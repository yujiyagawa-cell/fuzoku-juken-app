import { useEffect, useRef, useState } from 'react';
import { db } from '../../core/db';
import { makeRng, weightedPick } from '../../core/rng';
import { useSettings } from '../../core/settings';
import { cancelSpeak, speak, ttsAvailable } from '../../core/speech/tts';
import type { Attempt } from '../../core/types';
import { AttemptJudge, PanelLine, RunnerTop, secLabel, wait } from '../../player/parts';
import { TapRound } from '../../player/TapRound';
import type { QuestionType, RunnerProps, TapQuestion, TapResult } from '../../player/types';
import { VoiceStage } from '../../player/voice';
import { ParentPanel } from '../../ui/components';
import { makeStory, templateOfType, type Story } from './stories';
import { isInPrint, isTypeActive, markMap } from '../scope';
import { OHANASHI_TYPES } from './types';

// お話の記憶：スタート → お話を1回だけ読み上げ（文字は出さない）→ 4問をタップで → 1問ずつ記録

const PER_STORY = 4;

async function pickTypes(count: number, types?: string[]): Promise<QuestionType[]> {
  let list: QuestionType[] = [];
  if (types?.length) list = OHANASHI_TYPES.filter((t) => types.includes(t.id));
  if (!list.length) {
    // ふだんはプリントにあるお話だけ（scope.ts）
    const marks = markMap(await db.reviews.toArray());
    list = OHANASHI_TYPES.filter((t) => isTypeActive(t, marks));
    if (!list.length) list = OHANASHI_TYPES.filter(isInPrint);
  }
  const rng = makeRng();
  const out: QuestionType[] = [];
  for (let i = 0; i < count; i++) {
    const prev = out[out.length - 1]?.id;
    out.push(weightedPick(rng, list, (t) => (t.id === prev && list.length > 1 ? 0 : t.priority)));
  }
  return out;
}

function answerLabel(q: TapQuestion): string {
  const ids = Array.isArray(q.answer) ? q.answer : [q.answer];
  return ids.map((id) => q.choices.find((c) => c.id === id)?.label ?? id).join(' → ');
}

type Phase = 'ready' | 'story' | 'question';

export function OhanashiRunner({ count, timeLimitSec, types, session, onDone }: RunnerProps) {
  const { settings } = useSettings();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [si, setSi] = useState(0);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [last, setLast] = useState<Attempt | null>(null);
  const [lastQ, setLastQ] = useState<TapQuestion | null>(null);
  const [showText, setShowText] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    alive.current = true;
    pickTypes(Math.max(1, count), types).then((list) => {
      if (!alive.current) return;
      const rng = makeRng();
      const made = list.map((t) => makeStory(templateOfType(t.id) ?? 'kakekko', rng));
      setStories(made);
    });
    return () => {
      alive.current = false;
      cancelSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stories) return <div className="stage" />;
  const story = stories[si];
  const cur = phase === 'question' ? story.questions[qi] : null;
  const total = stories.length * PER_STORY;

  const toQuestions = () => {
    setQi(0);
    setPhase('question');
  };

  const startStory = async () => {
    setPhase('story');
    if (!ttsAvailable()) {
      // 読み上げが使えない端末：保護者が読む（読み終わったらボタンで問題へ）
      setShowText(true);
      return;
    }
    await speak(story.speech);
    if (!alive.current) return;
    await wait(600);
    if (!alive.current) return;
    toQuestions();
  };

  const onAnswered = async (r: TapResult) => {
    if (!cur || busy.current) return;
    busy.current = true;
    const a = await session.record({
      moduleId: 'ohanashi',
      questionType: cur.type,
      prompt: cur.prompt,
      params: cur.params,
      answerMode: 'tap',
      tappedChoice: r.choiceId,
      correctChoice: Array.isArray(cur.answer) ? cur.answer.join(',') : cur.answer,
      autoJudge: r.judge,
      latencyMs: r.timedOut ? undefined : r.latencyMs,
      latencySource: r.timedOut ? undefined : 'tap',
      meta: { story: story.text, ...(r.timedOut ? { timedOut: true } : {}) }
    });
    busy.current = false;
    if (!alive.current) return;
    setLast(a);
    setLastQ(cur);
    if (qi + 1 < story.questions.length) {
      setQi(qi + 1);
    } else if (si + 1 < stories.length) {
      setSi(si + 1);
      setQi(0);
      setPhase('ready');
    } else {
      onDone();
    }
  };

  return (
    <>
      <div className="play-main">
        <RunnerTop index={si * PER_STORY + (phase === 'question' ? qi : 0)} total={total} />
        {phase === 'ready' && (
          <>
            <div className="stage-text" style={{ fontSize: 20, textAlign: 'center', marginTop: 8 }}>
              おはなしを よみます。
              <br />
              いちどしか よみません。よく きいてください。
            </div>
            <VoiceStage phase="ready" onStart={startStory} color="var(--good)" />
          </>
        )}
        {phase === 'story' && <VoiceStage phase="speaking" />}
        {phase === 'question' && cur && (
          <TapRound
            key={`${si}-${qi}`}
            q={cur}
            timeLimitSec={timeLimitSec ?? settings.tapTimeLimitSec}
            showResult={settings.showResultImmediately}
            onAnswered={onAnswered}
          />
        )}
      </div>
      <ParentPanel
        right={
          <span className="row" style={{ gap: 6 }}>
            {phase === 'story' && !ttsAvailable() && (
              <button className="btn btn-parent btn-sm" onClick={toQuestions}>
                読み終わった
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowText((v) => !v)} aria-pressed={showText}>
              {showText ? 'かくす' : 'お話・答え'}
            </button>
          </span>
        }
      >
        {showText ? (
          <div className="panel-box stack" style={{ gap: 4, maxHeight: 180, overflow: 'auto' }}>
            <PanelLine label={`お話${stories.length > 1 ? `${si + 1}` : ''}`}>{story.text}</PanelLine>
            {cur && <PanelLine label="もんだい">{cur.prompt}</PanelLine>}
            {cur && (
              <PanelLine label="こたえ">
                {answerLabel(cur)}
                {cur.explain ? `（${cur.explain}）` : ''}
              </PanelLine>
            )}
          </div>
        ) : (
          <div className="tiny muted">
            {phase === 'story'
              ? 'お話は1回だけ読み上げます。声が出ないときは「お話・答え」を押して、保護者が1回だけ読んでください。'
              : '子どもに見えないよう、お話と答えは「お話・答え」で表示します。'}
          </div>
        )}
        {last && lastQ && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="tiny muted">
              まえの もんだい：{lastQ.prompt.slice(0, 22)}
              {lastQ.prompt.length > 22 ? '…' : ''}（{secLabel(last.latencyMs)}）
            </span>
            <AttemptJudge attempt={last} session={session} />
          </div>
        )}
      </ParentPanel>
    </>
  );
}
