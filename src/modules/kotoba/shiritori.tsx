import type { Rng } from '../../core/rng';
import type { TapQuestion } from '../../player/types';
import { emo, Emoji, type EmojiItem } from '../../ui/emoji';

// しりとり並べ：絵カード3〜4枚を、しりとりになる順にタップする。
// 絵を見てすぐ名前が分かるもの（よみが1つに決まるもの）だけを使う。並べ方が1通りになる組み合わせだけ出す。

const IDS = [
  'risu', 'suika', 'kame', 'megane', 'neko', 'koara', 'rappa', 'panda', 'gorira', 'rakuda', 'dango', 'ringo', 'ichigo',
  'tamago', 'kuri', 'inu', 'usagi', 'kitsune', 'tanuki', 'nezumi', 'kasa', 'sakana', 'nasu', 'sushi', 'shika', 'saru',
  'tokei', 'ika', 'kani', 'niwatori', 'iruka', 'kujira', 'rakko', 'sori', 'hoshi', 'tsuki', 'yuki', 'kinoko', 'fune',
  'tora', 'tomato', 'taiko', 'momo', 'budou', 'ushi', 'uma', 'mado', 'basu', 'kagi', 'kaeru', 'kuruma', 'maiku', 'kuma',
  'hachi', 'ari', 'isu', 'kutsu', 'ebi', 'bara', 'hebi', 'wani', 'kaminari', 'hasami', 'kagami', 'momiji'
];

const POOL: EmojiItem[] = IDS.map(emo);

const last = (s: string) => s[s.length - 1];
const links = (a: EmojiItem, b: EmojiItem) => last(a.kana) === b.kana[0];

/** 並べてしりとりになる順番の数 */
export function countOrders(items: EmojiItem[]): number {
  let n = 0;
  const used = new Array(items.length).fill(false);
  const dfs = (prev: EmojiItem | null, depth: number) => {
    if (depth === items.length) {
      n++;
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      if (prev && !links(prev, items[i])) continue;
      used[i] = true;
      dfs(items[i], depth + 1);
      used[i] = false;
    }
  };
  dfs(null, 0);
  return n;
}

export function generateShiritori(rng: Rng, length?: 3 | 4): TapQuestion {
  for (let tries = 0; tries < 400; tries++) {
    const L = length ?? (rng.chance(0.5) ? 3 : 4);
    const chain: EmojiItem[] = [rng.pick(POOL)];
    while (chain.length < L) {
      const p = chain[chain.length - 1];
      const nexts = POOL.filter((x) => !chain.includes(x) && links(p, x));
      if (!nexts.length) break;
      chain.push(rng.pick(nexts));
    }
    if (chain.length < L || countOrders(chain) !== 1) continue;
    const choices = rng.shuffle(chain).map((e) => ({
      id: e.id,
      label: e.kana,
      node: <Emoji char={e.char} size={L === 4 ? 62 : 56} label={e.kana} />
    }));
    return {
      type: 'shiritori',
      prompt: 'しりとりに なるように じゅんばんに さわってください。',
      speech: 'しりとりに なるように、じゅんばんに さわってください。',
      choices,
      answer: chain.map((e) => e.id),
      mode: 'order',
      cols: L === 4 ? 2 : 3,
      choiceHeight: L === 4 ? 110 : 120,
      explain: chain.map((e) => e.kana).join(' → '),
      params: { ids: chain.map((e) => e.id) }
    };
  }
  // 念のための固定問題
  const fixed = ['risu', 'suika', 'kame'].map(emo);
  return {
    type: 'shiritori',
    prompt: 'しりとりに なるように じゅんばんに さわってください。',
    choices: [fixed[2], fixed[0], fixed[1]].map((e) => ({ id: e.id, label: e.kana, node: <Emoji char={e.char} size={56} label={e.kana} /> })),
    answer: fixed.map((e) => e.id),
    mode: 'order',
    cols: 3,
    explain: 'りす → すいか → かめ',
    params: { ids: fixed.map((e) => e.id) }
  };
}
