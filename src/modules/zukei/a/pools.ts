import { emo, type EmojiItem } from '../../../ui/emoji';

// 図形・推理 A で使う絵文字のなかま（子どもが名前を知っているもの）

export const ANIMALS: EmojiItem[] = [
  'inu', 'neko', 'usagi', 'kuma', 'kitsune', 'buta', 'zou', 'kirin', 'saru', 'nezumi',
  'ushi', 'panda', 'koara', 'raion', 'tora', 'hiyoko', 'pengin', 'kaeru', 'kame', 'hitsuji'
].map(emo);

export const FOODS: EmojiItem[] = [
  'ringo', 'mikan', 'banana', 'ichigo', 'budou', 'suika', 'momo', 'meron',
  'onigiri', 'pan', 'keki', 'purin', 'donatsu', 'dango', 'sakuranbo'
].map(emo);

export const THINGS: EmojiItem[] = [
  'kasa', 'kutsu', 'boushi', 'hon', 'tokei', 'fuusen', 'kuruma', 'densha', 'fune', 'hikouki',
  'hoshi', 'tsuki', 'yukidaruma', 'ki', 'saikoro', 'kagi', 'enpitsu', 'hasami', 'megane', 'isu'
].map(emo);
