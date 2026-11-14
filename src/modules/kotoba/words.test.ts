import { describe, expect, it } from 'vitest';
import { ALL_KANA, countMora, headMatches } from '../../core/kana';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { WORDS, examplesFor } from './words';

const rules = DEFAULT_SETTINGS.moraRules;

describe('ことばの解答例', () => {
  it('すべての音に項目がある', () => {
    for (const k of ALL_KANA) expect(WORDS[k], k).toBeDefined();
  });

  it('はじめの音と文字数が合っている（ふつうの数え方）', () => {
    for (const [kana, w] of Object.entries(WORDS)) {
      for (const len of [2, 3] as const) {
        for (const word of w[len]) {
          expect(headMatches(word, kana, rules, false), `${kana}: ${word}`).toBe(true);
          expect(countMora(word, rules), `${kana}: ${word}`).toBe(len);
        }
      }
    }
  });

  it('3文字は全部の音で例がある・2文字はほとんどの音で例がある', () => {
    const no2: string[] = [];
    for (const k of ALL_KANA) {
      expect(examplesFor(k, 3, rules).length, k).toBeGreaterThan(0);
      if (examplesFor(k, 2, rules).length === 0) no2.push(k);
    }
    expect(no2.sort()).toEqual(['ぷ', 'ぽ', 'で'].sort());
  });
});
