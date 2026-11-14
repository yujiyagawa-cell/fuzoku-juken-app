import type { ReactNode } from 'react';
import type { Rng } from '../../../core/rng';
import type { Choice, QuestionType, TapQuestion } from '../../../player/types';
import { emo, Emoji } from '../../../ui/emoji';
import { emojiChoice, FILL, GRID, INK, SvgEmoji } from './common';

// お話の順番（順にタップ）と、絵の記憶（見せて隠す）

// =====================================================================
// お話の順番
// =====================================================================

const SCENE_STYLE = { width: '100%', maxHeight: 84, display: 'block' } as const;

function Scene({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 80 80" style={SCENE_STYLE} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const Soil = () => <path d="M4 72 Q40 54 76 72 Z" fill="#d8b48c" stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
const Leaf = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <ellipse cx={x} cy={y} rx={9} ry={4.5} transform={`rotate(${r} ${x} ${y})`} fill="#8fd1a5" stroke={INK} strokeWidth={1.8} />
);

const PLANT: Record<string, ReactNode> = {
  seed: (
    <Scene label="たね">
      <Soil />
      <ellipse cx={40} cy={61} rx={6} ry={4} fill="#7a4b26" stroke={INK} strokeWidth={1.6} />
    </Scene>
  ),
  sprout: (
    <Scene label="め">
      <Soil />
      <path d="M40 63 V46" stroke="#3f9a5c" strokeWidth={3} strokeLinecap="round" />
      <Leaf x={32} y={46} r={-25} />
      <Leaf x={48} y={46} r={25} />
    </Scene>
  ),
  bud: (
    <Scene label="つぼみ">
      <Soil />
      <path d="M40 63 V28" stroke="#3f9a5c" strokeWidth={3} strokeLinecap="round" />
      <Leaf x={31} y={50} r={-25} />
      <Leaf x={49} y={44} r={25} />
      <ellipse cx={40} cy={22} rx={6} ry={9} fill="#f5a3bd" stroke={INK} strokeWidth={1.8} />
    </Scene>
  ),
  flower: (
    <Scene label="はな">
      <Soil />
      <path d="M40 63 V30" stroke="#3f9a5c" strokeWidth={3} strokeLinecap="round" />
      <Leaf x={31} y={52} r={-25} />
      <Leaf x={49} y={46} r={25} />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={40 + 9 * Math.cos((a * Math.PI) / 180)} cy={22 + 9 * Math.sin((a * Math.PI) / 180)} r={7} fill="#f5a3bd" stroke={INK} strokeWidth={1.6} />
      ))}
      <circle cx={40} cy={22} r={5.5} fill="#f2cf63" stroke={INK} strokeWidth={1.6} />
    </Scene>
  )
};

function Candle({ h, lit, label }: { h: number; lit: boolean; label: string }) {
  const top = 72 - h;
  return (
    <Scene label={label}>
      <rect x={18} y={72} width={44} height={5} rx={2} fill={FILL.gray} stroke={INK} strokeWidth={1.6} />
      <rect x={31} y={top} width={18} height={h} rx={2} fill="#fff7e0" stroke={INK} strokeWidth={2} />
      <line x1={40} y1={top} x2={40} y2={top - 5} stroke={INK} strokeWidth={1.8} />
      {lit ? (
        <path d={`M40 ${top - 20} Q47 ${top - 10} 40 ${top - 5} Q33 ${top - 10} 40 ${top - 20} Z`} fill="#f7b23b" stroke="#c9771a" strokeWidth={1.4} />
      ) : (
        <path d={`M40 ${top - 7} q-4 -5 0 -9 q4 -5 0 -9`} fill="none" stroke="#a7b1c0" strokeWidth={1.8} strokeLinecap="round" />
      )}
    </Scene>
  );
}

function Ice({ s, puddle, label }: { s: number; puddle: number; label: string }) {
  return (
    <Scene label={label}>
      {puddle > 0 && <ellipse cx={40} cy={70} rx={puddle} ry={puddle / 4 + 2} fill="#b9dcf7" stroke="#6aa8dc" strokeWidth={1.4} />}
      {s > 0 && <rect x={40 - s / 2} y={70 - s} width={s} height={s} rx={3} fill="#e6f4ff" stroke={INK} strokeWidth={2} />}
      {s > 8 && <line x1={40 - s / 2 + 4} y1={70 - s + 5} x2={40 - s / 2 + 4} y2={70 - s / 2} stroke="#fff" strokeWidth={2} />}
    </Scene>
  );
}

function Balloon({ r, label }: { r: number; label: string }) {
  const cy = 60 - r;
  return (
    <Scene label={label}>
      <path d={`M40 ${cy + r} Q36 ${cy + r + 8} 40 ${cy + r + 14} T40 78`} fill="none" stroke={INK} strokeWidth={1.6} />
      <ellipse cx={40} cy={cy} rx={r} ry={r * 1.1} fill="#f5a3bd" stroke={INK} strokeWidth={2} />
      <path d={`M37 ${cy + r * 1.1} L43 ${cy + r * 1.1} L40 ${cy + r * 1.1 + 4} Z`} fill="#f5a3bd" stroke={INK} strokeWidth={1.4} />
    </Scene>
  );
}

function Snow({ step, label }: { step: number; label: string }) {
  return (
    <Scene label={label}>
      <path d="M2 76 H78" stroke={GRID} strokeWidth={3} strokeLinecap="round" />
      {step === 0 && <circle cx={40} cy={67} r={8} fill="#fff" stroke={INK} strokeWidth={2} />}
      {step === 1 && <circle cx={40} cy={56} r={19} fill="#fff" stroke={INK} strokeWidth={2} />}
      {step >= 2 && (
        <>
          <circle cx={40} cy={56} r={19} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={40} cy={27} r={13} fill="#fff" stroke={INK} strokeWidth={2} />
        </>
      )}
      {step === 3 && (
        <>
          <circle cx={35} cy={25} r={1.8} fill={INK} />
          <circle cx={45} cy={25} r={1.8} fill={INK} />
          <path d="M36 31 Q40 34 44 31" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <path d="M30 15 L50 15 L47 6 L33 6 Z" fill="#9cc3f0" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M22 50 L10 42 M58 50 L70 42" stroke="#7a4b26" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
    </Scene>
  );
}

function Apple({ step, label }: { step: number; label: string }) {
  // 0: まるごと 1: ひとくち 2: はんぶん 3: しん
  const body =
    step === 0
      ? 'M40 24 C24 14 10 28 14 48 C17 64 30 74 40 68 C50 74 63 64 66 48 C70 28 56 14 40 24 Z'
      : step === 1
        ? 'M40 24 C24 14 10 28 14 48 C17 64 30 74 40 68 C50 74 63 64 66 48 C67 44 66 40 64 37 Q56 41 58 33 Q60 26 56 22 C51 19 45 20 40 24 Z'
        : step === 2
          ? 'M40 24 C34 20 28 21 25 24 Q31 31 25 38 Q20 45 26 52 Q32 58 26 64 C31 71 36 72 40 68 C50 74 63 64 66 48 C70 28 56 14 40 24 Z'
          : 'M36 22 Q42 24 44 22 Q38 30 44 38 Q50 46 44 54 Q38 62 44 68 Q40 70 36 68 Q42 60 36 52 Q30 44 36 36 Q42 30 36 22 Z';
  return (
    <Scene label={label}>
      <path d="M40 24 Q41 14 46 9" fill="none" stroke="#7a4b26" strokeWidth={2.4} strokeLinecap="round" />
      <path d={body} fill={step === 3 ? '#fff7e0' : '#f08a7a'} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {step === 3 && <ellipse cx={40} cy={44} rx={1.6} ry={3} fill="#7a4b26" />}
    </Scene>
  );
}

function Pupa() {
  return (
    <Scene label="さなぎ">
      <path d="M8 14 H72" stroke="#7a4b26" strokeWidth={4} strokeLinecap="round" />
      <line x1={40} y1={14} x2={40} y2={22} stroke={INK} strokeWidth={1.6} />
      <path d="M40 22 C52 26 54 46 46 62 C43 68 37 68 34 62 C26 46 28 26 40 22 Z" fill="#c9d98f" stroke={INK} strokeWidth={2} />
      <path d="M34 38 Q40 42 46 38 M34 48 Q40 52 46 48" fill="none" stroke={INK} strokeWidth={1.2} />
    </Scene>
  );
}

const E = (char: string, label: string) => <Emoji char={char} size={48} label={label} />;

interface OrderSet {
  id: string;
  prompt: string;
  speech: string;
  steps: { id: string; label: string; node: ReactNode }[];
  min?: number; // 3枚にするときに残す数
}

export const ORDER_SETS: OrderSet[] = [
  {
    id: 'flower',
    prompt: 'たねから はなが さくまでを、じゅんばんに さわってください。',
    speech: '種から 花が咲くまでを、順番に さわってください。',
    steps: [
      { id: 'seed', label: 'たね', node: PLANT.seed },
      { id: 'sprout', label: 'め', node: PLANT.sprout },
      { id: 'bud', label: 'つぼみ', node: PLANT.bud },
      { id: 'flower', label: 'はな', node: PLANT.flower }
    ]
  },
  {
    id: 'chicken',
    prompt: 'たまごが にわとりに なるまでを、じゅんばんに さわってください。',
    speech: '卵が にわとりに なるまでを、順番に さわってください。',
    steps: [
      { id: 'egg', label: 'たまご', node: E('🥚', 'たまご') },
      { id: 'hatch', label: 'われた たまご', node: E('🐣', 'われた たまご') },
      { id: 'chick', label: 'ひよこ', node: E('🐤', 'ひよこ') },
      { id: 'hen', label: 'にわとり', node: E('🐔', 'にわとり') }
    ]
  },
  {
    id: 'butterfly',
    prompt: 'あおむしが ちょうちょに なるまでを、じゅんばんに さわってください。',
    speech: 'あおむしが ちょうちょに なるまでを、順番に さわってください。',
    steps: [
      { id: 'caterpillar', label: 'あおむし', node: E('🐛', 'あおむし') },
      { id: 'pupa', label: 'さなぎ', node: <Pupa /> },
      { id: 'butterfly', label: 'ちょうちょ', node: E('🦋', 'ちょうちょ') }
    ]
  },
  {
    id: 'candle',
    prompt: 'ろうそくに ひを つけました。もえて みじかく なっていく じゅんばんに さわってください。',
    speech: 'ろうそくに 火を つけました。燃えて 短くなっていく 順番に さわってください。',
    steps: [
      { id: 'c1', label: 'ながい ろうそく', node: <Candle h={46} lit label="ながい ろうそく" /> },
      { id: 'c2', label: 'すこし みじかい ろうそく', node: <Candle h={32} lit label="すこし みじかい ろうそく" /> },
      { id: 'c3', label: 'みじかい ろうそく', node: <Candle h={18} lit label="みじかい ろうそく" /> },
      { id: 'c4', label: 'きえた ろうそく', node: <Candle h={6} lit={false} label="きえた ろうそく" /> }
    ]
  },
  {
    id: 'ice',
    prompt: 'こおりが とけていく じゅんばんに さわってください。',
    speech: '氷が とけていく 順番に さわってください。',
    steps: [
      { id: 'i1', label: 'おおきい こおり', node: <Ice s={40} puddle={0} label="おおきい こおり" /> },
      { id: 'i2', label: 'すこし とけた こおり', node: <Ice s={28} puddle={16} label="すこし とけた こおり" /> },
      { id: 'i3', label: 'ちいさい こおり', node: <Ice s={14} puddle={24} label="ちいさい こおり" /> },
      { id: 'i4', label: 'みず', node: <Ice s={0} puddle={32} label="みず" /> }
    ]
  },
  {
    id: 'balloon',
    prompt: 'ふうせんを ふくらませる じゅんばんに さわってください。',
    speech: '風船を ふくらませる 順番に さわってください。',
    steps: [
      { id: 'b1', label: 'ちいさい ふうせん', node: <Balloon r={9} label="ちいさい ふうせん" /> },
      { id: 'b2', label: 'すこし おおきい ふうせん', node: <Balloon r={16} label="すこし おおきい ふうせん" /> },
      { id: 'b3', label: 'おおきい ふうせん', node: <Balloon r={23} label="おおきい ふうせん" /> }
    ]
  },
  {
    id: 'snowman',
    prompt: 'ゆきだるまを つくる じゅんばんに さわってください。',
    speech: '雪だるまを つくる 順番に さわってください。',
    steps: [
      { id: 's1', label: 'ちいさい ゆきだま', node: <Snow step={0} label="ちいさい ゆきだま" /> },
      { id: 's2', label: 'おおきい ゆきだま', node: <Snow step={1} label="おおきい ゆきだま" /> },
      { id: 's3', label: 'ふたつ かさねた ゆきだま', node: <Snow step={2} label="ふたつ かさねた ゆきだま" /> },
      { id: 's4', label: 'ゆきだるま', node: <Snow step={3} label="ゆきだるま" /> }
    ]
  },
  {
    id: 'apple',
    prompt: 'りんごを たべていく じゅんばんに さわってください。',
    speech: 'りんごを 食べていく 順番に さわってください。',
    steps: [
      { id: 'a1', label: 'まるごとの りんご', node: <Apple step={0} label="まるごとの りんご" /> },
      { id: 'a2', label: 'ひとくち たべた りんご', node: <Apple step={1} label="ひとくち たべた りんご" /> },
      { id: 'a3', label: 'はんぶん たべた りんご', node: <Apple step={2} label="はんぶん たべた りんご" /> },
      { id: 'a4', label: 'りんごの しん', node: <Apple step={3} label="りんごの しん" /> }
    ]
  },
  {
    id: 'seasons',
    prompt: 'はるから じゅんばんに、きせつの じゅんに さわってください。',
    speech: '春から 順番に、季節の順に さわってください。',
    steps: [
      { id: 'haru', label: 'さくら（はる）', node: E('🌸', 'さくら') },
      { id: 'natsu', label: 'ひまわり（なつ）', node: E('🌻', 'ひまわり') },
      { id: 'aki', label: 'もみじ（あき）', node: E('🍁', 'もみじ') },
      { id: 'fuyu', label: 'ゆきだるま（ふゆ）', node: E('⛄', 'ゆきだるま') }
    ]
  }
];

function generateStoryOrder(rng: Rng): TapQuestion {
  const set = rng.pick(ORDER_SETS);
  let steps = set.steps;
  // 4枚の組は、ときどき3枚にする（はじめと終わりは残す）
  if (steps.length === 4 && set.id !== 'seasons' && rng.chance(0.35)) {
    const drop = rng.int(1, 2);
    steps = steps.filter((_, i) => i !== drop);
  }
  const correct = steps.map((s) => s.id);
  let order = rng.shuffle(steps);
  for (let i = 0; i < 10 && order.every((s, j) => s.id === correct[j]); i++) order = rng.shuffle(steps);
  if (order.every((s, j) => s.id === correct[j])) order = [...steps.slice(1), steps[0]];
  const choices: Choice[] = order.map((s) => ({ id: s.id, node: s.node, label: s.label }));
  return {
    type: 'zukei-story-order',
    prompt: set.prompt,
    speech: set.speech,
    choices,
    answer: correct,
    mode: 'order',
    cols: choices.length,
    choiceHeight: 104,
    explain: `正しい順：${steps.map((s) => s.label).join(' → ')}`,
    params: { set: set.id, correct, shown: order.map((s) => s.id) }
  };
}

export const storyOrderType: QuestionType = {
  id: 'zukei-story-order',
  name: 'お話の順番',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '3〜4枚の場面（たね→め→はな、たまご→ひよこ→にわとり、ろうそく、こおり、ゆきだるま など）を正しい順にタップする。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 12,
  generate: generateStoryOrder
};

// =====================================================================
// 絵の記憶
// =====================================================================

export const MEMORY_POOL = [
  'inu', 'neko', 'usagi', 'zou', 'kuma', 'buta', 'kame', 'sakana', 'ringo', 'banana', 'ichigo', 'suika',
  'kasa', 'kutsu', 'boushi', 'tokei', 'hon', 'fuusen', 'kuruma', 'densha', 'hikouki', 'hoshi', 'tsuki', 'isu'
];

const POS_WORDS = ['ひだり うえ', 'うえの まんなか', 'みぎ うえ', 'ひだりの まんなか', 'まんなか', 'みぎの まんなか', 'ひだり した', 'したの まんなか', 'みぎ した'];

function MemoryBoard({ items }: { items: { id: string; cell: number }[] }) {
  return (
    <svg viewBox="0 0 240 240" style={{ width: '100%', maxHeight: 300, display: 'block' }} role="img" aria-label="おぼえる え">
      {Array.from({ length: 9 }, (_, c) => (
        <rect key={c} x={4 + (c % 3) * 77.3} y={4 + Math.floor(c / 3) * 77.3} width={77.3} height={77.3} fill="#fff" stroke={GRID} strokeWidth={2} />
      ))}
      {items.map((it) => (
        <SvgEmoji key={it.id} x={4 + (it.cell % 3) * 77.3 + 38.6} y={4 + Math.floor(it.cell / 3) * 77.3 + 40} char={emo(it.id).char} size={50} />
      ))}
    </svg>
  );
}

function PosCell({ cell }: { cell: number }) {
  return (
    <svg viewBox="0 0 90 90" style={{ width: '100%', maxHeight: 96, display: 'block' }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, c) => (
        <rect
          key={c}
          x={3 + (c % 3) * 28}
          y={3 + Math.floor(c / 3) * 28}
          width={28}
          height={28}
          fill={c === cell ? '#f2cf63' : '#fff'}
          stroke={c === cell ? INK : GRID}
          strokeWidth={c === cell ? 2.4 : 1.6}
        />
      ))}
      <circle cx={3 + (cell % 3) * 28 + 14} cy={3 + Math.floor(cell / 3) * 28 + 14} r={6} fill={INK} />
    </svg>
  );
}

function generatePictureMemory(rng: Rng): TapQuestion {
  const k = rng.int(3, 5);
  const ids = rng.sample(MEMORY_POOL, k);
  const cells = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8], k);
  const shown = ids.map((id, i) => ({ id, cell: cells[i] }));
  const others = MEMORY_POOL.filter((id) => !ids.includes(id));
  const r = rng.next();
  const variant: 'present' | 'absent' | 'where' = r < 0.4 ? 'present' : r < 0.7 ? 'absent' : 'where';
  const preview = { node: <MemoryBoard items={shown} />, seconds: k + 3, speech: 'よく みて おぼえてください。' };
  const base = { type: 'zukei-picture-memory', preview, params: { variant, shown } } as const;

  if (variant === 'present') {
    const ans = rng.pick(ids);
    const opts = rng.shuffle([ans, ...rng.sample(others, 3)]);
    return {
      ...base,
      params: { ...base.params, answerId: ans },
      prompt: 'さっき みた えに あったのは どれですか。',
      speech: 'さっき見た絵に あったのは、どれですか。',
      choices: opts.map((id) => emojiChoice(id, emo(id).char, emo(id).kana)),
      answer: ans,
      explain: `あったもの：${ids.map((id) => emo(id).kana).join('・')}`
    };
  }
  if (variant === 'absent') {
    const ans = rng.pick(others);
    const opts = rng.shuffle([ans, ...rng.sample(ids, 3)]);
    return {
      ...base,
      params: { ...base.params, answerId: ans },
      prompt: 'さっき みた えに なかったのは どれですか。',
      speech: 'さっき見た絵に なかったのは、どれですか。',
      choices: opts.map((id) => emojiChoice(id, emo(id).char, emo(id).kana)),
      answer: ans,
      explain: `あったもの：${ids.map((id) => emo(id).kana).join('・')}`
    };
  }
  const target = rng.pick(shown);
  // ほかの絵があった場所を まちがいの候補に（足りなければ空いていた場所）
  const otherCells = rng.shuffle(shown.filter((s) => s.id !== target.id).map((s) => s.cell));
  const empty = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !cells.includes(c)));
  const wrong = [...otherCells, ...empty].slice(0, 3);
  const opts = rng.shuffle([target.cell, ...wrong]);
  const t = emo(target.id);
  return {
    ...base,
    params: { ...base.params, targetId: target.id, answerCell: target.cell },
    prompt: `${t.kana}は どこに ありましたか。`,
    speech: `${t.kana}は、どこに ありましたか。`,
    choices: opts.map((c) => ({ id: `p${c}`, node: <PosCell cell={c} />, label: POS_WORDS[c] })),
    answer: `p${target.cell}`,
    explain: `${t.kana}は ${POS_WORDS[target.cell]}`
  };
}

export const pictureMemoryType: QuestionType = {
  id: 'zukei-picture-memory',
  name: '絵の記憶',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '365日',
  description: '3×3のマスに3〜5個の絵を数秒見せて隠す。「あったもの」「なかったもの」「どこにあったか」を答える。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generatePictureMemory
};
