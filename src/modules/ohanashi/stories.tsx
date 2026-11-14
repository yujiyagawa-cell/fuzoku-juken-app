import type { Rng } from '../../core/rng';
import type { Choice, TapQuestion } from '../../player/types';
import { emo } from '../../ui/emoji';
import { emojiChoice, INK, numberChoices, SEASONS, seasonChoices, type SeasonId } from '../zukei/b/common';

// お話の記憶：テンプレートに語句を差し込んで、毎回ちがうお話を作る。
// k = 表示（保護者パネル。ひらがな・分かち書き）、s = 読み上げ（漢字まじり）

export type TemplateId = 'kakekko' | 'yukidaruma' | 'otsukai' | 'odekake';
export const TEMPLATE_IDS: TemplateId[] = ['kakekko', 'yukidaruma', 'otsukai', 'odekake'];

export function typeIdOf(t: TemplateId): string {
  return `ohanashi-${t}`;
}

interface KK {
  k: string;
  s: string;
}
const kk = (k: string, s: string = k): KK => ({ k, s });
function cat(...parts: (KK | string)[]): KK {
  let k = '';
  let s = '';
  for (const p of parts) {
    if (typeof p === 'string') {
      k += p;
      s += p;
    } else {
      k += p.k;
      s += p.s;
    }
  }
  return { k, s };
}

export interface Story {
  template: TemplateId;
  type: string;
  title: string;
  text: string; // 表示用
  speech: string; // 読み上げ用
  questions: TapQuestion[];
  facts: Record<string, unknown>;
}

// ---- 数え方 ----
const smallTsu = (n: number) => n === 1 || n === 6 || n === 8 || n === 10;
export const hiki = (n: number): KK => kk(`${n}${smallTsu(n) ? 'ぴき' : n === 3 ? 'びき' : 'ひき'}`, `${n}匹`);
export const ko = (n: number): KK => kk(`${n}こ`, `${n}個`);
export const hon = (n: number): KK => kk(`${n}${smallTsu(n) ? 'ぽん' : n === 3 ? 'ぼん' : 'ほん'}`, `${n}本`);

function q(
  template: TemplateId,
  kind: string,
  prompt: KK,
  choices: Choice[],
  answer: string,
  explain: string,
  extra: Partial<TapQuestion> = {}
): TapQuestion {
  return {
    type: typeIdOf(template),
    prompt: prompt.k,
    speech: prompt.k,
    choices,
    answer,
    explain,
    params: { template, kind, answer },
    ...extra
  };
}

/** 動物の選択肢（お話に出た動物＋足りなければ出ていない動物で4つ） */
function animalChoices(rng: Rng, inStory: string[], pool: string[]): Choice[] {
  const ids = rng.shuffle(inStory).slice(0, 4);
  const extra = rng.shuffle(pool.filter((a) => !inStory.includes(a)));
  while (ids.length < 4 && extra.length) ids.push(extra.shift()!);
  return rng.shuffle(ids).map((id) => emojiChoice(id, emo(id).char, emo(id).kana, { size: 54 }));
}

const name = (id: string) => emo(id).kana;

function seasonQ(template: TemplateId, season: SeasonId): TapQuestion {
  return q(template, 'season', kk('この おはなしの きせつは いつですか。', 'このお話の 季節は、いつですか。'), seasonChoices(), `season-${season}`, `季節：${SEASONS.find((s) => s.id === season)!.kana}`, {
    cols: 4,
    choiceHeight: 104
  });
}

function countQ(template: TemplateId, rng: Rng, n: number): TapQuestion {
  const { choices, answerId } = numberChoices(rng, n, { min: 2, max: 6 });
  return q(template, 'count', kk('どうぶつは なんびき いましたか。', '動物は、何匹 いましたか。'), choices, answerId, `${n}匹`, { cols: 4, choiceHeight: 96 });
}

// =====================================================================
// かけっこ（本番：ノート17枚目）
// =====================================================================

export const RACERS = ['usagi', 'risu', 'kuma', 'tanuki', 'kitsune', 'neko', 'inu', 'saru', 'buta', 'nezumi'];

const KAKEKKO_PLACES: Record<SeasonId, KK[]> = {
  haru: [kk('さくらの はなが さいている きまで', '桜の花が 咲いている 木まで'), kk('ちゅーりっぷが さいている はなばたけまで', 'チューリップが 咲いている 花畑まで')],
  natsu: [kk('ひまわりが さいている はたけまで', 'ひまわりが 咲いている 畑まで'), kk('せみが ないている おおきな きまで', 'セミが 鳴いている 大きな木まで')],
  aki: [kk('もみじが まっかな きまで', 'もみじが 真っ赤な 木まで'), kk('どんぐりが たくさん おちている きまで', 'どんぐりが たくさん 落ちている 木まで')],
  fuyu: [kk('ゆきが つもった こうえんの すべりだいまで', '雪が 積もった 公園の すべり台まで'), kk('ゆきだるまが ある ところまで', '雪だるまが ある ところまで')]
};

/** 季節の手がかり（テスト用）：お話にこの言葉が入っている */
export const SEASON_CLUES: Record<SeasonId, string[]> = {
  haru: ['さくら', 'ちゅーりっぷ'],
  natsu: ['ひまわり', 'せみ', 'なつやすみ', 'うみ'],
  aki: ['もみじ', 'どんぐり'],
  fuyu: ['ゆき']
};

function kakekko(rng: Rng): Story {
  const t: TemplateId = 'kakekko';
  const n = rng.chance(0.75) ? 4 : 3;
  const order = rng.sample(RACERS, n); // はやい順
  const season = rng.pick(SEASONS).id;
  const place = rng.pick(KAKEKKO_PLACES[season]);
  const pairs = order.slice(0, -1).map((fast, i) => [fast, order[i + 1]] as [string, string]);
  const stmts = rng.shuffle(pairs);
  const parts = stmts.map(([fast, slow], i) =>
    cat(`${name(slow)}より ${name(fast)}の `, i < stmts.length - 1 ? kk('ほうが はやくて、', '方が 速くて、') : kk('ほうが はやかったです。', '方が 速かったです。'))
  );
  const text = cat(
    kk('どうぶつが ', '動物が '),
    hiki(n),
    '、',
    place,
    kk(' かけっこを しました。', ' かけっこを しました。'),
    'スタートすると、',
    ...parts,
    kk(`ゴールすると、${name(order[0])}が 1ばんでした。`, `ゴールすると、${name(order[0])}が 1番でした。`)
  );

  const first = q(t, 'first', kk('1ばんに ゴールしたのは だれですか。', '1番に ゴールしたのは、誰ですか。'), animalChoices(rng, order, RACERS), order[0], `1番：${name(order[0])}`);
  const last = q(t, 'last', kk('いちばん おそかったのは だれですか。', 'いちばん 遅かったのは、誰ですか。'), animalChoices(rng, order, RACERS), order[n - 1], `いちばん遅い：${name(order[n - 1])}`);
  const second = q(t, 'second', kk('2ばんに ゴールしたのは だれですか。', '2番に ゴールしたのは、誰ですか。'), animalChoices(rng, order, RACERS), order[1], `2番：${name(order[1])}`);
  const head = rng.shuffle([countQ(t, rng, n), seasonQ(t, season)]);
  const questions = [...head, first, rng.chance(0.6) ? last : second];

  return {
    template: t,
    type: typeIdOf(t),
    title: 'かけっこ',
    text: text.k,
    speech: text.k,
    questions,
    facts: { n, order, season, pairs, statements: stmts }
  };
}

// =====================================================================
// 雪だるま（ノート4枚目）
// =====================================================================

export const BUILDERS = ['usagi', 'kuma', 'tanuki', 'kitsune', 'risu', 'neko', 'inu', 'saru', 'buta'];

function yukidaruma(rng: Rng): Story {
  const t: TemplateId = 'yukidaruma';
  const n = rng.chance(0.8) ? 4 : 3;
  const animals = rng.sample(BUILDERS, n); // 紹介の順
  const asc = rng.shuffle(animals); // 小さい順
  const place = rng.pick([kk('ゆきの おやまに', '雪の お山に'), kk('ゆきの つもった こうえんに', '雪の 積もった 公園に')]);
  const list = animals.map(name).join('、');
  const stmts: KK[] = [kk(`${name(asc[0])}は いちばん ちいさい ゆきだるまでした。`, `${name(asc[0])}は いちばん小さい 雪だるまでした。`)];
  const bigger: [string, string][] = []; // [大きい, 小さい]
  for (let i = 1; i <= n - 2; i++) {
    const small = asc[i];
    const big = asc[i + 1];
    bigger.push([big, small]);
    stmts.push(
      rng.chance(0.7)
        ? kk(`${name(big)}は ${name(small)}より おおきい ゆきだるまでした。`, `${name(big)}は ${name(small)}より 大きい 雪だるまでした。`)
        : kk(`${name(small)}は ${name(big)}より ちいさい ゆきだるまでした。`, `${name(small)}は ${name(big)}より 小さい 雪だるまでした。`)
    );
  }
  const text = cat(place, `、${list}が いました。`, kk('みんなで ゆきだるまを つくりました。', 'みんなで 雪だるまを 作りました。'), ...stmts);

  const biggest = q(
    t,
    'biggest',
    kk('いちばん おおきい ゆきだるまを つくったのは だれですか。', 'いちばん大きい 雪だるまを 作ったのは、誰ですか。'),
    animalChoices(rng, animals, BUILDERS),
    asc[n - 1],
    `いちばん大きい：${name(asc[n - 1])}`
  );
  const smallest = q(
    t,
    'smallest',
    kk('いちばん ちいさい ゆきだるまを つくったのは だれですか。', 'いちばん小さい 雪だるまを 作ったのは、誰ですか。'),
    animalChoices(rng, animals, BUILDERS),
    asc[0],
    `いちばん小さい：${name(asc[0])}`
  );
  const second = q(
    t,
    'second',
    kk('2ばんめに おおきい ゆきだるまを つくったのは だれですか。', '2番目に 大きい 雪だるまを 作ったのは、誰ですか。'),
    animalChoices(rng, animals, BUILDERS),
    asc[n - 2],
    `2番目に大きい：${name(asc[n - 2])}`
  );
  const what = q(
    t,
    'what',
    kk('みんなで なにを つくりましたか。', 'みんなで 何を 作りましたか。'),
    rng.shuffle([
      emojiChoice('yukidaruma', '⛄', 'ゆきだるま', { size: 54 }),
      emojiChoice('oshiro', '🏰', 'おしろ', { size: 54 }),
      emojiChoice('ie', '🏠', 'いえ', { size: 54 }),
      emojiChoice('onigiri', '🍙', 'おにぎり', { size: 54 })
    ]),
    'yukidaruma',
    '雪だるま'
  );
  const extras = rng.sample([what, seasonQ(t, 'fuyu'), countQ(t, rng, n), second], 2);
  const questions = rng.shuffle([biggest, smallest, ...extras]);
  return {
    template: t,
    type: typeIdOf(t),
    title: 'ゆきだるま',
    text: text.k,
    speech: text.k,
    questions,
    facts: { n, animals, asc, smallest: asc[0], bigger, season: 'fuyu' }
  };
}

// =====================================================================
// おつかい
// =====================================================================

export const CHILD_NAMES = ['はなこちゃん', 'ゆいちゃん', 'みくちゃん', 'ゆうたくん', 'けんたくん', 'そうたくん'];

export const FAMILY: { id: string; k: string; s: string; char: string }[] = [
  { id: 'okaasan', k: 'おかあさん', s: 'お母さん', char: '👩' },
  { id: 'otousan', k: 'おとうさん', s: 'お父さん', char: '👨' },
  { id: 'obaasan', k: 'おばあさん', s: 'おばあさん', char: '👵' },
  { id: 'ojiisan', k: 'おじいさん', s: 'おじいさん', char: '👴' },
  { id: 'oniisan', k: 'おにいさん', s: 'お兄さん', char: '👦' },
  { id: 'oneesan', k: 'おねえさん', s: 'お姉さん', char: '👧' }
];

export interface ShopItem {
  id: string;
  k: string;
  s: string;
  char: string;
  unit: 'ko' | 'hon';
}

export const SHOPS: { id: string; k: string; s: string; char: string; caption: string; items: ShopItem[] }[] = [
  {
    id: 'yaoya',
    k: 'やおやさん',
    s: '八百屋さん',
    char: '🥕',
    caption: 'やおやさん',
    items: [
      { id: 'ringo', k: 'りんご', s: 'りんご', char: '🍎', unit: 'ko' },
      { id: 'mikan', k: 'みかん', s: 'みかん', char: '🍊', unit: 'ko' },
      { id: 'tomato', k: 'とまと', s: 'トマト', char: '🍅', unit: 'ko' },
      { id: 'ninjin', k: 'にんじん', s: 'にんじん', char: '🥕', unit: 'hon' },
      { id: 'nasu', k: 'なす', s: 'なす', char: '🍆', unit: 'hon' },
      { id: 'banana', k: 'ばなな', s: 'バナナ', char: '🍌', unit: 'hon' },
      { id: 'toumorokoshi', k: 'とうもろこし', s: 'とうもろこし', char: '🌽', unit: 'hon' }
    ]
  },
  {
    id: 'panya',
    k: 'ぱんやさん',
    s: 'パン屋さん',
    char: '🍞',
    caption: 'ぱんやさん',
    items: [
      { id: 'pan', k: 'しょくぱん', s: '食パン', char: '🍞', unit: 'ko' },
      { id: 'kurowassan', k: 'くろわっさん', s: 'クロワッサン', char: '🥐', unit: 'ko' },
      { id: 'donatsu', k: 'どーなつ', s: 'ドーナツ', char: '🍩', unit: 'ko' },
      { id: 'sando', k: 'さんどいっち', s: 'サンドイッチ', char: '🥪', unit: 'ko' }
    ]
  },
  {
    id: 'okashiya',
    k: 'おかしやさん',
    s: 'お菓子屋さん',
    char: '🍰',
    caption: 'おかしやさん',
    items: [
      { id: 'purin', k: 'ぷりん', s: 'プリン', char: '🍮', unit: 'ko' },
      { id: 'keki', k: 'けーき', s: 'ケーキ', char: '🍰', unit: 'ko' },
      { id: 'dango', k: 'だんご', s: 'だんご', char: '🍡', unit: 'hon' },
      { id: 'choko', k: 'ちょこれーと', s: 'チョコレート', char: '🍫', unit: 'ko' }
    ]
  }
];

const OTHER_SHOPS = [
  { id: 'sakanaya', char: '🐟', caption: 'さかなやさん' },
  { id: 'hanaya', char: '💐', caption: 'はなやさん' }
];

export const BAGS: { id: string; k: string; s: string; name: string; fill: string }[] = [
  { id: 'aka', k: 'あかい', s: '赤い', name: 'あか', fill: '#e8524a' },
  { id: 'ao', k: 'あおい', s: '青い', name: 'あお', fill: '#3d7be0' },
  { id: 'kiiro', k: 'きいろい', s: '黄色い', name: 'きいろ', fill: '#f2c230' },
  { id: 'midori', k: 'みどりの', s: '緑の', name: 'みどり', fill: '#3fa564' }
];

function Bag({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 80 76" style={{ width: '100%', maxHeight: 66, display: 'block' }} aria-hidden="true">
      <path d="M28 26 Q28 8 40 8 Q52 8 52 26" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M14 26 H66 L61 72 H19 Z" fill={fill} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

const counter = (it: ShopItem, n: number) => (it.unit === 'hon' ? hon(n) : ko(n));

function otsukai(rng: Rng): Story {
  const t: TemplateId = 'otsukai';
  const child = rng.pick(CHILD_NAMES);
  const asker = rng.pick(FAMILY.slice(0, 4));
  const shop = rng.pick(SHOPS);
  const [it1, it2] = rng.sample(shop.items, 2);
  const c1 = rng.int(1, 5);
  let c2 = rng.int(1, 5);
  while (c2 === c1) c2 = rng.int(1, 5);
  const bag = rng.pick(BAGS);
  const text = cat(
    `${child}は、`,
    kk(`${asker.k}に たのまれて、`, `${asker.s}に 頼まれて、`),
    kk(`${shop.k}へ おつかいに いきました。`, `${shop.s}へ おつかいに 行きました。`),
    kk(`${it1.k}を `, `${it1.s}を `),
    counter(it1, c1),
    kk(`と、${it2.k}を `, `と、${it2.s}を `),
    counter(it2, c2),
    kk(' かいました。', ' 買いました。'),
    kk(`${bag.k} ふくろに いれて もらって、いえに かえりました。`, `${bag.s} 袋に 入れて もらって、家に 帰りました。`)
  );

  // かったもの
  const boughtAns = rng.pick([it1, it2]);
  const allItems = SHOPS.flatMap((s) => s.items);
  const notBought = rng.shuffle(allItems.filter((x) => x.id !== it1.id && x.id !== it2.id && x.char !== it1.char && x.char !== it2.char));
  const ds: ShopItem[] = [];
  for (const x of notBought) if (ds.length < 3 && !ds.some((d) => d.char === x.char)) ds.push(x);
  const bought = q(
    t,
    'bought',
    kk(`${child}が かった ものは どれですか。`, `${child}が 買ったものは、どれですか。`),
    rng.shuffle([boughtAns, ...ds]).map((x) => emojiChoice(x.id, x.char, x.k, { size: 54 })),
    boughtAns.id,
    `買ったもの：${it1.k}・${it2.k}`
  );

  // いくつ
  const [cx, cOther] = rng.chance(0.5) ? [it1, c2] : [it2, c1];
  const cAns = cx.id === it1.id ? c1 : c2;
  const nc = numberChoices(rng, cAns, { min: 1, max: 6, traps: [cOther] });
  const count = q(
    t,
    'count',
    cx.unit === 'hon' ? kk(`${cx.k}は なんぼん かいましたか。`, `${cx.s}は、何本 買いましたか。`) : kk(`${cx.k}は いくつ かいましたか。`, `${cx.s}は、いくつ 買いましたか。`),
    nc.choices,
    nc.answerId,
    `${cx.k}：${cAns}`,
    { cols: 4, choiceHeight: 96 }
  );

  // ふくろの いろ
  const bagQ = q(
    t,
    'bag',
    kk('ふくろは なにいろ でしたか。', '袋は、何色 でしたか。'),
    rng.shuffle(BAGS).map((b) => ({ id: b.id, node: <Bag fill={b.fill} />, label: b.name, caption: b.name })),
    bag.id,
    `袋：${bag.name}`,
    { cols: 4, choiceHeight: 104 }
  );

  // だれに / どこへ
  const askerQ = q(
    t,
    'asker',
    kk(`${child}は だれに たのまれましたか。`, `${child}は、誰に 頼まれましたか。`),
    rng.shuffle(FAMILY.slice(0, 4)).map((f) => emojiChoice(f.id, f.char, f.k, { caption: f.k, size: 48 })),
    asker.id,
    `頼んだ人：${asker.k}`
  );
  const shopOpts = rng.shuffle([...SHOPS.map((s) => ({ id: s.id, char: s.char, caption: s.caption })), rng.pick(OTHER_SHOPS)]);
  const shopQ = q(
    t,
    'shop',
    kk(`${child}は どこへ おつかいに いきましたか。`, `${child}は、どこへ おつかいに 行きましたか。`),
    shopOpts.map((s) => emojiChoice(s.id, s.char, s.caption, { caption: s.caption, size: 46 })),
    shop.id,
    `お店：${shop.k}`
  );

  const fourth = rng.chance(0.5) ? askerQ : shopQ;
  const questions = rng.shuffle([bought, count, bagQ, fourth]);
  return {
    template: t,
    type: typeIdOf(t),
    title: 'おつかい',
    text: text.k,
    speech: text.k,
    questions,
    facts: { child, asker: asker.id, shop: shop.id, items: [{ id: it1.id, n: c1 }, { id: it2.id, n: c2 }], bag: bag.id }
  };
}

// =====================================================================
// きせつの おでかけ
// =====================================================================

export const CARRY: Record<string, { k: string; s: string; char: string; group?: string }> = {
  bento: { k: 'おべんとう', s: 'お弁当', char: '🍱' },
  boushi: { k: 'ぼうし', s: '帽子', char: '🧢', group: 'hat' },
  booru: { k: 'ぼーる', s: 'ボール', char: '⚽' },
  mugiwara: { k: 'むぎわらぼうし', s: '麦わら帽子', char: '👒', group: 'hat' },
  kago: { k: 'かご', s: 'かご', char: '🧺' },
  onigiri: { k: 'おにぎり', s: 'おにぎり', char: '🍙' },
  sori: { k: 'そり', s: 'そり', char: '🛷' },
  tebukuro: { k: 'てぶくろ', s: '手袋', char: '🧤' },
  kasa: { k: 'かさ', s: '傘', char: '☂️' }
};

export const FOUND: Record<string, { k: string; s: string; char: string }> = {
  choucho: { k: 'ちょうちょ', s: 'ちょうちょ', char: '🦋' },
  tentoumushi: { k: 'てんとうむし', s: 'てんとう虫', char: '🐞' },
  kani: { k: 'かに', s: 'カニ', char: '🦀' },
  kai: { k: 'かいがら', s: '貝がら', char: '🐚' },
  sakana: { k: 'さかな', s: '魚', char: '🐟' },
  kuri: { k: 'くり', s: '栗', char: '🌰' },
  kinoko: { k: 'きのこ', s: 'きのこ', char: '🍄' },
  risu: { k: 'りす', s: 'リス', char: '🐿️' },
  ashiato: { k: 'どうぶつの あしあと', s: '動物の 足あと', char: '🐾' },
  tori: { k: 'ことり', s: '小鳥', char: '🐦' }
};

const ODEKAKE: Record<SeasonId, { open: KK; go: KK; at: KK; carry: string[]; found: string[] }> = {
  haru: {
    open: kk('さくらが さいたので、', '桜が 咲いたので、'),
    go: kk('こうえんへ おはなみに いきました。', '公園へ お花見に 行きました。'),
    at: kk('こうえんで', '公園で'),
    carry: ['bento', 'boushi', 'booru'],
    found: ['choucho', 'tentoumushi']
  },
  natsu: {
    open: kk('なつやすみに、', '夏休みに、'),
    go: kk('うみへ あそびに いきました。', '海へ 遊びに 行きました。'),
    at: kk('すなはまで', '砂浜で'),
    carry: ['mugiwara', 'booru', 'onigiri'],
    found: ['kani', 'kai', 'sakana']
  },
  aki: {
    open: kk('もみじが まっかに なったので、', 'もみじが 真っ赤に なったので、'),
    go: kk('やまへ さんぽに いきました。', '山へ 散歩に 行きました。'),
    at: kk('やまで', '山で'),
    carry: ['kago', 'onigiri', 'boushi'],
    found: ['kuri', 'kinoko', 'risu']
  },
  fuyu: {
    open: kk('ゆきが たくさん ふったので、', '雪が たくさん 降ったので、'),
    go: kk('こうえんへ ゆきあそびに いきました。', '公園へ 雪遊びに 行きました。'),
    at: kk('こうえんで', '公園で'),
    carry: ['sori', 'tebukuro'],
    found: ['ashiato', 'tori']
  }
};

function odekake(rng: Rng): Story {
  const t: TemplateId = 'odekake';
  const season = rng.pick(SEASONS).id;
  const sc = ODEKAKE[season];
  const child = rng.pick(CHILD_NAMES);
  const who = rng.pick(FAMILY);
  const carried = rng.sample(sc.carry, rng.chance(0.6) ? 2 : 1);
  const found = rng.pick(sc.found);
  const carryText =
    carried.length === 2
      ? kk(`${CARRY[carried[0]].k}と ${CARRY[carried[1]].k}を もって いきました。`, `${CARRY[carried[0]].s}と ${CARRY[carried[1]].s}を 持って 行きました。`)
      : kk(`${CARRY[carried[0]].k}を もって いきました。`, `${CARRY[carried[0]].s}を 持って 行きました。`);
  const text = cat(
    sc.open,
    `${child}は `,
    kk(`${who.k}と `, `${who.s}と `),
    sc.go,
    carryText,
    sc.at,
    kk(` ${FOUND[found].k}を みつけました。`, ` ${FOUND[found].s}を 見つけました。`)
  );

  const whoQ = q(
    t,
    'who',
    kk(`${child}は だれと いきましたか。`, `${child}は、誰と 行きましたか。`),
    rng.shuffle([who, ...rng.sample(FAMILY.filter((f) => f.id !== who.id), 3)]).map((f) => emojiChoice(f.id, f.char, f.k, { caption: f.k, size: 48 })),
    who.id,
    `いっしょに行った人：${who.k}`
  );

  const carryAns = rng.pick(carried);
  const carriedGroups = new Set(carried.map((c) => CARRY[c].group).filter(Boolean));
  const carryPool = rng.shuffle(Object.keys(CARRY).filter((c) => !carried.includes(c) && !(CARRY[c].group && carriedGroups.has(CARRY[c].group))));
  const carryQ = q(
    t,
    'carry',
    kk('なにを もって いきましたか。', '何を 持って 行きましたか。'),
    rng.shuffle([carryAns, ...carryPool.slice(0, 3)]).map((c) => emojiChoice(c, CARRY[c].char, CARRY[c].k, { size: 54 })),
    carryAns,
    `持っていったもの：${carried.map((c) => CARRY[c].k).join('・')}`
  );

  const foundQ = q(
    t,
    'found',
    cat(sc.at, kk(' なにを みつけましたか。', ' 何を 見つけましたか。')),
    rng.shuffle([found, ...rng.sample(Object.keys(FOUND).filter((f) => f !== found), 3)]).map((f) => emojiChoice(f, FOUND[f].char, FOUND[f].k, { size: 54 })),
    found,
    `見つけたもの：${FOUND[found].k}`
  );

  const questions = [seasonQ(t, season), ...rng.shuffle([whoQ, carryQ, foundQ])];
  return {
    template: t,
    type: typeIdOf(t),
    title: 'きせつの おでかけ',
    text: text.k,
    speech: text.k,
    questions,
    facts: { season, child, who: who.id, carried, found }
  };
}

// =====================================================================

const MAKERS: Record<TemplateId, (rng: Rng) => Story> = { kakekko, yukidaruma, otsukai, odekake };

export function makeStory(template: TemplateId, rng: Rng): Story {
  return MAKERS[template](rng);
}

export function templateOfType(typeId: string): TemplateId | null {
  const t = typeId.replace(/^ohanashi-/, '') as TemplateId;
  return TEMPLATE_IDS.includes(t) ? t : null;
}
