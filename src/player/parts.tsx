import { useEffect, useState, type ReactNode } from 'react';
import type { Attempt, Judge } from '../core/types';
import { Dots, JudgeButtons } from '../ui/components';
import type { SessionApi } from './types';

// プレイヤーの中で使う小さな部品

/** 問題の上の段（何問目か） */
export function RunnerTop({ index, total, right }: { index: number; total: number; right?: ReactNode }) {
  return (
    <div className="between" style={{ minHeight: 30, margin: '2px 0 6px' }}>
      <Dots total={total} index={index} />
      {right}
    </div>
  );
}

/** 記録した1問の判定を保護者が上書きする（ワンタップ） */
export function AttemptJudge({
  attempt,
  session,
  labels,
  only,
  onChange
}: {
  attempt: Attempt | null;
  session: SessionApi;
  labels?: Partial<Record<Judge, string>>;
  only?: Judge[];
  onChange?: (j: Judge) => void;
}) {
  const [value, setValue] = useState<Judge | undefined>(attempt?.finalJudge);
  useEffect(() => setValue(attempt?.finalJudge), [attempt?.id, attempt?.finalJudge]);
  if (!attempt) {
    return <div className="small muted">こたえを まっています</div>;
  }
  return (
    <JudgeButtons
      value={value}
      labels={labels}
      only={only}
      onChange={(j) => {
        setValue(j);
        session.setParentJudge(attempt.id, j);
        onChange?.(j);
      }}
    />
  );
}

/** 保護者パネルの1行（ラベル：値） */
export function PanelLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: 6, fontSize: 13 }}>
      <span className="tiny muted" style={{ flexShrink: 0, minWidth: 52 }}>
        {label}
      </span>
      <span style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

export function secLabel(ms?: number): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return '—';
  return `${(ms / 1000).toFixed(1)}秒`;
}

/** 少し待つ */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
