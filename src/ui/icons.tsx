import type { CSSProperties } from 'react';

// 線のアイコン（stroke=currentColor）

const PATHS: Record<string, string[]> = {
  music: ['M9 18V5l11-2v13', 'C6 18 3', 'C17 16 3'],
  bubble: ['M4 5h16v11H10l-5 4v-4H4z', 'M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01'],
  shapes: ['M12 3l5 8H7z', 'R3 14 7 7 1', 'C17.5 17.5 3.5'],
  book: ['M2.5 5.5c3-1.2 6.5-1 9.5 1 3-2 6.5-2.2 9.5-1V19c-3-1.2-6.5-1-9.5 1-3-2-6.5-2.2-9.5-1z', 'M12 6.5V20'],
  pencil: ['M4 20l4.5-1L19 8.5 15.5 5 5 15.5z', 'M13.5 7l3.5 3.5'],
  question: ['C12 12 9', 'M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6', 'M12 17.2h.01'],
  chair: ['R7 3 10 7 2', 'M9 10v3M15 10v3', 'R5 13 14 3 1.5', 'M7 16v5M17 16v5'],
  list: ['M10 6h10M10 12h10M10 18h10', 'M3.5 6l1.3 1.3L7.5 4.5M3.5 12l1.3 1.3 2.7-2.8M3.5 18l1.3 1.3 2.7-2.8'],
  face: ['C12 12 9', 'C9 10.5 0.9', 'C15 10.5 0.9', 'M9 14.5c1.6 1.5 4.4 1.5 6 0'],
  smile: ['C12 12 9', 'C9 10.5 0.9', 'C15 10.5 0.9', 'M8.5 14.5c1.8 2 5.2 2 7 0'],
  parents: ['C9 8 3', 'M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6', 'C17 9 2.5', 'M15.5 14.3c.5-.2 1-.3 1.5-.3 2.4 0 4 1.9 4 4.5'],
  calendar: ['R3 5 18 16 2', 'M3 10h18M8 3v4M16 3v4'],
  check: ['M5 12l5 5 9-10'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  left: ['M15 6l-6 6 6 6'],
  right: ['M9 6l6 6-6 6'],
  down: ['M6 9l6 6 6-6'],
  x: ['M6 6l12 12M18 6L6 18'],
  speaker: ['M3.5 9h4l5-4v14l-5-4h-4z', 'M16 9.5c1.2 1.4 1.2 3.6 0 5', 'M19 7c2.4 2.8 2.4 7.2 0 10'],
  mic: ['R9 3 6 11 3', 'M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6'],
  refresh: ['M4 4v6h6', 'M5.5 15a8 8 0 1 0 1.4-8.6L4 10'],
  chart: ['M4 20V11M10 20V5M16 20v-6M21 20H3'],
  activity: ['M3 12h4l3-7 4 14 3-7h4'],
  notebook: ['R5 3 14 18 2', 'M9 8h6M9 12h6M9 16h3'],
  sliders: ['M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', 'C15 6 2', 'C9 12 2', 'C17 18 2'],
  grid: ['R3.5 3.5 7 7 1.5', 'R13.5 3.5 7 7 1.5', 'R3.5 13.5 7 7 1.5', 'R13.5 13.5 7 7 1.5'],
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
  download: ['M12 4v11M7 10l5 5 5-5M5 20h14'],
  upload: ['M12 20V9M7 14l5-5 5 5M5 4h14'],
  trash: ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'],
  sparkle: ['M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', 'M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  clock: ['C12 13 8', 'M12 9v4l2.5 2.5M9 2h6'],
  level: ['M4 20h4v-6H4zM10 20h4V9h-4zM16 20h4V4h-4z'],
  youtube: ['R2.5 6 19 12 3.5', 'M10 9.5v5l4.5-2.5z'],
  hand: ['M8 13V5.5a1.5 1.5 0 0 1 3 0V11', 'M11 11V4.5a1.5 1.5 0 0 1 3 0V11', 'M14 11V5.5a1.5 1.5 0 0 1 3 0V13', 'M8 13l-1.6-2a1.6 1.6 0 0 0-2.6 1.8L7 18c1.2 2 3 3 5.5 3h1A5.5 5.5 0 0 0 19 15.5V12']
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  const items = PATHS[name] ?? [];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0, ...style }}
    >
      {items.map((d, i) => {
        if (d[0] === 'C') {
          const [cx, cy, r] = d.slice(1).trim().split(/\s+/).map(Number);
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        if (d[0] === 'R') {
          const [x, y, w, h, rx] = d.slice(1).trim().split(/\s+/).map(Number);
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
        }
        return <path key={i} d={d} />;
      })}
    </svg>
  );
}

/** ◯△□◇などの形（線） */
export function ShapeGlyph({ shape, size = 24, stroke = 2.4 }: { shape: string; size?: number; stroke?: number }) {
  const d: Record<string, string> = {
    circle: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0',
    triangle: 'M12 4L20.5 19H3.5Z',
    square: 'M5 5H19V19H5Z',
    diamond: 'M12 2.5L19 12L12 21.5L5 12Z',
    rect: 'M2.5 7.5H21.5V16.5H2.5Z',
    halfUp: 'M3 16H21A9 9 0 0 0 3 16Z',
    halfDown: 'M3 8H21A9 9 0 0 1 3 8Z',
    star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={d[shape] ?? d.circle} style={{ fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinejoin: 'round' }} />
    </svg>
  );
}
