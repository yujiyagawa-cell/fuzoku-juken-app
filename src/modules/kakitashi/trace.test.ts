import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import { pickShapes, shapeBox, shapePathD, SHAPES, type ShapeId } from './shapes';
import { distToPolyline, evaluateTrace, makeTracePath, pathLength, resample, TRACE_KINDS, type Pt } from './trace';
import { KAKITASHI_TYPES } from './types';

const W = 360;
const H = 396;

describe('resample', () => {
  it('一定の間隔で点をならべ、両端をふくむ', () => {
    const line: Pt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ];
    const r = resample(line, 10);
    expect(r.length).toBe(11);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[r.length - 1]).toEqual({ x: 100, y: 0 });
    for (let i = 1; i < r.length; i++) expect(r[i].x - r[i - 1].x).toBeCloseTo(10, 5);
  });

  it('折れ線の角をまたいでも間隔がそろう', () => {
    const poly: Pt[] = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 15 }
    ];
    const r = resample(poly, 10);
    // 長さ30 → 0,10,20,30 の4点
    expect(r.length).toBe(4);
    expect(r[1]).toEqual({ x: 10, y: 0 });
    expect(r[2].x).toBeCloseTo(15, 5);
    expect(r[2].y).toBeCloseTo(5, 5);
  });
});

describe('evaluateTrace', () => {
  const rng = makeRng(42);
  const target = makeTracePath('zigzag', W, H, rng);
  const tol = W * 0.04;

  it('お手本どおりなら ほぼ100% なぞれて はみ出しなし', () => {
    const e = evaluateTrace(target, [resample(target, 3)], tol);
    expect(e.coverage).toBeGreaterThanOrEqual(0.99);
    expect(e.outside).toBe(0);
    expect(e.meanDev).toBeLessThan(1);
  });

  it('大きくずれた線は なぞれた 0%・はみ出し 100%', () => {
    const shifted = resample(target, 3).map((p) => ({ x: p.x, y: p.y + 120 }));
    const e = evaluateTrace(target, [shifted], tol);
    expect(e.coverage).toBe(0);
    expect(e.outside).toBe(1);
  });

  it('半分だけなぞると coverage は約半分', () => {
    const straight = makeTracePath('straight', W, H, makeRng(7));
    const half: Pt[] = [straight[0], { x: (straight[0].x + straight[1].x) / 2, y: (straight[0].y + straight[1].y) / 2 }];
    const e = evaluateTrace(straight, [resample(half, 3)], tol);
    expect(e.coverage).toBeGreaterThan(0.4);
    expect(e.coverage).toBeLessThan(0.65);
    expect(e.outside).toBe(0);
  });

  it('少しだけずれた線（tol 以内）は はみ出しにならない', () => {
    const near = resample(target, 3).map((p) => ({ x: p.x, y: p.y + tol * 0.5 }));
    const e = evaluateTrace(target, [near], tol);
    expect(e.coverage).toBeGreaterThan(0.9);
    expect(e.outside).toBeLessThan(0.1);
  });

  it('何も描かないと 0', () => {
    expect(evaluateTrace(target, [], tol)).toEqual({ coverage: 0, outside: 0, meanDev: 0, maxDev: 0, inkLength: 0 });
  });

  it('distToPolyline は線分までのいちばん近いきょり', () => {
    expect(
      distToPolyline({ x: 5, y: 3 }, [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ])
    ).toBeCloseTo(3, 5);
  });
});

describe('makeTracePath', () => {
  it('同じ seed なら同じ線、キャンバスの内側におさまる', () => {
    for (const kind of TRACE_KINDS) {
      for (let seed = 1; seed < 40; seed++) {
        const a = makeTracePath(kind, W, H, makeRng(seed));
        const b = makeTracePath(kind, W, H, makeRng(seed));
        expect(a).toEqual(b);
        expect(a.length).toBeGreaterThanOrEqual(2);
        for (const p of a) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(W);
          expect(p.y).toBeGreaterThanOrEqual(H * 0.1);
          expect(p.y).toBeLessThanOrEqual(H * 0.9);
        }
        expect(pathLength(a)).toBeGreaterThan(W * 0.5);
      }
    }
  });
});

describe('shapes', () => {
  it('7つの形すべてに パスと タイプがある', () => {
    expect(SHAPES.map((s) => s.shape).sort()).toEqual(['circle', 'diamond', 'halfDown', 'halfUp', 'rect', 'square', 'triangle']);
    for (const s of SHAPES) {
      const d = shapePathD(s.shape, W / 2, H / 2, W * 0.3);
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      const b = shapeBox(s.shape as ShapeId, W / 2, H / 2, W * 0.3);
      expect(b.x0).toBeGreaterThan(0);
      expect(b.x1).toBeLessThan(W);
      expect(b.y0).toBeGreaterThan(0);
      expect(b.y1).toBeLessThan(H);
      expect(KAKITASHI_TYPES.some((t) => t.id === s.typeId && t.genre === 'kakitashi')).toBe(true);
    }
    expect(KAKITASHI_TYPES.find((t) => t.id === 'zukei-trace')?.genre).toBe('zukei');
    expect(new Set(KAKITASHI_TYPES.map((t) => t.id)).size).toBe(KAKITASHI_TYPES.length);
  });

  it('半円：弧が上は平らな辺が下、弧が下は平らな辺が上', () => {
    const up = shapePathD('halfUp', 100, 100, 100);
    const down = shapePathD('halfDown', 100, 100, 100);
    // 弧の向き（sweep フラグ）がちがう
    expect(up).toContain(' 0 0 0 ');
    expect(down).toContain(' 0 0 1 ');
    expect(up.startsWith('M25 137.5')).toBe(true);
    expect(down.startsWith('M25 62.5')).toBe(true);
  });

  it('pickShapes：つづけて同じ形にしない・数がそろう・優先度の高い形が多め', () => {
    const rng = makeRng(3);
    const counts: Record<string, number> = {};
    let prev = '';
    const list = pickShapes(SHAPES, 400, {}, rng.next);
    expect(list.length).toBe(400);
    for (const s of list) {
      expect(s.shape).not.toBe(prev);
      prev = s.shape;
      counts[s.shape] = (counts[s.shape] ?? 0) + 1;
    }
    expect(counts.rect).toBeGreaterThan(counts.circle);
    // 1つしか候補がないときはそれをくりかえす
    expect(pickShapes([SHAPES[0]], 3, {}, rng.next).map((s) => s.shape)).toEqual(['rect', 'rect', 'rect']);
  });
});
