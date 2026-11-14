import { audioCtx } from '../../core/audio';

// 楽器の音（Web Audio で合成。録音データは使わない）

export type InstrumentId = 'triangle' | 'castanets' | 'tambourine' | 'bell';

export const INSTRUMENTS: { id: InstrumentId; name: string; kana: string }[] = [
  { id: 'triangle', name: 'トライアングル', kana: 'とらいあんぐる' },
  { id: 'castanets', name: 'カスタネット', kana: 'かすたねっと' },
  { id: 'tambourine', name: 'タンバリン', kana: 'たんばりん' },
  { id: 'bell', name: 'すず', kana: 'すず' }
];

function ping(c: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(c: AudioContext, start: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, q = 1) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(start);
}

/** 楽器を1回鳴らす */
export function playInstrument(id: InstrumentId) {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime + 0.01;
  switch (id) {
    case 'triangle':
      ping(c, 1760, t, 1.6, 0.07);
      ping(c, 2637, t, 1.2, 0.045);
      ping(c, 4186, t, 0.8, 0.03);
      break;
    case 'castanets':
      noise(c, t, 0.045, 0.9, 'bandpass', 2600, 3);
      noise(c, t + 0.035, 0.03, 0.6, 'bandpass', 3100, 3);
      break;
    case 'tambourine':
      noise(c, t, 0.28, 0.5, 'highpass', 6000, 0.7);
      ping(c, 5274, t, 0.18, 0.02, 'square');
      ping(c, 6272, t + 0.03, 0.16, 0.018, 'square');
      ping(c, 5587, t + 0.06, 0.14, 0.015, 'square');
      break;
    case 'bell':
      for (const dt of [0, 0.07, 0.14]) {
        ping(c, 3520, t + dt, 0.35, 0.045);
        ping(c, 4699, t + dt, 0.28, 0.03);
      }
      break;
  }
}
