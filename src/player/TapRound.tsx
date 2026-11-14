import { useEffect, useRef, useState } from 'react';
import { buzzer } from '../core/audio';
import { cancelSpeak, speak } from '../core/speech/tts';
import { Icon } from '../ui/icons';
import type { TapQuestion, TapResult } from './types';

// タップで答える1問。読み上げ（1回）→ 制限時間つきで答える → 時間切れは「だいじょうぶです」。

interface Props {
  q: TapQuestion;
  timeLimitSec: number;
  showResult: boolean; // その場で正誤を見せる（練習用）
  onAnswered: (r: TapResult) => void;
}

type Phase = 'preview' | 'speaking' | 'answering' | 'done';

export function TapRound({ q, timeLimitSec, showResult, onAnswered }: Props) {
  const [phase, setPhase] = useState<Phase>(q.preview ? 'preview' : 'speaking');
  const [order, setOrder] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const t0 = useRef(0);
  const doneRef = useRef(false);
  const limit = q.timeLimitSec ?? timeLimitSec;
  const [left, setLeft] = useState(1);

  // 問題が変わったらやり直し
  useEffect(() => {
    doneRef.current = false;
    setOrder([]);
    setPicked(null);
    setFeedback(null);
    setLeft(1);
    let alive = true;
    (async () => {
      if (q.preview) {
        setPhase('preview');
        if (q.preview.speech) await speak(q.preview.speech, { times: 1 });
        await new Promise((r) => setTimeout(r, q.preview!.seconds * 1000));
        if (!alive) return;
      }
      setPhase('speaking');
      await speak(q.speech ?? q.prompt);
      if (!alive) return;
      t0.current = performance.now();
      setPhase('answering');
    })();
    return () => {
      alive = false;
      cancelSpeak();
    };
  }, [q]);

  // 制限時間
  useEffect(() => {
    if (phase !== 'answering') return;
    const start = performance.now();
    const id = setInterval(() => {
      const f = 1 - (performance.now() - start) / (limit * 1000);
      setLeft(Math.max(0, f));
      if (f <= 0) {
        clearInterval(id);
        if (doneRef.current) return;
        doneRef.current = true;
        setPhase('done');
        speak('大丈夫です。', { times: 1 }).then(() => onAnswered({ judge: 'unknown', timedOut: true, order: order.length ? order : undefined }));
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, limit]);

  const finish = (r: TapResult) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('done');
    if (showResult) {
      setFeedback(r.judge === 'correct' ? 'correct' : 'wrong');
      if (r.judge !== 'correct') buzzer(1);
      setTimeout(() => onAnswered(r), 900);
    } else {
      setTimeout(() => onAnswered(r), 350);
    }
  };

  const tap = (id: string) => {
    if (phase !== 'answering') return;
    if (doneRef.current) return;
    const latencyMs = performance.now() - t0.current;
    if (q.mode === 'order') {
      const answer = q.answer as string[];
      const idx = order.indexOf(id);
      const next = idx >= 0 ? order.slice(0, idx) : [...order, id];
      setOrder(next);
      if (next.length === answer.length) {
        const ok = next.every((x, i) => x === answer[i]);
        finish({ order: next, judge: ok ? 'correct' : 'wrong', latencyMs, timedOut: false });
      }
      return;
    }
    setPicked(id);
    finish({ choiceId: id, judge: id === q.answer ? 'correct' : 'wrong', latencyMs, timedOut: false });
  };

  const n = q.choices.length;
  const cols = q.cols ?? (n <= 3 ? n : n === 4 ? 2 : 3);
  // 4択（2列×2行）でも、問題の絵と保護者パネルの間に収まる高さ
  const h = q.choiceHeight ?? (cols >= 4 ? 88 : cols === 3 ? 108 : n <= 2 ? 130 : 112);

  if (phase === 'preview' && q.preview) {
    return (
      <div className="stage">
        <div className="figure-card" style={{ width: '100%' }}>{q.preview.node}</div>
        <span className="stage-text" style={{ fontSize: 20 }}>よく みて おぼえてください</span>
      </div>
    );
  }

  return (
    <div>
      <div className="timer" role="img" aria-label="のこり じかん">
        <div style={{ width: `${(phase === 'answering' ? left : 1) * 100}%`, background: left < 0.25 ? 'var(--accent)' : undefined }} />
      </div>
      {phase === 'speaking' && (
        <div className="row muted small" style={{ justifyContent: 'center', marginBottom: 6 }}>
          <Icon name="speaker" size={18} />
          よく きいてください
        </div>
      )}
      {q.figure && <div className="figure-card">{q.figure}</div>}
      <div className="choice-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {q.choices.map((c) => {
          const ord = order.indexOf(c.id);
          const isPicked = picked === c.id || ord >= 0;
          let cls = 'choice';
          if (feedback && isPicked) cls += feedback === 'correct' ? ' correct' : ' wrong';
          else if (isPicked) cls += ' selected';
          return (
            <button key={c.id} className={cls} style={{ minHeight: h }} aria-label={c.label} onClick={() => tap(c.id)}>
              {q.mode === 'order' && ord >= 0 && <span className="order-num">{ord + 1}</span>}
              {c.node}
              {c.caption && <span className="choice-label">{c.caption}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
