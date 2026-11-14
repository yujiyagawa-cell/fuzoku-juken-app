import { useSyncExternalStore } from 'react';
import { asrSupported } from './asr';

// 音声認識が使えるかどうか（使えないときは保護者が判定するモード）

export type VoiceReason = '' | 'unsupported' | 'denied' | 'offline' | 'disabled' | 'error';

interface VoiceState {
  available: boolean;
  reason: VoiceReason;
}

let state: VoiceState = { available: false, reason: 'unsupported' };
let enabledSetting = true;
let failedReason: VoiceReason = '';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((f) => f());
}

function compute() {
  let next: VoiceState;
  if (!enabledSetting) next = { available: false, reason: 'disabled' };
  else if (!asrSupported()) next = { available: false, reason: 'unsupported' };
  else if (typeof navigator !== 'undefined' && navigator.onLine === false) next = { available: false, reason: 'offline' };
  else if (failedReason) next = { available: false, reason: failedReason };
  else next = { available: true, reason: '' };
  if (next.available !== state.available || next.reason !== state.reason) {
    state = next;
    emit();
  }
}

export function initVoice(enabled: boolean) {
  enabledSetting = enabled;
  compute();
}

/** 致命的なエラー（許可なし・通信不可）が出たとき */
export function markVoiceFailed(error: string) {
  failedReason = error === 'not-allowed' || error === 'service-not-allowed' ? 'denied' : error === 'network' ? 'offline' : 'error';
  compute();
}

/** もう一度試す（設定画面の「音声テスト」などから） */
export function resetVoiceFailure() {
  failedReason = '';
  compute();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (failedReason === 'offline') failedReason = '';
    compute();
  });
  window.addEventListener('offline', compute);
  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((p) => {
        if (p.state === 'denied') {
          failedReason = 'denied';
          compute();
        }
        p.onchange = () => {
          failedReason = p.state === 'denied' ? 'denied' : '';
          compute();
        };
      })
      .catch(() => {});
  }
}

export function getVoiceState(): VoiceState {
  return state;
}

export function useVoiceState(): VoiceState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => state,
    () => state
  );
}

export function voiceReasonText(r: VoiceReason): string {
  switch (r) {
    case 'unsupported':
      return 'このブラウザは音声認識に対応していません';
    case 'denied':
      return 'マイクが許可されていません';
    case 'offline':
      return '通信できません';
    case 'disabled':
      return '設定で音声認識をオフにしています';
    case 'error':
      return '音声認識でエラーが出ました';
    default:
      return '';
  }
}
