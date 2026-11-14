import { useEffect, useRef, useState } from 'react';
import { examDateLabel } from '../../core/dates';
import { countMora } from '../../core/kana';
import { fullReading, loadTokenizer, readingLoadState } from '../../core/reading';
import { useSettings } from '../../core/settings';
import { asrSupported, listen, requestMicPermission, type ListenResult } from '../../core/speech/asr';
import { cancelSpeak, speak } from '../../core/speech/tts';
import { markVoiceFailed, resetVoiceFailure, useVoiceState, voiceReasonText } from '../../core/speech/voice';
import { BackButton, Header, ParentStrip } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useMode } from '../../ui/mode';
import { navigate } from '../../ui/router';
import { ChildInfoFields } from './SettingsScreen';

// はじめての設定：説明 → 子どもの情報 → マイクの許可と音声テスト → 完了

type Step = 0 | 1 | 2 | 3;

interface TestState {
  phase: 'idle' | 'speaking' | 'listening' | 'done';
  interim?: string;
  result?: ListenResult;
  reading?: string;
  mora?: number;
}

const SOURCE_TEXT: Record<string, string> = {
  speechstart: '話し始め',
  soundstart: '音の始まり',
  interim: '途中の結果',
  tap: 'タップ',
  parent: '保護者'
};

export function OnboardingScreen() {
  const { settings, update } = useSettings();
  const { setMode } = useMode();
  const voice = useVoiceState();
  const [step, setStep] = useState<Step>(0);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [test, setTest] = useState<TestState>({ phase: 'idle' });
  const [dict, setDict] = useState(readingLoadState());
  const abortRef = useRef<(() => void) | null>(null);
  const firstRun = !settings.onboarded;

  useEffect(() => {
    setMode('parent');
    return () => {
      abortRef.current?.();
      cancelSpeak();
    };
  }, [setMode]);

  useEffect(() => {
    if (step !== 2) return;
    loadTokenizer()
      .then(() => setDict('ready'))
      .catch(() => setDict('error'));
  }, [step]);

  const finish = () => {
    update({ onboarded: true });
    navigate('/', { replace: true });
  };

  const askMic = async () => {
    const ok = await requestMicPermission();
    setPerm(ok ? 'granted' : 'denied');
    if (ok) resetVoiceFailure();
    else markVoiceFailed('not-allowed');
  };

  const runTest = async () => {
    abortRef.current?.();
    setTest({ phase: 'speaking' });
    await speak('「ねこ」と いってください。', { times: 1 });
    if (!asrSupported()) {
      setTest({ phase: 'done' });
      return;
    }
    setTest({ phase: 'listening' });
    const l = listen({
      timeoutMs: 8000,
      onEvent: (e, text) => {
        if (e === 'interim' && text) setTest((t) => ({ ...t, interim: text }));
      }
    });
    abortRef.current = l.abort;
    const r = await l.promise;
    abortRef.current = null;
    if (r.status === 'error' && r.fatal) markVoiceFailed(r.error || 'error');
    let reading: string | undefined;
    let mora: number | undefined;
    if (r.transcript) {
      reading = await fullReading(r.transcript);
      mora = countMora(reading, settings.moraRules);
    }
    setTest({ phase: 'done', result: r, reading, mora });
  };

  const dots = (
    <div className="row" style={{ gap: 6, justifyContent: 'center', margin: '6px 0 2px' }} aria-label={`${step + 1} / 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 999, background: i <= step ? 'var(--parent)' : 'var(--line2)', transition: 'width .2s' }} />
      ))}
    </div>
  );

  const nav = (next: () => void, nextLabel = 'つぎへ', canNext = true) => (
    <div className="row" style={{ gap: 8, margin: '16px 16px 0' }}>
      {step > 0 && (
        <button className="btn btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
          もどる
        </button>
      )}
      <button className="btn btn-parent" style={{ flex: 1 }} onClick={next} disabled={!canNext}>
        {nextLabel}
      </button>
    </div>
  );

  const r = test.result;
  const heard = r?.transcript;
  const ok = test.reading === 'ねこ';

  return (
    <div className="screen">
      <Header left={firstRun ? <span className="h2" style={{ paddingLeft: 2 }}>はじめての設定</span> : <BackButton to="/settings" label="設定" />} />
      <ParentStrip />
      {dots}

      {step === 0 && (
        <>
          <div className="pad">
            <h1 className="h1">ようこそ</h1>
            <p className="small" style={{ lineHeight: 1.8, fontWeight: 500 }}>
              {examDateLabel(settings.examDate).kanji} の入学検査に向けて、子どもと保護者が1台のスマホで練習するアプリです。本番と同じく、問題は1回しか読み上げません。
            </p>
          </div>
          <div className="card stack" style={{ margin: '0 16px', gap: 10 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <Icon name="parents" size={22} style={{ color: 'var(--parent)', marginTop: 2 }} />
              <span className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
                右上のボタンを <b>2秒長押し</b> すると、子どもモードと保護者モードが切りかわります。子どもモードでは設定や記録の削除はできません。
              </span>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <Icon name="mic" size={22} style={{ color: 'var(--parent)', marginTop: 2 }} />
              <span className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
                声で答える問題では音声認識を使います。<b>音声は Google のサーバーで文字に変換されます。録音は保存しません。</b>
              </span>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <Icon name="notebook" size={22} style={{ color: 'var(--parent)', marginTop: 2 }} />
              <span className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
                記録はこのスマホの中だけに保存されます（ログインなし）。機種変更のときは設定から書き出せます。
              </span>
            </div>
          </div>
          {nav(() => setStep(1), 'はじめる')}
          {firstRun && (
            <div className="pad" style={{ marginTop: 10 }}>
              <button className="btn btn-ghost btn-block" onClick={finish}>
                あとで設定する
              </button>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <div className="pad">
            <h1 className="h1">こどもの情報</h1>
            <p className="small muted" style={{ lineHeight: 1.7 }}>
              質疑応答（名前・年齢・誕生日・園・利き手）の自動判定に使います。あとから設定で変えられます。
            </p>
          </div>
          <div className="card" style={{ margin: '0 16px', padding: '2px 14px' }}>
            <ChildInfoFields s={settings} update={update} />
          </div>
          {nav(() => setStep(2))}
        </>
      )}

      {step === 2 && (
        <>
          <div className="pad">
            <h1 className="h1">マイクと音声テスト</h1>
            <p className="small muted" style={{ lineHeight: 1.7 }}>
              音声は Google のサーバーで文字に変換されます。録音は保存しません。使えないときは、保護者が○×で判定するモードになります。
            </p>
          </div>
          <div className="card stack" style={{ margin: '0 16px', gap: 12 }}>
            {!asrSupported() ? (
              <div className="small" style={{ color: 'var(--warn)' }}>
                このブラウザは音声認識に対応していません。Android の Chrome で開いてください（保護者判定でも練習はできます）。
              </div>
            ) : (
              <>
                <div className="between">
                  <span className="small">1. マイクを許可する</span>
                  {perm === 'granted' ? (
                    <span className="chip chip-good">許可ずみ</span>
                  ) : (
                    <button className="btn btn-parent btn-sm" onClick={askMic}>
                      <Icon name="mic" size={16} />
                      許可する
                    </button>
                  )}
                </div>
                {perm === 'denied' && (
                  <div className="small" style={{ color: 'var(--bad)', lineHeight: 1.6 }}>
                    マイクが許可されませんでした。Chrome のアドレスバーの左のアイコン →「権限」からマイクを許可してください。
                  </div>
                )}
                <div className="between">
                  <span className="small">2. 「ねこ」と言ってみる</span>
                  <button className="btn btn-outline btn-sm" onClick={runTest} disabled={test.phase === 'speaking' || test.phase === 'listening'}>
                    <Icon name="speaker" size={16} />
                    テスト
                  </button>
                </div>
                {test.phase !== 'idle' && (
                  <div className="panel-box stack" style={{ gap: 6, background: '#f8fafd' }}>
                    {test.phase === 'speaking' && <span className="small">読み上げ中…</span>}
                    {test.phase === 'listening' && (
                      <span className="small" style={{ color: 'var(--accent)' }}>
                        聞いています…「ねこ」と言ってください {test.interim ? `（${test.interim}）` : ''}
                      </span>
                    )}
                    {test.phase === 'done' && (
                      <>
                        {r?.status === 'result' && heard ? (
                          <>
                            <div className="small">
                              聞こえた言葉：<b>「{heard}」</b>
                            </div>
                            <div className="small">
                              読み：<b>{test.reading || '—'}</b>（{test.mora ?? '—'}文字）
                            </div>
                            <div className="small">
                              話し始めまで：<b>{r.latencyMs !== undefined ? `${(r.latencyMs / 1000).toFixed(1)}秒` : '—'}</b>
                              {r.latencySource ? `（${SOURCE_TEXT[r.latencySource] ?? r.latencySource}で計測）` : ''}
                            </div>
                            <div className={`chip ${ok ? 'chip-good' : 'chip-warn'}`} style={{ alignSelf: 'flex-start' }}>
                              {ok ? '○ 「ねこ」・2文字として認識できました' : 'もう一度ためしてみてください'}
                            </div>
                          </>
                        ) : r?.status === 'nospeech' ? (
                          <span className="small" style={{ color: 'var(--warn)' }}>
                            声が聞こえませんでした。スマホを口に近づけて、もう一度どうぞ。
                          </span>
                        ) : r?.status === 'error' ? (
                          <span className="small" style={{ color: 'var(--bad)' }}>
                            エラー：{r.error}
                            {r.fatal ? '（保護者判定モードで使えます）' : ''}
                          </span>
                        ) : (
                          <span className="small muted">テストを終えました</span>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="tiny muted" style={{ lineHeight: 1.6 }}>
                  音声認識：{voice.available ? '使えます' : voiceReasonText(voice.reason)}／読み仮名の辞書：
                  {dict === 'ready' ? '読み込みずみ' : dict === 'error' ? '読み込めませんでした（通信を確認）' : '読み込み中'}
                </div>
              </>
            )}
          </div>
          {nav(() => {
            abortRef.current?.();
            setStep(3);
          })}
        </>
      )}

      {step === 3 && (
        <>
          <div className="pad">
            <h1 className="h1">じゅんび完了</h1>
          </div>
          <div className="card stack" style={{ margin: '0 16px', gap: 10 }}>
            <div className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
              <b>ホーム画面に追加</b>：Chrome のメニュー（︙）→「ホーム画面に追加」で、アプリのように起動できます。通信がなくても動きます（音声認識だけは通信が必要）。
            </div>
            <div className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
              <b>保護者メニュー</b>：右上を2秒長押し →「進捗（レベル）一覧」「記録」「運動・生活ログ」「問題カタログ」「設定」。
            </div>
            <div className="small" style={{ lineHeight: 1.7, fontWeight: 500 }}>
              <b>1日20〜30分</b>：ホームの「おまかせ」で、苦手なものから練習できます。
            </div>
          </div>
          {nav(finish, 'ホームへ')}
        </>
      )}
    </div>
  );
}
