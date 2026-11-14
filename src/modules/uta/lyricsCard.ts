import { toHiragana } from '../../core/kana';
import { tokenize, type TokenLite } from '../../core/reading';

// うたのカード：保護者が貼りつけた歌詞を、ひらがなにして、A4 にちょうどよく入れる
// （歌詞そのものはアプリに入れない。このスマホの中だけに保存する）

const KANJI = /[一-鿿々〆]/;
const KATAKANA = /[ァ-ヺ]/;

/** 形態素ごとに：漢字をふくむものは読み（ひらがな）、カタカナはひらがな、それ以外はそのまま */
export function tokensToHiragana(tokens: Pick<TokenLite, 'surface' | 'reading'>[], katakana = true): string {
  let s = '';
  for (const t of tokens) {
    if (KANJI.test(t.surface)) s += t.reading || t.surface;
    else if (katakana && KATAKANA.test(t.surface)) s += toHiragana(t.surface);
    else s += t.surface;
  }
  return s;
}

/** 歌詞をひらがなにする（行・空白はそのまま） */
export async function lyricsToHiragana(text: string, katakana = true): Promise<string> {
  const lines = normalizeNewlines(text).split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      out.push('');
      continue;
    }
    out.push(tokensToHiragana(await tokenize(line), katakana));
  }
  return out.join('\n');
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

// ---- A4 に入れる大きさ ----
// 歌詞の入る場所（mm）：A4 から上の絵・題名と下のあまりを引いたところ
export const LYRICS_AREA = { w: 172, h: 180 };
const LINE_HEIGHT = 1.32;
const MAX_FONT_MM = 14;
const MIN_FONT_MM = 4;

/** 1行の長さ（全角1文字＝1。空白・半角は小さめに数える） */
export function lineWidth(line: string): number {
  let w = 0;
  for (const ch of line) {
    if (ch === ' ' || ch === '　') w += 0.5;
    else if (/[\x21-\x7e]/.test(ch)) w += 0.55;
    else w += 1;
  }
  return w;
}

export interface FittedLyrics {
  lines: string[];
  fontMm: number;
}

/** 行の数と長さから、はみ出さない文字の大きさを決める */
export function fitLyrics(text: string, area = LYRICS_AREA): FittedLyrics {
  const lines = normalizeNewlines(text)
    .split('\n')
    .map((l) => l.replace(/\s+$/u, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return { lines: [], fontMm: MAX_FONT_MM };
  const maxW = Math.max(1, ...lines.map(lineWidth));
  const byWidth = area.w / maxW;
  const byHeight = area.h / (lines.length * LINE_HEIGHT);
  const f = Math.max(MIN_FONT_MM, Math.min(MAX_FONT_MM, byWidth, byHeight));
  return { lines, fontMm: Math.floor(f * 10) / 10 };
}

export const LYRICS_LINE_HEIGHT = LINE_HEIGHT;
