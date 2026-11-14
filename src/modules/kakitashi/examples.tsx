import type { ReactNode } from 'react';
import type { ShapeId } from './shapes';

// 「こんな えも かけるよ」の見本の絵（手書きノート 10・12〜16枚目の作例を、SVG で描きなおしたもの）
// 赤い線 ＝ 紙に はじめから かいてある形。黒い線 ＝ かきたした ところ。

const RED = '#d0453a';
const INK = '#1e2a3b';

export interface ExampleArt {
  id: string;
  kidName: string; // ひらがな
  art: ReactNode; // viewBox 0 0 100 100 の中身
}

// 赤い形（線を太く）
function Red({ children }: { children: ReactNode }) {
  return (
    <g fill="none" stroke={RED} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

// かきたした線
function Ink({ children }: { children: ReactNode }) {
  return (
    <g fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

const dot = (x: number, y: number, r = 2.6) => <circle cx={x} cy={y} r={r} fill={INK} stroke="none" />;

export const SHAPE_EXAMPLES: Record<ShapeId, ExampleArt[]> = {
  rect: [
    {
      id: 'densha',
      kidName: 'でんしゃ',
      art: (
        <>
          <Ink>
            <rect x="5" y="42" width="24" height="24" rx="5" />
            <rect x="71" y="42" width="24" height="24" rx="5" />
            <rect x="37" y="45" width="7" height="7" />
            <rect x="47" y="45" width="7" height="7" />
            <rect x="57" y="45" width="7" height="7" />
            <path d="M43 40 L50 31 L57 40 M41 31 H59" />
            <path d="M2 76 H98" />
            {[12, 23, 40, 60, 77, 88].map((x) => (
              <circle key={x} cx={x} cy={70} r={3.5} />
            ))}
          </Ink>
          <Red>
            <rect x="32" y="40" width="36" height="26" rx="2" />
          </Red>
        </>
      )
    },
    {
      id: 'hata',
      kidName: 'はた',
      art: (
        <>
          <Ink>
            <path d="M30 20 V92" />
            <circle cx="30" cy="16" r="3.5" />
            <path d="M22 92 H38" />
          </Ink>
          <circle cx="54" cy="39" r="8" fill={RED} />
          <Red>
            <rect x="30" y="24" width="48" height="30" />
          </Red>
        </>
      )
    },
    {
      id: 'masuku',
      kidName: 'ますく',
      art: (
        <>
          <Ink>
            <path d="M28 44 C12 40 12 64 28 62" />
            <path d="M72 44 C88 40 88 64 72 62" />
            <path d="M33 47 H67 M33 53 H67 M33 59 H67" />
            <path d="M38 28 Q42 25 46 28 M54 28 Q58 25 62 28" />
          </Ink>
          <Red>
            <rect x="28" y="38" width="44" height="30" rx="7" />
          </Red>
        </>
      )
    }
  ],
  triangle: [
    {
      id: 'toire',
      kidName: 'といれの まーく',
      art: (
        <>
          <Ink>
            <circle cx="50" cy="27" r="8" />
            <path d="M45 46 L34 60 M55 46 L66 60" />
            <path d="M44 80 V94 M56 80 V94" />
          </Ink>
          <Red>
            <path d="M50 38 L31 80 H69 Z" />
          </Red>
        </>
      )
    },
    {
      id: 'shiiso',
      kidName: 'しーそー',
      art: (
        <>
          <Ink>
            <path d="M10 51.5 L90 72.5" />
            <path d="M4 82 H96" />
            <circle cx="20" cy="47" r="5.5" />
            <path d="M20 41 V37" />
            <circle cx="70" cy="60" r="5.5" />
            <path d="M70 54 V50" />
            <circle cx="82" cy="63" r="5.5" />
            <path d="M82 57 V53" />
          </Ink>
          <Red>
            <path d="M50 62 L39 82 H61 Z" />
          </Red>
        </>
      )
    },
    {
      id: 'ie-yane',
      kidName: 'いえの やね',
      art: (
        <>
          <Ink>
            <rect x="66" y="22" width="8" height="14" />
            <rect x="24" y="46" width="52" height="42" />
            <rect x="44" y="66" width="12" height="22" />
            <rect x="30" y="54" width="10" height="10" />
          </Ink>
          <Red>
            <path d="M50 16 L16 46 H84 Z" />
          </Red>
        </>
      )
    },
    {
      id: 'ika',
      kidName: 'いか',
      art: (
        <>
          <Ink>
            <rect x="35" y="44" width="30" height="24" rx="4" />
            {dot(44, 55)}
            {dot(56, 55)}
            {[37, 44, 50, 56, 63].map((x) => (
              <path key={x} d={`M${x} 68 q-3 6 0 12 q3 6 0 12`} />
            ))}
          </Ink>
          <Red>
            <path d="M50 10 L31 44 H69 Z" />
          </Red>
        </>
      )
    }
  ],
  halfUp: [
    {
      id: 'kame',
      kidName: 'かめ',
      art: (
        <>
          <Ink>
            <path d="M36 62 V48 M64 62 V48 M36 48 Q50 41 64 48 M24 56 L36 52 M76 56 L64 52" />
            <circle cx="86" cy="56" r="7" />
            {dot(88, 54, 1.8)}
            <ellipse cx="32" cy="67" rx="6" ry="4" />
            <ellipse cx="68" cy="67" rx="6" ry="4" />
            <path d="M22 60 L13 64 L22 64" />
          </Ink>
          <Red>
            <path d="M22 62 A28 28 0 0 1 78 62 Z" />
          </Red>
        </>
      )
    },
    {
      id: 'boushi',
      kidName: 'ぼうしの こ',
      art: (
        <>
          <Ink>
            <path d="M18 42 H82" strokeWidth={4} />
            <circle cx="50" cy="60" r="18" />
            {dot(43, 58)}
            {dot(57, 58)}
            <path d="M43 67 Q50 72 57 67" />
          </Ink>
          <Red>
            <path d="M28 41 A22 22 0 0 1 72 41 Z" />
          </Red>
        </>
      )
    }
  ],
  halfDown: [
    {
      id: 'warai',
      kidName: 'わらった かお',
      art: (
        <>
          <Ink>
            <circle cx="50" cy="50" r="34" />
            <path d="M36 40 Q40 35 44 40 M56 40 Q60 35 64 40" />
          </Ink>
          <Red>
            <path d="M36 56 A14 14 0 0 0 64 56 Z" />
          </Red>
        </>
      )
    },
    {
      id: 'kazaguruma',
      kidName: 'かざぐるま',
      art: (
        <>
          <Ink>
            <path d="M50 44 V96" />
            {[90, 180, 270].map((deg) => (
              <path key={deg} d="M50 44 A16 16 0 0 0 82 44 Z" transform={`rotate(${deg} 50 44)`} />
            ))}
          </Ink>
          <Red>
            <path d="M50 44 A16 16 0 0 0 82 44 Z" />
          </Red>
          {dot(50, 44, 3)}
        </>
      )
    },
    {
      id: 'tonbo',
      kidName: 'とんぼ',
      art: (
        <>
          <Ink>
            <circle cx="50" cy="20" r="6" />
            {dot(47, 19, 1.8)}
            {dot(53, 19, 1.8)}
            <path d="M50 26 V92" strokeWidth={4} />
            <path d="M48 36 A13 13 0 0 1 22 36 Z" />
            <path d="M52 48 A10 10 0 0 0 72 48 Z" />
            <path d="M48 48 A10 10 0 0 1 28 48 Z" />
          </Ink>
          <Red>
            <path d="M52 36 A13 13 0 0 0 78 36 Z" />
          </Red>
        </>
      )
    }
  ],
  square: [
    {
      id: 'saikoro',
      kidName: 'さいころ',
      art: (
        <>
          <Ink>
            <path d="M24 36 L36 24 H76 L64 36" />
            <path d="M64 76 L76 64 V24" />
            {dot(34, 46, 3.5)}
            {dot(54, 46, 3.5)}
            {dot(34, 66, 3.5)}
            {dot(54, 66, 3.5)}
          </Ink>
          <Red>
            <rect x="24" y="36" width="40" height="40" />
          </Red>
        </>
      )
    },
    {
      id: 'ie',
      kidName: 'いえ',
      art: (
        <>
          <Ink>
            <path d="M50 18 L20 46 H80 Z" />
            <rect x="62" y="24" width="7" height="13" />
            <rect x="34" y="54" width="11" height="11" />
            <path d="M39.5 54 V65 M34 59.5 H45" />
            <rect x="53" y="66" width="12" height="24" />
          </Ink>
          <Red>
            <rect x="28" y="46" width="44" height="44" />
          </Red>
        </>
      )
    },
    {
      id: 'onigiri',
      kidName: 'おにぎり',
      art: (
        <>
          <Ink>
            <path d="M50 14 Q56 14 60 22 L85 72 Q89 84 77 84 H23 Q11 84 15 72 L40 22 Q44 14 50 14 Z" />
            {dot(44, 46, 1.6)}
            {dot(56, 40, 1.6)}
            {dot(52, 52, 1.6)}
          </Ink>
          <rect x="38" y="60" width="24" height="24" fill="#3a4a3f" stroke="none" opacity="0.35" />
          <Red>
            <rect x="38" y="60" width="24" height="24" />
          </Red>
        </>
      )
    }
  ],
  diamond: [
    {
      id: 'tori',
      kidName: 'とり',
      art: (
        <>
          <Ink>
            <circle cx="46" cy="40" r="16" />
            {dot(51, 35, 2.4)}
            <ellipse cx="38" cy="70" rx="24" ry="15" />
            <path d="M24 66 Q34 76 46 66" />
            <path d="M32 85 V95 M44 85 V95 M28 95 H36 M40 95 H48" />
          </Ink>
          <Red>
            <path d="M70 30 L78 42 L70 54 L62 42 Z" />
          </Red>
        </>
      )
    }
  ],
  circle: [
    {
      id: 'kao',
      kidName: 'かお',
      art: (
        <>
          <Ink>
            {dot(40, 46, 3)}
            {dot(60, 46, 3)}
            <path d="M40 60 Q50 68 60 60" />
            <path d="M34 26 Q38 16 46 22 M50 21 Q56 12 62 22" />
          </Ink>
          <Red>
            <circle cx="50" cy="50" r="30" />
          </Red>
        </>
      )
    },
    {
      id: 'taiyou',
      kidName: 'たいよう',
      art: (
        <>
          <Ink>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              const x1 = 50 + Math.cos(a) * 28;
              const y1 = 50 + Math.sin(a) * 28;
              const x2 = 50 + Math.cos(a) * 40;
              const y2 = 50 + Math.sin(a) * 40;
              return <path key={i} d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
            })}
            {dot(43, 46, 2.4)}
            {dot(57, 46, 2.4)}
            <path d="M43 56 Q50 61 57 56" />
          </Ink>
          <Red>
            <circle cx="50" cy="50" r="20" />
          </Red>
        </>
      )
    },
    {
      id: 'booru',
      kidName: 'ぼーる',
      art: (
        <>
          <Ink>
            <path d="M28 46 Q50 36 72 46 M28 58 Q50 68 72 58" />
            <path d="M10 36 H18 M8 50 H16 M10 64 H18" />
          </Ink>
          <Red>
            <circle cx="50" cy="52" r="24" />
          </Red>
        </>
      )
    }
  ]
};

/** 見本の絵1まい */
export function ExampleCard({ ex, size = 100 }: { ex: ExampleArt; size?: number }) {
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={ex.kidName} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--line)' }}>
        {ex.art}
      </svg>
      <figcaption style={{ fontSize: 13, fontWeight: 900 }}>{ex.kidName}</figcaption>
    </figure>
  );
}

/** その形の見本を横に並べる（はみ出したら横にすべらせる） */
export function ShapeExamples({ shape, size = 96 }: { shape: ShapeId; size?: number }) {
  const list = SHAPE_EXAMPLES[shape] ?? [];
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      {list.map((ex) => (
        <ExampleCard key={ex.id} ex={ex} size={size} />
      ))}
    </div>
  );
}
