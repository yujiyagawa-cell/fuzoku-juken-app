import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { Emoji, type EmojiItem } from '../../../ui/emoji';
import { ANIMALS, FOODS } from './pools';
import { ArcArrow, FIG_STYLE, finalize, INK, SvgEmoji, type Draft } from './svg';

// 回るテーブル（とっくん42 型）— 席（どうぶつ）は動かず、テーブルの上の食べ物が回る
// 席の番号：0=上 1=右 2=下 3=左（時計回り）

function Table({ animals, foods, dir }: { animals: EmojiItem[]; foods: EmojiItem[]; dir: 'cw' | 'ccw' }) {
  const c = 120;
  const at = (i: number, r: number) => {
    const a = ((-90 + i * 90) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  return (
    <svg viewBox="0 0 240 240" style={FIG_STYLE} aria-hidden="true">
      <circle cx={c} cy={c} r={62} fill="#f6deb5" stroke={INK} strokeWidth={3} />
      <circle cx={c} cy={c} r={55} fill="none" stroke="#e3c48f" strokeWidth={2} />
      {foods.map((f, i) => {
        const [x, y] = at(i, 34);
        return <SvgEmoji key={f.id} x={x} y={y} size={28} char={f.char} />;
      })}
      {animals.map((a, i) => {
        const [x, y] = at(i, 99);
        return <SvgEmoji key={a.id} x={x} y={y} size={34} char={a.char} />;
      })}
      <ArcArrow cx={c} cy={c} r={77} a0={dir === 'cw' ? -70 : -20} a1={dir === 'cw' ? -20 : -70} width={4} head={7} />
    </svg>
  );
}

export function generateRotateTable(rng: Rng) {
  const animals = rng.sample(ANIMALS, 4);
  const foods = rng.sample(FOODS, 4);
  const dir: 'cw' | 'ccw' = rng.chance(0.6) ? 'cw' : 'ccw';
  const k = rng.chance(0.65) ? 1 : 2;
  const mod = (x: number) => ((x % 4) + 4) % 4;
  const step = dir === 'cw' ? k : -k;
  const figure = <Table animals={animals} foods={foods} dir={dir} />;
  const dirKana = dir === 'cw' ? 'みぎ' : 'ひだり';
  const dirK = dir === 'cw' ? '右' : '左';
  const params = { animals: animals.map((a) => a.id), foods: foods.map((f) => f.id), dir, k };
  const asDraft = (e: EmojiItem, ok: boolean): Draft => ({ key: ok ? 'ok' : e.id, sig: e.id, node: <Emoji char={e.char} size={52} />, label: e.kana });

  if (rng.chance(0.65)) {
    // A：「◯◯さんの まえに くる たべものは」
    const s = rng.int(0, 3);
    const src = mod(s - step);
    return finalize(rng, {
      type: 'zukei-rotate-table',
      prompt: `テーブルが ${dirKana}に ${k}かい まわると、${animals[s].kana}さんの まえに くる ものは どれですか。`,
      speech: `テーブルが、${dirK}に ${k}回 まわると、${animals[s].kana}さんの 前に 来るものは どれですか。`,
      figure,
      choices: foods.map((f, i) => asDraft(f, i === src)),
      answerKey: 'ok',
      labelMode: 'content',
      params: { ...params, form: 'A', s },
      explain: `${k}回＝${k === 1 ? 'となりの席へ' : 'むかいの席へ'}。${animals[s].kana}の前には ${foods[src].kana}`
    });
  }
  // B：「◯◯は だれの まえに いきますか」
  const f = rng.int(0, 3);
  const dst = mod(f + step);
  return finalize(rng, {
    type: 'zukei-rotate-table',
    prompt: `テーブルが ${dirKana}に ${k}かい まわると、${foods[f].kana}は だれの まえに いきますか。`,
    speech: `テーブルが、${dirK}に ${k}回 まわると、${foods[f].kana}は 誰の 前に 行きますか。`,
    figure,
    choices: animals.map((a, i) => asDraft(a, i === dst)),
    answerKey: 'ok',
    labelMode: 'content',
    params: { ...params, form: 'B', f },
    explain: `${foods[f].kana}は ${animals[f].kana}の前 → ${animals[dst].kana}の前へ`
  });
}

export const rotateTableType: QuestionType = {
  id: 'zukei-rotate-table',
  name: '回るテーブル',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'とっくん42',
  description: '丸いテーブルの上の食べ物が回る（座っている動物は動かない）。◯回まわると◯◯さんの前に来るものはどれか。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateRotateTable
};
