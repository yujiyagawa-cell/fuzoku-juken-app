import type { CSSProperties, ReactNode } from 'react';
import type { Rng } from '../../../core/rng';
import type { Choice } from '../../../player/types';
import { Emoji } from '../../../ui/emoji';

// 図形・推理 B とお話の記憶で使う、絵の部品と選択肢づくり

export const INK = '#1e2a3b';
export const GRID = '#d5dce7';
export const FILL = {
  blue: '#dceeff',
  yellow: '#fff2c6',
  green: '#e2f5e6',
  pink: '#ffe4ec',
  purple: '#eee6ff',
  orange: '#ffe8d9',
  gray: '#f0f3f8'
};
export const FILLS = [FILL.blue, FILL.yellow, FILL.green, FILL.pink, FILL.purple, FILL.orange];
export const WATER = '#8cc4f2';
export const EMOJI_FONT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';

export const FIG_STYLE: CSSProperties = { width: '100%', maxHeight: 230, display: 'block' };
export const CHOICE_STYLE: CSSProperties = { width: '100%', maxHeight: 110, display: 'block' };

/** SVG の中に絵文字を置く */
export function SvgEmoji({ x, y, char, size }: { x: number; y: number; char: string; size: number }) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: EMOJI_FONT }}>
      {char}
    </text>
  );
}

/** 数字と点のカード（数を答える選択肢） */
export function NumberCard({ n }: { n: number }) {
  const dots: ReactNode[] = [];
  const rows = n > 5 ? [5, n - 5] : [n];
  rows.forEach((cnt, r) => {
    const y = n > 5 ? 68 + r * 16 : 76;
    const x0 = 50 - ((cnt - 1) * 15) / 2;
    for (let i = 0; i < cnt; i++) dots.push(<circle key={`${r}-${i}`} cx={x0 + i * 15} cy={y} r={5.2} fill={INK} />);
  });
  return (
    <svg viewBox="0 0 100 96" style={{ width: '100%', maxHeight: 92, display: 'block' }} role="img" aria-label={`${n}`}>
      <text x={50} y={32} fontSize={40} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: 'inherit' }}>
        {n}
      </text>
      {dots}
    </svg>
  );
}

/** 数の選択肢（正解＋まちがえやすい数）。小さい順に並べる */
export function numberChoices(
  rng: Rng,
  answer: number,
  opts: { min: number; max: number; n?: number; traps?: number[] }
): { choices: Choice[]; answerId: string } {
  const n = opts.n ?? 4;
  const set = new Set<number>([answer]);
  const ok = (v: number) => v >= opts.min && v <= opts.max;
  for (const t of rng.shuffle(opts.traps ?? [])) if (ok(t) && set.size < n) set.add(t);
  for (const v of rng.shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3])) if (ok(v) && set.size < n) set.add(v);
  for (let v = opts.min; v <= opts.max && set.size < n; v++) set.add(v);
  const vals = [...set].sort((a, b) => a - b);
  return {
    choices: vals.map((v) => ({ id: `n${v}`, node: <NumberCard n={v} />, label: `${v}` })),
    answerId: `n${answer}`
  };
}

/** 絵文字の選択肢 */
export function emojiChoice(id: string, char: string, label: string, opts: { caption?: string; size?: number } = {}): Choice {
  return { id, node: <Emoji char={char} size={opts.size ?? 52} />, label, caption: opts.caption };
}

// ---- 位置のことば ----
const ROW_WORDS = ['いちばん うえ', 'うえから 2ばんめ', 'うえから 3ばんめ', 'うえから 4ばんめ', 'うえから 5ばんめ'];
export function rowLabel(i: number, what: string): string {
  return `${ROW_WORDS[i] ?? `うえから ${i + 1}ばんめ`}の ${what}`;
}
export function colLabel(i: number, what: string): string {
  return `ひだりから ${i + 1}ばんめの ${what}`;
}
const GRID2_WORDS = ['ひだり うえ', 'みぎ うえ', 'ひだり した', 'みぎ した'];
/** 2列×2行のときの位置 */
export function grid2Label(i: number, what: string): string {
  return `${GRID2_WORDS[i] ?? `${i + 1}ばんめ`}の ${what}`;
}

// ---- 季節 ----
export type SeasonId = 'haru' | 'natsu' | 'aki' | 'fuyu';
export const SEASONS: { id: SeasonId; kana: string; kanji: string; icon: string }[] = [
  { id: 'haru', kana: 'はる', kanji: '春', icon: '🌷' },
  { id: 'natsu', kana: 'なつ', kanji: '夏', icon: '🍉' },
  { id: 'aki', kana: 'あき', kanji: '秋', icon: '🍁' },
  { id: 'fuyu', kana: 'ふゆ', kanji: '冬', icon: '⛄' }
];
export const SEASON_IDS: SeasonId[] = SEASONS.map((s) => s.id);

/** 季節の4枚カード（はる→ふゆ の順） */
export function seasonChoices(): Choice[] {
  return SEASONS.map((s) => emojiChoice(`season-${s.id}`, s.icon, s.kana, { caption: s.kana, size: 46 }));
}

/** 選択肢を混ぜる（正解の位置もばらばらに） */
export function shuffled<T>(rng: Rng, arr: T[]): T[] {
  return rng.shuffle(arr);
}

/** 最大・最小がただ1つかどうか */
export function uniqueExtreme(values: number[], ask: 'max' | 'min'): number {
  const target = ask === 'max' ? Math.max(...values) : Math.min(...values);
  const idx = values.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
  return idx.length === 1 ? idx[0] : -1;
}
