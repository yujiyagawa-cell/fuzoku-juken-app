import { db, nowIso, TABLE_NAMES } from './db';
import { loadSettings, mergeSettings, saveSettings } from './settings';
import { disableSync, loadSyncConfig, toEnvSync, type EnvSync } from './sync';
import type { MySet, ReviewMark, Settings } from './types';

// ほかのスマホで同じ設定から始めるための「設定つきURL」
// - 入れるもの：子どもの情報・試験日・ルールなどの設定、問題カタログの評価、マイセット、うたの動画リンク、苦手な音
//   記録の共有をしているときは、共有先（Firebase の設定）も入れる → 開いたスマホも共有に入る
// - 入れないもの：記録（進捗）・描いた絵（大きいので、共有か「データの書き出し・読み込み」で移す）、声の種類（端末ごとにちがう）
// - URL の # のうしろに入れるので、サーバーには送られない（ただしリンクを見た人には中身が分かる）

export interface EnvSnapshot {
  v: 1;
  s: Partial<Settings>;
  r?: [string, ReviewMark | '', string?][]; // カタログの評価 [typeId, mark, note]
  m?: MySet[];
  l?: [string, string][]; // うたの動画 [songId, url]
  k?: [string, 2 | 3][]; // 苦手な音（手で足したもの）[kana, length]
  y?: EnvSync; // 記録の共有先
  ro?: 1; // 見る専用URL（開いたスマホは、共有の記録を受けとって見るだけ。何も送らない）
}

export async function buildEnvSnapshot(opts: { viewOnly?: boolean } = {}): Promise<EnvSnapshot> {
  const s = await loadSettings();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { voiceURI, onboarded, ...rest } = s;
  const [reviews, mySets, songLinks, seeds] = await Promise.all([db.reviews.toArray(), db.mySets.toArray(), db.songLinks.toArray(), db.kanaSeeds.toArray()]);
  const snap: EnvSnapshot = { v: 1, s: rest };
  const r = reviews.filter((x) => x.mark || x.note).map((x) => (x.note ? [x.typeId, x.mark, x.note] : [x.typeId, x.mark]) as [string, ReviewMark | '', string?]);
  if (r.length) snap.r = r;
  if (mySets.length) snap.m = mySets;
  if (songLinks.length) snap.l = songLinks.map((x) => [x.songId, x.url]);
  const k = seeds.filter((x) => x.source === 'manual').map((x) => [x.kana, x.length] as [string, 2 | 3]);
  if (k.length) snap.k = k;
  const sync = await loadSyncConfig();
  if (sync) snap.y = toEnvSync(sync.fb);
  if (opts.viewOnly && snap.y) snap.ro = 1; // 見る専用は、共有しているときだけ作れる
  return snap;
}

// ---- 文字列にする（短くするために deflate して base64url） ----
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeEnv(snap: EnvSnapshot): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(snap));
  if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + b64url(bytes);
}

export async function decodeEnv(code: string): Promise<EnvSnapshot> {
  const kind = code[0];
  const raw = unb64url(code.slice(1));
  let bytes: Uint8Array;
  if (kind === 'z') bytes = await pipe(raw, new DecompressionStream('deflate-raw'));
  else if (kind === 'j') bytes = raw;
  else throw new Error('unknown format');
  const o = JSON.parse(new TextDecoder().decode(bytes));
  if (!o || o.v !== 1 || typeof o.s !== 'object' || !o.s) throw new Error('bad snapshot');
  return o as EnvSnapshot;
}

// ---- URL ----
export function appBaseUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function envLinkUrl(code: string): string {
  return `${appBaseUrl()}#/start?env=${code}`;
}

export function freshLinkUrl(): string {
  return `${appBaseUrl()}#/start?fresh=1`;
}

// ---- 取りこむ ----
/** 設定つきURLの中身で、このスマホの設定を置きかえる（記録・絵はそのまま） */
export async function applyEnv(snap: EnvSnapshot): Promise<void> {
  const cur = await loadSettings();
  const next = mergeSettings({ ...cur, ...snap.s, voiceURI: cur.voiceURI, onboarded: true });
  const now = nowIso();
  await db.transaction('rw', [db.settings, db.reviews, db.mySets, db.songLinks, db.kanaSeeds], async () => {
    await saveSettings(next);
    await db.reviews.clear();
    if (snap.r?.length) await db.reviews.bulkPut(snap.r.map(([typeId, mark, note]) => ({ typeId, mark, note, updatedAt: now })));
    await db.mySets.clear();
    if (snap.m?.length) await db.mySets.bulkPut(snap.m);
    await db.songLinks.clear();
    if (snap.l?.length) await db.songLinks.bulkPut(snap.l.map(([songId, url]) => ({ songId, url })));
    const seeds = await db.kanaSeeds.toArray();
    await db.kanaSeeds.bulkDelete(seeds.filter((x) => x.source === 'manual').map((x) => x.key));
    if (snap.k?.length) await db.kanaSeeds.bulkPut(snap.k.map(([kana, length]) => ({ key: `${kana}-${length}`, kana, length, source: 'manual' as const, createdAt: now })));
  });
}

/** このスマホに記録や設定があるか（ゼロから始めるときに確かめる） */
export async function hasLocalData(): Promise<boolean> {
  const s = await loadSettings();
  if (s.onboarded) return true;
  for (const name of TABLE_NAMES) {
    if (name === 'settings') continue;
    if ((await db.table(name).count()) > 0) return true;
  }
  return false;
}

/** 記録・絵・設定をすべて消す（記録の共有もやめる。共有している記録は消さない） */
export async function wipeAll(): Promise<void> {
  await disableSync();
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
