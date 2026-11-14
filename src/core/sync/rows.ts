// 記録の共有（スマホどうし）で使う、表と行の決まりごと。
// Dexie にも Firebase にも依存しない（db.ts からも読み込む）。

/** 共有する表（db.ts の TABLE_NAMES と同じ。共有の管理用の syncMeta・syncState は入れない） */
export const SYNC_TABLES = [
  'settings',
  'sessions',
  'attempts',
  'drawings',
  'waitingLogs',
  'practiceLogs',
  'mySets',
  'reviews',
  'songLinks',
  'ideas',
  'kanaSeeds',
  'songTexts'
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export const SYNC_TABLE_SET: ReadonlySet<string> = new Set<string>(SYNC_TABLES);

/** 端末ごとにちがう設定（共有しない） */
const DEVICE_SETTING_KEYS = ['voiceURI', 'onboarded'] as const;

/** 共有から設定が届いたときに出すイベント（settings.tsx が読み直す） */
export const SETTINGS_REMOTE_EVENT = 'fz-settings-remote';

/** 消した行のしるし（syncState.h に入れる） */
export const DELETED = 'DEL';

/** 1行の大きさの上限（Firestore の1件は 1MiB まで。描いた絵がこれより大きいときは送らない） */
export const MAX_ROW_CHARS = 900_000;

/** 行のキー（表の名前 ~ 主キー） */
export function rowKey(table: string, key: string): string {
  return `${table}~${key}`;
}

export function splitRowKey(rk: string): [string, string] {
  const i = rk.indexOf('~');
  return i < 0 ? [rk, ''] : [rk.slice(0, i), rk.slice(i + 1)];
}

/** Firestore の文書 ID（「/」は使えないので、主キーはエンコードする） */
export function docIdOf(table: string, key: string): string {
  return `${table}~${encodeURIComponent(key)}`;
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      if (o[k] !== undefined) out[k] = sortDeep(o[k]);
    }
    return out;
  }
  return v;
}

/** キーの順番をそろえた JSON（中身が同じなら、同じ文字列になる） */
export function canonical(v: unknown): string {
  return JSON.stringify(sortDeep(v));
}

/** 文字列のハッシュ（cyrb53。変わったかどうかを見るだけなので、暗号用ではない） */
export function hashStr(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** 共有する形にする（設定は、端末ごとの項目を抜く） */
export function toShared(table: string, row: unknown): unknown {
  if (table === 'settings' && row && typeof row === 'object' && 'value' in row) {
    const r = row as { value?: Record<string, unknown> };
    const value = { ...(r.value || {}) };
    for (const k of DEVICE_SETTING_KEYS) delete value[k];
    return { ...r, value };
  }
  return row;
}

/** 共有の形から、この端末の行にもどす（端末ごとの項目は、いまの値を残す） */
export function fromShared(table: string, shared: unknown, local: unknown): unknown {
  if (table === 'settings' && shared && typeof shared === 'object' && 'value' in shared) {
    const s = shared as { value?: Record<string, unknown> };
    const lv = ((local as { value?: Record<string, unknown> } | undefined)?.value || {}) as Record<string, unknown>;
    return { ...s, value: { ...(s.value || {}), voiceURI: lv.voiceURI ?? '', onboarded: lv.onboarded ?? true } };
  }
  return shared;
}

/** 行を共有用の JSON とハッシュにする */
export function sharedJson(table: string, row: unknown): { j: string; h: string } {
  const j = canonical(toShared(table, row));
  return { j, h: hashStr(j) };
}
