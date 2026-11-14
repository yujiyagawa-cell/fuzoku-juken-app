import { useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../core/audio';
import { funLabel } from '../core/dates';
import { cancelSpeak } from '../core/speech/tts';
import { moduleById } from '../modules/registry';
import { loadPlan } from '../player/plan';
import { createSession, endSession, makeSessionApi } from '../player/session';
import { VoiceBanner } from '../player/voice';
import { Modal, ModeButton, useWakeLock } from '../ui/components';
import { Icon } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate } from '../ui/router';

// 練習（プレイヤー）：計画のモジュールを順番に実行して、終わったら結果へ

const VOICE_MODULES = new Set(['kotoba', 'shitsugi', 'uta']);

export function Player() {
  const plan = useMemo(() => loadPlan(), []);
  const items = useMemo(() => (plan?.items ?? []).filter((x) => moduleById(x.moduleId)), [plan]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<'intro' | 'run'>('intro');
  const [quit, setQuit] = useState(false);
  const { isParent } = useMode();
  const created = useRef(false);
  const ending = useRef(false);
  useWakeLock(true);

  useEffect(() => {
    if (!items.length) {
      navigate('/', { replace: true });
      return;
    }
    if (!created.current) {
      created.current = true;
      createSession(
        items.map((x) => x.moduleId),
        plan?.mySetId
      ).then(setSessionId);
    }
    return () => cancelSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => (sessionId ? makeSessionApi(sessionId) : null), [sessionId]);
  if (!items.length || !api) return <div className="play" />;

  const item = items[i];
  const mod = moduleById(item.moduleId)!;

  const finish = async () => {
    if (ending.current) return;
    ending.current = true;
    cancelSpeak();
    await endSession(api.sessionId);
    navigate(`/results/${api.sessionId}`, { replace: true });
  };

  const next = () => {
    if (i + 1 < items.length) {
      setI(i + 1);
      setStage('intro');
    } else finish();
  };

  const countLabel = mod.unit === 'ふん' ? funLabel(item.count) : `${item.count}${mod.unit}`;

  return (
    <div className="play">
      <header className="hdr">
        <span className="module-chip" style={{ background: mod.color.bg, color: mod.color.ink }}>
          <Icon name={mod.icon} size={20} style={{ color: mod.color.icon }} />
          {mod.name}
        </span>
        <div className="row">
          {items.length > 1 && (
            <span className="small muted">
              {i + 1} / {items.length}
            </span>
          )}
          {isParent && (
            <button className="btn btn-ghost btn-sm" onClick={() => setQuit(true)}>
              やめる
            </button>
          )}
          <ModeButton />
        </div>
      </header>
      {VOICE_MODULES.has(mod.id) && <VoiceBanner />}
      {stage === 'intro' ? (
        <div className="play-main">
          <div className="stage">
            <div className="orb" style={{ background: mod.color.bg, color: mod.color.icon, width: 150, height: 150 }}>
              <Icon name={mod.icon} size={78} style={{ strokeWidth: 1.8 }} />
            </div>
            <span className="stage-text">
              {i > 0 ? 'つぎは ' : ''}「{mod.name}」です
              <br />
              <span style={{ fontSize: 18, color: 'var(--muted)' }}>{countLabel}</span>
            </span>
            <button
              className="big-start"
              onClick={() => {
                unlockAudio();
                setStage('run');
              }}
            >
              <svg viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" style={{ fill: 'currentColor' }}>
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
              スタート
            </button>
          </div>
        </div>
      ) : (
        <mod.Runner key={i} count={item.count} timeLimitSec={item.timeLimitSec} types={item.types} session={api} onDone={next} />
      )}
      <Modal open={quit} onClose={() => setQuit(false)} title="練習をやめますか">
        <p className="muted" style={{ marginTop: 0 }}>
          ここまでの記録は保存されています。
        </p>
        <div className="stack">
          <button className="btn btn-parent btn-block" onClick={finish}>
            やめて結果を見る
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={async () => {
              cancelSpeak();
              await endSession(api.sessionId);
              navigate('/', { replace: true });
            }}
          >
            やめてホームへ
          </button>
        </div>
      </Modal>
    </div>
  );
}
