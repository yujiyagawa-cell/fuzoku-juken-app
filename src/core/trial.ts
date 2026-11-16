import { db } from './db';
import { getSyncStatus } from './sync';

// おためし：見る専用のスマホでも、タイルから練習をためせる（どんな問題があるかを見るため）。
// 練習のしくみは そのまま動かし（結果の画面も出る）、そのスマホの中に書いた記録は、ホームにもどったときに消す。
// 見る専用のスマホは何も送らないので、おためしの記録が ほかのスマホに届くことはない。
// 練習の途中でホームにもどると、消したあとに答えが書かれることがあるので、おためしの ID はしばらくおぼえておき、毎回消す。

const KEY = 'fz-trial-sessions';
const KEEP = 100;

function readIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-KEEP)));
  } catch {
    /* noop */
  }
}

/** このスマホでの練習を、おためしにするか（見る専用のスマホ） */
export function isTrialDevice(): boolean {
  return getSyncStatus().viewOnly;
}

/** おためしの練習をおぼえる（あとで、その記録を消すため） */
export function rememberTrial(sessionId: string): void {
  const ids = readIds();
  if (!ids.includes(sessionId)) writeIds([...ids, sessionId]);
}

/** おためしの練習（セッション）と、その記録（答え・描いた絵・待機・録音）を消す。消した行の数を返す */
export async function clearTrials(): Promise<number> {
  const flaggedRows = await db.sessions.filter((s) => !!s.trial).toArray();
  const flagged = flaggedRows.map((s) => s.id);
  const ids = [...new Set([...readIds(), ...flagged])];
  if (!ids.length) return 0;
  const idSet = new Set(ids);
  // 描いた絵・待機の記録は sessionId の索引がないので、おためしを始めたころより新しいものだけ見る（絵は大きいので全部は読まない）
  const starts = flaggedRows.map((s) => Date.parse(s.startedAt)).filter((t) => Number.isFinite(t));
  const since = new Date(Math.min(Date.now() - 86_400_000, ...starts)).toISOString();
  let n = 0;
  await db.transaction('rw', [db.sessions, db.attempts, db.drawings, db.waitingLogs, db.recordings], async () => {
    const attemptIds = (await db.attempts.where('sessionId').anyOf(ids).primaryKeys()) as string[];
    if (attemptIds.length) {
      n += await db.recordings.where('attemptId').anyOf(attemptIds).delete();
      await db.attempts.bulkDelete(attemptIds);
      n += attemptIds.length;
    }
    n += await db.drawings
      .where('createdAt')
      .aboveOrEqual(since)
      .filter((d) => !!d.sessionId && idSet.has(d.sessionId))
      .delete();
    n += await db.waitingLogs
      .where('createdAt')
      .aboveOrEqual(since)
      .filter((w) => !!w.sessionId && idSet.has(w.sessionId))
      .delete();
    n += flagged.length;
    await db.sessions.bulkDelete(ids);
  });
  writeIds(ids);
  return n;
}
