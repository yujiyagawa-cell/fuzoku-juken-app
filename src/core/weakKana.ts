import type { Attempt, KanaSeed } from './types';

// 苦手な音（ことば即答）
// - 最終判定が ×／？、または答えるまで 5秒をこえた → 苦手としてかぞえる
// - さいごの3回が つづけて ○ かつ 3秒以内 → 苦手リストから外す
// - ノートで × がついていた音は、はじめから苦手として扱う（同じルールで外れる）

/** 手書きノートで × がついていた音（音-文字数） */
export const NOTE_WEAK_KEYS: string[] = [
  'あ-3', 'い-3', 'う-3', 'え-2', 'く-3', 'け-2', 'そ-3', 'つ-3', 'て-2', 'て-3', 'な-3', 'に-2', 'に-3', 'ぬ-3',
  'ま-3', 'み-2', 'む-2', 'む-3', 'め-2', 'も-3', 'や-2', 'ゆ-2', 'ゆ-3', 'ら-2', 'る-2', 'れ-2', 'れ-3', 'ろ-2',
  'ろ-3', 'わ-3', 'び-2', 'ぺ-2'
];

/** 本番で実際に聞かれた音（ノート・聞き取りより） */
export const EXAM_KANA: string[] = ['い', 'ぴ', 'き', 'か', 'お'];

export const KOTOBA_SLOW_MS = 5000;
export const KOTOBA_FAST_MS = 3000;

export interface WeakKanaRow {
  key: string; // 'あ-3'
  kana: string;
  length: 2 | 3;
  tries: number;
  misses: number;
  streak: number; // さいごから数えて つづけて ○かつ3秒以内 の回数
  fromNote: boolean;
  lastAt?: string;
  weak: boolean;
}

function keyOf(kana: string, length: number) {
  return `${kana}-${length}`;
}

export function isKotobaAttempt(a: Attempt): boolean {
  return a.questionType === 'kotoba-2' || a.questionType === 'kotoba-3';
}

export function kotobaParams(a: Attempt): { kana: string; length: 2 | 3 } | null {
  const p = a.params as { kana?: string; length?: number } | undefined;
  if (!p?.kana || (p.length !== 2 && p.length !== 3)) return null;
  return { kana: p.kana, length: p.length };
}

export function computeWeakKana(attempts: Attempt[], seeds: KanaSeed[] = []): WeakKanaRow[] {
  const rows = new Map<string, WeakKanaRow>();
  const ensure = (kana: string, length: 2 | 3, fromNote: boolean) => {
    const k = keyOf(kana, length);
    let r = rows.get(k);
    if (!r) {
      r = { key: k, kana, length, tries: 0, misses: 0, streak: 0, fromNote, weak: false };
      rows.set(k, r);
    }
    if (fromNote) r.fromNote = true;
    return r;
  };
  for (const k of NOTE_WEAK_KEYS) {
    const [kana, len] = k.split('-');
    ensure(kana, Number(len) as 2 | 3, true);
  }
  for (const s of seeds) ensure(s.kana, s.length, true);

  const list = attempts.filter(isKotobaAttempt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const a of list) {
    const p = kotobaParams(a);
    if (!p) continue;
    const r = ensure(p.kana, p.length, false);
    r.tries++;
    r.lastAt = a.createdAt;
    const ok = a.finalJudge === 'correct';
    const slow = (a.latencyMs ?? 0) > KOTOBA_SLOW_MS;
    const fast = a.latencyMs !== undefined && a.latencyMs <= KOTOBA_FAST_MS;
    if (!ok || slow) r.misses++;
    r.streak = ok && fast ? r.streak + 1 : 0;
  }
  for (const r of rows.values()) {
    r.weak = (r.misses > 0 || r.fromNote) && r.streak < 3;
  }
  return [...rows.values()].sort((a, b) => Number(b.weak) - Number(a.weak) || b.misses - a.misses || a.key.localeCompare(b.key, 'ja'));
}
