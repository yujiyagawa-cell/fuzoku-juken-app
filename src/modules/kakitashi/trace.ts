import type { Rng } from '../../core/rng';

// 点線なぞり・線をひく：お手本の線（折れ線）の作成と、なぞった線の評価（純粋な計算）

export interface Pt {
  x: number;
  y: number;
}

export type TraceKind = 'straight' | 'curve' | 'zigzag' | 'line';

export const TRACE_KINDS: TraceKind[] = ['straight', 'curve', 'zigzag', 'line'];

export const TRACE_NAMES: Record<TraceKind, string> = {
  straight: 'まっすぐの 点線',
  curve: 'くねくねの 点線',
  zigzag: 'ぎざぎざの 点線',
  line: '点と点を むすぶ線'
};

/** 子どもへの指示（読み上げ） */
export function traceInstruction(kind: TraceKind): string {
  if (kind === 'line') return 'みどりの まるから あかい まるまで、まっすぐ せんを ひいてください。';
  return 'てんせんの うえを、みどりの まるから ゆびで なぞってください。';
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** お手本の線（左から右へ）。キャンバスの大きさ w × h（CSS px）。 */
export function makeTracePath(kind: TraceKind, w: number, h: number, rng: Rng): Pt[] {
  const x0 = w * 0.12;
  const x1 = w * 0.88;
  const cy = h * 0.5;
  if (kind === 'straight' || kind === 'line') {
    const y0 = h * (0.3 + rng.next() * 0.4);
    const tilt = rng.chance(0.5) ? 0 : (rng.next() - 0.5) * h * 0.5;
    return [
      { x: x0, y: y0 },
      { x: x1, y: clamp(y0 + tilt, h * 0.15, h * 0.85) }
    ];
  }
  if (kind === 'curve') {
    const amp = h * (0.14 + rng.next() * 0.08);
    const periods = rng.pick([1, 1.5, 2]);
    const phase = rng.chance(0.5) ? 0 : Math.PI;
    const n = 80;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: x0 + (x1 - x0) * t, y: cy + amp * Math.sin(2 * Math.PI * periods * t + phase) });
    }
    return pts;
  }
  // zigzag
  const segs = rng.int(4, 6);
  const amp = h * (0.14 + rng.next() * 0.08);
  const up = rng.chance(0.5) ? 1 : -1;
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    pts.push({ x: x0 + ((x1 - x0) * i) / segs, y: cy + (i % 2 === 0 ? -amp : amp) * up });
  }
  return pts;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(poly: Pt[]): number {
  let L = 0;
  for (let i = 1; i < poly.length; i++) L += dist(poly[i - 1], poly[i]);
  return L;
}

/** 折れ線を一定の間隔の点に並べ直す（両端を含む） */
export function resample(poly: Pt[], step: number): Pt[] {
  if (poly.length === 0) return [];
  if (poly.length === 1 || step <= 0) return poly.map((p) => ({ ...p }));
  const out: Pt[] = [{ ...poly[0] }];
  let need = step; // 次の点までの残りの長さ
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = dist(a, b);
    if (seg === 0) continue;
    let pos = 0;
    while (seg - pos >= need) {
      pos += need;
      const t = pos / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      need = step;
    }
    need -= seg - pos;
  }
  const last = poly[poly.length - 1];
  if (dist(out[out.length - 1], last) > 1e-6) out.push({ ...last });
  return out;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPolyline(p: Pt, poly: Pt[]): number {
  if (poly.length === 0) return Infinity;
  if (poly.length === 1) return dist(p, poly[0]);
  let m = Infinity;
  for (let i = 1; i < poly.length; i++) m = Math.min(m, distToSegment(p, poly[i - 1], poly[i]));
  return m;
}

export interface TraceEval {
  coverage: number; // お手本の線のうち、なぞれた割合 0..1
  outside: number; // なぞった線のうち、はみ出した割合 0..1
  meanDev: number; // なぞった線とお手本のずれの平均（px）
  maxDev: number; // いちばん大きいずれ（px）
  inkLength: number; // なぞった線の長さ（px）
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * なぞった線の評価。tol（px）より近ければ「線の上」とみなす。
 * - coverage：お手本を tol/2 間隔の点にして、その点の近く（tol 以内）を指が通った割合
 * - outside：なぞった線を tol/2 間隔の点にして、お手本から tol より離れていた割合（長さの割合）
 */
export function evaluateTrace(target: Pt[], strokes: Pt[][], tol: number): TraceEval {
  const lines = strokes.filter((s) => s.length > 0);
  if (!lines.length || !target.length) return { coverage: 0, outside: 0, meanDev: 0, maxDev: 0, inkLength: 0 };
  const step = Math.max(1, tol / 2);
  const tSamples = resample(target, step);
  let covered = 0;
  for (const p of tSamples) {
    if (lines.some((s) => distToPolyline(p, s) <= tol)) covered++;
  }
  const uSamples: Pt[] = [];
  for (const s of lines) uSamples.push(...resample(s, step));
  let out = 0;
  let sum = 0;
  let max = 0;
  for (const p of uSamples) {
    const d = distToPolyline(p, target);
    if (d > tol) out++;
    sum += d;
    if (d > max) max = d;
  }
  return {
    coverage: round2(covered / tSamples.length),
    outside: round2(out / uSamples.length),
    meanDev: round1(sum / uSamples.length),
    maxDev: round1(max),
    inkLength: Math.round(lines.reduce((a, s) => a + pathLength(s), 0))
  };
}

/** 保護者向けの短い説明 */
export function traceSummary(e: TraceEval): string {
  return `なぞれた ${Math.round(e.coverage * 100)}%・はみ出し ${Math.round(e.outside * 100)}%`;
}
