import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, finalize, INK, STRONG, SvgEmoji, type Draft } from './svg';

// パズル（絵の分割）— ノート：「3〜4枚の絵の分割（予）」
// 4つに分けた絵の1つが空いている。ぴったり入るかけらを選ぶ。
// まちがい：同じ絵の別のかけら／別の絵の同じ場所／正しいかけらを さかさま・裏返しにしたもの
// どの絵も、4つのかけらにそれぞれ向きの分かる物が入るように描く（さかさまにすると見分けられる）。

type SceneId = 'ie' | 'kuruma' | 'hana' | 'sakana';
const SCENES: SceneId[] = ['ie', 'kuruma', 'hana', 'sakana'];
const SCENE_KANA: Record<SceneId, string> = { ie: 'いえ', kuruma: 'くるま', hana: 'はな', sakana: 'さかな' };

function Rays({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#e0a800" strokeWidth={3} strokeLinecap="round">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return <line key={i} x1={cx + 21 * Math.cos(a)} y1={cy + 21 * Math.sin(a)} x2={cx + 28 * Math.cos(a)} y2={cy + 28 * Math.sin(a)} />;
      })}
    </g>
  );
}

function Scene({ id }: { id: SceneId }) {
  if (id === 'ie') {
    return (
      <g>
        <rect x={0} y={0} width={200} height={200} fill="#eaf4ff" />
        <rect x={0} y={152} width={200} height={48} fill="#d6efd9" />
        <g fill="#fff" stroke="#b9c6d8" strokeWidth={2}>
          <ellipse cx={30} cy={36} rx={18} ry={11} />
          <ellipse cx={48} cy={29} rx={16} ry={13} />
          <ellipse cx={63} cy={37} rx={14} ry={10} />
        </g>
        <circle cx={166} cy={36} r={16} fill="#ffd23f" stroke={INK} strokeWidth={2} />
        <Rays cx={166} cy={36} />
        <rect x={118} y={62} width={12} height={26} fill="#b5651d" stroke={INK} strokeWidth={2} />
        <rect x={56} y={100} width={78} height={62} fill="#ffe8d9" stroke={INK} strokeWidth={2.5} />
        <polygon points="46,102 95,58 144,102" fill={STRONG.red} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={102} y={124} width={20} height={38} fill="#8a5a2b" stroke={INK} strokeWidth={2} />
        <circle cx={117} cy={144} r={2.5} fill="#ffd23f" />
        <rect x={66} y={114} width={24} height={22} fill="#bfe0ff" stroke={INK} strokeWidth={2} />
        <path d="M 78 114 V 136 M 66 125 H 90" stroke={INK} strokeWidth={1.5} />
        <rect x={162} y={136} width={10} height={26} fill="#8a5a2b" stroke={INK} strokeWidth={2} />
        <circle cx={167} cy={124} r={20} fill="#5fb36a" stroke={INK} strokeWidth={2} />
        <line x1={22} y1={172} x2={22} y2={150} stroke="#3f9a4b" strokeWidth={3} />
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={22 + 6 * Math.cos((a * Math.PI) / 180)} cy={146 + 6 * Math.sin((a * Math.PI) / 180)} r={4.5} fill="#ff8fb1" stroke={INK} strokeWidth={1} />
        ))}
        <circle cx={22} cy={146} r={3} fill="#ffd23f" />
      </g>
    );
  }
  if (id === 'kuruma') {
    return (
      <g>
        <rect x={0} y={0} width={200} height={200} fill="#f3f9ff" />
        <rect x={0} y={164} width={200} height={36} fill="#c9d2e0" />
        <line x1={8} y1={182} x2={192} y2={182} stroke="#fff" strokeWidth={4} strokeDasharray="14 10" />
        <circle cx={34} cy={34} r={15} fill="#ffd23f" stroke={INK} strokeWidth={2} />
        <Rays cx={34} cy={34} />
        <path d="M 142 30 q 5 -7 10 0 q 5 -7 10 0 M 166 48 q 4 -6 8 0 q 4 -6 8 0" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <polygon points="56,112 78,80 134,80 156,112" fill="#5b8def" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={26} y={110} width={150} height={42} rx={10} fill="#5b8def" stroke={INK} strokeWidth={2.5} />
        <polygon points="68,110 84,86 102,86 102,110" fill="#dff1ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <polygon points="110,110 110,86 128,86 144,110" fill="#dff1ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={168} cy={124} r={5} fill="#ffd23f" stroke={INK} strokeWidth={1.5} />
        <rect x={26} y={120} width={10} height={8} fill={STRONG.red} stroke={INK} strokeWidth={1} />
        {[62, 142].map((x) => (
          <g key={x}>
            <circle cx={x} cy={152} r={15} fill={INK} />
            <circle cx={x} cy={152} r={6} fill="#c9d2e0" />
          </g>
        ))}
      </g>
    );
  }
  if (id === 'hana') {
    return (
      <g>
        <rect x={0} y={0} width={200} height={200} fill="#fff5f8" />
        <rect x={0} y={180} width={200} height={20} fill="#f0e0c8" />
        <SvgEmoji x={36} y={42} size={24} char="🐞" />
        <SvgEmoji x={164} y={40} size={30} char="🦋" />
        <SvgEmoji x={30} y={166} size={24} char="🐌" />
        <path d="M 100 140 C 104 120, 92 100, 98 70" stroke="#3f9a4b" strokeWidth={5} fill="none" strokeLinecap="round" />
        <ellipse cx={84} cy={118} rx={16} ry={7} transform="rotate(-30 84 118)" fill="#5fb36a" stroke={INK} strokeWidth={1.5} />
        <ellipse cx={117} cy={104} rx={15} ry={7} transform="rotate(30 117 104)" fill="#5fb36a" stroke={INK} strokeWidth={1.5} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <circle key={a} cx={98 + 14 * Math.cos((a * Math.PI) / 180)} cy={62 + 14 * Math.sin((a * Math.PI) / 180)} r={11} fill="#ff8fb1" stroke={INK} strokeWidth={1.5} />
        ))}
        <circle cx={98} cy={62} r={9} fill="#ffd23f" stroke={INK} strokeWidth={1.5} />
        <rect x={62} y={138} width={76} height={12} fill="#c96a1a" stroke={INK} strokeWidth={2} />
        <polygon points="68,150 132,150 124,186 76,186" fill="#e07a1f" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={164} cy={184} r={5} fill="#b9c6d8" stroke={INK} strokeWidth={1} />
        <circle cx={177} cy={186} r={4} fill="#b9c6d8" stroke={INK} strokeWidth={1} />
        <circle cx={170} cy={176} r={3.5} fill="#b9c6d8" stroke={INK} strokeWidth={1} />
      </g>
    );
  }
  return (
    <g>
      <rect x={0} y={0} width={200} height={200} fill="#dff1ff" />
      <path d="M 0 178 Q 50 166 100 178 T 200 178 V 200 H 0 Z" fill="#f6e7b8" />
      <g fill="none" stroke="#5b8def" strokeWidth={2}>
        <circle cx={34} cy={42} r={8} />
        <circle cx={48} cy={22} r={5} />
        <circle cx={24} cy={18} r={4} />
      </g>
      <ellipse cx={158} cy={38} rx={14} ry={8} fill="#5b8def" stroke={INK} strokeWidth={1.5} />
      <polygon points="171,38 184,29 184,47" fill="#5b8def" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={152} cy={36} r={2} fill={INK} />
      <path d="M 24 196 C 14 176, 34 164, 22 144 C 14 132, 30 124, 24 110" stroke="#3f9a4b" strokeWidth={6} fill="none" strokeLinecap="round" />
      <polygon points="146,100 182,74 182,126" fill="#ff9f43" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={100} cy={100} rx={54} ry={32} fill="#ff9f43" stroke={INK} strokeWidth={2.5} />
      <path d="M 92 72 Q 100 100 92 128 M 114 71 Q 122 100 114 129" stroke="#e07a1f" strokeWidth={5} fill="none" />
      <circle cx={66} cy={92} r={7} fill="#fff" stroke={INK} strokeWidth={2} />
      <circle cx={64} cy={92} r={3.5} fill={INK} />
      <path d="M 48 106 Q 54 111 60 106" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      <polygon
        points={Array.from({ length: 10 }, (_, i) => {
          const a = ((-90 + i * 36) * Math.PI) / 180;
          const rr = i % 2 === 0 ? 15 : 7;
          return `${(168 + rr * Math.cos(a)).toFixed(1)},${(176 + rr * Math.sin(a)).toFixed(1)}`;
        }).join(' ')}
        fill="#ffb23f"
        stroke={INK}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </g>
  );
}

const Q: [number, number][] = [
  [0, 0],
  [100, 0],
  [0, 100],
  [100, 100]
];
const Q_KANA = ['ひだりうえ', 'みぎうえ', 'ひだりした', 'みぎした'];

type Tf = 'none' | 'rot' | 'mir';

function Piece({ scene, q, t }: { scene: SceneId; q: number; t: Tf }) {
  const [x, y] = Q[q];
  const cx = x + 50;
  const cy = y + 50;
  const tr = t === 'rot' ? `rotate(180 ${cx} ${cy})` : t === 'mir' ? `translate(${2 * cx} 0) scale(-1 1)` : undefined;
  return (
    <svg viewBox={`${x} ${y} 100 100`} style={CHOICE_STYLE} aria-hidden="true">
      <g transform={tr}>
        <Scene id={scene} />
      </g>
      <rect x={x + 1} y={y + 1} width={98} height={98} fill="none" stroke={INK} strokeWidth={2.5} />
    </svg>
  );
}

export function generatePuzzle(rng: Rng) {
  const scene = rng.pick(SCENES);
  const q = rng.int(0, 3);
  const q2 = rng.pick([0, 1, 2, 3].filter((x) => x !== q));
  const scene2 = rng.pick(SCENES.filter((s) => s !== scene));
  const tf: Tf = rng.chance(0.5) ? 'rot' : 'mir';
  const [qx, qy] = Q[q];
  const d = (key: string, s: SceneId, qq: number, t: Tf): Draft => ({ key, sig: `${s}-${qq}-${t}`, node: <Piece scene={s} q={qq} t={t} /> });
  return finalize(rng, {
    type: 'zukei-puzzle',
    prompt: 'あいている ところに ぴったり はいる かけらは どれですか。',
    speech: '空いている ところに、ぴったり 入る かけらは どれですか。',
    figure: (
      <svg viewBox="0 0 200 200" style={FIG_STYLE} aria-hidden="true">
        <Scene id={scene} />
        <line x1={100} y1={0} x2={100} y2={200} stroke={INK} strokeWidth={1.5} strokeDasharray="6 5" opacity={0.45} />
        <line x1={0} y1={100} x2={200} y2={100} stroke={INK} strokeWidth={1.5} strokeDasharray="6 5" opacity={0.45} />
        <rect x={qx + 1.5} y={qy + 1.5} width={97} height={97} fill="#fff" stroke={INK} strokeWidth={2} strokeDasharray="7 5" />
        <text x={qx + 50} y={qy + 52} fontSize={44} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#8a97ab">
          ？
        </text>
        <rect x={1} y={1} width={198} height={198} rx={6} fill="none" stroke={INK} strokeWidth={2.5} />
      </svg>
    ),
    choices: [d('ok', scene, q, 'none'), d('wrong', scene, q2, 'none'), d('other', scene2, q, 'none'), d('turned', scene, q, tf)],
    answerKey: 'ok',
    params: { scene, q, q2, scene2, tf },
    explain: `${SCENE_KANA[scene]}の絵の${Q_KANA[q]}のかけら（向きもそのまま）`
  });
}

export const puzzleType: QuestionType = {
  id: 'zukei-puzzle',
  name: 'パズル（絵の分割）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '4つに分けた絵の1つが空いている。ぴったり入るかけらを選ぶ。同じ絵の別のかけら・別の絵・さかさま（裏返し）のかけらを混ぜる。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generatePuzzle
};
