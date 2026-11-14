// 記録画面のグラフ（SVG 自作）。色だけで区別させない：目標線は点線＋文字、成功は塗り＋「○」。

export interface Pt {
  label: string; // x 軸の文字（例 11/14）
  value: number | null; // null = その日は記録なし
  n?: number; // その日の問題数
}

const W = 320;

export function LineChart({
  points,
  max,
  target,
  targetLabel,
  format,
  height = 150,
  color = '#2f6fdb',
  ariaLabel
}: {
  points: Pt[];
  max: number;
  target?: number;
  targetLabel?: string;
  format: (v: number) => string;
  height?: number;
  color?: string;
  ariaLabel: string;
}) {
  const L = 34;
  const R = 10;
  const T = 12;
  const B = 22;
  const iw = W - L - R;
  const ih = height - T - B;
  const n = points.length;
  const x = (i: number) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => T + ih - (Math.max(0, Math.min(max, v)) / max) * ih;
  const ticks = [0, max / 2, max];

  // 記録のない日で線を切る
  const segs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push({ i, v: p.value });
  });
  if (cur.length) segs.push(cur);

  const every = Math.max(1, Math.ceil(n / 7));
  const lastIdx = (() => {
    for (let i = n - 1; i >= 0; i--) if (points[i].value !== null) return i;
    return -1;
  })();

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={ariaLabel}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e8f0" strokeWidth={1} />
          <text x={L - 4} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#8a97ab" fontWeight={700}>
            {format(t)}
          </text>
        </g>
      ))}
      {target !== undefined && (
        <g>
          <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="#1e2a3b" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - R} y={y(target) - 4} textAnchor="end" fontSize={10} fill="#1e2a3b" fontWeight={900}>
            {targetLabel ?? `目標 ${format(target)}`}
          </text>
        </g>
      )}
      {segs.map((s, k) =>
        s.length > 1 ? (
          <polyline
            key={k}
            points={s.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null
      )}
      {points.map((p, i) =>
        p.value === null ? null : <circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill="#fff" stroke={color} strokeWidth={2.2} />
      )}
      {lastIdx >= 0 && (
        <text
          x={Math.min(W - R, Math.max(L, x(lastIdx)))}
          y={Math.max(10, y(points[lastIdx].value as number) - 8)}
          textAnchor={x(lastIdx) > W - 40 ? 'end' : 'middle'}
          fontSize={11}
          fontWeight={900}
          fill={color}
        >
          {format(points[lastIdx].value as number)}
        </text>
      )}
      {points.map((p, i) =>
        i % every === 0 || i === n - 1 ? (
          <text key={`x${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="#8a97ab" fontWeight={700}>
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  );
}

export interface WaitBar {
  label: string;
  minutes: number;
  success: boolean;
}

/** 待機練習の棒（成功＝塗り＋○、失敗＝白抜き＋×） */
export function WaitBars({ bars, height = 140 }: { bars: WaitBar[]; height?: number }) {
  const L = 30;
  const R = 6;
  const T = 16;
  const B = 22;
  const iw = W - L - R;
  const ih = height - T - B;
  const max = 20;
  const n = Math.max(1, bars.length);
  const slot = iw / n;
  const bw = Math.min(26, slot * 0.7);
  const y = (m: number) => T + ih - (Math.min(max, m) / max) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={bars.map((b) => `${b.label} ${b.minutes}分 ${b.success ? '成功' : '失敗'}`).join('、')}>
      {[5, 10, 15, 20].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e8f0" />
          <text x={L - 4} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#8a97ab" fontWeight={700}>
            {t}分
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = L + slot * i + slot / 2;
        const top = y(b.minutes);
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={T + ih - top}
              rx={4}
              fill={b.success ? '#157a78' : '#fff'}
              stroke="#157a78"
              strokeWidth={2}
              strokeDasharray={b.success ? undefined : '4 3'}
            />
            <text x={cx} y={top - 4} textAnchor="middle" fontSize={11} fontWeight={900} fill={b.success ? '#157a78' : '#a8321f'}>
              {b.success ? '○' : '×'}
            </text>
            {(bars.length <= 8 || i % Math.ceil(bars.length / 8) === 0) && (
              <text x={cx} y={height - 6} textAnchor="middle" fontSize={10} fill="#8a97ab" fontWeight={700}>
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
