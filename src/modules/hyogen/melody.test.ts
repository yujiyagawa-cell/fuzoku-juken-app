import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import { clapTimesMs, makeMelody, makeRhythm, melodyBeats, melodyLabel, PENTA, rhythmLabel } from './melody';
import { isNeutral, makePoseSequence, poseLabel, samePose } from './poses';
import { HYOGEN_TYPES } from './types';

describe('makeRhythm', () => {
  it('合計4拍・3〜6回・0.5は2つずつ・ぜんぶ1拍ではない', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeRhythm(makeRng(seed));
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(4, 9);
      expect(p.length).toBeGreaterThanOrEqual(3);
      expect(p.length).toBeLessThanOrEqual(6);
      expect(p.every((x) => x === 1)).toBe(false);
      for (const x of p) expect([0.5, 1, 2]).toContain(x);
      // 0.5 は2つずつ
      for (let i = 0; i < p.length; i++) {
        if (p[i] === 0.5) {
          expect(p[i + 1]).toBe(0.5);
          i++;
        }
      }
    }
  });

  it('同じ seed なら同じリズム', () => {
    expect(makeRhythm(makeRng(9))).toEqual(makeRhythm(makeRng(9)));
  });

  it('読み方と時刻', () => {
    expect(rhythmLabel([1, 0.5, 0.5, 2])).toBe('たん たた たーん');
    expect(clapTimesMs([1, 0.5, 0.5, 2], 60)).toEqual([0, 1000, 1500, 2000]);
  });
});

describe('makeMelody', () => {
  it('8拍・ペンタトニック・最後は2拍のド・音の動きは2つ以内', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const m = makeMelody(makeRng(seed));
      expect(melodyBeats(m)).toBeCloseTo(8, 9);
      for (const n of m) expect(PENTA).toContain(n.midi);
      const last = m[m.length - 1];
      expect([60, 72]).toContain(last.midi);
      expect(last.beats).toBe(2);
      for (let i = 1; i < m.length; i++) {
        const a = PENTA.indexOf(m[i - 1].midi);
        const b = PENTA.indexOf(m[i].midi);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
      }
      expect(m.length).toBeGreaterThanOrEqual(4);
      expect(melodyLabel(m).split(' ').length).toBe(m.length);
    }
  });

  it('毎回ちがうメロディになる（seed がちがえば）', () => {
    const set = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) set.add(JSON.stringify(makeMelody(makeRng(seed))));
    expect(set.size).toBeGreaterThan(40);
  });
});

describe('poses', () => {
  it('つづけて同じポーズなし・気をつけなし・両足を同時にあげない', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const seq = makePoseSequence(makeRng(seed), 4);
      expect(seq.length).toBe(4);
      for (let i = 0; i < seq.length; i++) {
        const p = seq[i];
        expect(isNeutral(p)).toBe(false);
        expect(p.ll === 'lift' && p.rl === 'lift').toBe(false);
        if (i > 0) expect(samePose(p, seq[i - 1])).toBe(false);
        expect(poseLabel(p)).toMatch(/／/);
      }
    }
  });
});

describe('HYOGEN_TYPES', () => {
  it('6タイプ・id が一意・すべて保護者判定', () => {
    expect(HYOGEN_TYPES.map((t) => t.id)).toEqual([
      'hyogen-rhythm-walk',
      'hyogen-pose',
      'hyogen-sing-copy',
      'hyogen-instrument',
      'hyogen-metronome',
      'hyogen-dance'
    ]);
    for (const t of HYOGEN_TYPES) {
      expect(t.genre).toBe('hyogen');
      expect(t.moduleId).toBe('hyogen');
      expect(t.answer).toBe('parent');
    }
  });
});
