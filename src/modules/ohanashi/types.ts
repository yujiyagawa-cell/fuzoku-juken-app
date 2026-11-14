import { makeRng } from '../../core/rng';
import type { QuestionType } from '../../player/types';
import { makeStory, type TemplateId } from './stories';

// お話の記憶の問題タイプ（テンプレートごと）。sample はカタログ用に1つ作っておいたお話。

const sample = (t: TemplateId, seed: number) => {
  try {
    const s = makeStory(t, makeRng(seed));
    return `${s.text}（質問：${s.questions.map((q) => q.prompt).join('／')}）`;
  } catch {
    return '';
  }
};

export const OHANASHI_TYPES: QuestionType[] = [
  {
    id: 'ohanashi-kakekko',
    name: 'お話：かけっこ',
    genre: 'kioku',
    moduleId: 'ohanashi',
    source: '本番',
    description:
      '本番で出たお話（ノート17枚目）を元にしたテンプレート。動物3〜4匹が競走し「◯より△のほうが速い」の文から順位を考える。質問は「なんびき」「季節」「1番」「いちばん遅い／2番」。',
    priority: 3,
    answer: 'tap',
    speedTargetSec: 5,
    sample: sample('kakekko', 3)
  },
  {
    id: 'ohanashi-yukidaruma',
    name: 'お話：雪だるま',
    genre: 'kioku',
    moduleId: 'ohanashi',
    source: 'ノート',
    description: 'ノート4枚目の例文が元。動物たちが雪だるまを作り、「いちばん小さい」「◯より大きい」から大きさの順を考える。',
    priority: 2,
    answer: 'tap',
    speedTargetSec: 5,
    sample: sample('yukidaruma', 5)
  },
  {
    id: 'ohanashi-otsukai',
    name: 'お話：おつかい',
    genre: 'kioku',
    moduleId: 'ohanashi',
    source: '仕様',
    description: '誰に頼まれて、どのお店で、何をいくつ、何色の袋で買ったか。',
    priority: 1,
    answer: 'tap',
    speedTargetSec: 5,
    sample: sample('otsukai', 7)
  },
  {
    id: 'ohanashi-odekake',
    name: 'お話：きせつの おでかけ',
    genre: 'kioku',
    moduleId: 'ohanashi',
    source: '仕様',
    description: '季節（お花見・海・山・雪遊び）、誰と行ったか、何を持って行ったか、何を見つけたか。',
    priority: 1,
    answer: 'tap',
    speedTargetSec: 5,
    sample: sample('odekake', 9)
  }
];
