import type { ModuleDef } from '../../player/types';
import { moduleColor } from '../common';
import { KakitashiRunner } from './KakitashiRunner';
import { KAKITASHI_TYPES } from './types';

// 絵の書き足し（7つの形）＋ 点線なぞり（zukei-trace は types で選んだときだけ）

export { KAKITASHI_TYPES };

export const kakitashiModule: ModuleDef = {
  id: 'kakitashi',
  name: 'おえかき',
  label: '絵の書き足し',
  sub: 'かたちに かきたす',
  unit: 'まい',
  defaultCount: 1,
  minCount: 1,
  maxCount: 4,
  step: 1,
  minutesPer: 2,
  color: moduleColor('kakitashi'),
  icon: 'pencil',
  genre: 'kakitashi',
  omakase: false,
  Runner: KakitashiRunner
};
