import type { CSSProperties, ReactNode } from 'react';
import type { Rng } from '../../../core/rng';
import type { TapQuestion } from '../../../player/types';

// 図形・推理 A の共通部品（色・SVG の小物・選択肢の仕上げ）

export const INK = '#1e2a3b';
export const FILL = {
  blue: '#dceeff',
  yellow: '#fff2c6',
  green: '#e2f5e6',
  pink: '#ffe4ec',
  purple: '#eee6ff',
  orange: '#ffe8d9',
  gray: '#f0f3f8',
  sky: '#eaf4ff'
};
export const STRONG = {
  red: '#d0453a',
  blue: '#2563c9',
  green: '#24734a',
  yellow: '#e0a800',
  purple: '#6d45c9',
  orange: '#e07a1f',
  pink: '#d23f7a',
  brown: '#8a5a2b'
};
export const EMOJI_FONT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';

export const FIG_STYLE: CSSProperties = { width: '100%', maxHeight: 230, display: 'block' };
export const CHOICE_STYLE: CSSProperties = { width: '100%', maxHeight: 110, display: 'block' };

/** SVG の中に絵文字を置く（中心座標） */
export function SvgEmoji({ x, y, size, char }: { x: number; y: number; size: number; char: string }) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: EMOJI_FONT }}>
      {char}
    </text>
  );
}

// ---- 回転の矢印 ----
const rad = (a: number) => (a * Math.PI) / 180;

/** 円弧の矢印。角度は画面の時計回りが正（0° = 右、-90° = 上） */
export function ArcArrow({
  cx,
  cy,
  r,
  a0,
  a1,
  color = STRONG.blue,
  width = 4,
  head = 8
}: {
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  color?: string;
  width?: number;
  head?: number;
}) {
  const cw = a1 > a0;
  const p = (a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = cw ? 1 : 0;
  // 終点での進む向き
  const tx = cw ? -Math.sin(rad(a1)) : Math.sin(rad(a1));
  const ty = cw ? Math.cos(rad(a1)) : -Math.cos(rad(a1));
  const nx = -ty;
  const ny = tx;
  const tip = [x1 + tx * head, y1 + ty * head];
  const b = [x1 - tx * (head * 0.4), y1 - ty * (head * 0.4)];
  const pts = [tip, [b[0] + nx * head, b[1] + ny * head], [b[0] - nx * head, b[1] - ny * head]];
  return (
    <g>
      <path
        d={`M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <polygon points={pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')} fill={color} />
    </g>
  );
}

/** 「みぎに まわす（時計回り）」「ひだりに まわす」の印 */
export function RotateHint({ x, y, dir, r = 24 }: { x: number; y: number; dir: 'cw' | 'ccw'; r?: number }) {
  return dir === 'cw' ? <ArcArrow cx={x} cy={y} r={r} a0={-160} a1={70} /> : <ArcArrow cx={x} cy={y} r={r} a0={-20} a1={-250} />;
}

// ---- 数のカード（数字＋点） ----
export function NumberCard({ n }: { n: number }) {
  const per = 5;
  const rows = Math.max(1, Math.ceil(n / per));
  const dot = 14;
  const h = 58 + rows * dot + 6;
  const dots: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per);
    const c = i % per;
    const inRow = Math.min(per, n - r * per);
    const x0 = 50 - ((inRow - 1) * dot) / 2;
    dots.push(<circle key={i} cx={x0 + c * dot} cy={64 + r * dot} r={5} fill={STRONG.blue} />);
  }
  return (
    <svg viewBox={`0 0 100 ${h}`} style={CHOICE_STYLE} aria-hidden="true">
      <text x={50} y={30} fontSize={44} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {n}
      </text>
      {dots}
    </svg>
  );
}

// ---- 位置の名前（保護者パネルの「こたえ」に出す） ----
export function defaultCols(n: number): number {
  return n <= 3 ? n : n === 4 ? 2 : 3;
}

export function positionLabel(i: number, n: number, cols: number): string {
  if (cols >= n) {
    if (n === 1) return 'ひとつだけ';
    if (n === 2) return i === 0 ? 'ひだり' : 'みぎ';
    if (n === 3) return ['ひだり', 'まんなか', 'みぎ'][i];
    if (i === 0) return 'いちばん ひだり';
    if (i === n - 1) return 'いちばん みぎ';
    return `ひだりから ${i + 1}ばんめ`;
  }
  if (cols === 2 && n === 4) return ['ひだりうえ', 'みぎうえ', 'ひだりした', 'みぎした'][i];
  const r = Math.floor(i / cols);
  const c = i % cols;
  return `${r + 1}だんめの ひだりから ${c + 1}ばんめ`;
}

// ---- 選択肢を混ぜて TapQuestion にする ----
export interface Draft {
  key: string; // 正解判定用（作る側で決める）
  sig: string; // 見た目の中身。同じ sig があれば作り直しが必要（＝不具合）
  node: ReactNode;
  label?: string; // 中身の名前（labelMode: 'content' のとき使う）
}

export interface FinalizeOpts {
  type: string;
  prompt: string;
  speech?: string;
  figure?: ReactNode;
  preview?: TapQuestion['preview'];
  choices: Draft[];
  answerKey: string;
  params: Record<string, unknown>;
  explain?: string;
  askReason?: boolean;
  cols?: number;
  choiceHeight?: number;
  labelMode?: 'position' | 'content';
}

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export function finalize(rng: Rng, o: FinalizeOpts): TapQuestion {
  const seen = new Set<string>();
  for (const c of o.choices) {
    if (seen.has(c.sig)) throw new Error(`${o.type}: 同じ選択肢があります（${c.sig}）`);
    seen.add(c.sig);
  }
  if (o.choices.length < 2 || o.choices.length > IDS.length) throw new Error(`${o.type}: 選択肢の数 ${o.choices.length}`);
  if (o.choices.filter((c) => c.key === o.answerKey).length !== 1) throw new Error(`${o.type}: 正解が1つではありません`);
  const order = rng.shuffle(o.choices);
  const n = order.length;
  const cols = o.cols ?? defaultCols(n);
  const choices = order.map((c, i) => ({
    id: IDS[i],
    node: c.node,
    label: o.labelMode === 'content' && c.label ? c.label : positionLabel(i, n, cols)
  }));
  const answer = IDS[order.findIndex((c) => c.key === o.answerKey)];
  return {
    type: o.type,
    prompt: o.prompt,
    speech: o.speech,
    figure: o.figure,
    preview: o.preview,
    choices,
    answer,
    cols,
    choiceHeight: o.choiceHeight,
    explain: o.explain,
    askReason: o.askReason,
    params: o.params
  };
}

/** 候補から重複しない sig を n 個（正解の sig は除く） */
export function pickDistinct<T extends { sig: string }>(rng: Rng, cands: T[], n: number, exclude: string[], keepOrder = false): T[] {
  const out: T[] = [];
  const used = new Set(exclude);
  const list = keepOrder ? cands : rng.shuffle(cands);
  for (const c of list) {
    if (out.length >= n) break;
    if (used.has(c.sig)) continue;
    used.add(c.sig);
    out.push(c);
  }
  return out;
}

/** 数の選択肢（正解と、まちがえやすい数）。prefer を先に、つぎに others（順不同）、足りなければ ±1, ±2… */
export function numberDrafts(
  rng: Rng,
  correct: number,
  o: { prefer?: number[]; others?: number[]; total?: number; min?: number; max?: number; unit?: string; render?: (n: number) => ReactNode } = {}
): Draft[] {
  const total = o.total ?? 4;
  const min = o.min ?? 1;
  const max = o.max ?? 20;
  const nums: number[] = [correct];
  const add = (x: number) => {
    if (nums.length >= total) return;
    if (!Number.isInteger(x) || x < min || x > max || nums.includes(x)) return;
    nums.push(x);
  };
  (o.prefer ?? []).forEach(add);
  rng.shuffle(o.others ?? []).forEach(add);
  for (let d = 1; nums.length < total && d < 30; d++) {
    add(correct + d);
    add(correct - d);
  }
  return nums.map((x) => ({
    key: x === correct ? 'ok' : `n${x}`,
    sig: `n${x}`,
    node: o.render ? o.render(x) : <NumberCard n={x} />,
    label: `${x}${o.unit ?? ''}`
  }));
}
