// 再現できる乱数（seed つき）と便利関数

export interface Rng {
  seed: number;
  next(): number; // 0 <= x < 1
  int(min: number, max: number): number; // min..max（両端を含む）
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
  sample<T>(arr: readonly T[], n: number): T[];
}

export function makeRng(seed?: number): Rng {
  let s = (seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const initial = s;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed: initial,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance: (p) => next() < p,
    sample: (arr, n) => rng.shuffle(arr).slice(0, n)
  };
  return rng;
}

/** 重みつきで1つ選ぶ */
export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  const ws = items.map((t) => Math.max(0, weight(t)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return rng.pick(items);
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
