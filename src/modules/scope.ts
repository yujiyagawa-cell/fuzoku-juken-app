import type { Review, ReviewMark } from '../core/types';

// ふだん出す問題の範囲（2026-11-14 保護者の指示「コンテンツとしては残して、デフォルトをプリントにあるものだけに」）
// - プリント（手書きノート）にある問題＝出どころが「本番」「ノート」「ノート（予想）」→ ふだん出す（カタログで「外す」にしたら出さない）
// - それ以外（問題集の単元・仕様書・アプリで足した聞き方）→ ふだんは出さない（カタログで「良い」にしたら出す）
// - 種類を指定して練習するとき（セット設定・進捗の「これを練習」）は、どれでも出せる

export const PRINT_SOURCES = ['本番', 'ノート', 'ノート（予想）'];

export function isInPrint(t: { source: string }): boolean {
  return PRINT_SOURCES.includes(t.source);
}

export type MarkMap = Map<string, ReviewMark | ''>;

export function markMap(reviews: Review[]): MarkMap {
  return new Map(reviews.map((r) => [r.typeId, r.mark]));
}

/** ふだん（種類を指定しないとき）出すか */
export function isTypeActive(t: { id: string; source: string }, marks: MarkMap): boolean {
  const m = marks.get(t.id) || '';
  return isInPrint(t) ? m !== 'off' : m === 'good';
}
