import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../core/rng';
import { emo } from '../../../ui/emoji';
import { ZUKEI_A_TYPES } from '../typesA';
import { allForms, rotations, sameShapeModel, shapeKey } from './sameShape';
import { countHidden, silKey, stackCount, viewOf, viewsModel, type Stack } from './tsumiki';

const IDS = [
  'zukei-rotate-box',
  'zukei-rotate-grid',
  'zukei-rotate-arrow',
  'zukei-ferris',
  'zukei-rotate-table',
  'zukei-tsumiki-count',
  'zukei-tsumiki-donguri',
  'zukei-tsumiki-views',
  'zukei-same-shape',
  'zukei-series',
  'zukei-coordinates',
  'zukei-puzzle',
  'zukei-split'
];

const typeOf = (id: string) => ZUKEI_A_TYPES.find((t) => t.id === id)!;
const answerLabel = (q: ReturnType<NonNullable<(typeof ZUKEI_A_TYPES)[number]['generate']>>) =>
  q.choices.find((c) => c.id === q.answer)!.label;

describe('図形・推理 A：タイプ一覧', () => {
  it('13タイプ・id が表のとおりで一意', () => {
    expect(ZUKEI_A_TYPES.map((t) => t.id)).toEqual(IDS);
    for (const t of ZUKEI_A_TYPES) {
      expect(t.genre).toBe('zukei');
      expect(t.moduleId).toBe('zukei');
      expect(t.answer).toBe('tap');
      expect(typeof t.generate).toBe('function');
      expect(t.description.length).toBeGreaterThan(10);
    }
  });
});

describe('図形・推理 A：200回つくっても正しい問題になる', () => {
  for (const t of ZUKEI_A_TYPES) {
    it(t.id, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const q = t.generate!(makeRng(seed));
        expect(q.type).toBe(t.id);
        const ids = q.choices.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThanOrEqual(2);
        expect(ids.length).toBeLessThanOrEqual(6);
        const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
        for (const a of ans) expect(ids).toContain(a);
        for (const c of q.choices) expect(c.label.length).toBeGreaterThan(0);
        expect(q.prompt.length).toBeGreaterThan(0);
        expect(q.figure).toBeTruthy();
        // params は小さな JSON（そのまま保存できる）
        const json = JSON.stringify(q.params);
        expect(JSON.parse(json)).toEqual(q.params);
        expect(json.length).toBeLessThan(600);
        // 同じ seed なら同じ問題
        const q2 = t.generate!(makeRng(seed));
        expect(JSON.stringify(q2.params)).toBe(json);
        expect(q2.answer).toEqual(q.answer);
        expect(q2.prompt).toBe(q.prompt);
        expect(q2.choices.map((c) => c.label)).toEqual(q.choices.map((c) => c.label));
      }
    });
  }

  it('絵に NaN・undefined が出ない（描ける）', () => {
    for (const t of ZUKEI_A_TYPES) {
      for (let seed = 1; seed <= 40; seed++) {
        const q = t.generate!(makeRng(seed));
        const html = renderToStaticMarkup(createElement(Fragment, null, q.figure, ...q.choices.map((c) => c.node)));
        expect(html, t.id).not.toMatch(/NaN|undefined|Infinity/);
        expect(html.length, t.id).toBeGreaterThan(100);
      }
    }
  });

  it('seed がちがえば いろいろな問題になる', () => {
    for (const t of ZUKEI_A_TYPES) {
      const set = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) set.add(JSON.stringify(t.generate!(makeRng(seed)).params));
      expect(set.size, t.id).toBeGreaterThan(10);
    }
  });
});

describe('図形・推理 A：答えの中身', () => {
  it('観覧車：上に来る動物・動いた数', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-ferris').generate!(makeRng(seed));
      const p = q.params as { N: number; animals: string[]; dir: 'cw' | 'ccw'; form: 'A' | 'B'; k: number; p?: number };
      const mod = (x: number) => ((x % p.N) + p.N) % p.N;
      if (p.form === 'A') {
        const src = p.dir === 'cw' ? mod(-p.k) : mod(p.k);
        expect(answerLabel(q)).toBe(emo(p.animals[src]).kana);
      } else {
        expect(answerLabel(q)).toBe(`${p.k}こ`);
        expect(p.p).toBe(p.dir === 'cw' ? mod(-p.k) : mod(p.k));
      }
      expect(q.askReason).toBe(true);
    }
  });

  it('回るテーブル', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-rotate-table').generate!(makeRng(seed));
      const p = q.params as { animals: string[]; foods: string[]; dir: 'cw' | 'ccw'; k: number; form: 'A' | 'B'; s?: number; f?: number };
      const step = p.dir === 'cw' ? p.k : -p.k;
      const mod = (x: number) => ((x % 4) + 4) % 4;
      if (p.form === 'A') expect(answerLabel(q)).toBe(emo(p.foods[mod(p.s! - step)]).kana);
      else expect(answerLabel(q)).toBe(emo(p.animals[mod(p.f! + step)]).kana);
    }
  });

  it('▷の回転', () => {
    const NAMES = ['みぎむき', 'したむき', 'ひだりむき', 'うえむき'];
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-rotate-arrow').generate!(makeRng(seed));
      const p = q.params as { d0: number; n: number; dir: 'cw' | 'ccw' };
      const d1 = (((p.d0 + (p.dir === 'cw' ? p.n : -p.n)) % 4) + 4) % 4;
      expect(answerLabel(q)).toBe(NAMES[d1]);
    }
  });

  it('積み木の数・どんぐり：数が合う', () => {
    for (const id of ['zukei-tsumiki-count', 'zukei-tsumiki-donguri']) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = typeOf(id).generate!(makeRng(seed));
        const p = q.params as { h: number[][]; n: number; hidden: number };
        const st: Stack = { R: p.h.length, C: p.h[0].length, h: p.h };
        expect(stackCount(st)).toBe(p.n);
        expect(answerLabel(q)).toBe(`${p.n}こ`);
        expect(p.n).toBeGreaterThanOrEqual(3);
        expect(p.n).toBeLessThanOrEqual(10);
        expect(p.hidden).toBeLessThanOrEqual(2);
        // 手前の列は奥の列より高くない（どの列も上が見える）
        for (let r = 1; r < st.R; r++) for (let c = 0; c < st.C; c++) expect(p.h[r][c]).toBeLessThanOrEqual(p.h[r - 1][c]);
      }
    }
  });

  it('見えない積み木の数え方', () => {
    expect(countHidden({ R: 1, C: 3, h: [[1, 2, 1]] })).toBe(0);
    expect(countHidden({ R: 2, C: 1, h: [[2], [1]] })).toBe(0);
    expect(countHidden({ R: 2, C: 2, h: [[2, 2], [1, 1]] })).toBe(1);
    expect(countHidden({ R: 2, C: 3, h: [[2, 2, 2], [1, 1, 1]] })).toBe(2);
  });

  it('四方からの見え方：正解は1つだけ', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = viewsModel(makeRng(seed));
      const ck = silKey(viewOf(m.st, m.dir));
      expect(silKey(m.correct)).toBe(ck);
      const keys = m.others.map(silKey);
      expect(keys).not.toContain(ck);
      expect(new Set(keys).size).toBe(3);
    }
    // 右から見ると手前の列が左
    const st: Stack = { R: 2, C: 2, h: [[3, 1], [1, 0]] };
    expect(silKey(viewOf(st, 'migi'))).toBe('2x3:01/01/11');
    expect(silKey(viewOf(st, 'hidari'))).toBe('2x3:10/10/11');
    expect(silKey(viewOf(st, 'mae'))).toBe('2x3:10/10/11');
    expect(silKey(viewOf(st, 'ue'))).toBe('2x2:11/10');
  });

  it('同じ形さがし：回して重なるのは正解だけ', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = sameShapeModel(makeRng(seed));
      const rotKeys = new Set(rotations(m.sample).map(shapeKey));
      const forms = new Set(allForms(m.sample));
      expect(forms.size).toBe(8);
      const ok = m.choices.filter((c) => rotKeys.has(shapeKey(c.cells)));
      expect(ok.map((c) => c.key)).toEqual(['ok']);
      expect(shapeKey(m.choices[0].cells)).not.toBe(shapeKey(m.sample)); // 見本と同じ向きにはしない
    }
  });

  it('系列：？の答えはくりかえしの同じ位置', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-series').generate!(makeRng(seed));
      const p = q.params as { tpl: string; seq: string[]; miss: number };
      const per = p.tpl.length;
      expect(p.miss).toBeGreaterThanOrEqual(per);
      expect(p.seq[p.miss]).toBe(p.seq[p.miss - per]);
      expect(p.seq.length).toBeGreaterThanOrEqual(2 * per);
    }
  });

  it('座標', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-coordinates').generate!(makeRng(seed));
      const p = q.params as { rows: number; cols: number; items: string[]; r: number; c: number };
      expect(answerLabel(q)).toBe(emo(p.items[p.r * p.cols + p.c]).kana);
    }
  });

  it('同じ数ずつ分ける', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = typeOf('zukei-split').generate!(makeRng(seed));
      const p = q.params as { form: 'A' | 'B'; n: number; k?: number; per: number; people?: number };
      if (p.form === 'A') {
        expect(p.n).toBe(p.k! * p.per);
        expect(answerLabel(q)).toBe(`${p.per}こ`);
      } else {
        expect(p.n).toBe(p.per * p.people!);
        expect(answerLabel(q)).toBe(`${p.people}にん`);
      }
    }
  });
});
