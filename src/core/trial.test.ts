import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSession, makeSessionApi } from '../player/session';
import { db } from './db';
import { clearTrials } from './trial';

// おためし（見る専用のスマホでの練習）：ホームにもどったら、その練習の記録ごと消す。ふつうの練習の記録は残す。

const answer = { moduleId: 'kotoba', questionType: 'kotoba-2', prompt: 'か', answerMode: 'voice' as const, autoJudge: 'correct' as const };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('おためし', () => {
  it('おためしの練習の記録（答え・描いた絵・待機・録音）だけを消す', async () => {
    const trial = await createSession(['kotoba'], undefined, true);
    const real = await createSession(['kotoba'], undefined, false);
    expect((await db.sessions.get(trial))?.trial).toBe(true);
    expect((await db.sessions.get(real))?.trial).toBeUndefined();

    const t1 = await makeSessionApi(trial).record(answer);
    const r1 = await makeSessionApi(real).record(answer);
    await db.recordings.put({ id: 'rec-t', attemptId: t1.id, mime: 'audio/webm', dataUrl: 'data:,', durationMs: 1000, createdAt: '2026-11-16T00:00:00.000Z' });
    await db.recordings.put({ id: 'rec-r', attemptId: r1.id, mime: 'audio/webm', dataUrl: 'data:,', durationMs: 1000, createdAt: '2026-11-16T00:00:00.000Z' });
    await db.drawings.put({ id: 'd-t', shape: 'circle', pngDataUrl: 'data:,', starred: false, sessionId: trial, seconds: 10, createdAt: new Date().toISOString() } as never);
    await db.drawings.put({ id: 'd-r', shape: 'circle', pngDataUrl: 'data:,', starred: false, sessionId: real, seconds: 10, createdAt: new Date().toISOString() } as never);
    await db.waitingLogs.put({ id: 'w-t', sessionId: trial, durationMin: 1, elapsedSec: 60, counts: {}, success: true, completed: true, createdAt: new Date().toISOString() } as never);

    expect(await clearTrials()).toBeGreaterThan(0);

    expect(await db.sessions.get(trial)).toBeUndefined();
    expect(await db.attempts.get(t1.id)).toBeUndefined();
    expect(await db.recordings.get('rec-t')).toBeUndefined();
    expect(await db.drawings.get('d-t')).toBeUndefined();
    expect(await db.waitingLogs.get('w-t')).toBeUndefined();

    expect(await db.sessions.get(real)).toBeDefined();
    expect(await db.attempts.get(r1.id)).toBeDefined();
    expect(await db.recordings.get('rec-r')).toBeDefined();
    expect(await db.drawings.get('d-r')).toBeDefined();

    expect(await clearTrials()).toBe(0);
  });

  it('消したあとに書かれた おためしの答え（練習の途中でホームにもどったとき）も、次に消す', async () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    try {
      const trial = await createSession(['kotoba'], undefined, true);
      await clearTrials();
      const late = await makeSessionApi(trial).record(answer); // おそく書かれた答え
      expect(await db.attempts.get(late.id)).toBeDefined();
      await clearTrials();
      expect(await db.attempts.get(late.id)).toBeUndefined();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
