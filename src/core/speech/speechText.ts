// 読み上げる文の整え方
// - 読み上げは かな だけにする（漢字は読み間違えるため。例：「方」を「かた」と読む）
// - 数字は かなの読みに直す。助数詞で音が変わるもの（いっこ・さんびき・ふたり など）も直す

const KANJI = /[一-鿿々〆]/;

export function hasKanji(s: string): boolean {
  return KANJI.test(s);
}

/** 読み上げる文を選ぶ：speech が かなだけならそれ、漢字があれば prompt（ひらがな） */
export function speechTextOf(speech: string | undefined, prompt: string): string {
  return speech && !hasKanji(speech) ? speech : prompt;
}

const DIGIT = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HUNDRED = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく'];
const THOUSAND = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん'];

/** 0〜9999 の数の読み（ひらがな） */
export function numKana(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 9999 || Math.floor(n) !== n) return String(n);
  if (n === 0) return DIGIT[0];
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  let s = THOUSAND[th] + HUNDRED[h];
  if (t) s += (t === 1 ? '' : DIGIT[t]) + 'じゅう';
  if (o) s += DIGIT[o];
  return s;
}

// 末尾の数（1〜9、10 は 10 の位で終わるとき）ごとの、音が変わる形
// 例：こ … 1 いっこ／6 ろっこ／8 はっこ／10 じゅっこ
const SOKUON_K: Record<number, string> = { 1: 'いっ', 6: 'ろっ', 8: 'はっ', 10: 'じゅっ' };

function withLast(n: number, form: (last: number) => string | null, base: string): string {
  const o = n % 10;
  if (o) {
    const head = numKana(n - o);
    const f = form(o);
    return (head === DIGIT[0] ? '' : head) + (f ?? DIGIT[o] + base);
  }
  // 10・20・… で終わる
  const t = Math.floor((n % 100) / 10);
  if (t) {
    const head = numKana(n - t * 10);
    const tens = (t === 1 ? '' : DIGIT[t]) + 'じゅう';
    const f = form(10);
    const pre = head === DIGIT[0] ? '' : head;
    return f ? pre + (t === 1 ? '' : DIGIT[t]) + f : pre + tens + base;
  }
  return numKana(n) + base;
}

/** 数＋助数詞の読み。counter は かなで（こ・かい・ひき・ほん・にん・ばん・まい・もじ…） */
export function countKana(n: number, counter: string): string {
  switch (counter) {
    case 'こ':
    case 'かい':
    case 'かいめ':
      return withLast(n, (d) => (SOKUON_K[d] ? SOKUON_K[d] + counter : null), counter);
    case 'ひき':
    case 'びき':
    case 'ぴき':
      return withLast(
        n,
        (d) => (d === 3 ? 'さんびき' : SOKUON_K[d] ? SOKUON_K[d] + 'ぴき' : null),
        'ひき'
      );
    case 'ほん':
    case 'ぼん':
    case 'ぽん':
      return withLast(
        n,
        (d) => (d === 3 ? 'さんぼん' : SOKUON_K[d] ? SOKUON_K[d] + 'ぽん' : null),
        'ほん'
      );
    case 'ふん':
    case 'ぷん':
      return withLast(
        n,
        (d) => (d === 3 || d === 4 ? DIGIT[d] + 'ぷん' : SOKUON_K[d] ? SOKUON_K[d] + 'ぷん' : null),
        'ふん'
      );
    case 'さい':
      if (n === 20) return 'はたち';
      return withLast(n, (d) => (d === 1 || d === 8 || d === 10 ? SOKUON_K[d] + 'さい' : null), 'さい');
    case 'にん':
      if (n === 1) return 'ひとり';
      if (n === 2) return 'ふたり';
      return withLast(n, (d) => (d === 4 ? 'よにん' : null), 'にん');
    case 'つ': {
      const T = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];
      return n >= 1 && n <= 10 ? T[n] : countKana(n, 'こ');
    }
    default:
      return numKana(n) + counter;
  }
}

const COUNTERS = ['ばんめ', 'ばん', 'びょう', 'かいめ', 'かい', 'ひき', 'びき', 'ぴき', 'ほん', 'ぼん', 'ぽん', 'ふん', 'ぷん', 'にん', 'まい', 'もじ', 'さい', 'だい', 'ど', 'つ', 'こ'];
const NUM_RE = new RegExp(`(\\d+)\\s*(${COUNTERS.join('|')})?`, 'g');

/** 読み上げ用に整える（数字 → かな、？ → はてな、全角数字 → 半角） */
export function toSpeechText(text: string): string {
  let s = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 「？に はいるのは」の ？ は「はてな」と読む（文の終わりの ？ はそのまま）
  s = s.replace(/[？?](?=\s*[にのをがは])/g, 'はてな');
  s = s.replace(NUM_RE, (_, d: string, c?: string) => (c ? countKana(Number(d), c) : numKana(Number(d))));
  return s;
}
