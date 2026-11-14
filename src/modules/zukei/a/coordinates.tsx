import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { Emoji, type EmojiItem } from '../../../ui/emoji';
import { ANIMALS, FOODS, THINGS } from './pools';
import { FIG_STYLE, finalize, INK, pickDistinct, SvgEmoji, type Draft } from './svg';

// 座標（マス目の位置）— 「うえから ◯ばんめ、ひだりから ◯ばんめ に ある ものは」

const ROW_FROM = { ue: { kana: 'うえ', k: '上' }, shita: { kana: 'した', k: '下' } };
const COL_FROM = { hidari: { kana: 'ひだり', k: '左' }, migi: { kana: 'みぎ', k: '右' } };

function Grid({ items, rows, cols }: { items: EmojiItem[]; rows: number; cols: number }) {
  const cell = 56;
  const W = cols * cell;
  const H = rows * cell;
  const lines = [];
  for (let i = 1; i < cols; i++) lines.push(<line key={`v${i}`} x1={4 + i * cell} y1={4} x2={4 + i * cell} y2={4 + H} stroke={INK} strokeWidth={2} />);
  for (let i = 1; i < rows; i++) lines.push(<line key={`h${i}`} x1={4} y1={4 + i * cell} x2={4 + W} y2={4 + i * cell} stroke={INK} strokeWidth={2} />);
  return (
    <svg viewBox={`0 0 ${W + 8} ${H + 8}`} style={FIG_STYLE} aria-hidden="true">
      <rect x={4} y={4} width={W} height={H} rx={6} fill="#fff" stroke={INK} strokeWidth={3} />
      {lines}
      {items.map((it, i) => (
        <SvgEmoji key={it.id} x={4 + (i % cols) * cell + cell / 2} y={4 + Math.floor(i / cols) * cell + cell / 2 + 1} size={34} char={it.char} />
      ))}
    </svg>
  );
}

export function generateCoordinates(rng: Rng) {
  const rows = 3;
  const cols = rng.chance(0.6) ? 3 : 4;
  const items = rng.sample([...ANIMALS, ...FOODS, ...THINGS], rows * cols);
  const r = rng.int(0, rows - 1);
  const c = rng.int(0, cols - 1);
  const rowFrom: 'ue' | 'shita' = rng.chance(0.7) ? 'ue' : 'shita';
  const colFrom: 'hidari' | 'migi' = rng.chance(0.7) ? 'hidari' : 'migi';
  const a = rowFrom === 'ue' ? r + 1 : rows - r;
  const b = colFrom === 'hidari' ? c + 1 : cols - c;
  const at = (rr: number, cc: number) => (rr >= 0 && cc >= 0 && rr < rows && cc < cols ? items[rr * cols + cc] : null);
  const target = at(r, c)!;
  const draft = (e: EmojiItem, key = e.id): Draft => ({ key, sig: e.id, node: <Emoji char={e.char} size={52} />, label: e.kana });

  // まちがえやすい場所：たてと横を入れかえた／数える向きを逆にした／となり
  const swapR = rowFrom === 'ue' ? b - 1 : rows - b;
  const swapC = colFrom === 'hidari' ? a - 1 : cols - a;
  const prefer = [at(swapR, swapC), at(rows - 1 - r, c), at(r, cols - 1 - c)].filter((e): e is EmojiItem => !!e);
  const near = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)].filter((e): e is EmojiItem => !!e);
  const others = pickDistinct(rng, [...rng.shuffle(prefer).map((e) => draft(e)), ...rng.shuffle(near).map((e) => draft(e)), ...rng.shuffle(items).map((e) => draft(e))], 3, [target.id], true);

  const R = ROW_FROM[rowFrom];
  const C = COL_FROM[colFrom];
  return finalize(rng, {
    type: 'zukei-coordinates',
    prompt: `${R.kana}から ${a}ばんめ、${C.kana}から ${b}ばんめに ある ものは どれですか。`,
    speech: `${R.k}から ${a}番目、${C.k}から ${b}番目に あるものは どれですか。`,
    figure: <Grid items={items} rows={rows} cols={cols} />,
    choices: [draft(target, 'ok'), ...others],
    answerKey: 'ok',
    labelMode: 'content',
    params: { rows, cols, items: items.map((e) => e.id), r, c, rowFrom, colFrom },
    explain: `${R.k}から${a}番目・${C.k}から${b}番目 → ${target.kana}`
  });
}

export const coordinatesType: QuestionType = {
  id: 'zukei-coordinates',
  name: '座標（マス目の位置）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: 'マス目に並んだ絵。「上から◯番目、左から◯番目」にあるものを選ぶ（下から・右からも出る）。たて横の入れかえ・逆から数えたものを混ぜる。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateCoordinates
};
