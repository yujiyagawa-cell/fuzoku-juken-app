import { useEffect, useMemo, useState } from 'react';
import { db } from '../core/db';
import { makeRng, type Rng } from '../core/rng';
import { useSettings } from '../core/settings';
import { cancelSpeak } from '../core/speech/tts';
import type { Attempt } from '../core/types';
import { ParentPanel, Switch } from '../ui/components';
import { AttemptJudge, PanelLine, RunnerTop, secLabel } from './parts';
import { TapRound } from './TapRound';
import type { QuestionType, RunnerProps, TapQuestion, TapResult } from './types';
import { askByVoice, VoiceStage, type VoicePhase } from './voice';

// タップで答える問題をつづけて出す、共通のランナー（図形・推理など）
// - 問題タイプを混ぜて出す（本番で出たタイプ＝priority 3 は多めに）
// - カタログで「外す」にしたタイプは出さない（タイプを指定したときは出す）
// - askReason の問題は、答えたあと「どうして その こたえですか」と聞く

export async function activeTypes(pool: QuestionType[], types?: string[]): Promise<QuestionType[]> {
  const list = pool.filter((t) => t.generate);
  if (types?.length) {
    const f = list.filter((t) => types.includes(t.id));
    if (f.length) return f;
  }
  const reviews = await db.reviews.toArray();
  const off = new Set(reviews.filter((r) => r.mark === 'off').map((r) => r.typeId));
  const on = list.filter((t) => !off.has(t.id));
  return on.length ? on : list;
}

export function buildSequence(rng: Rng, list: QuestionType[], count: number): QuestionType[] {
  if (!list.length) return [];
  const out: QuestionType[] = [];
  let bag: QuestionType[] = [];
  const refill = () => {
    const weighted: QuestionType[] = [];
    for (const t of list) {
      weighted.push(t);
      if (t.priority === 3) weighted.push(t);
    }
    bag = rng.shuffle(weighted);
  };
  while (out.length < count) {
    if (!bag.length) refill();
    let t = bag.shift()!;
    if (out.length && out[out.length - 1].id === t.id && bag.some((x) => x.id !== t.id)) {
      const j = bag.findIndex((x) => x.id !== t.id);
      const other = bag.splice(j, 1)[0];
      bag.push(t);
      t = other;
    }
    out.push(t);
  }
  return out;
}

/** 生成に失敗したら別のタイプで作り直す */
export function generateSafe(t: QuestionType, list: QuestionType[], rng: Rng): TapQuestion | null {
  const tries = [t, ...rng.shuffle(list.filter((x) => x.id !== t.id))];
  for (const x of tries) {
    try {
      const q = x.generate!(rng);
      if (q && q.choices.length) return q;
    } catch (e) {
      console.error('generate failed', x.id, e);
    }
  }
  return null;
}

function answerLabel(q: TapQuestion): string {
  const ids = Array.isArray(q.answer) ? q.answer : [q.answer];
  return ids.map((id) => q.choices.find((c) => c.id === id)?.label ?? id).join(' → ');
}

interface Props extends RunnerProps {
  moduleId: string;
  pool: QuestionType[];
}

export function TapSetRunner({ moduleId, pool, count, timeLimitSec, types, session, onDone }: Props) {
  const { settings } = useSettings();
  const [seq, setSeq] = useState<QuestionType[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<Attempt | null>(null);
  const [lastQ, setLastQ] = useState<TapQuestion | null>(null);
  const [phase, setPhase] = useState<'round' | 'reason'>('round');
  const [reasonPhase, setReasonPhase] = useState<VoicePhase>('speaking');
  const [reasonText, setReasonText] = useState('');
  const [reasonOk, setReasonOk] = useState(false);

  useEffect(() => {
    let alive = true;
    activeTypes(pool, types).then((list) => {
      if (!alive) return;
      const s = buildSequence(makeRng(), list, count);
      if (!s.length) onDone();
      setSeq(s);
    });
    return () => {
      alive = false;
      cancelSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = useMemo(() => {
    if (!seq || !seq[idx]) return null;
    return generateSafe(seq[idx], seq, makeRng());
  }, [seq, idx]);

  const advance = () => {
    setPhase('round');
    setReasonText('');
    setReasonOk(false);
    if (!seq || idx + 1 >= seq.length) onDone();
    else setIdx((i) => i + 1);
  };

  const onAnswered = async (r: TapResult) => {
    if (!q) return;
    const a = await session.record({
      moduleId,
      questionType: q.type,
      prompt: q.prompt,
      params: q.params,
      answerMode: 'tap',
      tappedChoice: r.order ? r.order.join(',') : r.choiceId,
      correctChoice: Array.isArray(q.answer) ? q.answer.join(',') : q.answer,
      autoJudge: r.judge,
      latencyMs: r.timedOut ? undefined : r.latencyMs,
      latencySource: r.timedOut ? undefined : 'tap',
      meta: r.timedOut ? { timedOut: true } : undefined
    });
    setLast(a);
    setLastQ(q);
    if (q.askReason && !r.timedOut) {
      setPhase('reason');
      const ask = askByVoice('どうして その こたえ ですか。', {
        timeoutMs: settings.silenceTimeoutSec * 1000,
        onPhase: setReasonPhase,
        onInterim: setReasonText
      });
      ask.promise.then(async (o) => {
        const t = o.result?.transcript ?? '';
        if (t) {
          setReasonText(t);
          await db.attempts.update(a.id, { meta: { ...(a.meta || {}), reasonTranscript: t } });
        }
      });
      return;
    }
    advance();
  };

  if (!seq || !q) return <div className="stage" />;

  const limit = timeLimitSec ?? settings.tapTimeLimitSec;

  return (
    <>
      <div className="play-main">
        <RunnerTop index={idx} total={seq.length} />
        {phase === 'round' ? (
          <TapRound key={idx} q={q} timeLimitSec={limit} showResult={settings.showResultImmediately} onAnswered={onAnswered} />
        ) : (
          <VoiceStage phase={reasonPhase} />
        )}
      </div>
      <ParentPanel
        right={
          phase === 'reason' ? (
            <button className="btn btn-parent btn-sm" onClick={advance}>
              つぎへ
            </button>
          ) : undefined
        }
      >
        {phase === 'round' ? (
          <div className="panel-box stack" style={{ gap: 4 }}>
            <PanelLine label="もんだい">{q.prompt}</PanelLine>
            <PanelLine label="こたえ">
              {answerLabel(q)}
              {q.explain ? `（${q.explain}）` : ''}
            </PanelLine>
          </div>
        ) : (
          <div className="panel-box stack" style={{ gap: 6 }}>
            <PanelLine label="りゆう">{reasonText || '（きいています）'}</PanelLine>
            <div className="between">
              <span className="small">りゆうまで いえた</span>
              <Switch
                on={reasonOk}
                label="りゆうまで いえた"
                onChange={(v) => {
                  setReasonOk(v);
                  if (last) session.setChecks(last.id, { reason: v });
                }}
              />
            </div>
          </div>
        )}
        {last && lastQ && (
          <div className={`stack ${phase === 'round' ? 'panel-more' : ''}`} style={{ gap: 4 }}>
            <span className="tiny muted">
              {phase === 'round' ? 'まえの もんだい' : 'いまの もんだい'}：{lastQ.prompt.slice(0, 24)}
              {lastQ.prompt.length > 24 ? '…' : ''}（{secLabel(last.latencyMs)}）
            </span>
            <AttemptJudge attempt={last} session={session} />
          </div>
        )}
      </ParentPanel>
    </>
  );
}
