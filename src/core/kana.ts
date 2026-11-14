import type { MoraRules } from './types';

// ひらがな・カタカナと「文字数（音の数）」の扱い

export const SEION: readonly string[] = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ'
];

export const DAKUON: readonly string[] = [
  'が', 'ぎ', 'ぐ', 'げ', 'ご',
  'ざ', 'じ', 'ず', 'ぜ', 'ぞ',
  'だ', 'で', 'ど',
  'ば', 'び', 'ぶ', 'べ', 'ぼ'
];

export const HANDAKUON: readonly string[] = ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'];

export const ALL_KANA: readonly string[] = [...SEION, ...DAKUON, ...HANDAKUON];

const SMALL_YOUON = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ']);

const DAKU_BASE: Record<string, string> = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ',
  ゔ: 'う'
};

/** カタカナ → ひらがな（ー はそのまま） */
export function toHiragana(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCharCode(c - 0x60);
    else out += ch;
  }
  return out;
}

/** ひらがな → カタカナ */
export function toKatakana(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x3041 && c <= 0x3096) out += String.fromCharCode(c + 0x60);
    else out += ch;
  }
  return out;
}

export function isKanaOnly(s: string): boolean {
  return /^[ぁ-ゖァ-ヶー\s、。！？!?・]+$/.test(s);
}

/** 読みとして比べられる形にする（ひらがな化して、ひらがなと ー 以外を消す） */
export function normalizeReading(s: string): string {
  return toHiragana(s).replace(/[^ぁ-ゖー]/g, '');
}

/** 音（モーラ）に分ける */
export function splitMora(reading: string, rules: MoraRules): string[] {
  const s = normalizeReading(reading);
  const out: string[] = [];
  for (const ch of s) {
    if (SMALL_YOUON.has(ch)) {
      if (rules.youon === 'merge' && out.length > 0) {
        out[out.length - 1] += ch;
      } else {
        out.push(ch);
      }
      continue;
    }
    if (ch === 'っ' && rules.sokuon === 'skip') continue;
    if (ch === 'ー' && rules.chouon === 'skip') continue;
    out.push(ch);
  }
  return out;
}

export function countMora(reading: string, rules: MoraRules): number {
  return splitMora(reading, rules).length;
}

/** 頭の音 */
export function firstMora(reading: string, rules: MoraRules): string {
  const m = splitMora(reading, { ...rules, sokuon: 'count', chouon: 'count' });
  return m[0] ?? '';
}

export function dakuBase(kana: string): string {
  return DAKU_BASE[kana] ?? kana;
}

/** 頭の音が指定の音か（濁音を許すかは設定） */
export function headMatches(reading: string, target: string, rules: MoraRules, allowDakuonVariant: boolean): boolean {
  const head = firstMora(reading, rules);
  if (!head) return false;
  if (head === target) return true;
  if (allowDakuonVariant && head.length === 1 && dakuBase(head) === dakuBase(target)) return true;
  return false;
}

/** しりとり用：最後の音（小さい字は大きく、ー は前の母音に） */
export function lastSoundForShiritori(reading: string): string {
  const s = normalizeReading(reading);
  let last = s[s.length - 1] ?? '';
  if (last === 'ー') last = s[s.length - 2] ?? '';
  const big: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゎ: 'わ' };
  return big[last] ?? last;
}
