import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buzzer, chime } from '../core/audio';
import { freeHints } from '../core/judge';
import { useSettings } from '../core/settings';
import { cancelSpeak, speak } from '../core/speech/tts';
import type { Attempt, Judge, ParentChecks } from '../core/types';
import { JudgeButtons, ParentPanel, Switch } from '../ui/components';
import { Icon } from '../ui/icons';
import { AttemptJudge, PanelLine, RunnerTop, secLabel } from './parts';
import type { SessionApi } from './types';
import { askByVoice, VoiceStage, type VoicePhase } from './voice';

// 声で答える1問（ことば即答・質疑応答・うた の共通部分）
// 読み上げ（1回）→ 音声認識 → 自動判定 → 保護者が上書き。認識が使えないときは保護者がその場で判定。

export interface AutoJudgeResult {
  judge: Judge;
  matched?: string;
  note?: string;
}

export interface VoiceQSpec {
  moduleId: string;
  questionType: string;
  prompt: string; // 保護者パネルに出す（ひらがな）
  speech: string; // 読み上げ
  params?: unknown;
  figure?: ReactNode; // 子どもに見せる絵
  parentOnly?: boolean; // 声では答えない（手をあげる など）
  judge?: (transcript: string, alternatives: string[]) => Promise<AutoJudgeResult> | AutoJudgeResult;
  hints?: boolean; // 「理由あり」「敬語あり」の目安を出す
  checks?: boolean; // 即答・理由・敬語 のチェックを出す（自動では次へ進まない）
  examples?: string[]; // 解答例
  judgeLabels?: Partial<Record<Judge, string>>;
}

interface Props {
  spec: VoiceQSpec;
  session: SessionApi;
  index: number;
  total: number;
  onNext: () => void;
}

export function VoiceQuestion({ spec, session, index, total, onNext }: Props) {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<VoicePhase>('speaking');
  const [interim, setInterim] = useState('');
  const [heard, setHeard] = useState('');
  const [auto, setAuto] = useState<AutoJudgeResult | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [checks, setChecksState] = useState<ParentChecks>({});
  const [feedback, setFeedback] = useState<Judge | null>(null);
  const spokeAt = useRef(0);
  const recorded = useRef(false);
  const advanced = useRef(false);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = { moduleId: spec.moduleId, questionType: spec.questionType, prompt: spec.prompt, params: spec.params };

  const next = () => {
    if (advanced.current) return;
    advanced.current = true;
    if (nextTimer.current) clearTimeout(nextTimer.current);
    cancelSpeak();
    onNext();
  };

  const scheduleNext = () => {
    if (spec.checks || settings.autoNextSec <= 0) return;
    nextTimer.current = setTimeout(next, settings.autoNextSec * 1000 + (settings.showResultImmediately ? 600 : 0));
  };

  const showFeedback = (j: Judge) => {
    if (!settings.showResultImmediately) return;
    setFeedback(j);
    if (j === 'correct') chime();
    else buzzer(1);
  };

  useEffect(() => {
    let alive = true;
    let abort: (() => void) | null = null;
    if (spec.parentOnly) {
      (async () => {
        setPhase('speaking');
        await speak(spec.speech);
        spokeAt.current = performance.now();
        if (alive) setPhase('parent');
      })();
    } else {
      const ask = askByVoice(spec.speech, {
        timeoutMs: settings.silenceTimeoutSec * 1000,
        onPhase: (p) => alive && setPhase(p),
        onInterim: (t) => alive && setInterim(t)
      });
      abort = ask.abort;
      ask.promise.then(async (o) => {
        if (!alive) return;
        spokeAt.current = o.spokeAt;
        if (o.mode === 'parent') {
          setPhase('parent');
          return;
        }
        const r = o.result!;
        if (r.status === 'result' && r.transcript) {
          const alts = r.alternatives?.length ? r.alternatives : [r.transcript];
          setHeard(r.transcript);
          let aj: AutoJudgeResult = { judge: 'unknown' };
          try {
            if (spec.judge) aj = await spec.judge(r.transcript, alts);
          } catch (e) {
            console.error(e);
          }
          if (!alive) return;
          setAuto(aj);
          const h = spec.hints ? freeHints(r.transcript) : undefined;
          const initialChecks: ParentChecks | undefined = spec.checks
            ? { immediate: (r.latencyMs ?? 99999) <= 3000, reason: !!h?.reason, keigo: !!h?.keigo }
            : undefined;
          if (initialChecks) setChecksState(initialChecks);
          recorded.current = true;
          const a = await session.record({
            ...base,
            answerMode: 'voice',
            transcript: r.transcript,
            alternatives: alts,
            matched: aj.matched,
            autoJudge: aj.judge,
            parentChecks: initialChecks,
            latencyMs: r.latencyMs,
            latencySource: r.latencySource,
            meta: { note: aj.note, ...(h ? { hints: h } : {}) }
          });
          if (!alive) return;
          setAttempt(a);
          showFeedback(aj.judge);
          scheduleNext();
        } else {
          recorded.current = true;
          await speak('大丈夫です。');
          const a = await session.record({
            ...base,
            answerMode: 'voice',
            autoJudge: 'unknown',
            meta: { status: r.status, error: r.error }
          });
          if (!alive) return;
          setAttempt(a);
          scheduleNext();
        }
      });
    }
    return () => {
      alive = false;
      abort?.();
      cancelSpeak();
      if (nextTimer.current) clearTimeout(nextTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保護者判定のとき：時間内にタップがなければ「大丈夫です」
  // （子どもが答えてから保護者が押すまでの余裕として 5秒たす）
  useEffect(() => {
    if (phase !== 'parent' || recorded.current) return;
    const t = setTimeout(async () => {
      if (recorded.current) return;
      recorded.current = true;
      setPhase('heard');
      await speak('大丈夫です。');
      const a = await session.record({ ...base, answerMode: 'parent', autoJudge: 'unknown', meta: { timedOut: true } });
      setAttempt(a);
      scheduleNext();
    }, (settings.silenceTimeoutSec + 5) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const parentJudgeNow = async (j: Judge) => {
    if (recorded.current) return;
    recorded.current = true;
    const lat = performance.now() - spokeAt.current;
    const a = await session.record({ ...base, answerMode: 'parent', parentJudge: j, latencyMs: lat, latencySource: 'parent' });
    setAttempt(a);
    setPhase('heard');
    showFeedback(j);
    scheduleNext();
  };

  const toggleCheck = (k: keyof ParentChecks, v: boolean) => {
    const c = { ...checks, [k]: v };
    setChecksState(c);
    if (attempt) session.setChecks(attempt.id, { [k]: v });
  };

  const hints = spec.hints && heard ? freeHints(heard) : null;

  return (
    <>
      <div className="play-main">
        <RunnerTop index={index} total={total} />
        {spec.figure && (
          <div className="figure-card" style={{ marginBottom: 8 }}>
            {spec.figure}
          </div>
        )}
        {feedback ? (
          <div className="stage rise">
            <span style={{ fontSize: 120, fontWeight: 900, color: feedback === 'correct' ? 'var(--good)' : 'var(--bad)', lineHeight: 1 }}>
              {feedback === 'correct' ? '○' : feedback === 'wrong' ? '×' : '？'}
            </span>
          </div>
        ) : spec.figure ? (
          <CompactStatus phase={phase} />
        ) : (
          <VoiceStage phase={phase} />
        )}
      </div>
      <ParentPanel
        right={
          attempt ? (
            <button className="btn btn-parent btn-sm" onClick={next}>
              つぎへ
              <Icon name="right" size={16} />
            </button>
          ) : undefined
        }
      >
        <div className="panel-box stack" style={{ gap: 4 }}>
          <PanelLine label="もんだい">{spec.prompt}</PanelLine>
          {(heard || interim) && (
            <PanelLine label="きこえた">
              {heard || interim}
              {auto?.matched ? `（よみ：${auto.matched}）` : ''}
            </PanelLine>
          )}
          {auto?.note && <PanelLine label="じどう">{auto.note}</PanelLine>}
          {hints && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className={`chip ${hints.reason ? 'chip-good' : ''}`}>理由{hints.reason ? 'あり' : 'なし'}</span>
              <span className={`chip ${hints.keigo ? 'chip-good' : ''}`}>敬語{hints.keigo ? 'あり' : 'なし'}</span>
            </div>
          )}
          {attempt?.latencyMs !== undefined && <PanelLine label="はやさ">{secLabel(attempt.latencyMs)}</PanelLine>}
          {spec.examples && spec.examples.length > 0 && <PanelLine label="れい">{spec.examples.join('・')}</PanelLine>}
        </div>
        {phase === 'parent' && !attempt ? (
          <JudgeButtons onChange={parentJudgeNow} labels={spec.judgeLabels} />
        ) : (
          <AttemptJudge attempt={attempt} session={session} labels={spec.judgeLabels} />
        )}
        {spec.checks && attempt && (
          <div className="panel-box stack" style={{ gap: 6 }}>
            {(
              [
                ['immediate', 'すぐ こたえた'],
                ['reason', 'りゆうまで いえた'],
                ['keigo', 'けいごで いえた']
              ] as [keyof ParentChecks, string][]
            ).map(([k, label]) => (
              <div className="between" key={k}>
                <span className="small">{label}</span>
                <Switch on={!!checks[k]} label={label} onChange={(v) => toggleCheck(k, v)} />
              </div>
            ))}
          </div>
        )}
      </ParentPanel>
    </>
  );
}

function CompactStatus({ phase }: { phase: VoicePhase }) {
  const text =
    phase === 'speaking' ? 'よく きいてください' : phase === 'listening' ? 'ピッと なったら こたえてね' : phase === 'parent' ? 'こたえてください' : 'こたえを ききました';
  const icon = phase === 'speaking' ? 'speaker' : phase === 'listening' ? 'mic' : phase === 'parent' ? 'face' : 'smile';
  return (
    <div className="stage" style={{ gap: 12, padding: '8px 0' }}>
      <span
        className={phase === 'listening' ? 'blink' : undefined}
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background: phase === 'listening' ? 'var(--primary)' : '#fff',
          color: phase === 'listening' ? '#fff' : 'var(--muted)',
          border: phase === 'listening' ? 0 : '3px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Icon name={icon} size={44} />
      </span>
      <span className="stage-text" style={{ fontSize: 21 }}>
        {text}
      </span>
    </div>
  );
}
