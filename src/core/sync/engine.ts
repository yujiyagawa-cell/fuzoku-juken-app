import { db, type SyncMarks, type SyncStateRow } from '../db';
import * as dirty from './dirty';
import { describeSyncError, cursorAfter, type Cursor, type ListenMeta, type Remote, type RemoteDoc, type RemoteRow } from './remote';
import { DELETED, fromShared, hashStr, MAX_ROW_CHARS, rowKey, SETTINGS_REMOTE_EVENT, sharedJson, splitRowKey, SYNC_TABLE_SET, SYNC_TABLES } from './rows';

// 記録の共有：このスマホ（Dexie）と、ネット上の保存先（Remote）をそろえる。
//
// ・受けとる：保存先の行を、前に受けとった時刻（cursor）より新しいものだけ受けとり、このスマホに入れる。
//   このスマホでまだ送っていない変更の方が新しいときは、このスマホの方を残す（あとで送る）。
// ・送る：このスマホで変わった行（dirty.ts）を送る。最後にそろえたときと中身が同じなら送らない。
// ・はじめて共有を始めたとき・表をまるごと消したとき：保存先の行を全部受けとり（同じ行は保存先の方に合わせる）、
//   保存先にない行を送る。
// ・消した行は「消した」というしるしを送る（ほかのスマホでも消える）。

export interface EngineReport {
  connected?: boolean;
  lastAt?: number;
  error?: string;
  peerAt?: number; // ほかのスマホから届いた、いちばん新しい変更の時刻（そのスマホで変えた時刻）
}

const CURSOR_KEY = 'cursor';
/** 受けとり（cursor）を進めたときに、このアプリが共有していた表の一覧 */
const TABLES_KEY = 'tables';
/** ほかのスマホから届いた、いちばん新しい変更の時刻 */
const PEER_KEY = 'peer';

export async function readCursor(): Promise<Cursor | null> {
  const v = (await db.syncMeta.get(CURSOR_KEY))?.value as Cursor | undefined;
  return v && typeof v.s === 'number' && typeof v.n === 'number' ? v : null;
}

export interface EngineOptions {
  debounceMs?: number; // 変わってから送るまで
  retryMs?: number; // 失敗したあと、もう一度ためすまで
  readOnly?: boolean; // 見る専用：受けとるだけで、何も送らない
}

export class SyncEngine {
  private chain: Promise<unknown> = Promise.resolve();
  private unlisten: (() => void) | null = null;
  private offDirty: (() => void) | null = null;
  private scanned = false;
  private pushing: Promise<void> | null = null;
  private pushAgain = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private relistenTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(
    private readonly remote: Remote,
    private readonly deviceId: string,
    private readonly report: (r: EngineReport) => void,
    private readonly opts: EngineOptions = {}
  ) {}

  /** このスマホの読み書きを1つずつ順番にする */
  private run<T>(job: () => Promise<T>): Promise<T> {
    const p = this.chain.then(job, job);
    this.chain = p.catch(() => undefined);
    return p;
  }

  async start(): Promise<void> {
    const peer = (await db.syncMeta.get(PEER_KEY))?.value;
    if (typeof peer === 'number') this.report({ peerAt: peer });
    await this.remote.connect();
    if (this.stopped) return;
    await this.run(() => this.resetCleared());
    await this.run(() => this.checkTables());
    this.listen(await readCursor());
    this.offDirty = dirty.onDirtyChange(() => {
      if (dirty.hasCleared()) void this.run(() => this.resync()).catch((e) => this.fail(e));
      if (dirty.dirtyCount() > 0) this.schedulePush();
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    clearTimeout(this.relistenTimer);
    this.unlisten?.();
    this.unlisten = null;
    this.offDirty?.();
    this.offDirty = null;
    await this.chain.catch(() => undefined);
    await this.remote.close();
  }

  /** いますぐ そろえる（受けとりが止まっていたら、つなぎ直す） */
  async syncNow(): Promise<void> {
    if (this.stopped) return;
    if (!this.unlisten) this.listen(await readCursor());
    if (this.scanned) await this.pushNow();
  }

  private listen(after: Cursor | null): void {
    this.unlisten?.();
    this.scanned = false;
    this.unlisten = this.remote.listen(
      after,
      (docs, meta) => {
        void this.run(() => this.onRemote(docs, meta)).catch((e) => this.fail(e));
      },
      (e) => this.onListenError(e)
    );
  }

  private onListenError(e: unknown): void {
    this.unlisten = null;
    this.report({ error: describeSyncError(e), connected: false });
    if (this.stopped) return;
    clearTimeout(this.relistenTimer);
    this.relistenTimer = setTimeout(() => {
      if (!this.stopped && !this.unlisten) void readCursor().then((c) => !this.stopped && !this.unlisten && this.listen(c));
    }, this.opts.retryMs ?? 30_000);
  }

  private fail(e: unknown): void {
    this.report({ error: describeSyncError(e) });
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.schedulePush(0);
    }, this.opts.retryMs ?? 30_000);
  }

  // ---- 受けとる ----

  private async onRemote(docs: RemoteDoc[], meta: ListenMeta): Promise<void> {
    if (this.stopped) return;
    const peerAt = docs.length ? await this.apply(docs) : undefined;
    if (peerAt !== undefined) this.report({ peerAt });
    if (!meta.fromServer) {
      this.report({ connected: false });
      return;
    }
    this.report({ connected: true, lastAt: Date.now(), error: '' });
    if (!this.scanned) {
      // 保存先の内容を受けとったあとで、このスマホの全部の行を見直す（送りもれ・共有していないあいだの変更）
      this.scanned = true;
      if (this.opts.readOnly) return; // 見る専用：送らない
      await this.fullScan();
      this.schedulePush(0);
    }
  }

  /** 受けとった行をこのスマホに入れる。ほかのスマホの変更が新しく届いたら、その時刻を返す */
  private async apply(docs: RemoteDoc[]): Promise<number | undefined> {
    let cursor = await readCursor();
    const done: [string, number][] = [];
    let settingsChanged = false;
    let peerAt: number | undefined;
    const tables = SYNC_TABLES.map((t) => db.table(t));
    await db.transaction('rw', [...tables, db.syncState, db.syncMeta], async (tx) => {
      // このトランザクションの書きこみは「このスマホの変更」としておぼえない（db.ts の見張り）
      (tx as unknown as SyncMarks).__fzSync = true;
      (tx.idbtrans as unknown as SyncMarks).__fzSync = true;
      const prevPeer = (await db.syncMeta.get(PEER_KEY))?.value;
      let peer = typeof prevPeer === 'number' ? prevPeer : 0;
      for (const d of docs) {
        if (cursorAfter(d.at, cursor)) cursor = d.at;
        if (!SYNC_TABLE_SET.has(d.t)) continue;
        if (d.d && d.d !== this.deviceId && d.u > peer) {
          peer = d.u;
          peerAt = d.u;
        }
        const rk = rowKey(d.t, d.k);
        const mine = dirty.dirtyTime(rk);
        if (mine !== undefined && mine > d.u) continue; // このスマホの変更の方が新しい → あとで送る
        const table = db.table(d.t);
        const local = await table.get(d.k);
        let h: string;
        if (d.del) {
          h = DELETED;
          if (local !== undefined) await table.delete(d.k);
        } else {
          h = hashStr(d.j);
          if (local === undefined || sharedJson(d.t, local).h !== h) {
            let row: unknown;
            try {
              row = JSON.parse(d.j);
            } catch {
              continue;
            }
            await table.put(fromShared(d.t, row, local));
            if (d.t === 'settings') settingsChanged = true;
          }
        }
        await db.syncState.put({ k: rk, h, u: d.u });
        if (mine !== undefined) done.push([rk, mine]);
      }
      if (cursor) await db.syncMeta.put({ key: CURSOR_KEY, value: cursor });
      if (peerAt !== undefined) await db.syncMeta.put({ key: PEER_KEY, value: peerAt });
    });
    for (const [rk, at] of done) dirty.clearDirty(rk, at);
    if (settingsChanged && typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_REMOTE_EVENT));
    return peerAt;
  }

  /**
   * 共有する表が、受けとりを進めたときとちがう（アプリの新しい版で表がふえた）→ 保存先から全部受けとり直す。
   * 前の版は知らない表の行を読みとばして、受けとり（cursor）だけ先へ進めているので、そのままでは二度と届かない
   * （新しい版に入れかわる前の数秒に、ほかのスマホの録音が届いたときなど）。
   * 受けとり直しても、同じ中身の行は書きかえない。
   */
  private async checkTables(): Promise<void> {
    const want = SYNC_TABLES.join(',');
    if ((await db.syncMeta.get(TABLES_KEY))?.value === want) return;
    await db.transaction('rw', db.syncMeta, async () => {
      await db.syncMeta.delete(CURSOR_KEY);
      await db.syncMeta.put({ key: TABLES_KEY, value: want });
    });
  }

  /** 表をまるごと消した（JSON の読み込みなど）→ その表の「そろえた記録」を忘れて、保存先から全部受けとり直す */
  private async resetCleared(): Promise<boolean> {
    const cleared = dirty.takeCleared();
    if (!cleared.length) return false;
    await db.transaction('rw', db.syncState, db.syncMeta, async () => {
      for (const t of cleared) await db.syncState.where('k').startsWith(`${t}~`).delete();
      await db.syncMeta.delete(CURSOR_KEY);
    });
    return true;
  }

  private async resync(): Promise<void> {
    if (this.stopped) return;
    if (await this.resetCleared()) this.listen(null);
  }

  /** このスマホの全部の行を、最後にそろえたときと見くらべる（変わった行・消した行にしるしをつける） */
  private async fullScan(): Promise<void> {
    const known = new Map((await db.syncState.toArray()).map((s) => [s.k, s] as const));
    const marks: string[] = [];
    for (const t of SYNC_TABLES) {
      await db.table(t).each((row: unknown, cursor: { primaryKey: unknown }) => {
        const rk = rowKey(t, String(cursor.primaryKey));
        const s = known.get(rk);
        known.delete(rk);
        if (dirty.dirtyTime(rk) !== undefined) return;
        if (!s || s.h !== sharedJson(t, row).h) marks.push(rk);
      });
    }
    // そろえたことがあるのに、このスマホにはない行（共有していないあいだに消した）
    for (const [rk, s] of known) {
      if (s.h !== DELETED && dirty.dirtyTime(rk) === undefined && SYNC_TABLE_SET.has(splitRowKey(rk)[0])) marks.push(rk);
    }
    if (marks.length) dirty.markRowKeys(marks);
  }

  // ---- 送る ----

  schedulePush(delay = this.opts.debounceMs ?? 1500): void {
    if (this.stopped || !this.scanned || this.opts.readOnly) return; // 保存先の内容を受けとるまでは送らない（見る専用は送らない）
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.pushNow();
    }, delay);
  }

  pushNow(): Promise<void> {
    if (this.stopped || !this.scanned || this.opts.readOnly) return Promise.resolve();
    if (this.pushing) {
      this.pushAgain = true;
      return this.pushing;
    }
    this.pushing = this.pushLoop().finally(() => {
      this.pushing = null;
    });
    return this.pushing;
  }

  private async pushLoop(): Promise<void> {
    for (let round = 0; round < 10 && !this.stopped; round++) {
      this.pushAgain = false;
      const entries = dirty.dirtyEntries();
      if (!entries.length) return;
      const batch = await this.run(() => this.collect(entries));
      if (batch.rows.length) {
        try {
          await this.remote.push(batch.rows);
        } catch (e) {
          this.fail(e);
          return;
        }
        await this.run(() => db.syncState.bulkPut(batch.states));
        for (const s of batch.states) dirty.clearDirty(s.k, s.u);
        this.report({ lastAt: Date.now(), error: '' });
      }
      if (!this.pushAgain && dirty.dirtyCount() === 0) return;
    }
  }

  private async collect(entries: [string, number][]): Promise<{ rows: RemoteRow[]; states: SyncStateRow[] }> {
    const rows: RemoteRow[] = [];
    const states: SyncStateRow[] = [];
    const known = await db.syncState.bulkGet(entries.map(([rk]) => rk));
    for (let i = 0; i < entries.length; i++) {
      const [rk, at] = entries[i];
      const [t, k] = splitRowKey(rk);
      if (!SYNC_TABLE_SET.has(t)) {
        dirty.clearDirty(rk, at);
        continue;
      }
      const st = known[i];
      const local = await db.table(t).get(k);
      if (local === undefined) {
        if (st && st.h !== DELETED) {
          rows.push({ t, k, j: '', del: true, u: at, d: this.deviceId });
          states.push({ k: rk, h: DELETED, u: at });
        } else dirty.clearDirty(rk, at);
        continue;
      }
      const { j, h } = sharedJson(t, local);
      if ((st && st.h === h) || j.length > MAX_ROW_CHARS) {
        // 変わっていない／大きすぎる（描いた絵など）→ 送らない
        dirty.clearDirty(rk, at);
        continue;
      }
      rows.push({ t, k, j, del: false, u: at, d: this.deviceId });
      states.push({ k: rk, h, u: at });
    }
    return { rows, states };
  }

  /** テスト用：受けとり・送りが落ち着くまで待つ（送るのを待っている行も、すぐ送る） */
  async whenIdle(): Promise<void> {
    let quiet = 0;
    for (let i = 0; i < 200 && quiet < 3; i++) {
      await this.chain;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
        await this.pushNow();
        quiet = 0;
        continue;
      }
      if (this.pushing) {
        await this.pushing;
        quiet = 0;
        continue;
      }
      await new Promise((r) => setTimeout(r, 5));
      quiet++;
    }
  }
}
