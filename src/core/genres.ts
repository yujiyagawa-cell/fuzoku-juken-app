import type { IconName } from '../ui/icons';
import type { GenreId } from './types';

// 分野（ジャンル）。進捗一覧・カタログ・おまかせで使う。
// priority：3 = 最重要（不合格の直接の原因になりうる）、2 = 高、1 = 中（対策まとめ 6章より）

export interface GenreDef {
  id: GenreId;
  name: string; // 保護者向け
  kidName: string; // 子ども向け
  priority: 1 | 2 | 3;
  icon: IconName;
  bg: string;
  ink: string;
  icon_color: string;
}

export const GENRES: GenreDef[] = [
  { id: 'taiki', name: '待機・態度', kidName: 'まつ', priority: 3, icon: 'chair', bg: '#dff3f2', ink: '#0f5b59', icon_color: '#157a78' },
  { id: 'uta', name: 'うた', kidName: 'うた', priority: 2, icon: 'music', bg: '#ffe4ec', ink: '#8e1f4a', icon_color: '#c8336a' },
  { id: 'kotoba', name: 'ことば（2・3文字・しりとり）', kidName: 'ことば', priority: 2, icon: 'bubble', bg: '#fff2c6', ink: '#6b4a00', icon_color: '#9a6a00' },
  { id: 'zukei', name: '図形・推理（プリント）', kidName: 'ずけい', priority: 2, icon: 'shapes', bg: '#dceeff', ink: '#1d4e9e', icon_color: '#2563c9' },
  { id: 'kioku', name: 'お話・記憶', kidName: 'おはなし', priority: 1, icon: 'book', bg: '#e2f5e6', ink: '#1c5c3a', icon_color: '#24734a' },
  { id: 'kakitashi', name: '絵の書き足し', kidName: 'おえかき', priority: 2, icon: 'pencil', bg: '#eee6ff', ink: '#4f2fa0', icon_color: '#6d45c9' },
  { id: 'shitsugi', name: '質疑応答', kidName: 'しつもん', priority: 2, icon: 'question', bg: '#ffe8d9', ink: '#8f3a12', icon_color: '#c2531f' },
  { id: 'hyogen', name: '表現・模倣（リズム・まね）', kidName: 'まね', priority: 1, icon: 'hand', bg: '#fde8f6', ink: '#7a2163', icon_color: '#a8338a' },
  { id: 'undo', name: '運動', kidName: 'うんどう', priority: 1, icon: 'activity', bg: '#e6f4ff', ink: '#13466e', icon_color: '#1d6fa8' },
  { id: 'seikatsu', name: '生活・巧緻性', kidName: 'せいかつ', priority: 1, icon: 'list', bg: '#f0f3f8', ink: '#33415a', icon_color: '#4f5e74' }
];

export function genreOf(id: GenreId): GenreDef {
  return GENRES.find((g) => g.id === id) ?? GENRES[0];
}
