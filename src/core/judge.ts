import { countMora, firstMora, headMatches, normalizeReading, toHiragana } from './kana';
import type { Judge, MoraRules, Settings } from './types';

// 口頭の答えの自動判定

export interface KotobaResult {
  judge: Judge;
  matched?: string; // 判定に使った読み
  note: string; // 保護者向けの短い説明
}

export function judgeKotoba(
  candidates: string[],
  kana: string,
  length: 2 | 3,
  rules: MoraRules,
  allowDakuonVariant: boolean
): KotobaResult {
  const cands = candidates.map(normalizeReading).filter(Boolean);
  if (cands.length === 0) return { judge: 'unknown', note: 'きこえませんでした' };
  for (const c of cands) {
    if (headMatches(c, kana, rules, allowDakuonVariant) && countMora(c, rules) === length) {
      return { judge: 'correct', matched: c, note: `「${kana}」ではじまる・${length}もじ` };
    }
  }
  const c = cands[0];
  const n = countMora(c, rules);
  const head = firstMora(c, rules);
  if (!headMatches(c, kana, rules, allowDakuonVariant)) {
    return { judge: 'wrong', matched: c, note: `「${head}」ではじまっている` };
  }
  return { judge: 'wrong', matched: c, note: `${n}もじ` };
}

// ---- 数の読み取り ----
const KANJI_DIGIT: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

export function parseKanjiNumber(s: string): number | null {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  let total = 0;
  let cur = 0;
  for (const ch of s) {
    if (ch === '十') {
      total += (cur || 1) * 10;
      cur = 0;
    } else if (KANJI_DIGIT[ch]) {
      cur = KANJI_DIGIT[ch];
    } else {
      return null;
    }
  }
  return total + cur || null;
}

const toHalfWidth = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

const AGE_READ: Record<number, string[]> = {
  3: ['さんさい'],
  4: ['よんさい', 'よさい'],
  5: ['ごさい'],
  6: ['ろくさい'],
  7: ['ななさい', 'しちさい']
};

const MONTH_READ: Record<number, string[]> = {
  1: ['いちがつ'], 2: ['にがつ'], 3: ['さんがつ'], 4: ['しがつ'], 5: ['ごがつ'], 6: ['ろくがつ'],
  7: ['しちがつ'], 8: ['はちがつ'], 9: ['くがつ'], 10: ['じゅうがつ'], 11: ['じゅういちがつ'], 12: ['じゅうにがつ']
};

const DAY_READ: Record<number, string[]> = (() => {
  const base: Record<number, string[]> = {
    1: ['ついたち'], 2: ['ふつか'], 3: ['みっか'], 4: ['よっか'], 5: ['いつか'], 6: ['むいか'], 7: ['なのか'],
    8: ['ようか'], 9: ['ここのか'], 10: ['とおか'], 14: ['じゅうよっか'], 20: ['はつか'], 24: ['にじゅうよっか']
  };
  const ones = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'しち', 'はち', 'く'];
  for (let d = 11; d <= 31; d++) {
    if (base[d]) continue;
    const tens = Math.floor(d / 10);
    const one = d % 10;
    const t = tens === 1 ? 'じゅう' : tens === 2 ? 'にじゅう' : 'さんじゅう';
    base[d] = [`${t}${ones[one]}にち`];
  }
  return base;
})();

function findNumberBefore(text: string, unit: RegExp): number[] {
  const t = toHalfWidth(text);
  const out: number[] = [];
  const re = new RegExp(`([0-9]+|[一二三四五六七八九十]+)\\s*(?:${unit.source})`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = parseKanjiNumber(m[1]);
    if (n !== null) out.push(n);
  }
  return out;
}

export interface FixedResult {
  judge: Judge;
  note: string;
}

export function judgeName(transcript: string, reading: string, s: Settings): FixedResult {
  if (!s.childName && !s.childNameKanji) return { judge: 'unknown', note: '名前が設定されていません' };
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const hira = normalizeReading(reading || transcript);
  const name = normalizeReading(s.childName);
  if (s.childNameKanji && transcript.includes(s.childNameKanji)) return { judge: 'correct', note: '名前あり' };
  if (name && (hira.includes(name) || normalizeReading(toHiragana(transcript)).includes(name))) return { judge: 'correct', note: '名前あり' };
  return { judge: 'wrong', note: '名前が見つかりません' };
}

export function judgeAge(transcript: string, reading: string, s: Settings): FixedResult {
  if (!s.age) return { judge: 'unknown', note: '年齢が設定されていません' };
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const nums = findNumberBefore(transcript, /さい|歳|才/);
  if (nums.includes(s.age)) return { judge: 'correct', note: `${s.age}さい` };
  const hira = normalizeReading(reading);
  if ((AGE_READ[s.age] || []).some((r) => hira.includes(r))) return { judge: 'correct', note: `${s.age}さい` };
  const bare = toHalfWidth(transcript).match(/^\s*([0-9]+|[一二三四五六七八九十]+)\s*$/);
  if (bare && parseKanjiNumber(bare[1]) === s.age) return { judge: 'correct', note: `${s.age}` };
  return { judge: 'wrong', note: '年齢がちがう／見つからない' };
}

export function judgeBirthday(transcript: string, reading: string, s: Settings): FixedResult {
  const { month, day } = s.birthday;
  if (!month || !day) return { judge: 'unknown', note: '誕生日が設定されていません' };
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const hira = normalizeReading(reading);
  const monthOk = findNumberBefore(transcript, /月|がつ/).includes(month) || (MONTH_READ[month] || []).some((r) => hira.includes(r));
  const dayOk = findNumberBefore(transcript, /日|にち|か/).includes(day) || (DAY_READ[day] || []).some((r) => hira.includes(r));
  if (monthOk && dayOk) return { judge: 'correct', note: `${month}月${day}日` };
  return { judge: 'wrong', note: monthOk ? '日がちがう／ない' : '月がちがう／ない' };
}

export function judgeNursery(transcript: string, reading: string, s: Settings): FixedResult {
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const hira = normalizeReading(reading) + normalizeReading(toHiragana(transcript));
  const hoiku = /保育|ほいく/.test(transcript) || hira.includes('ほいく');
  const youchi = /幼稚|ようち/.test(transcript) || hira.includes('ようちえん');
  const want = s.nurseryType === 'hoikuen' ? hoiku : youchi;
  const other = s.nurseryType === 'hoikuen' ? youchi : hoiku;
  if (want && !other) return { judge: 'correct', note: s.nurseryType === 'hoikuen' ? '保育園' : '幼稚園' };
  if (want && other) return { judge: 'unknown', note: '両方の言葉があります' };
  return { judge: 'wrong', note: '園の種類がちがう／ない' };
}

export function judgeHand(transcript: string, reading: string, s: Settings): FixedResult {
  if (!s.handedness) return { judge: 'unknown', note: '利き手が設定されていません' };
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const hira = normalizeReading(reading) + normalizeReading(toHiragana(transcript));
  const right = /右/.test(transcript) || hira.includes('みぎ');
  const left = /左/.test(transcript) || hira.includes('ひだり');
  if (right && left) return { judge: 'unknown', note: '右と左の両方があります' };
  const want = s.handedness === 'right' ? right : left;
  return want ? { judge: 'correct', note: s.handedness === 'right' ? '右きき' : '左きき' } : { judge: 'wrong', note: '利き手がちがう／ない' };
}

export function judgeProperty(transcript: string, reading: string, list: string[]): FixedResult & { matched?: string } {
  if (!transcript) return { judge: 'unknown', note: 'きこえませんでした' };
  const hira = normalizeReading(reading) || normalizeReading(toHiragana(transcript));
  for (const item of list) {
    const r = normalizeReading(item);
    if (r.length >= 2 && hira.includes(r)) return { judge: 'correct', note: `候補「${item}」`, matched: item };
  }
  return { judge: 'unknown', note: '候補にない答え（保護者が判定）' };
}

export function freeHints(transcript: string): { reason: boolean; keigo: boolean } {
  return {
    reason: /から|ので|だって/.test(transcript),
    keigo: /です|ます|ください/.test(transcript)
  };
}
