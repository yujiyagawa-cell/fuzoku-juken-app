import type { ArmPos, LegPos, Pose } from './poses';

// 棒人間（SVG）。むかって左側の手足の座標を決めて、右側は左右反転して描く。

type P = [number, number];

const SHOULDER: P = [45, 46];
const HIP: P = [47, 84];

// [ひじ, て]
const ARM: Record<ArmPos, [P, P]> = {
  down: [
    [39, 64],
    [35, 82]
  ],
  side: [
    [30, 46],
    [14, 45]
  ],
  up: [
    [40, 28],
    [37, 8]
  ],
  diag: [
    [33, 34],
    [19, 20]
  ],
  hip: [
    [29, 62],
    [42, 78]
  ],
  head: [
    [28, 30],
    [40, 13]
  ]
};

// [ひざ, あし]
const LEG: Record<LegPos, [P, P]> = {
  stand: [
    [44, 108],
    [41, 134]
  ],
  side: [
    [36, 106],
    [24, 131]
  ],
  lift: [
    [33, 98],
    [40, 118]
  ]
};

const mirror = (p: P): P => [100 - p[0], p[1]];

function limb(start: P, joints: [P, P], flip: boolean, key: string, end: 'hand' | 'foot') {
  const [a, b] = flip ? [mirror(joints[0]), mirror(joints[1])] : joints;
  const s = flip ? mirror(start) : start;
  return (
    <g key={key}>
      <polyline points={`${s[0]},${s[1]} ${a[0]},${a[1]} ${b[0]},${b[1]}`} />
      {end === 'hand' ? (
        <circle cx={b[0]} cy={b[1]} r={3.6} style={{ fill: '#1e2a3b' }} />
      ) : (
        <line x1={b[0]} y1={b[1]} x2={b[0] + (flip ? 6 : -6)} y2={b[1]} />
      )}
    </g>
  );
}

export function StickFigure({ pose, size = 220, ghost = false, label }: { pose: Pose; size?: number; ghost?: boolean; label?: string }) {
  return (
    <svg
      viewBox="0 0 100 140"
      width={(size * 100) / 140}
      height={size}
      role="img"
      aria-label={label ?? 'せんせいの ポーズ'}
      style={{ opacity: ghost ? 0.25 : 1, overflow: 'visible' }}
    >
      <g style={{ fill: 'none', stroke: '#1e2a3b', strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <line x1={50} y1={34} x2={50} y2={84} />
        <line x1={44} y1={84} x2={56} y2={84} />
        {limb(SHOULDER, ARM[pose.la], false, 'la', 'hand')}
        {limb(SHOULDER, ARM[pose.ra], true, 'ra', 'hand')}
        {limb(HIP, LEG[pose.ll], false, 'll', 'foot')}
        {limb(HIP, LEG[pose.rl], true, 'rl', 'foot')}
      </g>
      <circle cx={50} cy={22} r={12} style={{ fill: '#ffe4ec', stroke: '#1e2a3b', strokeWidth: 4 }} />
      <circle cx={45.5} cy={21} r={1.8} style={{ fill: '#1e2a3b' }} />
      <circle cx={54.5} cy={21} r={1.8} style={{ fill: '#1e2a3b' }} />
      <path d="M45.5 26.5c2.6 2.2 6.4 2.2 9 0" style={{ fill: 'none', stroke: '#1e2a3b', strokeWidth: 1.8, strokeLinecap: 'round' }} />
    </svg>
  );
}
