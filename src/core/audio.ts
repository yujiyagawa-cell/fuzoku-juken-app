// 効果音・ブザー・メトロノーム・手拍子・メロディ（Web Audio）

let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 最初のタップのときに呼ぶ（スマホは操作がないと音が出ない） */
export function unlockAudio() {
  const c = audioCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.setValueAtTime(vol, start + Math.max(0.02, dur - 0.05));
  g.gain.linearRampToValueAtTime(0, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** ブザー（ピピピ） */
export function buzzer(times = 3): Promise<void> {
  const c = audioCtx();
  if (!c) return Promise.resolve();
  const t = c.currentTime + 0.02;
  for (let i = 0; i < times; i++) tone(c, 1046, t + i * 0.22, 0.14, 'square', 0.08);
  return new Promise((r) => setTimeout(r, times * 220 + 100));
}

/** ポン（正解の合図などに） */
export function chime() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime + 0.02;
  tone(c, 784, t, 0.15, 'sine', 0.12);
  tone(c, 1046, t + 0.12, 0.25, 'sine', 0.12);
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  const len = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  return buf;
}

/** 手拍子の音 */
export function clapAt(c: AudioContext, when: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1500;
  const g = c.createGain();
  g.gain.value = 0.9;
  src.connect(f).connect(g).connect(c.destination);
  src.start(when);
}

/** 手拍子のリズムを鳴らす。pattern は拍の長さ（1 = 1拍）。 */
export function playClaps(pattern: number[], bpm: number): Promise<void> {
  const c = audioCtx();
  if (!c) return Promise.resolve();
  const beat = 60 / bpm;
  let t = c.currentTime + 0.1;
  for (const p of pattern) {
    clapAt(c, t);
    t += p * beat;
  }
  const total = (t - c.currentTime) * 1000;
  return new Promise((r) => setTimeout(r, total + 200));
}

/** メトロノーム。止める関数を返す。 */
export function startMetronome(bpm: number): () => void {
  const c = audioCtx();
  if (!c) return () => {};
  const beat = 60 / bpm;
  let next = c.currentTime + 0.1;
  let count = 0;
  const timer = setInterval(() => {
    while (next < c.currentTime + 0.3) {
      tone(c, count % 4 === 0 ? 1320 : 880, next, 0.05, 'square', 0.06);
      next += beat;
      count++;
    }
  }, 50);
  return () => clearInterval(timer);
}

export interface Note {
  midi: number; // 60 = ド
  beats: number;
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** メロディを鳴らす（オリジナルの短いメロディ用） */
export function playMelody(notes: Note[], bpm: number): Promise<void> {
  const c = audioCtx();
  if (!c) return Promise.resolve();
  const beat = 60 / bpm;
  let t = c.currentTime + 0.1;
  for (const n of notes) {
    if (n.midi > 0) tone(c, midiToFreq(n.midi), t, n.beats * beat * 0.92, 'triangle', 0.16);
    t += n.beats * beat;
  }
  const total = (t - c.currentTime) * 1000;
  return new Promise((r) => setTimeout(r, total + 200));
}

/** 踊る用のやさしい伴奏（ループ）。止める関数を返す。 */
export function startTune(bpm = 96): () => void {
  const c = audioCtx();
  if (!c) return () => {};
  const beat = 60 / bpm;
  const prog = [
    [60, 64, 67],
    [65, 69, 72],
    [67, 71, 74],
    [60, 64, 67]
  ];
  let next = c.currentTime + 0.1;
  let i = 0;
  const timer = setInterval(() => {
    while (next < c.currentTime + 0.4) {
      const chord = prog[Math.floor(i / 4) % prog.length];
      tone(c, midiToFreq(chord[i % 3] + 12), next, beat * 0.8, 'triangle', 0.08);
      if (i % 4 === 0) tone(c, midiToFreq(chord[0] - 12), next, beat * 3.5, 'sine', 0.1);
      next += beat;
      i++;
    }
  }, 60);
  return () => clearInterval(timer);
}
