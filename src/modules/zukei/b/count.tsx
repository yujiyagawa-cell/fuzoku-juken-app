import type { Rng } from '../../../core/rng';
import type { QuestionType, TapQuestion } from '../../../player/types';
import { emo } from '../../../ui/emoji';
import { emojiChoice, FIG_STYLE, FILL, INK, numberChoices, SvgEmoji } from './common';

// 数の問題：多い・少ない、手袋・くつした

// =====================================================================
// 多い・少ない
// =====================================================================

export const MORE_LESS_PAIRS: [string, string][] = [
  ['ringo', 'mikan'],
  ['inu', 'neko'],
  ['choucho', 'hachi'],
  ['usagi', 'kame'],
  ['ichigo', 'budou'],
  ['kuruma', 'basu'],
  ['hoshi', 'tsuki']
];

/** 6列×3行のマスに、少しずらして置く位置（生成のときに決める） */
function scatterPositions(rng: Rng, n: number): [number, number][] {
  const slots = rng.sample(
    Array.from({ length: 18 }, (_, i) => i),
    n
  );
  return slots.map((s) => [26 + (s % 6) * 50 + rng.int(-7, 7), 28 + Math.floor(s / 6) * 50 + rng.int(-6, 6)]);
}

function Scatter({ items, pos }: { items: string[]; pos: [number, number][] }) {
  return (
    <svg viewBox="0 0 300 156" style={FIG_STYLE} role="img" aria-label="え">
      <rect x={2} y={2} width={296} height={152} rx={14} fill="#fff" stroke="#e3e8f0" strokeWidth={2} />
      {items.map((char, i) => (
        <SvgEmoji key={i} x={pos[i][0]} y={pos[i][1]} char={char} size={34} />
      ))}
    </svg>
  );
}

function generateMoreLess(rng: Rng): TapQuestion {
  const [aId, bId] = rng.pick(MORE_LESS_PAIRS);
  const swap = rng.chance(0.5);
  const moreId = swap ? bId : aId;
  const lessId = swap ? aId : bId;
  const more = emo(moreId);
  const less = emo(lessId);
  const variant: 'which' | 'diff' = rng.chance(0.55) ? 'which' : 'diff';
  const d = variant === 'which' ? rng.int(1, 3) : rng.int(1, 4);
  const moreN = rng.int(Math.max(4, d + 2), 9);
  const lessN = moreN - d;
  const items = rng.shuffle([...Array(moreN).fill(more.char), ...Array(lessN).fill(less.char)]);
  const figure = <Scatter items={items} pos={scatterPositions(rng, items.length)} />;
  if (variant === 'which') {
    const pair = rng.shuffle([more, less]);
    return {
      type: 'zukei-more-less',
      prompt: `${pair[0].kana}と ${pair[1].kana}、どちらが おおいですか。`,
      speech: `${pair[0].kana}と ${pair[1].kana}、どちらが 多いですか。`,
      figure,
      choices: pair.map((e) => emojiChoice(e.id, e.char, e.kana, { size: 60 })),
      answer: more.id,
      cols: 2,
      choiceHeight: 104,
      explain: `${more.kana} ${moreN}・${less.kana} ${lessN}`,
      params: { variant, moreId, lessId, moreN, lessN }
    };
  }
  const { choices, answerId } = numberChoices(rng, d, { min: 1, max: 6 });
  return {
    type: 'zukei-more-less',
    prompt: `${more.kana}は ${less.kana}より いくつ おおいですか。`,
    speech: `${more.kana}は、${less.kana}より いくつ 多いですか。`,
    figure,
    choices,
    answer: answerId,
    cols: 4,
    choiceHeight: 96,
    explain: `${more.kana} ${moreN} − ${less.kana} ${lessN} ＝ ${d}`,
    params: { variant, moreId, lessId, moreN, lessN, d }
  };
}

export const moreLessType: QuestionType = {
  id: 'zukei-more-less',
  name: '多い・少ない',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '365日',
  description: 'ばらばらに置いた2種類の絵を数えて「どちらが多いか」「いくつ多いか」を答える。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateMoreLess
};

// =====================================================================
// 手袋・くつした
// =====================================================================

type WearId = 'tebukuro' | 'kutsushita' | 'kutsu' | 'boushi';

export const WEAR: Record<WearId, { k: string; s: string; per: 1 | 2; verbK: string; verbS: string }> = {
  tebukuro: { k: 'てぶくろ', s: '手袋', per: 2, verbK: 'てぶくろを します', verbS: '手袋を します' },
  kutsushita: { k: 'くつした', s: '靴下', per: 2, verbK: 'くつしたを はきます', verbS: '靴下を はきます' },
  kutsu: { k: 'くつ', s: '靴', per: 2, verbK: 'くつを はきます', verbS: '靴を はきます' },
  boushi: { k: 'ぼうし', s: '帽子', per: 1, verbK: 'ぼうしを かぶります', verbS: '帽子を かぶります' }
};

function Mitten({ x, y, flip, color }: { x: number; y: number; flip: boolean; color: string }) {
  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      <ellipse cx={-11} cy={-2} rx={5} ry={9} transform="rotate(-25 -11 -2)" fill={color} stroke={INK} strokeWidth={2} />
      <rect x={-8} y={-18} width={20} height={30} rx={10} fill={color} stroke={INK} strokeWidth={2} />
      <rect x={-9} y={9} width={22} height={9} rx={2} fill="#fff" stroke={INK} strokeWidth={2} />
    </g>
  );
}

function Sock({ x, y, flip, color }: { x: number; y: number; flip: boolean; color: string }) {
  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      <path d="M-8 -16 H8 V4 L16 9 Q21 13 17 18 Q13 21 8 18 L-6 9 Q-10 6 -8 1 Z" fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <rect x={-9} y={-21} width={18} height={7} rx={2} fill="#fff" stroke={INK} strokeWidth={2} />
    </g>
  );
}

function WearItem({ id, x, y, flip, color }: { id: WearId; x: number; y: number; flip: boolean; color: string }) {
  if (id === 'tebukuro') return <Mitten x={x} y={y} flip={flip} color={color} />;
  if (id === 'kutsushita') return <Sock x={x} y={y} flip={flip} color={color} />;
  const char = id === 'kutsu' ? '👟' : '🧢';
  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      <SvgEmoji x={0} y={0} char={char} size={34} />
    </g>
  );
}

const KIDS = ['👧', '👦'];

const WEAR_COLORS = ['#f5a3bd', '#9cc3f0', '#f2cf63', '#9fd3ae'];

function NeedFigure({ kids, item, color }: { kids: string[]; item: WearId; color: string }) {
  const n = kids.length;
  const per = WEAR[item].per;
  const gap = 300 / (n + 1);
  return (
    <svg viewBox="0 0 300 160" style={FIG_STYLE} role="img" aria-label={`こども ${n}にん`}>
      {kids.map((c, i) => (
        <SvgEmoji key={i} x={gap * (i + 1)} y={38} char={c} size={48} />
      ))}
      <rect x={96} y={84} width={108} height={70} rx={14} fill={FILL.yellow} stroke="#e8d79c" strokeWidth={2} />
      <text x={150} y={99} fontSize={13} fontWeight={900} textAnchor="middle" fill="#6b4a00">
        1にんぶん
      </text>
      {per === 2 ? (
        <>
          <WearItem id={item} x={128} y={128} flip={item !== 'kutsu'} color={color} />
          <WearItem id={item} x={172} y={128} flip={item === 'kutsu'} color={color} />
        </>
      ) : (
        <WearItem id={item} x={150} y={128} flip={false} color={color} />
      )}
    </svg>
  );
}

function PiecesFigure({ item, color, pieces }: { item: WearId; color: string; pieces: { x: number; y: number; flip: boolean }[] }) {
  return (
    <svg viewBox="0 0 300 130" style={FIG_STYLE} role="img" aria-label={WEAR[item].k}>
      <rect x={2} y={2} width={296} height={126} rx={14} fill="#fff" stroke="#e3e8f0" strokeWidth={2} />
      {pieces.map((p, i) => (
        <WearItem key={i} id={item} x={p.x} y={p.y} flip={p.flip} color={color} />
      ))}
    </svg>
  );
}

function piecePositions(rng: Rng, total: number): { x: number; y: number; flip: boolean }[] {
  const slots = rng.sample(
    Array.from({ length: 12 }, (_, i) => i),
    total
  );
  const flips = rng.shuffle(Array.from({ length: total }, (_, i) => i % 2 === 0));
  return slots.map((s, i) => ({ x: 30 + (s % 6) * 48 + rng.int(-4, 4), y: 36 + Math.floor(s / 6) * 58 + rng.int(-4, 4), flip: flips[i] }));
}

function generateGloves(rng: Rng): TapQuestion {
  const variant: 'need' | 'people' = rng.chance(0.65) ? 'need' : 'people';
  if (variant === 'need') {
    const r = rng.next();
    const item: WearId = r < 0.4 ? 'tebukuro' : r < 0.7 ? 'kutsushita' : r < 0.85 ? 'kutsu' : 'boushi';
    const w = WEAR[item];
    const n = rng.int(2, 4);
    const ans = n * w.per;
    const first = rng.chance(0.5);
    const { choices, answerId } = numberChoices(rng, ans, { min: 1, max: 10, traps: [n, ans + 1, ans - 1, n + 1] });
    return {
      type: 'zukei-gloves',
      prompt: `こどもが ${n}にん います。みんなが ${w.verbK}。${w.k}は ぜんぶで いくつ いりますか。`,
      speech: `子どもが ${n}人 います。みんなが ${w.verbS}。${w.s}は、全部で いくつ いりますか。`,
      figure: <NeedFigure kids={Array.from({ length: n }, (_, i) => KIDS[(i + (first ? 1 : 0)) % 2])} item={item} color={rng.pick(WEAR_COLORS)} />,
      choices,
      answer: answerId,
      cols: 4,
      choiceHeight: 96,
      explain: `${n}人 × ${w.per} ＝ ${ans}`,
      params: { variant, item, n, per: w.per }
    };
  }
  const item: WearId = rng.pick(['tebukuro', 'kutsushita', 'kutsu'] as WearId[]);
  const w = WEAR[item];
  const k = rng.int(2, 4);
  const { choices, answerId } = numberChoices(rng, k, { min: 1, max: 8, traps: [k * 2] });
  return {
    type: 'zukei-gloves',
    prompt: `${w.k}が あります。なんにんぶん ありますか。`,
    speech: `${w.s}が あります。何人分 ありますか。`,
    figure: <PiecesFigure item={item} color={rng.pick(WEAR_COLORS)} pieces={piecePositions(rng, k * 2)} />,
    choices,
    answer: answerId,
    cols: 4,
    choiceHeight: 96,
    explain: `${k * 2}こ ÷ 2 ＝ ${k}人分`,
    params: { variant, item, k, pieces: k * 2 }
  };
}

export const glovesType: QuestionType = {
  id: 'zukei-gloves',
  name: '手袋・くつした',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '「子どもが3人。手袋は全部でいくつ？」（1人に2つ）と、その反対の「何人分ありますか」。帽子は1人に1つ。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateGloves
};
