import { describe, expect, it } from 'vitest';
import { countMora, firstMora, headMatches, lastSoundForShiritori, splitMora, toHiragana } from './kana';
import { judgeAge, judgeBirthday, judgeHand, judgeKotoba, judgeNursery, judgeProperty, parseKanjiNumber } from './judge';
import { DEFAULT_SETTINGS } from './settings';

const rules = DEFAULT_SETTINGS.moraRules;

describe('kana', () => {
  it('katakana to hiragana', () => {
    expect(toHiragana('アイス')).toBe('あいす');
    expect(toHiragana('プール')).toBe('ぷーる');
  });
  it('counts mora with default rules', () => {
    expect(countMora('きゅうり', rules)).toBe(3);
    expect(countMora('らっぱ', rules)).toBe(3);
    expect(countMora('プール', rules)).toBe(3);
    expect(countMora('でんしゃ', rules)).toBe(3);
    expect(splitMora('しゃしん', rules)).toEqual(['しゃ', 'し', 'ん']);
  });
  it('alternative rules', () => {
    expect(countMora('きゅうり', { ...rules, youon: 'separate' })).toBe(4);
    expect(countMora('らっぱ', { ...rules, sokuon: 'skip' })).toBe(2);
    expect(countMora('プール', { ...rules, chouon: 'skip' })).toBe(2);
  });
  it('head', () => {
    expect(firstMora('しゃしん', rules)).toBe('しゃ');
    expect(headMatches('がっこう', 'か', rules, false)).toBe(false);
    expect(headMatches('がっこう', 'か', rules, true)).toBe(true);
  });
  it('shiritori last sound', () => {
    expect(lastSoundForShiritori('ごりら')).toBe('ら');
    expect(lastSoundForShiritori('ボール')).toBe('る');
    expect(lastSoundForShiritori('ちょうちょ')).toBe('よ');
  });
});

describe('judgeKotoba', () => {
  it('correct when any candidate matches', () => {
    expect(judgeKotoba(['あいす'], 'あ', 3, rules, false).judge).toBe('correct');
    expect(judgeKotoba(['あめ', 'あたま'], 'あ', 3, rules, false).judge).toBe('correct');
  });
  it('wrong length', () => {
    const r = judgeKotoba(['あめ'], 'あ', 3, rules, false);
    expect(r.judge).toBe('wrong');
    expect(r.note).toContain('2');
  });
  it('unknown when nothing heard', () => {
    expect(judgeKotoba([], 'あ', 3, rules, false).judge).toBe('unknown');
  });
});

describe('fixed answers', () => {
  const s = { ...DEFAULT_SETTINGS, age: 6, birthday: { month: 4, day: 10 }, handedness: 'right' as const };
  it('parses kanji numbers', () => {
    expect(parseKanjiNumber('十二')).toBe(12);
    expect(parseKanjiNumber('二十四')).toBe(24);
    expect(parseKanjiNumber('6')).toBe(6);
  });
  it('age', () => {
    expect(judgeAge('6歳です', 'ろくさいです', s).judge).toBe('correct');
    expect(judgeAge('5歳', 'ごさい', s).judge).toBe('wrong');
    expect(judgeAge('ろくさい', 'ろくさい', s).judge).toBe('correct');
  });
  it('birthday', () => {
    expect(judgeBirthday('4月10日です', 'しがつとおかです', s).judge).toBe('correct');
    expect(judgeBirthday('しがつとおか', 'しがつとおか', s).judge).toBe('correct');
    expect(judgeBirthday('4月11日', 'しがつじゅういちにち', s).judge).toBe('wrong');
  });
  it('nursery and hand', () => {
    expect(judgeNursery('保育園です', 'ほいくえんです', s).judge).toBe('correct');
    expect(judgeNursery('幼稚園', 'ようちえん', s).judge).toBe('wrong');
    expect(judgeHand('右利きです', 'みぎききです', s).judge).toBe('correct');
  });
  it('property', () => {
    expect(judgeProperty('サボテン', 'さぼてん', s.propertyAnswers.togetoge).judge).toBe('correct');
    expect(judgeProperty('新しい10円玉', 'あたらしい10えんだま', s.propertyAnswers.pikapika).judge).toBe('correct');
    expect(judgeProperty('雲', 'くも', s.propertyAnswers.togetoge).judge).toBe('unknown');
  });
});
