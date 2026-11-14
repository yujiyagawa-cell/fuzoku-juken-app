import type { QuestionType } from '../../player/types';
import { SHAPES } from './shapes';

// 絵の書き足しの問題タイプ（7つの形）と、点線なぞり（ジャンルは図形）

export const SHAPE_INSTRUCTION = 'この かたちを つかって じゆうに えを かいてください。';
export const SHAPE_SPEECH = 'この かたちを つかって、じゆうに えを かいてください。';
export const TRACE_TYPE_ID = 'zukei-trace';

export const KAKITASHI_TYPES: QuestionType[] = [
  ...SHAPES.map(
    (s): QuestionType => ({
      id: s.typeId,
      name: `書き足し：${s.name}`,
      genre: 'kakitashi',
      moduleId: 'kakitashi',
      source: s.source,
      description: `${s.name}を1つ使って自由に絵をかく（黒のペン1色・消しゴムなし）。作例：${s.examples.join('、')}。描き始めまでの秒数を記録し、保護者が判定・◎（本番で使う）をつける。`,
      priority: s.priority,
      answer: 'draw',
      speedTargetSec: 10,
      sample: SHAPE_INSTRUCTION
    })
  ),
  {
    id: TRACE_TYPE_ID,
    name: '点線なぞり・線をひく',
    genre: 'zukei',
    moduleId: 'kakitashi',
    source: 'ノート',
    description:
      '直線・曲線・ジグザグの点線を指でなぞる／みどりの点からあかい点まで線をひく。なぞれた割合・はみ出し・時間を記録し、判定は保護者。「おえかき」で種類にこれを選んだときに出る。',
    priority: 2,
    answer: 'draw',
    sample: 'てんせんの うえを、みどりの まるから ゆびで なぞってください。'
  }
];
