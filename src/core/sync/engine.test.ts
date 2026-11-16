import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import * as dirty from './dirty';
import { readCursor, SyncEngine, type EngineReport } from './engine';
import { markAllLocal } from './index';
import { cursorAfter, type Cursor, type ListenMeta, type Remote, type RemoteDoc, type RemoteRow } from './remote';
import { docIdOf, sharedJson } from './rows';

// 記録の共有のしくみを、メモリの中の「にせの保存先」で確かめる。
// このスマホ＝SyncEngine、ほかのスマホ＝ remote.external() で保存先に直接書く。

type Listener = { after: Cursor | null; onDocs: (docs: RemoteDoc[], meta: ListenMeta) => void };

class FakeRemote implements Remote {
  docs = new Map<string, RemoteDoc>();
  pushes: RemoteRow[][] = [];
  private clock = 0;
  private listeners = new Set<Listener>();

  async connect(): Promise<void> {}

  private write(rows: RemoteRow[]): RemoteDoc[] {
    const out: RemoteDoc[] = [];
    for (const r of rows) {
      const d: RemoteDoc = { ...r, at: { s: ++this.clock, n: 0 } };
      this.docs.set(docIdOf(r.t, r.k), d);
      out.push(d);
    }
    // 本物と同じく、受けとり口ごとに、受けとりを始めた位置より新しい行だけ配る
    setTimeout(() => {
      for (const l of this.listeners) {
        const docs = out.filter((d) => cursorAfter(d.at, l.after));
        if (docs.length) l.onDocs(docs, { fromServer: true });
      }
    }, 0);
    return out;
  }

  async push(rows: RemoteRow[]): Promise<void> {
    this.pushes.push(rows);
    this.write(rows);
  }

  /** ほかのスマホが書いた */
  external(rows: RemoteRow[]): RemoteDoc[] {
    return this.write(rows);
  }

  listen(after: Cursor | null, onDocs: Listener['onDocs']): () => void {
    const l: Listener = { after, onDocs };
    this.listeners.add(l);
    const initial = [...this.docs.values()].filter((d) => cursorAfter(d.at, after)).sort((a, b) => a.at.s - b.at.s);
    setTimeout(() => onDocs(initial, { fromServer: true }), 0);
    return () => {
      this.listeners.delete(l);
    };
  }

  async close(): Promise<void> {}

  rowOf(t: string, k: string): RemoteDoc | undefined {
    return this.docs.get(docIdOf(t, k));
  }

  pushedKeys(): string[] {
    return this.pushes.flat().map((r) => `${r.t}~${r.k}${r.del ? ' (del)' : ''}`);
  }
}

const attempt = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  sessionId: 's1',
  moduleId: 'kotoba',
  questionType: 'kotoba-2',
  prompt: 'か',
  answerMode: 'voice' as const,
  finalJudge: 'correct' as const,
  createdAt: '2026-11-14T00:00:00.000Z',
  ...extra
});

const settingsRow = (value: Record<string, unknown>) => ({ key: 'main', value });

function remoteRow(t: string, k: string, row: unknown, u: number, d = 'other'): RemoteRow {
  return { t, k, j: sharedJson(t, row).j, del: false, u, d };
}

/** 保存先の行を、このスマホが受けとり終わるまで待つ（送るのは待たない） */
async function waitApplied(docs: RemoteDoc[]): Promise<void> {
  const last = docs[docs.length - 1].at;
  for (let i = 0; i < 400; i++) {
    const c = await readCursor();
    if (c && !cursorAfter(last, c)) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('受けとりが終わらない');
}

let remote: FakeRemote;
let engine: SyncEngine | null = null;

async function startEngine(opts: { debounceMs?: number } = {}): Promise<SyncEngine> {
  dirty.setTracking(true);
  engine = new SyncEngine(remote, 'me', () => {}, { debounceMs: opts.debounceMs ?? 0, retryMs: 50 });
  await engine.start();
  await engine.whenIdle();
  return engine;
}

beforeEach(async () => {
  dirty.setTracking(false);
  await Promise.all(db.tables.map((t) => t.clear()));
  remote = new FakeRemote();
});

afterEach(async () => {
  await engine?.stop();
  engine = null;
  dirty.setTracking(false);
});

describe('記録の共有', () => {
  it('はじめると、このスマホの行を全部送る（声の種類・はじめての設定ずみ は送らない）', async () => {
    await db.settings.put(settingsRow({ childName: 'はな', voiceURI: 'voice-a', onboarded: true, tapTimeLimitSec: 10 }) as never);
    await db.attempts.put(attempt('a1') as never);
    await db.songTexts.put({ songId: 'zousan', text: 'うたの ことば', updatedAt: '2026-11-14T00:00:00.000Z' });
    await startEngine();

    expect(remote.docs.size).toBe(3);
    const s = JSON.parse(remote.rowOf('settings', 'main')!.j);
    expect(s.value.childName).toBe('はな');
    expect(s.value.voiceURI).toBeUndefined();
    expect(s.value.onboarded).toBeUndefined();
    expect(JSON.parse(remote.rowOf('songTexts', 'zousan')!.j).text).toBe('うたの ことば');
    expect(dirty.dirtyCount()).toBe(0);
  });

  it('変わった行だけを送る', async () => {
    await db.attempts.put(attempt('a1') as never);
    await startEngine();
    const before = remote.pushes.length;

    await db.attempts.update('a1', { parentJudge: 'wrong', finalJudge: 'wrong' });
    await db.attempts.put(attempt('a2') as never);
    await engine!.whenIdle();

    expect(remote.pushes.slice(before).flat().map((r) => r.k).sort()).toEqual(['a1', 'a2']);
    expect(JSON.parse(remote.rowOf('attempts', 'a1')!.j).finalJudge).toBe('wrong');
    expect(dirty.dirtyCount()).toBe(0);
  });

  it('ほかのスマホの行を受けとる（送り返さない）', async () => {
    await startEngine();
    const before = remote.pushes.length;

    remote.external([remoteRow('attempts', 'b1', attempt('b1', { prompt: 'さ' }), Date.now())]);
    await engine!.whenIdle();

    expect((await db.attempts.get('b1'))?.prompt).toBe('さ');
    expect(remote.pushes.length).toBe(before);
    expect(dirty.dirtyCount()).toBe(0);
  });

  it('設定を受けとっても、声の種類と はじめての設定ずみ は このスマホのまま', async () => {
    await db.settings.put(settingsRow({ childName: 'はな', voiceURI: 'my-voice', onboarded: true }) as never);
    await startEngine();
    const before = remote.pushes.length;

    remote.external([remoteRow('settings', 'main', settingsRow({ childName: 'たろう', voiceURI: 'other-voice', onboarded: false }), Date.now() + 1000)]);
    await engine!.whenIdle();

    const v = (await db.settings.get('main'))!.value as unknown as Record<string, unknown>;
    expect(v.childName).toBe('たろう');
    expect(v.voiceURI).toBe('my-voice');
    expect(v.onboarded).toBe(true);
    expect(remote.pushes.length).toBe(before);
  });

  it('消した行は、ほかのスマホでも消える', async () => {
    await db.attempts.bulkPut([attempt('a1'), attempt('a2')] as never);
    await startEngine();

    await db.attempts.delete('a1');
    await engine!.whenIdle();
    expect(remote.rowOf('attempts', 'a1')?.del).toBe(true);

    remote.external([{ t: 'attempts', k: 'a2', j: '', del: true, u: Date.now() + 1000, d: 'other' }]);
    await engine!.whenIdle();
    expect(await db.attempts.get('a2')).toBeUndefined();
    expect(remote.pushedKeys()).not.toContain('attempts~a2 (del)');
  });

  it('両方のスマホで変わったときは、新しい方を残す', async () => {
    await db.attempts.put(attempt('a1') as never);
    await startEngine({ debounceMs: 60_000 });

    const t0 = Date.now();
    await db.attempts.update('a1', { prompt: 'このスマホ' });
    // ほかのスマホの、もっと前の変更 → このスマホの方を残す
    await waitApplied(remote.external([remoteRow('attempts', 'a1', attempt('a1', { prompt: 'まえの変更' }), t0 - 60_000)]));
    expect((await db.attempts.get('a1'))?.prompt).toBe('このスマホ');

    // ほかのスマホの、あとの変更 → そちらに合わせる
    await waitApplied(remote.external([remoteRow('attempts', 'a1', attempt('a1', { prompt: 'あとの変更' }), t0 + 60_000)]));
    expect((await db.attempts.get('a1'))?.prompt).toBe('あとの変更');
    await engine!.whenIdle();
    expect(JSON.parse(remote.rowOf('attempts', 'a1')!.j).prompt).toBe('あとの変更');
  });

  it('JSON の読み込み（表をまるごと入れかえ）では、消したことにせず、共有の内容と合わせ直す', async () => {
    remote.external([remoteRow('attempts', 'x1', attempt('x1'), Date.now())]);
    await db.attempts.put(attempt('y1') as never);
    await startEngine();
    expect(remote.rowOf('attempts', 'y1')).toBeDefined();
    expect(await db.attempts.get('x1')).toBeDefined();

    await db.transaction('rw', db.attempts, async () => {
      await db.attempts.clear();
      await db.attempts.bulkPut([attempt('z1')] as never);
    });
    await engine!.whenIdle();

    expect(remote.pushedKeys().filter((k) => k.endsWith('(del)'))).toEqual([]);
    expect((await db.attempts.toArray()).map((a) => a.id).sort()).toEqual(['x1', 'y1', 'z1']);
    expect(remote.rowOf('attempts', 'z1')).toBeDefined();
  });

  it('あとから参加したスマホ：同じ行は共有の内容に合わせ、このスマホだけの行を送る', async () => {
    remote.external([
      remoteRow('settings', 'main', settingsRow({ childName: 'はな', tapTimeLimitSec: 10 }), Date.now() - 5000),
      remoteRow('songTexts', 'zousan', { songId: 'zousan', text: 'きょうゆうの歌詞', updatedAt: 'x' }, Date.now() - 5000)
    ]);
    await db.settings.put(settingsRow({ childName: 'はなこ', tapTimeLimitSec: 20, voiceURI: 'v', onboarded: true }) as never);
    await db.songTexts.put({ songId: 'zousan', text: 'このスマホの歌詞', updatedAt: 'y' });
    await db.attempts.put(attempt('c1') as never);
    await startEngine();

    const v = (await db.settings.get('main'))!.value as unknown as Record<string, unknown>;
    expect(v.childName).toBe('はな');
    expect(v.tapTimeLimitSec).toBe(10);
    expect(v.voiceURI).toBe('v');
    expect((await db.songTexts.get('zousan'))?.text).toBe('きょうゆうの歌詞');
    expect(JSON.parse(remote.rowOf('songTexts', 'zousan')!.j).text).toBe('きょうゆうの歌詞');
    expect(remote.rowOf('attempts', 'c1')?.d).toBe('me');
    expect(remote.pushedKeys()).toEqual(['attempts~c1']);
  });

  it('共有していないときは、変わった行をおぼえない', async () => {
    dirty.setTracking(false);
    await db.attempts.put(attempt('a1') as never);
    expect(dirty.dirtyCount()).toBe(0);
  });

  it('つなぎ直したときは、前に受けとったところから続ける', async () => {
    await startEngine();
    remote.external([remoteRow('attempts', 'b1', attempt('b1'), Date.now())]);
    await engine!.whenIdle();
    await engine!.stop();

    remote.external([remoteRow('attempts', 'b2', attempt('b2'), Date.now())]);
    engine = new SyncEngine(remote, 'me', () => {}, { debounceMs: 0, retryMs: 50 });
    await engine.start();
    await engine.whenIdle();
    expect((await db.attempts.toArray()).map((a) => a.id).sort()).toEqual(['b1', 'b2']);
    expect(remote.pushes.flat().length).toBe(0);
  });

  it('アプリの新しい版で共有する表がふえたら、保存先から全部受けとり直す（前の版が読みとばした録音など）', async () => {
    // 前の版が、知らない表（録音）の行を読みとばして、受けとり（cursor）だけ先へ進めた状態
    const rec = { id: 'r1', attemptId: 'b1', mime: 'audio/webm', dataUrl: 'data:audio/webm;base64,AAAA', durationMs: 1000, createdAt: '2026-11-15T00:00:00.000Z' };
    const docs = remote.external([remoteRow('recordings', 'r1', rec, Date.now())]);
    await db.syncMeta.put({ key: 'cursor', value: docs[docs.length - 1].at });
    await startEngine();
    expect((await db.recordings.get('r1'))?.attemptId).toBe('b1');
    expect(remote.pushes.flat().length).toBe(0);

    // 表が同じなら、受けとったところから続ける（全部は読み直さない）
    await engine!.stop();
    engine = null;
    const later = remote.external([remoteRow('attempts', 'b9', attempt('b9'), Date.now())]);
    await db.syncMeta.put({ key: 'cursor', value: later[0].at });
    await startEngine();
    expect(await db.attempts.get('b9')).toBeUndefined();
  });

  it('ほかのスマホから届いた いちばん新しい変更の時刻を知らせる（このスマホが送った行は数えない）', async () => {
    remote.external([remoteRow('attempts', 'b1', attempt('b1'), 1000), remoteRow('attempts', 'b2', attempt('b2'), 3000)]);
    remote.external([remoteRow('attempts', 'm1', attempt('m1'), 9000, 'me')]);
    const reports: EngineReport[] = [];
    const lastPeer = (list: EngineReport[]) => list.filter((r) => r.peerAt !== undefined).pop()?.peerAt;
    dirty.setTracking(true);
    engine = new SyncEngine(remote, 'me', (r) => reports.push(r), { debounceMs: 0, retryMs: 50 });
    await engine.start();
    await engine.whenIdle();
    expect(lastPeer(reports)).toBe(3000);

    await db.attempts.put(attempt('a1') as never); // このスマホの変更（送ったあと、自分の行として戻ってくる）
    await engine.whenIdle();
    expect(lastPeer(reports)).toBe(3000);

    // 開き直しても おぼえている（つながる前に知らせる）
    await engine.stop();
    const again: EngineReport[] = [];
    engine = new SyncEngine(remote, 'me', (r) => again.push(r), { debounceMs: 0, retryMs: 50 });
    await engine.start();
    expect(again[0]?.peerAt).toBe(3000);
  });

  it('このスマホの内容に そろえる：同じ行は このスマホの方が残って送られ、共有にしかない行は受けとる（記録は消えない）', async () => {
    // 先に共有に入っていたスマホの行
    const old = Date.now() - 60_000;
    remote.external([
      remoteRow('settings', 'main', settingsRow({ childName: 'ほかのスマホ', tapTimeLimitSec: 5 }), old),
      remoteRow('songTexts', 'zousan', { songId: 'zousan', text: 'ほかのスマホの歌詞', updatedAt: '2026-11-15T00:00:00.000Z' }, old),
      remoteRow('songTexts', 'kotori', { songId: 'kotori', text: 'ことりの歌詞', updatedAt: '2026-11-15T00:00:00.000Z' }, old),
      remoteRow('attempts', 'b1', attempt('b1'), old)
    ]);
    // 子どもが使ってきたスマホ（まだ共有に入っていない）
    await db.settings.put(settingsRow({ childName: 'このスマホ', tapTimeLimitSec: 10, voiceURI: 'v', onboarded: true }) as never);
    await db.songTexts.put({ songId: 'zousan', text: 'このスマホの歌詞', updatedAt: '2026-11-16T00:00:00.000Z' });
    await db.attempts.put(attempt('a1') as never);

    dirty.setTracking(true);
    expect(await markAllLocal()).toBe(3);
    await startEngine();

    const v = (await db.settings.get('main'))!.value as unknown as Record<string, unknown>;
    expect(v.childName).toBe('このスマホ');
    expect(v.voiceURI).toBe('v');
    expect((await db.songTexts.get('zousan'))?.text).toBe('このスマホの歌詞');
    expect((await db.songTexts.get('kotori'))?.text).toBe('ことりの歌詞');
    expect((await db.attempts.toArray()).map((a) => a.id).sort()).toEqual(['a1', 'b1']);

    expect(JSON.parse(remote.rowOf('settings', 'main')!.j).value.childName).toBe('このスマホ');
    expect(JSON.parse(remote.rowOf('songTexts', 'zousan')!.j).text).toBe('このスマホの歌詞');
    expect(remote.rowOf('attempts', 'a1')?.d).toBe('me');
    expect(remote.rowOf('attempts', 'b1')?.d).toBe('other');
    expect(dirty.dirtyCount()).toBe(0);
  });
});
