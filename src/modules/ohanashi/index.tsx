import type { ModuleDef } from '../../player/types';
import { moduleColor } from '../common';
import { OhanashiRunner } from './Runner';
import { OHANASHI_TYPES } from './types';

// お話の記憶（1回だけ読み上げ → 4問をタップで答える）。count はお話の数（わ）。

export { OHANASHI_TYPES };

export const ohanashiModule: ModuleDef = {
  id: 'ohanashi',
  name: 'おはなし',
  label: 'お話の記憶',
  sub: 'きいて こたえる',
  unit: 'わ',
  defaultCount: 1,
  minCount: 1,
  maxCount: 3,
  step: 1,
  minutesPer: 2,
  color: moduleColor('kioku'),
  icon: 'book',
  genre: 'kioku',
  omakase: true,
  Runner: OhanashiRunner
};
