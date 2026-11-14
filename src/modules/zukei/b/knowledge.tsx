import type { Rng } from '../../../core/rng';
import type { QuestionType, TapQuestion } from '../../../player/types';
import { emo, Emoji } from '../../../ui/emoji';
import { emojiChoice, SEASONS, type SeasonId } from './common';

// ちしき：わたしは だれでしょう・昔話・季節

// =====================================================================
// わたしは だれでしょう
// =====================================================================

export const WHO_ANIMALS = ['usagi', 'zou', 'kirin', 'inu', 'neko', 'buta', 'saru', 'kame', 'pengin', 'niwatori', 'kaeru', 'raion', 'panda', 'ushi', 'uma', 'hitsuji'];

export interface WhoHint {
  id: string;
  k: string; // 表示（ひらがな）
  s?: string; // 読み上げ
  who: string[]; // 当てはまる動物
  unclear?: string[]; // 当てはまるか はっきりしない動物（まちがいの選択肢にしない）
}

export const WHO_HINTS: WhoHint[] = [
  { id: 'legs4', k: 'あしが 4ほん あります。', s: '足が 4本 あります。', who: ['inu', 'neko', 'usagi', 'zou', 'kirin', 'buta', 'ushi', 'uma', 'hitsuji', 'raion', 'panda', 'kame', 'kaeru'], unclear: ['saru'] },
  { id: 'legs2', k: 'あしが 2ほんです。', s: '足が 2本です。', who: ['pengin', 'niwatori'], unclear: ['saru'] },
  { id: 'egg', k: 'たまごを うみます。', s: '卵を 産みます。', who: ['niwatori', 'kame', 'kaeru', 'pengin'] },
  { id: 'wings', k: 'はねが あります。', s: '羽が あります。', who: ['niwatori', 'pengin'] },
  { id: 'jump', k: 'ぴょんぴょん はねます。', who: ['usagi', 'kaeru'] },
  { id: 'climb', k: 'きのぼりが とくいです。', s: '木登りが 得意です。', who: ['saru', 'neko', 'panda'] },
  { id: 'pond', k: 'いけや かわの ちかくに すんでいます。', s: '池や 川の近くに 住んでいます。', who: ['kaeru', 'kame'] },
  { id: 'carrot', k: 'にんじんが だいすきです。', s: 'にんじんが 大好きです。', who: ['usagi', 'uma'] },
  { id: 'mane', k: 'たてがみが あります。', who: ['raion', 'uma'] },
  { id: 'blackwhite', k: 'しろと くろの もようです。', s: '白と黒の もようです。', who: ['panda', 'pengin'], unclear: ['ushi', 'inu', 'neko', 'hitsuji'] },
  { id: 'ears', k: 'みみが ながいです。', s: '耳が 長いです。', who: ['usagi'] },
  { id: 'nose', k: 'はなが とても ながいです。', s: '鼻が とても 長いです。', who: ['zou'] },
  { id: 'trunkwater', k: 'はなで みずを あびます。', s: '鼻で 水を 浴びます。', who: ['zou'] },
  { id: 'neck', k: 'くびが とても ながいです。', s: '首が とても 長いです。', who: ['kirin'] },
  { id: 'highleaves', k: 'たかい きの はっぱを たべます。', s: '高い木の 葉っぱを 食べます。', who: ['kirin'], unclear: ['zou', 'saru', 'panda'] },
  { id: 'wanwan', k: '「わんわん」と なきます。', s: '「わんわん」と 鳴きます。', who: ['inu'] },
  { id: 'smell', k: 'においを かぐのが とくいです。', s: 'においを かぐのが 得意です。', who: ['inu'], unclear: ['buta', 'zou', 'neko'] },
  { id: 'walk', k: 'おさんぽが だいすきです。', s: 'お散歩が 大好きです。', who: ['inu'] },
  { id: 'nyaa', k: '「にゃあ」と なきます。', s: '「にゃあ」と 鳴きます。', who: ['neko'] },
  { id: 'mouse', k: 'ねずみを おいかけます。', s: 'ねずみを 追いかけます。', who: ['neko'] },
  { id: 'buubuu', k: '「ぶうぶう」と なきます。', s: '「ぶうぶう」と 鳴きます。', who: ['buta'] },
  { id: 'flatnose', k: 'はなが まるくて ひらたいです。', s: '鼻が 丸くて 平たいです。', who: ['buta'] },
  { id: 'banana', k: 'ばななが だいすきです。', s: 'バナナが 大好きです。', who: ['saru'] },
  { id: 'redbottom', k: 'おしりが あかいです。', s: 'おしりが 赤いです。', who: ['saru'] },
  { id: 'shell', k: 'せなかに かたい こうらが あります。', s: '背中に かたい こうらが あります。', who: ['kame'] },
  { id: 'slow', k: 'のろのろ ゆっくり あるきます。', s: 'のろのろ ゆっくり 歩きます。', who: ['kame'] },
  { id: 'cold', k: 'さむい ところに すんでいます。', s: '寒いところに 住んでいます。', who: ['pengin'] },
  { id: 'swimbird', k: 'そらは とべませんが、およぐのが じょうずです。', s: '空は飛べませんが、泳ぐのが 上手です。', who: ['pengin'] },
  { id: 'comb', k: 'あたまに あかい とさかが あります。', s: '頭に 赤い とさかが あります。', who: ['niwatori'] },
  { id: 'kokekokko', k: '「こけこっこー」と なきます。', s: '「こけこっこー」と 鳴きます。', who: ['niwatori'] },
  { id: 'kerokero', k: '「けろけろ」と なきます。', s: '「けろけろ」と 鳴きます。', who: ['kaeru'] },
  { id: 'gaoo', k: '「がおー」と ほえます。', who: ['raion'] },
  { id: 'king', k: 'どうぶつの おうさまと いわれます。', s: '動物の 王様と 言われます。', who: ['raion'] },
  { id: 'bamboo', k: 'ささを たべます。', s: '笹を 食べます。', who: ['panda'] },
  { id: 'moo', k: '「もうもう」と なきます。', s: '「もうもう」と 鳴きます。', who: ['ushi'] },
  { id: 'milk', k: 'おちちから ぎゅうにゅうが とれます。', s: 'お乳から 牛乳が とれます。', who: ['ushi'], unclear: ['hitsuji'] },
  { id: 'hihiin', k: '「ひひーん」と なきます。', s: '「ひひーん」と 鳴きます。', who: ['uma'] },
  { id: 'ride', k: 'ひとを せなかに のせて はしります。', s: '人を 背中に 乗せて 走ります。', who: ['uma'], unclear: ['zou', 'ushi'] },
  { id: 'meee', k: '「めえめえ」と なきます。', s: '「めえめえ」と 鳴きます。', who: ['hitsuji'] },
  { id: 'wool', k: 'けから けいとが できます。', s: '毛から 毛糸が できます。', who: ['hitsuji'] }
];

const HINT_BY_ID = new Map(WHO_HINTS.map((h) => [h.id, h]));

/** その動物が、ヒントに「はっきり当てはまらない」 */
export function clearlyFails(animal: string, h: WhoHint): boolean {
  return !h.who.includes(animal) && !(h.unclear ?? []).includes(animal);
}

function generateWhoAmI(rng: Rng): TapQuestion {
  const ans = rng.pick(WHO_ANIMALS);
  const mine = WHO_HINTS.filter((h) => h.who.includes(ans));
  const specific = rng.shuffle(mine.filter((h) => h.who.length === 1));
  const general = rng.shuffle(mine.filter((h) => h.who.length > 1));
  let chosen: WhoHint[] = [];
  const nGeneral = Math.min(general.length, 2);
  chosen = [...general.slice(0, nGeneral).sort((a, b) => b.who.length - a.who.length), ...specific.slice(0, 3 - nGeneral)];
  if (chosen.length < 3) chosen = [...chosen, ...specific.slice(3 - nGeneral)].slice(0, 3);
  // まちがいの選択肢：どれか1つのヒントに はっきり当てはまらない動物。はじめのヒントに当てはまる動物を多めに。
  const cands = WHO_ANIMALS.filter((a) => a !== ans && chosen.some((h) => clearlyFails(a, h)));
  const score = (a: string) => chosen.filter((h) => h.who.includes(a)).length;
  const ordered = rng.shuffle(cands).sort((a, b) => score(b) - score(a));
  const distractors: string[] = [];
  for (const a of ordered) {
    if (distractors.length >= 3) break;
    if (distractors.length < 2 || rng.chance(0.7)) distractors.push(a);
  }
  for (const a of ordered) if (distractors.length < 3 && !distractors.includes(a)) distractors.push(a);
  const opts = rng.shuffle([ans, ...distractors]);
  const nums = ['ひとつめ', 'ふたつめ', 'みっつめ'];
  const numsS = ['ひとつめ', 'ふたつめ', 'みっつめ'];
  const prompt = `わたしは だれでしょう。${chosen.map((h, i) => `${nums[i]}、${h.k}`).join('')}わたしは だれでしょう。`;
  const speech = `わたしは 誰でしょう。${chosen.map((h, i) => `${numsS[i]}。${h.s ?? h.k}`).join('')}わたしは 誰でしょう。`;
  return {
    type: 'zukei-who-am-i',
    prompt,
    speech,
    choices: opts.map((id) => emojiChoice(id, emo(id).char, emo(id).kana, { size: 58 })),
    answer: ans,
    explain: `こたえ：${emo(ans).kana}`,
    params: { answerId: ans, hints: chosen.map((h) => h.id), options: opts }
  };
}

export const whoAmIType: QuestionType = {
  id: 'zukei-who-am-i',
  name: 'わたしは だれでしょう',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '365日',
  description: 'ヒントを3つ読み上げて（「あしが 4ほん あります」→「みみが ながいです」…）、絵から選ぶ。最後まで聞かないと決まらない。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 6,
  generate: generateWhoAmI
};

export function hintById(id: string): WhoHint | undefined {
  return HINT_BY_ID.get(id);
}

// =====================================================================
// 昔話・絵本（著作権の切れた昔話・童話だけ）
// =====================================================================

export const TALE_ELEMS: Record<string, { char: string; label: string; animal?: boolean }> = {
  momo: { char: '🍑', label: 'もも' },
  inu: { char: '🐶', label: 'いぬ', animal: true },
  saru: { char: '🐵', label: 'さる', animal: true },
  kiji: { char: '🐦', label: 'きじ', animal: true },
  dango: { char: '🍡', label: 'きびだんご' },
  oni: { char: '👹', label: 'おに' },
  kani: { char: '🦀', label: 'かに', animal: true },
  kuri: { char: '🌰', label: 'くり' },
  hachi: { char: '🐝', label: 'はち', animal: true },
  omusubi: { char: '🍙', label: 'おむすび' },
  nezumi: { char: '🐭', label: 'ねずみ', animal: true },
  kuma: { char: '🐻', label: 'くま', animal: true },
  masakari: { char: '🪓', label: 'まさかり' },
  sakura: { char: '🌸', label: 'さくらの はな' },
  kobuta: { char: '🐷', label: 'こぶた', animal: true },
  ookami: { char: '🐺', label: 'おおかみ', animal: true },
  ie: { char: '🏠', label: 'いえ' },
  neko: { char: '🐱', label: 'ねこ', animal: true },
  kago: { char: '🧺', label: 'かご' },
  usagi: { char: '🐰', label: 'うさぎ', animal: true },
  kame: { char: '🐢', label: 'かめ', animal: true },
  tanuki: { char: '🦝', label: 'たぬき', animal: true },
  ari: { char: '🐜', label: 'あり', animal: true },
  kirigirisu: { char: '🦗', label: 'きりぎりす', animal: true },
  ringo: { char: '🍎', label: 'りんご' },
  taiyou: { char: '☀️', label: 'たいよう' },
  kaze: { char: '🌬️', label: 'かぜ' },
  tsuki: { char: '🌙', label: 'つき' },
  kabocha: { char: '🎃', label: 'かぼちゃ' },
  kutsu: { char: '👠', label: 'ガラスの くつ' }
};

const ANIMAL_ELEMS = Object.keys(TALE_ELEMS).filter((k) => TALE_ELEMS[k].animal);

/** どの話にも出てきそうなので、まちがいの選択肢には使わない */
export const NEVER_DISTRACT = new Set(['ie']);

export interface Tale {
  id: string;
  k: string;
  s: string;
  items: string[]; // でてくるもの
  maybe: string[]; // 本によっては でてくるもの（まちがいの選択肢にしない）
}

export const TALES: Tale[] = [
  { id: 'momotaro', k: 'ももたろう', s: '桃太郎', items: ['momo', 'inu', 'saru', 'kiji', 'dango', 'oni'], maybe: [] },
  { id: 'sarukani', k: 'さるかに がっせん', s: 'さるかに合戦', items: ['saru', 'kani', 'kuri', 'hachi'], maybe: ['omusubi'] },
  { id: 'omusubi', k: 'おむすび ころりん', s: 'おむすびころりん', items: ['omusubi', 'nezumi'], maybe: ['neko'] },
  { id: 'kintaro', k: 'きんたろう', s: '金太郎', items: ['kuma', 'masakari'], maybe: ANIMAL_ELEMS },
  { id: 'hanasaka', k: 'はなさか じいさん', s: '花咲かじいさん', items: ['inu', 'sakura'], maybe: ['kago'] },
  { id: 'kobuta', k: 'さんびきの こぶた', s: '三匹の子豚', items: ['kobuta', 'ookami', 'ie'], maybe: [] },
  { id: 'kabu', k: 'おおきな かぶ', s: '大きなかぶ', items: ['inu', 'neko', 'nezumi'], maybe: [] },
  { id: 'akazukin', k: 'あかずきん', s: '赤ずきん', items: ['ookami', 'kago'], maybe: ['ringo', 'sakura', 'ie'] },
  { id: 'usagikame', k: 'うさぎと かめ', s: 'うさぎとかめ', items: ['usagi', 'kame'], maybe: [] },
  { id: 'arikirigirisu', k: 'ありと きりぎりす', s: 'アリとキリギリス', items: ['ari', 'kirigirisu'], maybe: [] },
  { id: 'shirayuki', k: 'しらゆきひめ', s: '白雪姫', items: ['ringo'], maybe: [...ANIMAL_ELEMS, 'ie'] },
  { id: 'kitakaze', k: 'きたかぜと たいよう', s: '北風と太陽', items: ['taiyou', 'kaze'], maybe: [] },
  { id: 'kaguya', k: 'かぐやひめ', s: 'かぐや姫', items: ['tsuki'], maybe: [] },
  { id: 'cinderella', k: 'シンデレラ', s: 'シンデレラ', items: ['kabocha', 'kutsu'], maybe: ['nezumi'] },
  { id: 'urashima', k: 'うらしま たろう', s: '浦島太郎', items: ['kame'], maybe: [] },
  { id: 'kachikachi', k: 'かちかちやま', s: 'かちかち山', items: ['usagi', 'tanuki'], maybe: [] }
];

function taleChoice(id: string) {
  const e = TALE_ELEMS[id];
  return { id, node: <Emoji char={e.char} size={52} />, label: e.label };
}

function generateMukashi(rng: Rng): TapQuestion {
  const tale = rng.pick(TALES);
  const blocked = new Set([...tale.items, ...tale.maybe]);
  const outsiders = Object.keys(TALE_ELEMS).filter((id) => !blocked.has(id) && !NEVER_DISTRACT.has(id));
  const variant: 'in' | 'notIn' = tale.items.length >= 3 && rng.chance(0.4) ? 'notIn' : 'in';
  const pickDistinct = (pool: string[], n: number, avoidChars: string[]) => {
    const out: string[] = [];
    const chars = new Set(avoidChars);
    for (const id of rng.shuffle(pool)) {
      if (out.length >= n) break;
      if (chars.has(TALE_ELEMS[id].char)) continue;
      out.push(id);
      chars.add(TALE_ELEMS[id].char);
    }
    return out;
  };
  if (variant === 'in') {
    const ans = rng.pick(tale.items);
    const ds = pickDistinct(outsiders, 3, [TALE_ELEMS[ans].char]);
    const opts = rng.shuffle([ans, ...ds]);
    return {
      type: 'zukei-mukashi',
      prompt: `「${tale.k}」の おはなしに でてくるのは どれですか。`,
      speech: `${tale.s}の お話に 出てくるのは、どれですか。`,
      choices: opts.map(taleChoice),
      answer: ans,
      explain: `${tale.k}：${tale.items.map((i) => TALE_ELEMS[i].label).join('・')}`,
      params: { tale: tale.id, variant, answerId: ans, options: opts }
    };
  }
  const ins = rng.sample(tale.items, 3);
  const [out] = pickDistinct(outsiders, 1, ins.map((i) => TALE_ELEMS[i].char));
  const opts = rng.shuffle([...ins, out]);
  return {
    type: 'zukei-mukashi',
    prompt: `「${tale.k}」の おはなしに でてこないのは どれですか。`,
    speech: `${tale.s}の お話に 出てこないのは、どれですか。`,
    choices: opts.map(taleChoice),
    answer: out,
    explain: `${tale.k}：${tale.items.map((i) => TALE_ELEMS[i].label).join('・')}`,
    params: { tale: tale.id, variant, answerId: out, options: opts }
  };
}

export const mukashiType: QuestionType = {
  id: 'zukei-mukashi',
  name: '昔話・絵本',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '昔話・童話（ももたろう・さるかに・おむすびころりん・さんびきのこぶた・おおきなかぶ 等、著作権の切れた話）に「でてくるもの」「でてこないもの」を選ぶ。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 6,
  generate: generateMukashi
};

// =====================================================================
// 季節・行事
// =====================================================================

export const SEASON_ITEMS: Record<SeasonId, { id: string; char: string; label: string }[]> = {
  haru: [
    { id: 'sakura', char: '🌸', label: 'さくら' },
    { id: 'churippu', char: '🌷', label: 'ちゅーりっぷ' },
    { id: 'koinobori', char: '🎏', label: 'こいのぼり' },
    { id: 'hina', char: '🎎', label: 'おひなさま' }
  ],
  natsu: [
    { id: 'himawari', char: '🌻', label: 'ひまわり' },
    { id: 'hanabi', char: '🎆', label: 'はなび' },
    { id: 'suika', char: '🍉', label: 'すいか' },
    { id: 'tanabata', char: '🎋', label: 'たなばた' },
    { id: 'kakigoori', char: '🍧', label: 'かきごおり' }
  ],
  aki: [
    { id: 'momiji', char: '🍁', label: 'もみじ' },
    { id: 'otsukimi', char: '🎑', label: 'おつきみ' },
    { id: 'kuri', char: '🌰', label: 'くり' },
    { id: 'yakiimo', char: '🍠', label: 'やきいも' }
  ],
  fuyu: [
    { id: 'yukidaruma', char: '⛄', label: 'ゆきだるま' },
    { id: 'kadomatsu', char: '🎍', label: 'かどまつ' },
    { id: 'tako', char: '🪁', label: 'たこあげ' },
    { id: 'sori', char: '🛷', label: 'そり' }
  ]
};

export function seasonOf(itemId: string): SeasonId | undefined {
  for (const s of Object.keys(SEASON_ITEMS) as SeasonId[]) if (SEASON_ITEMS[s].some((x) => x.id === itemId)) return s;
  return undefined;
}

function generateKisetsu(rng: Rng): TapQuestion {
  const target = rng.pick(SEASONS);
  const others = SEASONS.filter((s) => s.id !== target.id);
  const variant: 'which' | 'same' = rng.chance(0.55) ? 'which' : 'same';
  const pickOthers = () => others.map((s) => rng.pick(SEASON_ITEMS[s.id]));
  if (variant === 'which') {
    const ans = rng.pick(SEASON_ITEMS[target.id]);
    const opts = rng.shuffle([ans, ...pickOthers()]);
    return {
      type: 'zukei-kisetsu',
      prompt: `${target.kana}の ものは どれですか。`,
      speech: `${target.kanji}の ものは、どれですか。`,
      choices: opts.map((x) => emojiChoice(x.id, x.char, x.label, { size: 56 })),
      answer: ans.id,
      explain: `${target.kana}：${ans.label}`,
      params: { variant, season: target.id, answerId: ans.id, options: opts.map((o) => o.id) }
    };
  }
  const [shown, ans] = rng.sample(SEASON_ITEMS[target.id], 2);
  const opts = rng.shuffle([ans, ...pickOthers()]);
  return {
    type: 'zukei-kisetsu',
    prompt: `この えと おなじ きせつの ものは どれですか。`,
    speech: `この絵と 同じ季節の ものは、どれですか。`,
    figure: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Emoji char={shown.char} size={84} label={shown.label} />
      </div>
    ),
    choices: opts.map((x) => emojiChoice(x.id, x.char, x.label, { size: 56 })),
    answer: ans.id,
    explain: `${shown.label}と ${ans.label}は ${target.kana}`,
    params: { variant, season: target.id, shownId: shown.id, answerId: ans.id, options: opts.map((o) => o.id) }
  };
}

export const kisetsuType: QuestionType = {
  id: 'zukei-kisetsu',
  name: '季節・行事',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '365日',
  description: '「なつの ものは どれですか」「この絵と おなじ季節のものは」。花・行事・食べもの（さくら・ひまわり・もみじ・ゆきだるま など）。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 5,
  generate: generateKisetsu
};
