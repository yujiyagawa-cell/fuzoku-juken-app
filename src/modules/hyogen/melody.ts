import type { Note } from '../../core/audio';
import type { Rng } from '../../core/rng';

// 表現・模倣で使う、オリジナルのリズムとメロディ（毎回 乱数で作る。既存の曲は使わない）

/** ペンタトニック（ド レ ミ ソ ラ ド） */
export const PENTA: readonly number[] = [60, 62, 64, 67, 69, 72];

const SOLFEGE: Record<number, string> = { 60: 'ド', 62: 'レ', 64: 'ミ', 67: 'ソ', 69: 'ラ', 72: '高いド' };

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** beats 拍ぶんを、セル（[1] [0.5,0.5] [2] など）で埋める */
function fill(rng: Rng, beats: number, cells: number[][]): number[] {
  const out: number[] = [];
  let left = beats;
  let guard = 0;
  while (left > 1e-9 && guard++ < 64) {
    const ok = cells.filter((c) => sum(c) <= left + 1e-9);
    if (!ok.length) break;
    const c = rng.pick(ok);
    out.push(...c);
    left -= sum(c);
  }
  return out;
}

/**
 * 手拍子のリズム（拍の長さの並び。1 = 1拍）。合計 4拍、3〜6回たたく。
 * 0.5 はかならず2つ続き（たた）、ぜんぶ同じ長さ（たん たん たん たん）にはしない。
 */
export function makeRhythm(rng: Rng): number[] {
  for (let i = 0; i < 30; i++) {
    const p = fill(rng, 4, [[1], [1], [0.5, 0.5], [2]]);
    if (p.every((x) => x === 1)) continue;
    if (p.length < 3 || p.length > 6) continue;
    return p;
  }
  return [1, 0.5, 0.5, 2];
}

/** 保護者向けの読み方（たん・たた・たーん） */
export function rhythmLabel(p: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0.5 && p[i + 1] === 0.5) {
      out.push('たた');
      i++;
    } else if (p[i] === 2) out.push('たーん');
    else if (p[i] === 0.5) out.push('た');
    else out.push('たん');
  }
  return out.join(' ');
}

/** 手拍子それぞれが鳴る時刻（ミリ秒、最初の手拍子 = 0） */
export function clapTimesMs(p: number[], bpm: number): number[] {
  const beat = 60000 / bpm;
  const out: number[] = [];
  let t = 0;
  for (const d of p) {
    out.push(Math.round(t));
    t += d * beat;
  }
  return out;
}

/**
 * まねして歌う用のメロディ。2小節（8拍）、最後は2拍のばして ド で終わる。
 * 音は ペンタトニックの中を 2つ以内ずつ動く（うたいやすく）。
 */
export function makeMelody(rng: Rng): Note[] {
  const bar1 = fill(rng, 4, [[1], [1], [0.5, 0.5], [2]]);
  const bar2 = [...fill(rng, 2, [[1], [0.5, 0.5]]), 2];
  const durs = [...bar1, ...bar2];
  let i = rng.pick([0, 2, 3]);
  const notes: Note[] = [];
  durs.forEach((beats, k) => {
    if (k === durs.length - 1) i = i >= 3 ? 5 : 0;
    else if (k > 0) i = Math.max(0, Math.min(5, i + rng.pick([-2, -1, -1, 0, 1, 1, 2])));
    notes.push({ midi: PENTA[i], beats });
  });
  return notes;
}

export function melodyBeats(notes: Note[]): number {
  return sum(notes.map((n) => n.beats));
}

export function melodyLabel(notes: Note[]): string {
  return notes.map((n) => SOLFEGE[n.midi] ?? String(n.midi)).join(' ');
}

/** それぞれの音が鳴る時刻（ミリ秒） */
export function noteTimesMs(notes: Note[], bpm: number): number[] {
  return clapTimesMs(
    notes.map((n) => n.beats),
    bpm
  );
}
