import type { Rng } from '../../../core/rng';
import type { Choice, QuestionType, TapQuestion } from '../../../player/types';
import { emojiChoice, FILL, FIG_STYLE, grid2Label, GRID, INK, rowLabel, colLabel, SvgEmoji, uniqueExtreme, WATER } from './common';

// くらべる問題：長さ・水の量・重さ・広さ

type Ask = 'max' | 'min';

// =====================================================================
// 長さくらべ（電車・鉛筆・ひも）
// =====================================================================

const CAR_PITCH = 48;

function TrainRow({ cars, x0, color }: { cars: number; x0: number; color: string }) {
  return (
    <svg viewBox="0 0 320 52" style={{ width: '100%', maxHeight: 56, display: 'block' }} aria-hidden="true">
      <line x1={4} y1={47} x2={316} y2={47} stroke={GRID} strokeWidth={2} />
      {Array.from({ length: cars }, (_, i) => {
        const x = x0 + i * CAR_PITCH;
        return (
          <g key={i}>
            {i > 0 && <line x1={x - 4} y1={24} x2={x} y2={24} stroke={INK} strokeWidth={3} />}
            <rect x={x} y={6} width={44} height={30} rx={i === 0 ? 11 : 5} fill={color} stroke={INK} strokeWidth={2.5} />
            <rect x={x + 6} y={12} width={13} height={10} rx={2} fill="#fff" stroke={INK} strokeWidth={1.6} />
            <rect x={x + 25} y={12} width={13} height={10} rx={2} fill="#fff" stroke={INK} strokeWidth={1.6} />
            <circle cx={x + 11} cy={40} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
            <circle cx={x + 33} cy={40} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

const PENCIL_UNIT = 28;

function PencilRow({ len, off, color }: { len: number; off: number; color: string }) {
  const x0 = 20 + off * PENCIL_UNIT;
  const end = x0 + len * PENCIL_UNIT;
  const bodyEnd = end - 18;
  return (
    <svg viewBox="0 0 320 44" style={{ width: '100%', maxHeight: 50, display: 'block' }} aria-hidden="true">
      {Array.from({ length: 11 }, (_, k) => (
        <line key={k} x1={20 + k * PENCIL_UNIT} y1={6} x2={20 + k * PENCIL_UNIT} y2={38} stroke={GRID} strokeWidth={1.2} />
      ))}
      <line x1={20} y1={6} x2={300} y2={6} stroke={GRID} strokeWidth={1.2} />
      <line x1={20} y1={38} x2={300} y2={38} stroke={GRID} strokeWidth={1.2} />
      <rect x={x0} y={14} width={bodyEnd - x0} height={16} fill={color} stroke={INK} strokeWidth={2.2} />
      <rect x={x0} y={14} width={9} height={16} fill="#f4a7b9" stroke={INK} strokeWidth={2.2} />
      <polygon points={`${bodyEnd},14 ${end},22 ${bodyEnd},30`} fill="#f6d7a7" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <polygon points={`${end - 6},19.6 ${end},22 ${end - 6},24.4`} fill={INK} />
    </svg>
  );
}

type Pt = [number, number];
const DIRS: Pt[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

/** マス目の上を通る、重ならないひも（L マスぶん） */
export function ropePath(rng: Rng, L: number, w = 6, h = 4): Pt[] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const start: Pt = [rng.int(0, w), rng.int(0, h)];
    const pts: Pt[] = [start];
    const seen = new Set([`${start[0]},${start[1]}`]);
    let dir: Pt | null = null;
    let ok = true;
    for (let s = 0; s < L; s++) {
      const [x, y] = pts[pts.length - 1];
      const opts = DIRS.filter(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && nx <= w && ny >= 0 && ny <= h && !seen.has(`${nx},${ny}`);
      });
      if (!opts.length) {
        ok = false;
        break;
      }
      const cur: Pt | null = dir;
      const straight: Pt | undefined = cur ? opts.find((o) => o[0] === cur[0] && o[1] === cur[1]) : undefined;
      const d: Pt = straight && rng.chance(0.45) ? straight : rng.pick(opts);
      dir = d;
      const np: Pt = [x + d[0], y + d[1]];
      pts.push(np);
      seen.add(`${np[0]},${np[1]}`);
    }
    // 少なくとも1回は曲がる（まっすぐ1本だと簡単すぎる）
    if (ok && turns(pts) >= 1) return pts;
  }
  // 念のため：L 字
  const pts: Pt[] = [[0, 0]];
  for (let i = 0; i < L; i++) {
    const [x, y] = pts[pts.length - 1];
    pts.push(x < w ? [x + 1, y] : [x, y + 1]);
  }
  return pts;
}

function turns(pts: Pt[]): number {
  let t = 0;
  for (let i = 2; i < pts.length; i++) {
    const d1 = [pts[i - 1][0] - pts[i - 2][0], pts[i - 1][1] - pts[i - 2][1]];
    const d2 = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) t++;
  }
  return t;
}

function RopeCell({ pts }: { pts: Pt[] }) {
  const X = (i: number) => 10 + i * 20;
  const Y = (j: number) => 10 + j * 20;
  return (
    <svg viewBox="0 0 140 100" style={{ width: '100%', maxHeight: 104, display: 'block' }} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`v${i}`} x1={X(i)} y1={Y(0)} x2={X(i)} y2={Y(4)} stroke={GRID} strokeWidth={1.2} />
      ))}
      {Array.from({ length: 5 }, (_, j) => (
        <line key={`h${j}`} x1={X(0)} y1={Y(j)} x2={X(6)} y2={Y(j)} stroke={GRID} strokeWidth={1.2} />
      ))}
      <polyline points={pts.map(([i, j]) => `${X(i)},${Y(j)}`).join(' ')} fill="none" stroke="#b5651d" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(pts[0][0])} cy={Y(pts[0][1])} r={4.5} fill="#b5651d" />
      <circle cx={X(pts[pts.length - 1][0])} cy={Y(pts[pts.length - 1][1])} r={4.5} fill="#b5651d" />
    </svg>
  );
}

const TRAIN_COLORS = [FILL.blue, FILL.yellow, FILL.green, FILL.pink];
const PENCIL_COLORS = ['#9cc3f0', '#f2cf63', '#8fd1a5', '#f5a3bd'];

function generateLength(rng: Rng): TapQuestion {
  const r = rng.next();
  const variant: 'train' | 'pencil' | 'rope' = r < 0.5 ? 'train' : r < 0.75 ? 'pencil' : 'rope';
  const ask: Ask = rng.chance(0.5) ? 'max' : 'min';
  const word = ask === 'max' ? { k: 'ながい', s: '長い' } : { k: 'みじかい', s: '短い' };

  if (variant === 'train') {
    const n = rng.chance(0.7) ? 4 : 3;
    const values = rng.sample([2, 3, 4, 5, 6], n);
    const aligned = rng.chance(0.4);
    const colors = rng.shuffle(TRAIN_COLORS);
    const choices: Choice[] = values.map((cars, i) => {
      const len = cars * CAR_PITCH - 4;
      const maxSteps = Math.floor((320 - 16 - len) / 24);
      const x0 = aligned ? 8 : 8 + rng.int(0, Math.max(0, maxSteps)) * 24;
      return { id: `c${i}`, node: <TrainRow cars={cars} x0={x0} color={colors[i % colors.length]} />, label: rowLabel(i, 'でんしゃ') };
    });
    const ai = uniqueExtreme(values, ask);
    return {
      type: 'zukei-length',
      prompt: `いちばん ${word.k} でんしゃは どれですか。`,
      speech: `いちばん ${word.s} 電車は、どれですか。`,
      choices,
      answer: `c${ai}`,
      cols: 1,
      choiceHeight: 64,
      explain: `車両の数 上から ${values.join('・')}`,
      params: { variant, ask, values, aligned }
    };
  }

  if (variant === 'pencil') {
    const n = rng.chance(0.6) ? 4 : 3;
    const values = rng.sample([2, 3, 4, 5, 6, 7, 8, 9], n);
    const colors = rng.shuffle(PENCIL_COLORS);
    const choices: Choice[] = values.map((len, i) => {
      const off = rng.int(0, 10 - len);
      return { id: `c${i}`, node: <PencilRow len={len} off={off} color={colors[i % colors.length]} />, label: rowLabel(i, 'えんぴつ') };
    });
    const ai = uniqueExtreme(values, ask);
    return {
      type: 'zukei-length',
      prompt: `いちばん ${word.k} えんぴつは どれですか。`,
      speech: `いちばん ${word.s} えんぴつは、どれですか。`,
      choices,
      answer: `c${ai}`,
      cols: 1,
      choiceHeight: 58,
      explain: `マスの数 上から ${values.join('・')}`,
      params: { variant, ask, values }
    };
  }

  // ひも（折れ線）
  const values = rng.sample([4, 5, 6, 7, 8, 9, 10], 4);
  const choices: Choice[] = values.map((L, i) => ({ id: `c${i}`, node: <RopeCell pts={ropePath(rng, L)} />, label: grid2Label(i, 'ひも') }));
  const ai = uniqueExtreme(values, ask);
  return {
    type: 'zukei-length',
    prompt: `いちばん ${word.k} ひもは どれですか。`,
    speech: `いちばん ${word.s} ひもは、どれですか。`,
    choices,
    answer: `c${ai}`,
    choiceHeight: 118,
    explain: `マスの数 ${values.join('・')}（左上・右上・左下・右下）`,
    params: { variant, ask, values }
  };
}

export const lengthType: QuestionType = {
  id: 'zukei-length',
  name: '長さくらべ（電車・鉛筆・ひも）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '本番',
  description: '本番は「電車の一番長いもの・一番短いもの」。電車は車両の数、鉛筆はマス目、ひもは折れ線のマスを数える。端をそろえない問題もある。',
  priority: 3,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateLength
};

// =====================================================================
// 水の量
// =====================================================================

function Glass({ width, height, level }: { width: number; height: number; level: number }) {
  const x0 = 35 - width / 2;
  const x1 = 35 + width / 2;
  const top = 94 - height;
  return (
    <svg viewBox="0 0 70 100" style={{ width: '100%', maxHeight: 104, display: 'block' }} aria-hidden="true">
      <rect x={x0} y={94 - level} width={width} height={level} fill={WATER} />
      <line x1={x0} y1={94 - level} x2={x1} y2={94 - level} stroke="#4f97d6" strokeWidth={1.6} />
      <path d={`M${x0} ${top} L${x0} 94 L${x1} 94 L${x1} ${top}`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={x0 - 3} y1={top} x2={x0 + 3} y2={top} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <line x1={x1 - 3} y1={top} x2={x1 + 3} y2={top} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}

function generateWater(rng: Rng): TapQuestion {
  const variant: 'level' | 'width' = rng.chance(0.6) ? 'level' : 'width';
  const n = rng.chance(0.7) ? 4 : 3;
  if (variant === 'level') {
    const ask: Ask = rng.chance(0.6) ? 'max' : 'min';
    const units = rng.sample([1, 2, 3, 4, 5, 6], n);
    const choices: Choice[] = units.map((u, i) => ({ id: `c${i}`, node: <Glass width={40} height={78} level={8 + u * 10} />, label: colLabel(i, 'コップ') }));
    const ai = uniqueExtreme(units, ask);
    return {
      type: 'zukei-water',
      prompt: ask === 'max' ? 'みずが いちばん おおく はいっているのは どれですか。' : 'みずが いちばん すくないのは どれですか。',
      speech: ask === 'max' ? '水が いちばん多く 入っているのは、どれですか。' : '水が いちばん少ないのは、どれですか。',
      choices,
      answer: `c${ai}`,
      cols: n,
      choiceHeight: 112,
      explain: `同じコップ。水の高さ 左から ${units.join('・')}`,
      params: { variant, ask, values: units }
    };
  }
  const ask: Ask = rng.chance(0.7) ? 'max' : 'min';
  const widths = rng.sample([20, 28, 36, 44, 52], n);
  const heights = widths.map(() => rng.pick([50, 58, 66, 74, 82]));
  const choices: Choice[] = widths.map((w, i) => ({ id: `c${i}`, node: <Glass width={w} height={heights[i]} level={30} />, label: colLabel(i, 'いれもの') }));
  const ai = uniqueExtreme(widths, ask);
  return {
    type: 'zukei-water',
    prompt:
      ask === 'max'
        ? 'おなじ たかさまで みずが はいっています。みずが いちばん おおく はいっているのは どれですか。'
        : 'おなじ たかさまで みずが はいっています。みずが いちばん すくないのは どれですか。',
    speech:
      ask === 'max'
        ? '同じ高さまで 水が 入っています。水が いちばん多く 入っているのは、どれですか。'
        : '同じ高さまで 水が 入っています。水が いちばん少ないのは、どれですか。',
    choices,
    answer: `c${ai}`,
    cols: n,
    choiceHeight: 112,
    explain: `水の高さは同じ。入れものの太さ 左から ${widths.join('・')}（太いほど多い）`,
    params: { variant, ask, values: widths, heights }
  };
}

export const waterType: QuestionType = {
  id: 'zukei-water',
  name: '水の量',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート',
  description: '同じコップで水の高さがちがう／ちがう太さの入れもので水の高さが同じ（太いほど多い）。「いちばん多い」「いちばん少ない」。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 6,
  generate: generateWater
};

// =====================================================================
// 重さ（シーソー）
// =====================================================================

export const WEIGHT_ITEMS: { id: string; char: string; label: string }[] = [
  { id: 'ringo', char: '🍎', label: 'りんご' },
  { id: 'mikan', char: '🍊', label: 'みかん' },
  { id: 'momo', char: '🍑', label: 'もも' },
  { id: 'tomato', char: '🍅', label: 'とまと' },
  { id: 'nashi', char: '🍐', label: 'なし' },
  { id: 'remon', char: '🍋', label: 'れもん' }
];

function SeesawFig({ items, seesaws }: { items: Record<string, string>; seesaws: { left: string; right: string; heavy: 'L' | 'R' }[] }) {
  const k = seesaws.length;
  const pos = k === 2 ? [[80, 54], [240, 54]] : [[80, 54], [240, 54], [160, 150]];
  const H = k === 2 ? 96 : 192;
  const half = 58;
  const rad = (12 * Math.PI) / 180;
  const dx = half * Math.cos(rad);
  const dy = half * Math.sin(rad);
  return (
    <svg viewBox={`0 0 320 ${H}`} style={FIG_STYLE} role="img" aria-label="シーソーの え">
      {seesaws.map((s, i) => {
        const [cx, cy] = pos[i];
        const sign = s.heavy === 'L' ? 1 : -1;
        const L = { x: cx - dx, y: cy + sign * dy };
        const R = { x: cx + dx, y: cy - sign * dy };
        return (
          <g key={i}>
            <line x1={cx - 72} y1={cy + 30} x2={cx + 72} y2={cy + 30} stroke={GRID} strokeWidth={2.5} strokeLinecap="round" />
            <polygon points={`${cx},${cy} ${cx - 14},${cy + 30} ${cx + 14},${cy + 30}`} fill={FILL.gray} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke={INK} strokeWidth={6} strokeLinecap="round" />
            <SvgEmoji x={L.x + 6} y={L.y - 17} char={items[s.left]} size={28} />
            <SvgEmoji x={R.x - 6} y={R.y - 17} char={items[s.right]} size={28} />
          </g>
        );
      })}
    </svg>
  );
}

function generateWeight(rng: Rng): TapQuestion {
  const n = rng.chance(0.7) ? 3 : 4;
  const picked = rng.sample(WEIGHT_ITEMS, n);
  const order = rng.shuffle(picked.map((p) => p.id)); // 重い順
  const pairs = order.slice(0, -1).map((heavy, i) => [heavy, order[i + 1]] as [string, string]);
  const seesaws = rng.shuffle(pairs).map(([heavy, light]) => (rng.chance(0.5) ? { left: heavy, right: light, heavy: 'L' as const } : { left: light, right: heavy, heavy: 'R' as const }));
  const chars = Object.fromEntries(picked.map((p) => [p.id, p.char]));
  const ask: Ask = rng.chance(0.6) ? 'max' : 'min';
  const answer = ask === 'max' ? order[0] : order[order.length - 1];
  const choices = rng.shuffle(picked).map((p) => emojiChoice(p.id, p.char, p.label, { size: 50 }));
  const name = (id: string) => picked.find((p) => p.id === id)!.label;
  return {
    type: 'zukei-weight',
    prompt: ask === 'max' ? 'シーソーを みてください。いちばん おもいのは どれですか。' : 'シーソーを みてください。いちばん かるいのは どれですか。',
    speech: ask === 'max' ? 'シーソーを見てください。いちばん重いのは、どれですか。' : 'シーソーを見てください。いちばん軽いのは、どれですか。',
    figure: <SeesawFig items={chars} seesaws={seesaws} />,
    choices,
    answer,
    cols: n,
    choiceHeight: 96,
    explain: `重い順：${order.map(name).join(' ＞ ')}（下がっているほうが重い）`,
    params: { ask, order, pairs }
  };
}

export const weightType: QuestionType = {
  id: 'zukei-weight',
  name: '重さ（シーソー）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '2〜3組のシーソーから、いちばん重いもの・軽いものを選ぶ（下がっているほうが重い）。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateWeight
};

// =====================================================================
// 広さ（マス目）
// =====================================================================

/** 4×4 のマスで、つながった形（size マス） */
export function polyomino(rng: Rng, size: number): number[] {
  const start = rng.int(0, 15);
  const cells = new Set([start]);
  while (cells.size < size) {
    const frontier: number[] = [];
    for (const c of cells) {
      const x = c % 4;
      const y = Math.floor(c / 4);
      const ns = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];
      for (const [nx, ny] of ns) {
        if (nx < 0 || nx > 3 || ny < 0 || ny > 3) continue;
        const id = ny * 4 + nx;
        if (!cells.has(id) && !frontier.includes(id)) frontier.push(id);
      }
    }
    cells.add(rng.pick(frontier));
  }
  return [...cells].sort((a, b) => a - b);
}

function AreaCell({ cells, color }: { cells: number[]; color: string }) {
  const S = 22;
  const O = 6;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', maxHeight: 104, display: 'block' }} aria-hidden="true">
      {Array.from({ length: 16 }, (_, c) => (
        <rect key={`g${c}`} x={O + (c % 4) * S} y={O + Math.floor(c / 4) * S} width={S} height={S} fill="#fff" stroke={GRID} strokeWidth={1.2} />
      ))}
      {cells.map((c) => (
        <rect key={c} x={O + (c % 4) * S} y={O + Math.floor(c / 4) * S} width={S} height={S} fill={color} stroke={INK} strokeWidth={2} />
      ))}
    </svg>
  );
}

function generateArea(rng: Rng): TapQuestion {
  const ask: Ask = rng.chance(0.6) ? 'max' : 'min';
  const sizes = rng.sample([3, 4, 5, 6, 7, 8, 9], 4);
  const shapes = sizes.map((s) => polyomino(rng, s));
  const color = rng.pick(['#9fd3ae', '#9cc3f0', '#f2cf63', '#f5a3bd']);
  const choices: Choice[] = shapes.map((cells, i) => ({ id: `c${i}`, node: <AreaCell cells={cells} color={color} />, label: grid2Label(i, 'かたち') }));
  const ai = uniqueExtreme(sizes, ask);
  return {
    type: 'zukei-area',
    prompt: ask === 'max' ? 'いちばん ひろいのは どれですか。' : 'いちばん せまいのは どれですか。',
    speech: ask === 'max' ? 'いちばん広いのは、どれですか。' : 'いちばん狭いのは、どれですか。',
    choices,
    answer: `c${ai}`,
    choiceHeight: 116,
    explain: `ぬったマスの数 ${sizes.join('・')}（左上・右上・左下・右下）`,
    params: { ask, values: sizes, shapes }
  };
}

export const areaType: QuestionType = {
  id: 'zukei-area',
  name: '広さ',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: 'マス目をぬった形のうち、いちばん広い・狭いものを選ぶ（ぬったマスの数をくらべる）。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateArea
};
