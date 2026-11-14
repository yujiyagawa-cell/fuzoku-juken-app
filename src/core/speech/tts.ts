// 読み上げ（Web Speech API の SpeechSynthesis）

interface TtsConfig {
  rate: number;
  voiceURI: string;
  readTimes: 1 | 2;
}

let config: TtsConfig = { rate: 1, voiceURI: '', readTimes: 1 };
let voicesCache: SpeechSynthesisVoice[] | null = null;

export function setTtsConfig(c: Partial<TtsConfig>) {
  config = { ...config, ...c };
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsAvailable()) return Promise.resolve([]);
  if (voicesCache && voicesCache.length) return Promise.resolve(voicesCache);
  return new Promise((resolve) => {
    const ss = window.speechSynthesis;
    const done = () => {
      voicesCache = ss.getVoices();
      resolve(voicesCache);
    };
    const now = ss.getVoices();
    if (now.length) {
      voicesCache = now;
      resolve(now);
      return;
    }
    ss.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export function japaneseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => /^ja(-|_|$)/i.test(v.lang));
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (config.voiceURI) {
    const v = voices.find((x) => x.voiceURI === config.voiceURI);
    if (v) return v;
  }
  const ja = japaneseVoices(voices);
  return ja.find((v) => /google/i.test(v.name)) ?? ja.find((v) => v.localService) ?? ja[0];
}

function splitChunks(text: string): string[] {
  const parts = text.split(/(?<=[。！？!?])/u).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

let generation = 0;

function speakOne(text: string, voice: SpeechSynthesisVoice | undefined, rate: number, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (gen !== generation) return resolve();
    const ss = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate;
    if (voice) u.voice = voice;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    // onend が来ない端末があるので、長さから見積もった時間で打ち切る
    const estimate = (text.length * 0.22) / rate + 2.5;
    const timer = setTimeout(finish, estimate * 1000);
    u.onend = finish;
    u.onerror = finish;
    ss.speak(u);
  });
}

/** 読み上げる。読み上げが終わったら解決する。times を省くと設定の読み上げ回数。 */
export async function speak(text: string, opts: { times?: 1 | 2; rate?: number } = {}): Promise<void> {
  if (!ttsAvailable() || !text) return;
  const gen = ++generation;
  const ss = window.speechSynthesis;
  ss.cancel();
  const voices = await getVoices();
  const voice = pickVoice(voices);
  const rate = opts.rate ?? config.rate;
  const times = opts.times ?? config.readTimes;
  for (let t = 0; t < times; t++) {
    for (const chunk of splitChunks(text)) {
      if (gen !== generation) return;
      await speakOne(chunk, voice, rate, gen);
    }
    if (t < times - 1) await new Promise((r) => setTimeout(r, 700));
  }
}

export function cancelSpeak() {
  generation++;
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
