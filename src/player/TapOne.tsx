import { useState } from 'react';
import { useSettings } from '../core/settings';
import type { Attempt } from '../core/types';
import { ParentPanel } from '../ui/components';
import { AttemptJudge, PanelLine, RunnerTop } from './parts';
import { TapRound } from './TapRound';
import type { SessionApi, TapQuestion } from './types';

// タップで答える1問を、記録と保護者パネルつきで出す（ほかの問題と混ぜるとき用）

export function TapOne({
  q,
  moduleId,
  session,
  index,
  total,
  timeLimitSec,
  onNext
}: {
  q: TapQuestion;
  moduleId: string;
  session: SessionApi;
  index: number;
  total: number;
  timeLimitSec?: number;
  onNext: () => void;
}) {
  const { settings } = useSettings();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const answer = Array.isArray(q.answer) ? q.answer : [q.answer];
  return (
    <>
      <div className="play-main">
        <RunnerTop index={index} total={total} />
        <TapRound
          q={q}
          timeLimitSec={timeLimitSec ?? settings.tapTimeLimitSec}
          showResult={settings.showResultImmediately}
          onAnswered={async (r) => {
            const a = await session.record({
              moduleId,
              questionType: q.type,
              prompt: q.prompt,
              params: q.params,
              answerMode: 'tap',
              tappedChoice: r.order ? r.order.join(',') : r.choiceId,
              correctChoice: answer.join(','),
              autoJudge: r.judge,
              latencyMs: r.timedOut ? undefined : r.latencyMs,
              latencySource: r.timedOut ? undefined : 'tap',
              meta: r.timedOut ? { timedOut: true } : undefined
            });
            setAttempt(a);
            setTimeout(onNext, 700);
          }}
        />
      </div>
      <ParentPanel>
        <div className="panel-box stack" style={{ gap: 4 }}>
          <PanelLine label="もんだい">{q.prompt}</PanelLine>
          <PanelLine label="こたえ">{q.explain ?? answer.map((id) => q.choices.find((c) => c.id === id)?.label ?? id).join(' → ')}</PanelLine>
        </div>
        {attempt && (
          <div className="panel-more">
            <AttemptJudge attempt={attempt} session={session} />
          </div>
        )}
      </ParentPanel>
    </>
  );
}
