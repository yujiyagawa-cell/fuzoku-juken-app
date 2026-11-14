import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { FIG_STYLE, finalize, numberDrafts, SvgEmoji } from './svg';

// 同じ数ずつ分ける（365日 型）
// A：「◯この りんごを ふたりで おなじ かずずつ わけると、ひとり なんこ」
// B：「◯この りんごを ひとり ◯こずつ くばると、なんにんに くばれますか」

const ITEMS = [
  { char: '🍎', kana: 'りんご' },
  { char: '🍓', kana: 'いちご' },
  { char: '🍬', kana: 'あめ' },
  { char: '🍪', kana: 'クッキー' },
  { char: '🍙', kana: 'おにぎり' }
];
const KIDS = ['👧', '👦', '👧'];
const PEOPLE_KANA: Record<number, string> = { 2: 'ふたり', 3: 'さんにん', 4: 'よにん' };

function ItemsFig({ n, char, kids }: { n: number; char: string; kids: number }) {
  const perRow = 6;
  const rows = Math.ceil(n / perRow);
  const itemsH = rows * 38;
  const H = itemsH + (kids ? 58 : 6) + 6;
  const els = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const inRow = Math.min(perRow, n - r * perRow);
    const x0 = 130 - ((inRow - 1) * 38) / 2;
    els.push(<SvgEmoji key={`i${i}`} x={x0 + c * 38} y={24 + r * 38} size={30} char={char} />);
  }
  for (let i = 0; i < kids; i++) {
    const x0 = 130 - ((kids - 1) * 64) / 2;
    els.push(<SvgEmoji key={`k${i}`} x={x0 + i * 64} y={itemsH + 36} size={40} char={KIDS[i % KIDS.length]} />);
  }
  return (
    <svg viewBox={`0 0 260 ${H}`} style={{ ...FIG_STYLE, maxHeight: 200 }} aria-hidden="true">
      {els}
    </svg>
  );
}

export function generateSplit(rng: Rng) {
  const item = rng.pick(ITEMS);
  if (rng.chance(0.65)) {
    const k = rng.chance(0.7) ? 2 : 3;
    const per = k === 2 ? rng.int(2, 5) : rng.int(1, 4);
    const N = k * per;
    return finalize(rng, {
      type: 'zukei-split',
      prompt: `${N}この ${item.kana}を ${PEOPLE_KANA[k]}で おなじ かずずつ わけると、ひとり なんこに なりますか。`,
      speech: `${N}個の ${item.kana}を、${k}人で 同じ数ずつ 分けると、1人 何個に なりますか。`,
      figure: <ItemsFig n={N} char={item.char} kids={k} />,
      choices: numberDrafts(rng, per, { prefer: [per + 1, per - 1, k], others: [N, N - per, per + 2], max: 12, unit: 'こ' }),
      answerKey: 'ok',
      labelMode: 'content',
      params: { form: 'A', item: item.kana, n: N, k, per },
      explain: `${N}こを${k}人で分ける → 1人${per}こ`
    });
  }
  const per = rng.int(2, 3);
  const people = per === 2 ? rng.int(2, 5) : rng.int(2, 4);
  const N = per * people;
  return finalize(rng, {
    type: 'zukei-split',
    prompt: `${N}この ${item.kana}を、ひとり ${per}こずつ くばると、なんにんに くばれますか。`,
    speech: `${N}個の ${item.kana}を、1人 ${per}個ずつ 配ると、何人に 配れますか。`,
    figure: <ItemsFig n={N} char={item.char} kids={0} />,
    choices: numberDrafts(rng, people, { prefer: [people + 1, people - 1, per], others: [N, N - per], max: 12, unit: 'にん' }),
    answerKey: 'ok',
    labelMode: 'content',
    params: { form: 'B', item: item.kana, n: N, per, people },
    explain: `${per}こずつ配ると${people}人分`
  });
}

export const splitType: QuestionType = {
  id: 'zukei-split',
  name: '同じ数ずつ分ける',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '365日',
  description: '「◯このりんごを2人で同じ数ずつ分けると1人何こ」「1人◯こずつ配ると何人に配れるか」。絵を見て数える。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateSplit
};
