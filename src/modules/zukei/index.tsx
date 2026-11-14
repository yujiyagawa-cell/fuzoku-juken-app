import { TapSetRunner } from '../../player/TapSetRunner';
import type { ModuleDef, QuestionType, RunnerProps } from '../../player/types';
import { moduleColor } from '../common';
import { ZUKEI_A_TYPES } from './typesA';
import { ZUKEI_B_TYPES } from './typesB';

// 図形・推理プリント（タップで答える）。問題タイプは typesA（回転・積み木など）と typesB（くらべる・記憶など）。

export const ZUKEI_TYPES: QuestionType[] = [...ZUKEI_A_TYPES, ...ZUKEI_B_TYPES];

function ZukeiRunner(p: RunnerProps) {
  return <TapSetRunner moduleId="zukei" pool={ZUKEI_TYPES} {...p} />;
}

export const zukeiModule: ModuleDef = {
  id: 'zukei',
  name: 'ずけい',
  label: '図形・推理プリント',
  sub: 'みて すぐ こたえる',
  unit: 'もん',
  defaultCount: 8,
  minCount: 3,
  maxCount: 20,
  step: 1,
  minutesPer: 0.4,
  color: moduleColor('zukei'),
  icon: 'shapes',
  genre: 'zukei',
  omakase: true,
  Runner: ZukeiRunner
};
