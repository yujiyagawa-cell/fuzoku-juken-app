import { useMemo } from 'react';
import { makeRng } from '../../core/rng';
import type { QuestionType, TapQuestion } from '../../player/types';
import { Icon } from '../../ui/icons';

// タップ問題の見本を静的に描く（カタログ用）。正解の選択肢に印をつける。

export function generateSample(type: QuestionType, seed: number): { q?: TapQuestion; error?: string } {
  if (!type.generate) return { error: '自動生成なし' };
  try {
    const q = type.generate(makeRng(seed));
    if (!q || !q.choices?.length) return { error: '選択肢がありません' };
    return { q };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function QuestionPreview({ type, seed }: { type: QuestionType; seed: number }) {
  const res = useMemo(() => generateSample(type, seed), [type, seed]);
  if (!res.q) {
    return (
      <div className="small" style={{ color: 'var(--bad)', background: 'var(--bad-bg)', borderRadius: 12, padding: '8px 10px' }}>
        見本を作れませんでした：{res.error}
      </div>
    );
  }
  const q = res.q;
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  const n = q.choices.length;
  const cols = q.cols ?? (n <= 3 ? n : n === 4 ? 2 : 3);
  const isOrder = q.mode === 'order';

  return (
    <div className="stack" style={{ gap: 8, background: '#f8fafd', borderRadius: 18, padding: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
        <span style={{ color: 'var(--muted)', marginTop: 2 }}>
          <Icon name="speaker" size={16} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.6 }}>{q.prompt}</span>
      </div>
      {q.speech && q.speech !== q.prompt && <div className="tiny muted">読み上げ：{q.speech}</div>}
      {q.preview && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny" style={{ color: 'var(--parent)' }}>
            先に {q.preview.seconds}秒 見せてから隠す絵{q.preview.speech ? `（「${q.preview.speech}」）` : ''}
          </span>
          <div className="figure-card" style={{ minHeight: 0, padding: 8 }}>
            {q.preview.node}
          </div>
        </div>
      )}
      {q.figure && (
        <div className="figure-card" style={{ minHeight: 0, padding: 8 }}>
          {q.figure}
        </div>
      )}
      <div className="choice-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: 0, gap: 8 }}>
        {q.choices.map((c) => {
          const ord = answers.indexOf(c.id);
          const correct = ord >= 0;
          return (
            <div key={c.id} className={`choice ${correct ? 'correct' : ''}`} style={{ minHeight: 76, borderWidth: 3 }} aria-label={`${c.label}${correct ? '（正解）' : ''}`}>
              {isOrder && correct && <span className="order-num">{ord + 1}</span>}
              {!isOrder && correct && (
                <span
                  style={{ position: 'absolute', right: 6, top: 4, fontSize: 11, fontWeight: 900, color: 'var(--good)', background: '#fff', borderRadius: 8, padding: '0 5px' }}
                >
                  せいかい
                </span>
              )}
              {c.node}
              {c.caption && <span className="choice-label" style={{ fontSize: 13 }}>{c.caption}</span>}
            </div>
          );
        })}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {isOrder && <span className="chip">順番にタップ</span>}
        {q.askReason && <span className="chip chip-parent">答えたあと理由を聞く</span>}
        {q.timeLimitSec && <span className="chip">制限 {q.timeLimitSec}秒</span>}
      </div>
      {q.explain && <div className="tiny muted">説明：{q.explain}</div>}
    </div>
  );
}
