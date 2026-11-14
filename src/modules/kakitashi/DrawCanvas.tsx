import { useEffect, useRef, type MutableRefObject, type PointerEvent as RPointerEvent } from 'react';
import { shapePathD, type ShapeId } from './shapes';
import { resample, type Pt, type TraceKind } from './trace';

// 指で描くキャンバス（Pointer Events）。黒1色・太さ固定・消しゴムなし。
// 下の層（形・点線）と上の層（なぞった線）の2枚重ね。線のデータは strokesRef に入れる（CSS px）。

export const PEN_COLOR = '#16181d';
export const PEN_WIDTH = 4.5;
export const SHAPE_COLOR = '#d0453a';

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function setupPen(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = PEN_COLOR;
  ctx.fillStyle = PEN_COLOR;
  ctx.lineWidth = PEN_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Pt[][]) {
  ctx.save();
  setupPen(ctx);
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, PEN_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

/** 形を1つ、中央に赤っぽい線で描く */
export function shapePainter(shape: ShapeId): Painter {
  return (ctx, w, h) => {
    const s = Math.min(w, h) * 0.3;
    ctx.save();
    ctx.strokeStyle = SHAPE_COLOR;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(shapePathD(shape, w / 2, h / 2, s)));
    ctx.restore();
  };
}

/** なぞる点線と、はじめ（みどり）・おわり（あか）の印 */
export function tracePainter(path: Pt[], kind: TraceKind): Painter {
  return (ctx, w) => {
    ctx.save();
    if (kind !== 'line') {
      ctx.fillStyle = '#7d8aa0';
      for (const p of resample(path, Math.max(9, w * 0.03))) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const a = path[0];
    const b = path[path.length - 1];
    ctx.fillStyle = '#24734a';
    ctx.beginPath();
    ctx.arc(a.x, a.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
}

/** 形＋描いた線を PNG にする（ネタ帳に保存する用） */
export function renderPng(w: number, h: number, paint: Painter, strokes: Pt[][], scale = 1.5): string {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  paint(ctx, w, h);
  drawStrokes(ctx, strokes);
  return c.toDataURL('image/png');
}

interface Props {
  width: number;
  height: number;
  paint: Painter;
  enabled: boolean;
  resetKey: number;
  strokesRef: MutableRefObject<Pt[][]>;
  onFirstStroke?: () => void;
  onStrokesChange?: (n: number) => void;
}

export function DrawCanvas({ width, height, paint, enabled, resetKey, strokesRef, onFirstStroke, onStrokesChange }: Props) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const active = useRef<number | null>(null);
  const cur = useRef<Pt[] | null>(null);
  const dpr = typeof window !== 'undefined' ? Math.min(3, window.devicePixelRatio || 1) : 1;

  // 下の層（形・点線）
  useEffect(() => {
    const c = bgRef.current;
    if (!c) return;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    paint(ctx, width, height);
  }, [width, height, paint, dpr]);

  // 上の層（描いた線）を消す
  useEffect(() => {
    const c = inkRef.current;
    if (!c) return;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    strokesRef.current = [];
    cur.current = null;
    active.current = null;
    onStrokesChange?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, resetKey, dpr]);

  // 描けなくなったら（時間切れなど）、描きかけの線を終える
  useEffect(() => {
    if (!enabled && active.current !== null) {
      active.current = null;
      cur.current = null;
      onStrokesChange?.(strokesRef.current.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = inkRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) * width * 10) / r.width) / 10,
      y: Math.round(((e.clientY - r.top) * height * 10) / r.height) / 10
    };
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!enabled || active.current !== null) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    active.current = e.pointerId;
    const p = local(e);
    const s: Pt[] = [p];
    cur.current = s;
    const first = strokesRef.current.length === 0;
    strokesRef.current.push(s);
    const ctx = inkRef.current!.getContext('2d');
    if (ctx) {
      setupPen(ctx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, PEN_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (first) onFirstStroke?.();
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== active.current || !cur.current) return;
    const native = e.nativeEvent as PointerEvent;
    const co = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const list: { clientX: number; clientY: number }[] = co.length ? co : [native];
    const ctx = inkRef.current!.getContext('2d');
    if (!ctx) return;
    setupPen(ctx);
    const s = cur.current;
    for (const ev of list) {
      const p = local(ev);
      const last = s[s.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.8) continue;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      s.push(p);
    }
  };

  const onEnd = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    cur.current = null;
    onStrokesChange?.(strokesRef.current.length);
  };

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        margin: '0 auto',
        borderRadius: 18,
        overflow: 'hidden',
        border: '2px solid var(--line)',
        background: '#fff'
      }}
    >
      <canvas ref={bgRef} style={{ position: 'absolute', inset: 0, width, height }} aria-hidden="true" />
      <canvas
        ref={inkRef}
        role="img"
        aria-label="おえかきの かみ"
        style={{ position: 'absolute', inset: 0, width, height, touchAction: 'none', cursor: enabled ? 'crosshair' : 'default' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
