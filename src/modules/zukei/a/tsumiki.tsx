import type { CSSProperties } from 'react';
import { weightedPick, type Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, FILL, finalize, INK, numberDrafts, pickDistinct, STRONG, SvgEmoji, type Draft } from './svg';

// 積み木（本番：積み木の数／四方からの観察。ノート：積み木と同じ数のどんぐり）
// 高さの表 h[r][c]（r=0 がいちばん奥、c=0 が左）。手前の列は奥の列より高くしない
// → どの列も一番上の面が見える（見えない積み木は「下で支えている」ことから分かる）。

export interface Stack {
  R: number;
  C: number;
  h: number[][];
}

type Pt = [number, number];
interface CubeGeo {
  r: number;
  c: number;
  z: number;
  faces: Pt[][]; // [前, 上, 右]
}

const S = 30;
const OX = 15;
const OY = 15;

function cubeGeo(st: Stack, r: number, c: number, z: number): CubeGeo {
  const d = st.R - 1 - r;
  const X = c * S + d * OX;
  const Y = -z * S - d * OY;
  return {
    r,
    c,
    z,
    faces: [
      [[X, Y], [X + S, Y], [X + S, Y - S], [X, Y - S]],
      [[X, Y - S], [X + S, Y - S], [X + S + OX, Y - S - OY], [X + OX, Y - S - OY]],
      [[X + S, Y], [X + S + OX, Y - OY], [X + S + OX, Y - S - OY], [X + S, Y - S]]
    ]
  };
}

/** 描く順（奥 → 手前、左 → 右、下 → 上） */
function cubesInOrder(st: Stack): CubeGeo[] {
  const out: CubeGeo[] = [];
  for (let r = 0; r < st.R; r++) for (let c = 0; c < st.C; c++) for (let z = 0; z < st.h[r][c]; z++) out.push(cubeGeo(st, r, c, z));
  return out;
}

function inside(p: Pt, poly: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 少しでも見えている積み木（あとから描く積み木に全部かくれていないか、面の中の点で調べる） */
function visibleFlags(cubes: CubeGeo[]): boolean[] {
  const U = [0.12, 0.31, 0.5, 0.69, 0.88];
  return cubes.map((cube, i) => {
    for (const f of cube.faces) {
      const [A, B, , D] = f;
      for (const u of U) {
        for (const v of U) {
          const p: Pt = [A[0] + u * (B[0] - A[0]) + v * (D[0] - A[0]), A[1] + u * (B[1] - A[1]) + v * (D[1] - A[1])];
          let covered = false;
          for (let j = i + 1; j < cubes.length && !covered; j++) {
            for (const g of cubes[j].faces) {
              if (inside(p, g)) {
                covered = true;
                break;
              }
            }
          }
          if (!covered) return true;
        }
      }
    }
    return false;
  });
}

export function stackCount(st: Stack): number {
  return st.h.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);
}

/** 全部かくれて見えない積み木の数 */
export function countHidden(st: Stack): number {
  return visibleFlags(cubesInOrder(st)).filter((v) => !v).length;
}

function trim(st: Stack): Stack | null {
  let h = st.h.map((row) => row.slice());
  while (h.length && h[h.length - 1].every((x) => x === 0)) h.pop();
  while (h.length && h[0].every((x) => x === 0)) h.shift();
  if (!h.length) return null;
  const colEmpty = (c: number) => h.every((row) => row[c] === 0);
  let C = h[0].length;
  while (C && colEmpty(C - 1)) {
    h = h.map((row) => row.slice(0, -1));
    C--;
  }
  while (C && colEmpty(0)) {
    h = h.map((row) => row.slice(1));
    C--;
  }
  if (!C) return null;
  return { R: h.length, C, h };
}

function connected(st: Stack): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < st.R; r++) for (let c = 0; c < st.C; c++) if (st.h[r][c] > 0) cells.push([r, c]);
  if (!cells.length) return false;
  const seen = new Set<string>([cells[0].join(',')]);
  const q = [cells[0]];
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= st.R || nc >= st.C || st.h[nr][nc] === 0) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nr, nc]);
    }
  }
  return seen.size === cells.length;
}

export function genStack(
  rng: Rng,
  o: { minN: number; maxN: number; Rs: number[]; Cs: number[]; maxH?: number; maxHidden?: number; minR?: number; minC?: number }
): { st: Stack; hidden: number } {
  const maxH = o.maxH ?? 3;
  for (let t = 0; t < 800; t++) {
    const R = rng.pick(o.Rs);
    const C = rng.pick(o.Cs);
    const h: number[][] = [];
    for (let r = 0; r < R; r++) {
      h.push([]);
      for (let c = 0; c < C; c++) h[r].push(r === 0 ? rng.int(0, maxH) : rng.int(0, h[r - 1][c]));
    }
    const st = trim({ R, C, h });
    if (!st || st.R < (o.minR ?? 1) || st.C < (o.minC ?? 1)) continue;
    const N = stackCount(st);
    if (N < o.minN || N > o.maxN || !connected(st)) continue;
    const cubes = cubesInOrder(st);
    const vis = visibleFlags(cubes);
    // どの列も、いちばん上の積み木は見えていること
    if (cubes.some((cu, i) => cu.z === st.h[cu.r][cu.c] - 1 && !vis[i])) continue;
    const hidden = vis.filter((v) => !v).length;
    if (hidden > (o.maxHidden ?? 2)) continue;
    return { st, hidden };
  }
  const st: Stack = { R: 2, C: 2, h: [[2, 1], [1, 0]] };
  return { st, hidden: countHidden(st) };
}

const FACE = { front: '#f6c46a', top: '#fde3a7', right: '#e0a24a' };

export function StackSvg({ st, style, x, y, width, height }: { st: Stack; style?: CSSProperties; x?: number; y?: number; width?: number; height?: number }) {
  const cubes = cubesInOrder(st);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cu of cubes)
    for (const f of cu.faces)
      for (const [px, py] of f) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
  const pad = 4;
  const pts = (f: Pt[]) => f.map((p) => p.join(',')).join(' ');
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
      style={style}
      x={x}
      y={y}
      width={width}
      height={height}
      aria-hidden="true"
    >
      {cubes.map((cu, i) => (
        <g key={i} stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <polygon points={pts(cu.faces[0])} fill={FACE.front} />
          <polygon points={pts(cu.faces[1])} fill={FACE.top} />
          <polygon points={pts(cu.faces[2])} fill={FACE.right} />
        </g>
      ))}
    </svg>
  );
}

// ---- 積み木の数 ----
export function generateTsumikiCount(rng: Rng) {
  const { st, hidden } = genStack(rng, { minN: 3, maxN: 10, Rs: [1, 2, 2, 3], Cs: [2, 3, 3, 4], minC: 2 });
  const N = stackCount(st);
  return finalize(rng, {
    type: 'zukei-tsumiki-count',
    prompt: 'つみきは いくつ ありますか。',
    speech: '積み木は いくつ ありますか。',
    figure: <StackSvg st={st} style={{ ...FIG_STYLE, maxHeight: 210 }} />,
    choices: numberDrafts(rng, N, { prefer: hidden > 0 ? [N - hidden, N + 1] : [N + 1, N - 1], others: [N - 1, N + 2, N - 2], max: 14, unit: 'こ' }),
    answerKey: 'ok',
    labelMode: 'content',
    params: { h: st.h, n: N, hidden },
    explain: `${N}こ${hidden ? `（見えないけれど下で支えている積み木が${hidden}こ）` : ''}`
  });
}

// ---- 積み木と同じ数のどんぐり ----
function Acorn({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 3} rx={7} ry={8.5} fill="#c98b4a" stroke={INK} strokeWidth={1.5} />
      <path d={`M ${x - 8.5} ${y - 1} Q ${x} ${y - 12} ${x + 8.5} ${y - 1} Z`} fill="#7a5230" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <line x1={x} y1={y - 8} x2={x + 1.5} y2={y - 12.5} stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

export function AcornGroup({ n }: { n: number }) {
  const per = 5;
  const rows = Math.max(1, Math.ceil(n / per));
  const H = rows * 26 + 8;
  const items = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per);
    const c = i % per;
    const inRow = Math.min(per, n - r * per);
    const x0 = 52 - ((inRow - 1) * 20) / 2;
    items.push(<Acorn key={i} x={x0 + c * 20} y={18 + r * 26} />);
  }
  return (
    <svg viewBox={`0 0 104 ${H}`} style={CHOICE_STYLE} aria-hidden="true">
      {items}
    </svg>
  );
}

export function generateTsumikiDonguri(rng: Rng) {
  const { st, hidden } = genStack(rng, { minN: 3, maxN: 9, Rs: [1, 2, 2, 3], Cs: [2, 3, 3], minC: 2 });
  const N = stackCount(st);
  return finalize(rng, {
    type: 'zukei-tsumiki-donguri',
    prompt: 'つみきと おなじ かずの どんぐりは どれですか。',
    speech: '積み木と 同じ 数の どんぐりは どれですか。',
    figure: <StackSvg st={st} style={{ ...FIG_STYLE, maxHeight: 190 }} />,
    choices: numberDrafts(rng, N, {
      prefer: hidden > 0 ? [N - hidden, N + 1] : [N + 1, N - 1],
      others: [N - 1, N + 2, N - 2],
      max: 12,
      unit: 'こ',
      render: (x) => <AcornGroup n={x} />
    }),
    answerKey: 'ok',
    labelMode: 'content',
    params: { h: st.h, n: N, hidden },
    explain: `積み木は${N}こ → どんぐり${N}こ`
  });
}

// ---- 四方からの見え方 ----
export type ViewDir = 'mae' | 'ue' | 'migi' | 'hidari';

export interface Sil {
  w: number;
  h: number;
  cells: boolean[][]; // cells[y][x]、y=0 が上
}

function colSil(heights: number[]): Sil {
  const H = Math.max(1, ...heights);
  const cells: boolean[][] = [];
  for (let y = 0; y < H; y++) cells.push(heights.map((hh) => H - 1 - y < hh));
  return { w: heights.length, h: H, cells };
}

export function viewOf(st: Stack, dir: ViewDir): Sil {
  if (dir === 'ue') {
    return { w: st.C, h: st.R, cells: st.h.map((row) => row.map((x) => x > 0)) };
  }
  if (dir === 'mae') {
    return colSil(Array.from({ length: st.C }, (_, c) => Math.max(...st.h.map((row) => row[c]))));
  }
  const rowMax = st.h.map((row) => Math.max(...row));
  // 右から見ると手前の列が左に、左から見ると奥の列が左に見える
  return colSil(dir === 'migi' ? rowMax.slice().reverse() : rowMax);
}

/** まわりの空いている行・列をけずる（見た目が同じなら同じ形になるように） */
export function trimSil(s: Sil): Sil {
  let cells = s.cells.map((row) => row.slice());
  while (cells.length && !cells[0].some(Boolean)) cells.shift();
  while (cells.length && !cells[cells.length - 1].some(Boolean)) cells.pop();
  if (!cells.length) return { w: 0, h: 0, cells: [] };
  const colEmpty = (x: number) => cells.every((row) => !row[x]);
  while (cells[0].length && colEmpty(0)) cells = cells.map((row) => row.slice(1));
  while (cells[0].length && colEmpty(cells[0].length - 1)) cells = cells.map((row) => row.slice(0, -1));
  return { w: cells[0].length, h: cells.length, cells };
}

export function silKey(s: Sil): string {
  const t = trimSil(s);
  return `${t.w}x${t.h}:${t.cells.map((row) => row.map((b) => (b ? 1 : 0)).join('')).join('/')}`;
}

function mirrorSil(s: Sil): Sil {
  return { w: s.w, h: s.h, cells: s.cells.map((row) => row.slice().reverse()) };
}

function heightsOf(s: Sil): number[] {
  return Array.from({ length: s.w }, (_, x) => s.cells.filter((row) => row[x]).length);
}

function perturb(rng: Rng, s: Sil, dir: ViewDir): Sil[] {
  const out: Sil[] = [];
  if (dir === 'ue') {
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const cells = s.cells.map((row) => row.slice());
        cells[y][x] = !cells[y][x];
        if (cells.some((row) => row.some(Boolean))) out.push({ w: s.w, h: s.h, cells });
      }
  } else {
    const hs = heightsOf(s);
    for (let i = 0; i < hs.length; i++)
      for (const d of [1, -1]) {
        const v = hs[i] + d;
        if (v < 1 || v > 4) continue;
        const nh = hs.slice();
        nh[i] = v;
        out.push(colSil(nh));
      }
  }
  return rng.shuffle(out);
}

function SilSvg({ s: raw }: { s: Sil }) {
  const s = trimSil(raw);
  const cell = 22;
  const W = s.w * cell;
  const H = s.h * cell;
  const x0 = 50 - W / 2;
  const y0 = 50 - H / 2;
  const rects = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      if (s.cells[y][x]) rects.push(<rect key={`${x}-${y}`} x={x0 + x * cell} y={y0 + y * cell} width={cell} height={cell} fill={FILL.blue} stroke={INK} strokeWidth={2} />);
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      {rects}
    </svg>
  );
}

const VIEWER: Record<ViewDir, { char: string; kana: string; where: string; x: number; y: number }> = {
  mae: { char: '🐶', kana: 'いぬ', where: 'まえ', x: 130, y: 210 },
  ue: { char: '🐦', kana: 'ことり', where: 'うえ', x: 130, y: 20 },
  migi: { char: '🐱', kana: 'ねこ', where: 'みぎ', x: 238, y: 115 },
  hidari: { char: '🐰', kana: 'うさぎ', where: 'ひだり', x: 22, y: 115 }
};

const VIEW_EXPLAIN: Record<ViewDir, string> = {
  mae: '前から：列ごとのいちばん高いところが見える',
  ue: '上から：積み木がある場所だけが見える（高さは分からない）',
  migi: '右から：手前の列が左側、奥の列が右側に見える',
  hidari: '左から：奥の列が左側、手前の列が右側に見える'
};

export interface ViewsModel {
  st: Stack;
  dir: ViewDir;
  correct: Sil;
  others: Sil[];
}

export function viewsModel(rng: Rng): ViewsModel {
  for (let t = 0; t < 30; t++) {
    const { st } = genStack(rng, { minN: 4, maxN: 9, Rs: [2, 3], Cs: [2, 3], maxHidden: 3, minR: 2, minC: 2 });
    const dir = weightedPick(rng, ['mae', 'ue', 'migi', 'hidari'] as ViewDir[], (d) => (d === 'mae' ? 3 : d === 'hidari' ? 1 : 2));
    const correct = viewOf(st, dir);
    const ck = silKey(correct);
    type C = { sig: string; s: Sil };
    const wrap = (s: Sil): C => ({ sig: silKey(s), s });
    const firsts: C[] = rng.shuffle([wrap(mirrorSil(correct)), ...(['mae', 'ue', 'migi', 'hidari'] as ViewDir[]).filter((d) => d !== dir).map((d) => wrap(viewOf(st, d)))]);
    const pert = perturb(rng, correct, dir).map(wrap);
    const picked = pickDistinct(rng, [...firsts.slice(0, 2), ...pert, ...firsts.slice(2)], 3, [ck], true);
    if (picked.length < 3) continue;
    return { st, dir, correct, others: picked.map((p) => p.s) };
  }
  throw new Error('zukei-tsumiki-views: 作れませんでした');
}

export function generateTsumikiViews(rng: Rng) {
  const m = viewsModel(rng);
  const v = VIEWER[m.dir];
  const draft = (s: Sil, key: string): Draft => ({ key, sig: silKey(s), node: <SilSvg s={s} /> });
  return finalize(rng, {
    type: 'zukei-tsumiki-views',
    prompt: `${v.where}の ${v.kana}さんから みると、つみきは どう みえますか。`,
    speech: `${v.where === 'まえ' ? '前' : v.where === 'うえ' ? '上' : v.where === 'みぎ' ? '右' : '左'}の ${v.kana}さんから 見ると、積み木は どう 見えますか。`,
    figure: (
      <svg viewBox="0 0 260 232" style={FIG_STYLE} aria-hidden="true">
        <StackSvg st={m.st} x={58} y={40} width={144} height={150} />
        {(Object.keys(VIEWER) as ViewDir[]).map((d) => {
          const w = VIEWER[d];
          return (
            <g key={d}>
              {d === m.dir && <circle cx={w.x} cy={w.y} r={20} fill={FILL.yellow} stroke={STRONG.yellow} strokeWidth={3} />}
              <SvgEmoji x={w.x} y={w.y} size={26} char={w.char} />
            </g>
          );
        })}
      </svg>
    ),
    choices: [draft(m.correct, 'ok'), ...m.others.map((s, i) => draft(s, `x${i}`))],
    answerKey: 'ok',
    params: { h: m.st.h, dir: m.dir },
    explain: VIEW_EXPLAIN[m.dir]
  });
}

export const tsumikiCountType: QuestionType = {
  id: 'zukei-tsumiki-count',
  name: '積み木の数',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '本番',
  description: '積んだ積み木（3〜10こ）の数。下に隠れて見えない積み木もある（上の積み木を支えているので数える）。数字と点のカードから選ぶ。',
  priority: 3,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateTsumikiCount
};

export const tsumikiDonguriType: QuestionType = {
  id: 'zukei-tsumiki-donguri',
  name: '積み木と同じ数のどんぐり',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート',
  description: '積み木と同じ数のどんぐりの絵を選ぶ（数字を使わずに数を合わせる）。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateTsumikiDonguri
};

export const tsumikiViewsType: QuestionType = {
  id: 'zukei-tsumiki-views',
  name: '四方からの見え方',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '本番',
  description: '積み木を前・上・右・左から見たときの形を選ぶ（見る動物に印）。ほかの向きから見た形や、裏返し・1つちがいの形を混ぜる。',
  priority: 3,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateTsumikiViews
};
