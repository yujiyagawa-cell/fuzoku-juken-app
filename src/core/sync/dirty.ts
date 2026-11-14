import { rowKey } from './rows';

// 記録の共有：このスマホで変わった行を覚えておく。
// db.ts の見張り（ミドルウェア）が書きこむ。アプリを閉じても残るよう localStorage にも書く。
// 書きもれがあっても、共有を始めるたびに全部の行を見直すので、あとで送られる（engine.ts の fullScan）。

const LS_ON = 'fz-sync-on';
const LS_DIRTY = 'fz-sync-dirty';
const LS_CLEARED = 'fz-sync-cleared';

function lsGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* 保存できない（プライベートモードなど）→ メモリだけで続ける */
  }
}

function readJson<T>(key: string, fallback: T): T {
  const s = lsGet(key);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

let tracking = lsGet(LS_ON) === '1';
const dirty = new Map<string, number>(Object.entries(readJson<Record<string, number>>(LS_DIRTY, {})));
const cleared = new Set<string>(readJson<string[]>(LS_CLEARED, []));
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistNow(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  lsSet(LS_DIRTY, dirty.size ? JSON.stringify(Object.fromEntries(dirty)) : null);
  lsSet(LS_CLEARED, cleared.size ? JSON.stringify([...cleared]) : null);
}

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(persistNow, 300);
}

function notify(): void {
  for (const f of listeners) f();
}

/** 共有中か（変わった行を覚えるか） */
export function isTracking(): boolean {
  return tracking;
}

export function setTracking(on: boolean): void {
  tracking = on;
  lsSet(LS_ON, on ? '1' : null);
  if (!on) {
    dirty.clear();
    cleared.clear();
  }
  persistNow();
  notify();
}

/** 行が変わった（at = 変わった時刻 ms） */
export function markDirty(table: string, keys: readonly unknown[], at = Date.now()): void {
  if (!tracking) return;
  let n = 0;
  for (const k of keys) {
    if (k === undefined || k === null) continue;
    dirty.set(rowKey(table, String(k)), at);
    n++;
  }
  if (!n) return;
  schedulePersist();
  notify();
}

/** 行キーで直接しるしをつける（見直しで見つけたとき） */
export function markRowKeys(rks: readonly string[], at = Date.now()): void {
  if (!tracking || !rks.length) return;
  for (const rk of rks) dirty.set(rk, at);
  schedulePersist();
  notify();
}

/** 表をまるごと消した（JSON の読み込み・設定つきURL など）→ 共有の内容と合わせ直す */
export function markCleared(table: string): void {
  if (!tracking) return;
  cleared.add(table);
  persistNow();
  notify();
}

export function dirtyTime(rk: string): number | undefined {
  return dirty.get(rk);
}

export function dirtyEntries(): [string, number][] {
  return [...dirty];
}

export function dirtyCount(): number {
  return dirty.size;
}

/** 送り終わった行のしるしを消す（ifAt：その時刻のしるしのときだけ。送っている間にまた変わったら残す） */
export function clearDirty(rk: string, ifAt?: number): void {
  if (!dirty.has(rk)) return;
  if (ifAt !== undefined && dirty.get(rk) !== ifAt) return;
  dirty.delete(rk);
  schedulePersist();
  notify();
}

export function hasCleared(): boolean {
  return cleared.size > 0;
}

export function takeCleared(): string[] {
  const out = [...cleared];
  cleared.clear();
  persistNow();
  return out;
}

export function onDirtyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** すぐに保存する（アプリが裏に回るとき） */
export function flushDirty(): void {
  persistNow();
}
