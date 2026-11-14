import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../core/rng';
import type { QuestionType, TapQuestion } from '../../../player/types';
import { ZUKEI_B_TYPES } from '../typesB';
import { polyomino, ropePath, WEIGHT_ITEMS } from './compare';
import { WEAR } from './count';
import { clearlyFails, hintById, NEVER_DISTRACT, seasonOf, TALE_ELEMS, TALES } from './knowledge';
import { ORDER_SETS } from './memory';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

function hasElement(x: unknown, depth = 0): boolean {
  if (depth > 6 || x === null || typeof x !== 'object') return false;
  if (isValidElement(x)) return true;
  return Object.values(x as Record<string, unknown>).some((v) => hasElement(v, depth + 1));
}

function basic(t: QuestionType, q: TapQuestion) {
  expect(q.type).toBe(t.id);
  expect(q.prompt.length).toBeGreaterThan(3);
  expect(q.prompt).not.toMatch(/undefined|NaN|\[object/);
  expect(q.speech ?? '').not.toMatch(/undefined|NaN|\[object/);
  const ids = q.choices.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBeGreaterThanOrEqual(2);
  expect(ids.length).toBeLessThanOrEqual(6);
  if (q.mode === 'order') {
    expect(Array.isArray(q.answer)).toBe(true);
    expect([...(q.answer as string[])].sort()).toEqual([...ids].sort());
  } else {
    expect(typeof q.answer).toBe('string');
    expect(ids).toContain(q.answer);
  }
  for (const c of q.choices) expect(c.label.length).toBeGreaterThan(0);
  expect(hasElement(q.params)).toBe(false);
  expect(() => JSON.stringify(q.params)).not.toThrow();
}

const extremeIndex = (values: number[], ask: 'max' | 'min') => {
  const target = ask === 'max' ? Math.max(...values) : Math.min(...values);
  const idx = values.flatMap((v, i) => (v === target ? [i] : []));
  expect(idx.length).toBe(1);
  return idx[0];
};

function connected(cells: number[]): boolean {
  const set = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const c = stack.pop()!;
    const x = c % 4;
    const y = Math.floor(c / 4);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ]) {
      const id = ny * 4 + nx;
      if (nx >= 0 && nx <= 3 && ny >= 0 && ny <= 3 && set.has(id) && !seen.has(id)) {
        seen.add(id);
        stack.push(id);
      }
    }
  }
  return seen.size === set.size;
}

/** [重い, 軽い] の組から順番を作り、ただ1通りに決まるか */
function orderFromPairs(items: string[], pairs: [string, string][]): string[] | null {
  const gt = new Set(pairs.map(([a, b]) => `${a}>${b}`));
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of items)
      for (const b of items)
        for (const c of items) {
          if (gt.has(`${a}>${b}`) && gt.has(`${b}>${c}`) && !gt.has(`${a}>${c}`)) {
            gt.add(`${a}>${c}`);
            changed = true;
          }
        }
  }
  for (const a of items) for (const b of items) if (a !== b && !gt.has(`${a}>${b}`) && !gt.has(`${b}>${a}`)) return null;
  const wins = (a: string) => items.filter((b) => gt.has(`${a}>${b}`)).length;
  return [...items].sort((a, b) => wins(b) - wins(a));
}

describe('図形・推理 B', () => {
  it('11タイプ・id が一意・メタデータ', () => {
    expect(ZUKEI_B_TYPES.length).toBe(11);
    expect(new Set(ZUKEI_B_TYPES.map((t) => t.id)).size).toBe(11);
    for (const t of ZUKEI_B_TYPES) {
      expect(t.genre).toBe('zukei');
      expect(t.moduleId).toBe('zukei');
      expect(t.answer).toBe('tap');
      expect(typeof t.generate).toBe('function');
      expect(['本番', 'ノート', 'ノート（予想）', 'とっくん42', 'とっくん65', '365日', '仕様']).toContain(t.source);
    }
  });

  for (const t of ZUKEI_B_TYPES) {
    it(`${t.id}：200回 生成して正しい・同じ seed で同じ・毎回ちがう`, () => {
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        const q = t.generate!(makeRng(seed));
        basic(t, q);
        const again = t.generate!(makeRng(seed));
        expect(again.prompt).toBe(q.prompt);
        expect(again.answer).toEqual(q.answer);
        expect(again.choices.map((c) => c.id)).toEqual(q.choices.map((c) => c.id));
        expect(JSON.stringify(again.params)).toBe(JSON.stringify(q.params));
        seen.add(`${q.prompt}|${JSON.stringify(q.answer)}|${JSON.stringify(q.params)}`);
      }
      // 手袋は「人数×もの」の組み合わせが少ない（ノートどおり 2〜4人）ので、置き方以外のちがいは少なめ
      expect(seen.size).toBeGreaterThan(t.id === 'zukei-gloves' ? 15 : 40);
    });
  }

  const byId = (id: string) => ZUKEI_B_TYPES.find((t) => t.id === id)!;

  it('長さ・水：答えが ただ1つの いちばん', () => {
    for (const id of ['zukei-length', 'zukei-water']) {
      for (const seed of SEEDS) {
        const q = byId(id).generate!(makeRng(seed));
        const p = q.params as { ask: 'max' | 'min'; values: number[] };
        expect(p.values.length).toBe(q.choices.length);
        expect(q.answer).toBe(`c${extremeIndex(p.values, p.ask)}`);
      }
    }
  });

  it('ひも：マスの数と同じ長さで、重ならない', () => {
    for (const seed of SEEDS) {
      const L = 4 + (seed % 7);
      const pts = ropePath(makeRng(seed), L);
      expect(pts.length).toBe(L + 1);
      expect(new Set(pts.map((p) => p.join(','))).size).toBe(pts.length);
      for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1])).toBe(1);
    }
  });

  it('重さ：シーソーから順番が1通りに決まり、答えが合う', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-weight').generate!(makeRng(seed));
      const p = q.params as { ask: 'max' | 'min'; order: string[]; pairs: [string, string][] };
      expect(orderFromPairs(p.order, p.pairs)).toEqual(p.order);
      expect(q.answer).toBe(p.ask === 'max' ? p.order[0] : p.order[p.order.length - 1]);
      expect(q.choices.map((c) => c.id).sort()).toEqual([...p.order].sort());
      for (const id of p.order) expect(WEIGHT_ITEMS.some((w) => w.id === id)).toBe(true);
    }
  });

  it('広さ：つながった形で、マスの数が合う', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-area').generate!(makeRng(seed));
      const p = q.params as { ask: 'max' | 'min'; values: number[]; shapes: number[][] };
      p.shapes.forEach((cells, i) => {
        expect(cells.length).toBe(p.values[i]);
        expect(connected(cells)).toBe(true);
      });
      expect(q.answer).toBe(`c${extremeIndex(p.values, p.ask)}`);
    }
    for (const seed of SEEDS) expect(connected(polyomino(makeRng(seed), 7))).toBe(true);
  });

  it('多い・少ない：数が合う', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-more-less').generate!(makeRng(seed));
      const p = q.params as { variant: string; moreId: string; lessId: string; moreN: number; lessN: number };
      expect(p.moreN).toBeGreaterThan(p.lessN);
      expect(p.lessN).toBeGreaterThanOrEqual(2);
      if (p.variant === 'which') {
        expect(q.answer).toBe(p.moreId);
        expect(q.choices.map((c) => c.id).sort()).toEqual([p.moreId, p.lessId].sort());
      } else {
        expect(q.answer).toBe(`n${p.moreN - p.lessN}`);
      }
    }
  });

  it('手袋・くつした：1人ぶんの数から計算が合う', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-gloves').generate!(makeRng(seed));
      const p = q.params as { variant: string; item: keyof typeof WEAR; n?: number; per?: number; k?: number };
      if (p.variant === 'need') {
        expect(p.per).toBe(WEAR[p.item].per);
        expect(q.answer).toBe(`n${p.n! * p.per!}`);
      } else {
        expect(q.answer).toBe(`n${p.k}`);
      }
    }
  });

  it('お話の順番：正しい順は組の順番どおり、出す順はばらばら', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-story-order').generate!(makeRng(seed));
      const p = q.params as { set: string; correct: string[]; shown: string[] };
      const set = ORDER_SETS.find((s) => s.id === p.set)!;
      const full = set.steps.map((s) => s.id);
      const pos = p.correct.map((id) => full.indexOf(id));
      expect(pos.every((x, i) => x >= 0 && (i === 0 || x > pos[i - 1]))).toBe(true);
      expect(p.correct[0]).toBe(full[0]);
      expect(p.correct[p.correct.length - 1]).toBe(full[full.length - 1]);
      expect(p.shown).not.toEqual(p.correct);
      expect(q.answer).toEqual(p.correct);
    }
  });

  it('絵の記憶：あった／なかった／どこ が合う', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-picture-memory').generate!(makeRng(seed));
      expect(q.preview).toBeTruthy();
      expect(q.preview!.seconds).toBeGreaterThanOrEqual(5);
      const p = q.params as { variant: string; shown: { id: string; cell: number }[]; answerId?: string; targetId?: string; answerCell?: number };
      const shownIds = p.shown.map((s) => s.id);
      expect(new Set(p.shown.map((s) => s.cell)).size).toBe(p.shown.length);
      const others = q.choices.map((c) => c.id).filter((id) => id !== q.answer);
      if (p.variant === 'present') {
        expect(shownIds).toContain(q.answer);
        for (const o of others) expect(shownIds).not.toContain(o);
      } else if (p.variant === 'absent') {
        expect(shownIds).not.toContain(q.answer);
        for (const o of others) expect(shownIds).toContain(o);
      } else {
        const target = p.shown.find((s) => s.id === p.targetId)!;
        expect(q.answer).toBe(`p${target.cell}`);
        expect(q.choices.length).toBe(4);
      }
    }
  });

  it('わたしは だれ：ヒントは答えに全部当てはまり、ほかの選択肢には はっきり1つ当てはまらない', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-who-am-i').generate!(makeRng(seed));
      const p = q.params as { answerId: string; hints: string[]; options: string[] };
      expect(p.hints.length).toBe(3);
      const hs = p.hints.map((h) => hintById(h)!);
      for (const h of hs) expect(h.who).toContain(p.answerId);
      for (const o of p.options.filter((x) => x !== p.answerId)) expect(hs.some((h) => clearlyFails(o, h))).toBe(true);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(4);
    }
  });

  it('昔話：でてくる／でてこない が合う（本によって出るものは まちがいにしない）', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-mukashi').generate!(makeRng(seed));
      const p = q.params as { tale: string; variant: 'in' | 'notIn'; answerId: string; options: string[] };
      const tale = TALES.find((t) => t.id === p.tale)!;
      const blocked = new Set([...tale.items, ...tale.maybe]);
      const others = p.options.filter((o) => o !== p.answerId);
      if (p.variant === 'in') {
        expect(tale.items).toContain(p.answerId);
        for (const o of others) {
          expect(blocked.has(o)).toBe(false);
          expect(NEVER_DISTRACT.has(o)).toBe(false);
        }
      } else {
        expect(blocked.has(p.answerId)).toBe(false);
        for (const o of others) expect(tale.items).toContain(o);
      }
      const chars = p.options.map((o) => TALE_ELEMS[o].char);
      expect(new Set(chars).size).toBe(chars.length);
    }
  });

  it('季節：答えだけが その季節', () => {
    for (const seed of SEEDS) {
      const q = byId('zukei-kisetsu').generate!(makeRng(seed));
      const p = q.params as { variant: string; season: string; answerId: string; options: string[]; shownId?: string };
      expect(seasonOf(p.answerId)).toBe(p.season);
      const otherSeasons = p.options.filter((o) => o !== p.answerId).map((o) => seasonOf(o));
      for (const s of otherSeasons) expect(s).not.toBe(p.season);
      expect(new Set(otherSeasons).size).toBe(otherSeasons.length);
      if (p.variant === 'same') {
        expect(seasonOf(p.shownId!)).toBe(p.season);
        expect(p.shownId).not.toBe(p.answerId);
      }
    }
  });
});
