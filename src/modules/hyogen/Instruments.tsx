import type { InstrumentId } from './sounds';

// 楽器の絵（SVG）

export function InstrumentIcon({ id, size = 84 }: { id: InstrumentId; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 100 100', 'aria-hidden': true as const };
  switch (id) {
    case 'triangle':
      return (
        <svg {...common}>
          <path d="M50 14 L84 78 L20 78 L44 32" style={{ fill: 'none', stroke: '#7b8796', strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
          <path d="M50 14 C50 8 50 6 50 4" style={{ fill: 'none', stroke: '#c2531f', strokeWidth: 3, strokeLinecap: 'round' }} />
          <path d="M62 96 L80 58" style={{ fill: 'none', stroke: '#4f5e74', strokeWidth: 4, strokeLinecap: 'round' }} />
        </svg>
      );
    case 'castanets':
      return (
        <svg {...common}>
          <path d="M18 54 A32 32 0 0 1 82 54 Z" style={{ fill: '#e05a4f', stroke: '#1e2a3b', strokeWidth: 3, strokeLinejoin: 'round' }} />
          <path d="M18 60 A32 32 0 0 0 82 60 Z" style={{ fill: '#3f6fd8', stroke: '#1e2a3b', strokeWidth: 3, strokeLinejoin: 'round' }} />
          <path d="M44 57 H56" style={{ stroke: '#1e2a3b', strokeWidth: 3, strokeLinecap: 'round' }} />
          <circle cx={50} cy={57} r={4} style={{ fill: '#fff', stroke: '#1e2a3b', strokeWidth: 2 }} />
        </svg>
      );
    case 'tambourine':
      return (
        <svg {...common}>
          <circle cx={50} cy={50} r={34} style={{ fill: '#fff6dc', stroke: '#c48a3a', strokeWidth: 9 }} />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={50 + 34 * Math.cos(r)}
                cy={50 + 34 * Math.sin(r)}
                r={6}
                style={{ fill: '#e8c547', stroke: '#8a6a10', strokeWidth: 2 }}
              />
            );
          })}
        </svg>
      );
    case 'bell':
    default:
      return (
        <svg {...common}>
          <path d="M50 10 V30" style={{ stroke: '#c2531f', strokeWidth: 4, strokeLinecap: 'round' }} />
          <path d="M26 44 Q50 18 74 44" style={{ fill: 'none', stroke: '#c2531f', strokeWidth: 4, strokeLinecap: 'round' }} />
          {[
            [28, 62],
            [50, 70],
            [72, 62]
          ].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={13} style={{ fill: '#f2c94c', stroke: '#8a6a10', strokeWidth: 3 }} />
              <path d={`M${x - 6} ${y + 3} H${x + 6}`} style={{ stroke: '#8a6a10', strokeWidth: 2.5, strokeLinecap: 'round' }} />
              <circle cx={x} cy={y + 7} r={2} style={{ fill: '#8a6a10' }} />
            </g>
          ))}
        </svg>
      );
  }
}
