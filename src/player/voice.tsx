import { listen, type ListenResult } from '../core/speech/asr';
import { speak } from '../core/speech/tts';
import { getVoiceState, markVoiceFailed, useVoiceState, voiceReasonText } from '../core/speech/voice';
import { Icon } from '../ui/icons';

// 声で答える問題の共通の流れ：読み上げ → （使えれば）音声認識 → 結果

export type VoicePhase = 'ready' | 'speaking' | 'listening' | 'heard' | 'parent';

export interface VoiceOutcome {
  mode: 'voice' | 'parent';
  result?: ListenResult;
  spokeAt: number; // 読み上げが終わった時刻（performance.now）
}

export function askByVoice(
  speech: string,
  opts: { timeoutMs: number; stopOnSpeech?: boolean; maxSpeechMs?: number; onPhase: (p: VoicePhase) => void; onInterim?: (t: string) => void }
): { promise: Promise<VoiceOutcome>; abort: () => void } {
  let aborted = false;
  let abortListen: (() => void) | null = null;
  const promise = (async (): Promise<VoiceOutcome> => {
    opts.onPhase('speaking');
    await speak(speech);
    const spokeAt = performance.now();
    if (aborted) return { mode: 'parent', spokeAt };
    if (!getVoiceState().available) {
      opts.onPhase('parent');
      return { mode: 'parent', spokeAt };
    }
    opts.onPhase('listening');
    const l = listen({
      timeoutMs: opts.timeoutMs,
      stopOnSpeech: opts.stopOnSpeech,
      maxSpeechMs: opts.maxSpeechMs,
      onEvent: (e, text) => {
        if (e === 'interim' && text) opts.onInterim?.(text);
      }
    });
    abortListen = l.abort;
    const r = await l.promise;
    if (r.status === 'error' && r.fatal) {
      markVoiceFailed(r.error || 'error');
      opts.onPhase('parent');
      return { mode: 'parent', spokeAt };
    }
    opts.onPhase('heard');
    return { mode: 'voice', result: r, spokeAt };
  })();
  return {
    promise,
    abort: () => {
      aborted = true;
      abortListen?.();
    }
  };
}

/** 子どもに見せる状態（読み上げ中・聞いている・聞いた） */
export function VoiceStage({ phase, onStart, color = 'var(--primary)', listenText = 'ピッと なったら こたえてね' }: { phase: VoicePhase; onStart?: () => void; color?: string; listenText?: string }) {
  if (phase === 'ready') {
    return (
      <div className="stage">
        <span className="stage-text" style={{ fontSize: 20 }}>じゅんびが できたら おしてください</span>
        <button className="big-start" onClick={onStart}>
          <svg viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" style={{ fill: 'currentColor' }}>
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
          スタート
        </button>
      </div>
    );
  }
  if (phase === 'speaking') {
    return (
      <div className="stage">
        <div className="orb" style={{ background: '#fff2c6', color: '#9a6a00' }}>
          <svg viewBox="0 0 24 24" width="100" height="100" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M3.5 9h4l5-4v14l-5-4h-4z" />
            <path className="blink" d="M16 9.5c1.2 1.4 1.2 3.6 0 5" />
            <path className="blink d2" d="M19 7c2.4 2.8 2.4 7.2 0 10" />
          </svg>
        </div>
        <span className="stage-text">よく きいてください</span>
      </div>
    );
  }
  if (phase === 'listening') {
    return (
      <div className="stage">
        <div className="orb">
          <span className="pulse" />
          <span className="pulse d2" />
          <span style={{ width: 160, height: 160, borderRadius: 999, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 0 rgba(0,0,0,.18)' }}>
            <Icon name="mic" size={80} style={{ strokeWidth: 1.8 }} />
          </span>
        </div>
        <span className="stage-text">{listenText}</span>
      </div>
    );
  }
  if (phase === 'parent') {
    return (
      <div className="stage">
        <div className="orb" style={{ background: '#fff', border: '4px solid var(--line)', color: 'var(--muted)' }}>
          <Icon name="face" size={96} style={{ strokeWidth: 1.6 }} />
        </div>
        <span className="stage-text">こたえてください</span>
      </div>
    );
  }
  return (
    <div className="stage rise">
      <div className="orb" style={{ background: '#fff', border: '4px solid var(--line)', color: 'var(--muted)' }}>
        <Icon name="smile" size={96} style={{ strokeWidth: 1.6 }} />
      </div>
      <span className="stage-text">こたえを ききました</span>
    </div>
  );
}

/** 音声認識が使えないときの帯 */
export function VoiceBanner() {
  const v = useVoiceState();
  if (v.available) return null;
  return (
    <div className="voice-banner" role="status">
      音声認識がつかえないため、保護者が判定してください（{voiceReasonText(v.reason)}）
    </div>
  );
}
