import type { ModuleDef } from '../../player/types';
import { moduleColor } from '../common';
import { HyogenRunner } from './HyogenRunner';
import { HYOGEN_TYPES } from './types';

// 表現・模倣（リズム・まねして歌う・ポーズ・メトロノーム・ダンス・楽器）。すべて保護者判定。

export { HYOGEN_TYPES };

export const hyogenModule: ModuleDef = {
  id: 'hyogen',
  name: 'まね',
  label: '表現・模倣',
  sub: 'リズム・うた・ポーズ',
  unit: 'もん',
  defaultCount: 3,
  minCount: 1,
  maxCount: 7,
  step: 1,
  minutesPer: 1,
  color: moduleColor('hyogen'),
  icon: 'hand',
  genre: 'hyogen',
  omakase: true,
  Runner: HyogenRunner
};
