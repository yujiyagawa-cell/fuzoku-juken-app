import type { LatencySource } from '../types';

// 音声認識（Web Speech API の SpeechRecognition）
// - 読み上げが終わってから start する（スピーカーの音を拾わないため）
// - continuous は使わず、1問ごとに開始・終了
// - 話し始めまでの秒数：speechstart → soundstart → 最初の途中結果 の順で記録

export interface ListenResult {
  status: 'result' | 'nospeech' | 'error' | 'aborted';
  transcript?: string;
  alternatives?: string[];
  latencyMs?: number;
  latencySource?: LatencySource;
  error?: string;
  fatal?: boolean; // 許可がない・通信できない など、続けても使えないエラー
}

export interface ListenOptions {
  timeoutMs: number; // 黙っているときに打ち切るまで
  stopOnSpeech?: boolean; // 話し始めたら終える（歌の歌い出しの計測用）
  maxSpeechMs?: number; // 話し始めてから待つ最大時間
  onEvent?: (e: 'start' | 'sound' | 'speech' | 'interim' | 'end', text?: string) => void;
}

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);

export function asrSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listen(opts: ListenOptions): { promise: Promise<ListenResult>; abort: () => void } {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec: any = null;
  let settled = false;
  let resolveFn: (r: ListenResult) => void = () => {};
  const t0 = performance.now();
  let speechAt = 0;
  let soundAt = 0;
  let interimAt = 0;
  let lastInterim = '';
  let finalAlts: string[] = [];
  let restarts = 0;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let hardStop: ReturnType<typeof setTimeout> | null = null;

  const latency = (): { latencyMs?: number; latencySource?: LatencySource } => {
    if (speechAt) return { latencyMs: speechAt - t0, latencySource: 'speechstart' };
    if (soundAt) return { latencyMs: soundAt - t0, latencySource: 'soundstart' };
    if (interimAt) return { latencyMs: interimAt - t0, latencySource: 'interim' };
    return {};
  };

  const cleanup = () => {
    if (deadline) clearTimeout(deadline);
    if (hardStop) clearTimeout(hardStop);
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onspeechstart = rec.onsoundstart = rec.onaudiostart = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
  };

  const finish = (r: ListenResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    opts.onEvent?.('end');
    resolveFn(r);
  };

  const heardSomething = () => !!(speechAt || soundAt || interimAt);

  const start = () => {
    rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.onaudiostart = () => opts.onEvent?.('start');
    rec.onsoundstart = () => {
      if (!soundAt) soundAt = performance.now();
      opts.onEvent?.('sound');
    };
    rec.onspeechstart = () => {
      if (!speechAt) speechAt = performance.now();
      opts.onEvent?.('speech');
      if (opts.stopOnSpeech) finish({ status: 'result', transcript: '', alternatives: [], ...latency() });
    };
    rec.onresult = (ev: any) => {
      if (!interimAt) interimAt = performance.now();
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const alts: string[] = [];
          for (let j = 0; j < res.length; j++) alts.push(String(res[j].transcript || '').trim());
          finalAlts = alts.filter(Boolean);
        } else {
          lastInterim = String(res[0]?.transcript || '').trim();
          opts.onEvent?.('interim', lastInterim);
        }
      }
      if (opts.stopOnSpeech) {
        finish({ status: 'result', transcript: lastInterim, alternatives: lastInterim ? [lastInterim] : [], ...latency() });
        return;
      }
      if (finalAlts.length) {
        finish({ status: 'result', transcript: finalAlts[0], alternatives: finalAlts, ...latency() });
      }
    };
    rec.onerror = (ev: any) => {
      const err = String(ev?.error || 'unknown');
      if (err === 'no-speech' || err === 'aborted') return; // onend で扱う
      finish({ status: 'error', error: err, fatal: FATAL.has(err), ...latency() });
    };
    rec.onend = () => {
      if (settled) return;
      if (finalAlts.length) {
        finish({ status: 'result', transcript: finalAlts[0], alternatives: finalAlts, ...latency() });
        return;
      }
      if (lastInterim) {
        finish({ status: 'result', transcript: lastInterim, alternatives: [lastInterim], ...latency() });
        return;
      }
      const elapsed = performance.now() - t0;
      if (elapsed < opts.timeoutMs - 400 && restarts < 6) {
        restarts++;
        try {
          start();
        } catch {
          finish({ status: 'nospeech', ...latency() });
        }
        return;
      }
      finish({ status: heardSomething() ? 'result' : 'nospeech', transcript: '', alternatives: [], ...latency() });
    };
    try {
      rec.start();
    } catch (e: any) {
      finish({ status: 'error', error: String(e?.message || e), fatal: true });
    }
  };

  const promise = new Promise<ListenResult>((resolve) => {
    resolveFn = resolve;
    if (!SR) {
      resolve({ status: 'error', error: 'unsupported', fatal: true });
      settled = true;
      return;
    }
    deadline = setTimeout(() => {
      if (heardSomething()) {
        // 話している途中なら少し待つ
        hardStop = setTimeout(() => {
          finish({
            status: lastInterim || finalAlts.length ? 'result' : 'nospeech',
            transcript: finalAlts[0] || lastInterim,
            alternatives: finalAlts.length ? finalAlts : lastInterim ? [lastInterim] : [],
            ...latency()
          });
        }, opts.maxSpeechMs ?? 6000);
      } else {
        finish({ status: 'nospeech' });
      }
    }, opts.timeoutMs);
    start();
  });

  return {
    promise,
    abort: () => finish({ status: 'aborted', transcript: lastInterim, alternatives: lastInterim ? [lastInterim] : [], ...latency() })
  };
}

// ---- 長く聞く（歌など）----
// 話し始め（歌い出し）までの秒数を取りつつ、止まるまで聞き続けて、聞こえた言葉を全部つなげる。
// 端末が途中で認識を終えても、時間内なら自動で再開する。

export interface LongListenResult {
  status: 'result' | 'nospeech' | 'error';
  transcript: string; // 聞こえた言葉をつなげたもの
  latencyMs?: number;
  latencySource?: LatencySource;
  activeMs?: number; // 歌い出しから最後に声が聞こえたまで
  error?: string;
  fatal?: boolean;
}

export interface LongListenOptions {
  startTimeoutMs: number; // 歌い出しを待つ時間
  maxMs: number; // 全体の最大
  endSilenceMs: number; // 歌い出したあと、これだけ何も聞こえなければ終わり
  onFirstSound?: (latencyMs: number, source: LatencySource) => void;
  onText?: (text: string) => void;
}

export function listenLong(opts: LongListenOptions): { promise: Promise<LongListenResult>; stop: () => void } {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec: any = null;
  let settled = false;
  let resolveFn: (r: LongListenResult) => void = () => {};
  const t0 = performance.now();
  let firstAt = 0;
  let firstSource: LatencySource | undefined;
  let lastHeardAt = 0;
  const finals: string[] = [];
  let interim = '';
  const timers: ReturnType<typeof setTimeout>[] = [];
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const text = () => [...finals, interim].filter(Boolean).join(' ');

  const finish = (status?: LongListenResult['status'], extra: Partial<LongListenResult> = {}) => {
    if (settled) return;
    settled = true;
    timers.forEach(clearTimeout);
    if (silenceTimer) clearTimeout(silenceTimer);
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onspeechstart = rec.onsoundstart = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
    const heard = !!firstAt;
    resolveFn({
      status: status ?? (heard ? 'result' : 'nospeech'),
      transcript: text(),
      latencyMs: heard ? firstAt - t0 : undefined,
      latencySource: firstSource,
      activeMs: heard ? Math.max(0, (lastHeardAt || firstAt) - firstAt) : undefined,
      ...extra
    });
  };

  const heard = (source: LatencySource) => {
    const now = performance.now();
    if (!firstAt) {
      firstAt = now;
      firstSource = source;
      opts.onFirstSound?.(now - t0, source);
    }
    lastHeardAt = now;
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => finish(), opts.endSilenceMs);
  };

  const start = () => {
    rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onsoundstart = () => heard('soundstart');
    rec.onspeechstart = () => heard('speechstart');
    rec.onresult = (ev: any) => {
      let cur = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = String(r[0]?.transcript || '').trim();
        if (r.isFinal) {
          if (t) finals.push(t);
        } else cur += t;
      }
      interim = cur;
      heard('interim');
      opts.onText?.(text());
    };
    rec.onerror = (ev: any) => {
      const err = String(ev?.error || 'unknown');
      if (err === 'no-speech' || err === 'aborted') return;
      if (FATAL.has(err)) finish('error', { error: err, fatal: true });
    };
    rec.onend = () => {
      if (settled) return;
      // いま聞こえていた途中の言葉は確定として残す
      if (interim) {
        finals.push(interim);
        interim = '';
      }
      const elapsed = performance.now() - t0;
      if (elapsed < opts.maxMs - 300) {
        try {
          start();
        } catch {
          finish();
        }
      } else finish();
    };
    try {
      rec.start();
    } catch (e: any) {
      finish('error', { error: String(e?.message || e), fatal: true });
    }
  };

  const promise = new Promise<LongListenResult>((resolve) => {
    resolveFn = resolve;
    if (!SR) {
      settled = true;
      resolve({ status: 'error', transcript: '', error: 'unsupported', fatal: true });
      return;
    }
    timers.push(
      setTimeout(() => {
        if (!firstAt) finish('nospeech');
      }, opts.startTimeoutMs)
    );
    timers.push(setTimeout(() => finish(), opts.maxMs));
    start();
  });

  return { promise, stop: () => finish() };
}

/** マイクの許可を取る（初回設定で使う） */
export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
