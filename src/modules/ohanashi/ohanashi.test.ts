import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import { emo } from '../../ui/emoji';
import { CARRY, FAMILY, FOUND, makeStory, SEASON_CLUES, SHOPS, TEMPLATE_IDS, type Story } from './stories';
import { OHANASHI_TYPES } from './types';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const name = (id: string) => emo(id).kana;

function hasElement(x: unknown, depth = 0): boolean {
  if (depth > 6 || x === null || typeof x !== 'object') return false;
  if (isValidElement(x)) return true;
  return Object.values(x as Record<string, unknown>).some((v) => hasElement(v, depth + 1));
}

function basic(s: Story) {
  expect(s.questions.length).toBe(4);
  expect(s.text.length).toBeGreaterThan(30);
  for (const str of [s.text, s.speech]) expect(str).not.toMatch(/undefined|NaN|\[object|\{|\}/);
  for (const q of s.questions) {
    expect(q.type).toBe(`ohanashi-${s.template}`);
    const ids = q.choices.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.length).toBeLessThanOrEqual(5);
    expect(ids).toContain(q.answer);
    expect(q.prompt).not.toMatch(/undefined|NaN/);
    expect(hasElement(q.params)).toBe(false);
  }
  // 同じ種類の質問は1つまで
  const kinds = s.questions.map((q) => (q.params as { kind: string }).kind);
  expect(new Set(kinds).size).toBe(kinds.length);
}

/** a が b より上（速い・大きい）の関係から、全体の順が1通りに決まるか。上から順に返す */
function totalOrder(items: string[], above: [string, string][]): string[] | null {
  const gt = new Set(above.map(([a, b]) => `${a}>${b}`));
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of items)
      for (const b of items)
        for (const c of items)
          if (gt.has(`${a}>${b}`) && gt.has(`${b}>${c}`) && !gt.has(`${a}>${c}`)) {
            gt.add(`${a}>${c}`);
            changed = true;
          }
  }
  for (const a of items) for (const b of items) if (a !== b && !gt.has(`${a}>${b}`) && !gt.has(`${b}>${a}`)) return null;
  const wins = (a: string) => items.filter((b) => gt.has(`${a}>${b}`)).length;
  return [...items].sort((a, b) => wins(b) - wins(a));
}

const kindOf = (q: { params?: unknown }) => (q.params as { kind: string }).kind;

describe('お話の記憶', () => {
  it('4テンプレートのタイプ', () => {
    expect(OHANASHI_TYPES.map((t) => t.id)).toEqual(TEMPLATE_IDS.map((t) => `ohanashi-${t}`));
    for (const t of OHANASHI_TYPES) {
      expect(t.genre).toBe('kioku');
      expect(t.moduleId).toBe('ohanashi');
      expect((t.sample ?? '').length).toBeGreaterThan(30);
    }
    expect(OHANASHI_TYPES.find((t) => t.id === 'ohanashi-kakekko')!.source).toBe('本番');
  });

  it('同じ seed で同じお話・毎回ちがうお話', () => {
    for (const t of TEMPLATE_IDS) {
      const texts = new Set<string>();
      for (const seed of SEEDS) {
        const a = makeStory(t, makeRng(seed));
        const b = makeStory(t, makeRng(seed));
        expect(b.text).toBe(a.text);
        expect(b.questions.map((q) => q.answer)).toEqual(a.questions.map((q) => q.answer));
        texts.add(a.text);
      }
      expect(texts.size).toBeGreaterThan(100);
    }
  });

  it('かけっこ：文から順位が1通りに決まり、答えが合う', () => {
    for (const seed of SEEDS) {
      const s = makeStory('kakekko', makeRng(seed));
      basic(s);
      const f = s.facts as { n: number; order: string[]; season: keyof typeof SEASON_CLUES; pairs: [string, string][] };
      expect(f.order.length).toBe(f.n);
      expect(totalOrder(f.order, f.pairs)).toEqual(f.order);
      for (const [fast, slow] of f.pairs) expect(s.text).toContain(`${name(slow)}より ${name(fast)}の ほうが`);
      for (const a of f.order) expect(s.text).toContain(name(a));
      expect(s.text).toContain(`${name(f.order[0])}が 1ばんでした`);
      expect(SEASON_CLUES[f.season].some((c) => s.text.includes(c))).toBe(true);
      for (const q of s.questions) {
        const k = kindOf(q);
        if (k === 'first') expect(q.answer).toBe(f.order[0]);
        if (k === 'last') expect(q.answer).toBe(f.order[f.n - 1]);
        if (k === 'second') expect(q.answer).toBe(f.order[1]);
        if (k === 'count') expect(q.answer).toBe(`n${f.n}`);
        if (k === 'season') expect(q.answer).toBe(`season-${f.season}`);
        if (['first', 'last', 'second'].includes(k)) {
          // お話に出た動物は全部 選択肢にある
          const ids = q.choices.map((c) => c.id);
          for (const a of f.order) expect(ids).toContain(a);
        }
      }
    }
  });

  it('雪だるま：大きさの順が1通りに決まり、答えが合う', () => {
    for (const seed of SEEDS) {
      const s = makeStory('yukidaruma', makeRng(seed));
      basic(s);
      const f = s.facts as { n: number; animals: string[]; asc: string[]; smallest: string; bigger: [string, string][] };
      const above: [string, string][] = [...f.animals.filter((a) => a !== f.smallest).map((a) => [a, f.smallest] as [string, string]), ...f.bigger];
      const desc = totalOrder(f.animals, above);
      expect(desc).toEqual([...f.asc].reverse());
      for (const [big, small] of f.bigger) {
        const ok = s.text.includes(`${name(big)}は ${name(small)}より おおきい`) || s.text.includes(`${name(small)}は ${name(big)}より ちいさい`);
        expect(ok).toBe(true);
      }
      expect(s.text).toContain(`${name(f.smallest)}は いちばん ちいさい`);
      expect(s.text).toContain('ゆき');
      for (const q of s.questions) {
        const k = kindOf(q);
        if (k === 'biggest') expect(q.answer).toBe(f.asc[f.n - 1]);
        if (k === 'smallest') expect(q.answer).toBe(f.asc[0]);
        if (k === 'second') expect(q.answer).toBe(f.asc[f.n - 2]);
        if (k === 'what') expect(q.answer).toBe('yukidaruma');
        if (k === 'season') expect(q.answer).toBe('season-fuyu');
        if (k === 'count') expect(q.answer).toBe(`n${f.n}`);
      }
      const kinds = s.questions.map(kindOf);
      expect(kinds).toContain('biggest');
      expect(kinds).toContain('smallest');
    }
  });

  it('おつかい：買ったもの・数・袋・頼んだ人・お店が合う', () => {
    const items = SHOPS.flatMap((x) => x.items);
    for (const seed of SEEDS) {
      const s = makeStory('otsukai', makeRng(seed));
      basic(s);
      const f = s.facts as { child: string; asker: string; shop: string; items: { id: string; n: number }[]; bag: string };
      const boughtIds = f.items.map((x) => x.id);
      expect(f.items[0].n).not.toBe(f.items[1].n);
      for (const it of f.items) expect(s.text).toContain(items.find((x) => x.id === it.id)!.k);
      for (const q of s.questions) {
        const k = kindOf(q);
        if (k === 'bought') {
          expect(boughtIds).toContain(q.answer);
          for (const c of q.choices) if (c.id !== q.answer) expect(boughtIds).not.toContain(c.id);
        }
        if (k === 'count') {
          const it = items.find((x) => q.prompt.startsWith(`${x.k}は`))!;
          expect(boughtIds).toContain(it.id);
          expect(q.answer).toBe(`n${f.items.find((x) => x.id === it.id)!.n}`);
        }
        if (k === 'bag') expect(q.answer).toBe(f.bag);
        if (k === 'asker') expect(q.answer).toBe(f.asker);
        if (k === 'shop') expect(q.answer).toBe(f.shop);
      }
      expect(s.text).toContain(FAMILY.find((x) => x.id === f.asker)!.k);
    }
  });

  it('おでかけ：季節・だれと・持ちもの・見つけたものが合う', () => {
    for (const seed of SEEDS) {
      const s = makeStory('odekake', makeRng(seed));
      basic(s);
      const f = s.facts as { season: keyof typeof SEASON_CLUES; who: string; carried: string[]; found: string };
      expect(SEASON_CLUES[f.season].some((c) => s.text.includes(c))).toBe(true);
      expect(s.text).toContain(FAMILY.find((x) => x.id === f.who)!.k);
      for (const c of f.carried) expect(s.text).toContain(CARRY[c].k);
      expect(s.text).toContain(FOUND[f.found].k);
      for (const q of s.questions) {
        const k = kindOf(q);
        if (k === 'season') expect(q.answer).toBe(`season-${f.season}`);
        if (k === 'who') expect(q.answer).toBe(f.who);
        if (k === 'carry') {
          expect(f.carried).toContain(q.answer);
          const groups = new Set(f.carried.map((c) => CARRY[c].group).filter(Boolean));
          for (const c of q.choices) {
            if (c.id === q.answer) continue;
            expect(f.carried).not.toContain(c.id);
            if (CARRY[c.id].group) expect(groups.has(CARRY[c.id].group)).toBe(false);
          }
        }
        if (k === 'found') {
          expect(q.answer).toBe(f.found);
          expect(q.choices.filter((c) => c.id === f.found).length).toBe(1);
        }
      }
    }
  });
});
