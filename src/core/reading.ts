import { isKanaOnly, normalizeReading, toHiragana } from './kana';

// 聞こえた言葉（漢字まじり）を読み（ひらがな）にする。kuromoji を使う。
// 辞書は public/dict/*.dat.gz。サーバーが gzip を自動で展開して返す場合にも対応する。

export interface TokenLite {
  surface: string;
  reading: string; // ひらがな（読みが無いときは表層をひらがな化）
  pos: string; // 名詞・動詞・助詞…
  pos1: string;
}

type TokenizerLike = { tokenize(text: string): any[] };

let tokenizerPromise: Promise<TokenizerLike> | null = null;
let loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const listeners = new Set<() => void>();

export function readingLoadState() {
  return loadState;
}
export function onReadingState(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(s: typeof loadState) {
  loadState = s;
  listeners.forEach((f) => f());
}

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const u = new Uint8Array(buf);
  if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
    const ds = new (window as any).DecompressionStream('gzip');
    const stream = new Blob([u]).stream().pipeThrough(ds);
    return await new Response(stream).arrayBuffer();
  }
  return buf; // すでに展開済み
}

async function loadFile(name: string): Promise<ArrayBuffer> {
  const base = `${import.meta.env.BASE_URL}dict/`;
  const res = await fetch(base + name);
  if (!res.ok) throw new Error(`dict ${name}: ${res.status}`);
  return gunzipIfNeeded(await res.arrayBuffer());
}

export function loadTokenizer(): Promise<TokenizerLike> {
  if (tokenizerPromise) return tokenizerPromise;
  setState('loading');
  tokenizerPromise = (async () => {
    const [{ default: DynamicDictionaries }, { default: Tokenizer }] = await Promise.all([
      import('kuromoji/src/dict/DynamicDictionaries.js'),
      import('kuromoji/src/Tokenizer.js')
    ]);
    const dic = new DynamicDictionaries();
    const [base, check] = await Promise.all(['base.dat.gz', 'check.dat.gz'].map(loadFile));
    dic.loadTrie(new Int32Array(base), new Int32Array(check));
    const [tid, tidPos, tidMap] = await Promise.all(['tid.dat.gz', 'tid_pos.dat.gz', 'tid_map.dat.gz'].map(loadFile));
    dic.loadTokenInfoDictionaries(new Uint8Array(tid), new Uint8Array(tidPos), new Uint8Array(tidMap));
    const cc = await loadFile('cc.dat.gz');
    dic.loadConnectionCosts(new Int16Array(cc));
    const unk = await Promise.all(
      ['unk.dat.gz', 'unk_pos.dat.gz', 'unk_map.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz', 'unk_invoke.dat.gz'].map(loadFile)
    );
    dic.loadUnknownDictionaries(
      new Uint8Array(unk[0]),
      new Uint8Array(unk[1]),
      new Uint8Array(unk[2]),
      new Uint8Array(unk[3]),
      new Uint32Array(unk[4]),
      new Uint8Array(unk[5])
    );
    const tokenizer = new Tokenizer(dic);
    setState('ready');
    return tokenizer as TokenizerLike;
  })().catch((e) => {
    console.error('kuromoji load failed', e);
    tokenizerPromise = null;
    setState('error');
    throw e;
  });
  return tokenizerPromise;
}

export async function tokenize(text: string): Promise<TokenLite[]> {
  const t = await loadTokenizer();
  return t.tokenize(text).map((tk: any) => {
    const surface: string = tk.surface_form ?? '';
    const reading: string = tk.reading && tk.reading !== '*' ? tk.reading : surface;
    return {
      surface,
      reading: toHiragana(reading),
      pos: tk.pos ?? '',
      pos1: tk.pos_detail_1 ?? ''
    };
  });
}

const TRAIL_POS = new Set(['助動詞', '助詞', '記号', 'フィラー', '感動詞']);
// 「えっと」は「えっ（感動詞）＋と（助詞）」に分かれるので、頭の助詞も外す
const LEAD_POS = new Set(['フィラー', '感動詞', '記号', '接続詞', '助詞']);

const FILLERS = new Set([
  'えっと', 'えーと', 'えーっと', 'えと', 'えっとね', 'えーとね', 'あのね', 'あの', 'あのー', 'あのう', 'うーん', 'うーんと',
  'うん', 'えー', 'え', 'あー', 'あ', 'んー', 'ん', 'んと', 'んーと', 'そうだな', 'そうですね', 'はい'
]);
const TRAIL_WORDS = /(ですか|です|でした|でーす|だよ|だね|かな|だと)$/u;

/**
 * かなだけの答え（音声認識がひらがなで返したとき）の候補。
 * 区切り（、 や空白）で分けて、「えっと」などのつなぎの言葉は外し、終わりの「です」などを外す。
 * 1文字の終わり（ね・よ・だ）は外さない（きつね・ふね が壊れるため）。
 */
export function kanaOnlyCandidates(text: string): string[] {
  const out: string[] = [];
  const segs = text
    .split(/[、。,.\s！？!?・]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segs) {
    if (FILLERS.has(toHiragana(seg))) continue;
    const s = normalizeReading(seg.replace(TRAIL_WORDS, ''));
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * 答えの候補（ひらがな）を作る。
 * - 名詞それぞれの読み
 * - 続いている名詞をつないだ読み
 * - 文の頭と終わりの「えっと」「です」などを外した全体の読み
 */
export async function answerCandidates(text: string): Promise<string[]> {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = normalizeReading(s);
    if (n) out.add(n);
  };
  if (isKanaOnly(text)) kanaOnlyCandidates(text).forEach(add);
  let tokens: TokenLite[];
  try {
    tokens = await tokenize(text);
  } catch {
    return Array.from(out);
  }
  let run = '';
  for (const t of tokens) {
    if (t.pos === '名詞') {
      add(t.reading);
      run += t.reading;
    } else {
      if (run) add(run);
      run = '';
    }
  }
  if (run) add(run);
  let s = 0;
  let e = tokens.length;
  while (s < e && LEAD_POS.has(tokens[s].pos)) s++;
  while (e > s && TRAIL_POS.has(tokens[e - 1].pos)) e--;
  if (e > s) add(tokens.slice(s, e).map((t) => t.reading).join(''));
  return Array.from(out);
}

/** 文全体の読み（ひらがな） */
export async function fullReading(text: string): Promise<string> {
  try {
    const tokens = await tokenize(text);
    return normalizeReading(tokens.map((t) => t.reading).join(''));
  } catch {
    return normalizeReading(text);
  }
}
