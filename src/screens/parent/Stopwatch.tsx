import { useEffect, useRef, useState } from 'react';
import { buzzer } from '../../core/audio';
import { speak } from '../../core/speech/tts';
import { Seg } from '../../ui/components';

// ストップウォッチ（はさみ・折り紙・箸用）。決めた時間でブザーと「おしまいです」。

function fmt(ms: number): string {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

const LIMITS = [
  { v: 0, label: 'なし' },
  { v: 30, label: '30秒' },
  { v: 60, label: '60秒' },
  { v: 90, label: '90秒' },
  { v: 120, label: '2分' }
];

export function Stopwatch({ defaultLimit = 0, onUse, compact = false }: { defaultLimit?: number; onUse?: (sec: number) => void; compact?: boolean }) {
  const [limit, setLimit] = useState<number>(LIMITS.some((l) => l.v === defaultLimit) ? defaultLimit : 0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const base = useRef(0); // これまでの合計
  const start = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const e = base.current + (performance.now() - start.current);
      if (limit > 0 && e >= limit * 1000) {
        base.current = limit * 1000;
        setElapsed(limit * 1000);
        setRunning(false);
        setEnded(true);
        buzzer(3).then(() => speak('おしまいです。', { times: 1 }));
        return;
      }
      setElapsed(e);
    }, 100);
    return () => clearInterval(id);
  }, [running, limit]);

  const startStop = () => {
    if (running) {
      base.current += performance.now() - start.current;
      setElapsed(base.current);
      setRunning(false);
    } else {
      if (ended) {
        base.current = 0;
        setElapsed(0);
        setEnded(false);
      }
      start.current = performance.now();
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setEnded(false);
    base.current = 0;
    setElapsed(0);
  };

  const left = limit > 0 ? limit * 1000 - elapsed : 0;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: compact ? 30 : 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }} aria-live="off">
          {fmt(elapsed)}
        </span>
        {limit > 0 && (
          <span className="small" style={{ color: ended ? 'var(--bad)' : 'var(--muted)' }}>
            {ended ? 'おしまい' : `のこり ${Math.ceil(left / 1000)}秒`}
          </span>
        )}
      </div>
      <Seg options={LIMITS} value={limit} onChange={(v) => !running && setLimit(v)} label="時間" />
      <div className="row" style={{ gap: 8 }}>
        <button className={`btn ${running ? 'btn-danger' : 'btn-parent'}`} style={{ flex: 1 }} onClick={startStop}>
          {running ? 'ストップ' : elapsed > 0 && !ended ? 'つづける' : 'スタート'}
        </button>
        <button className="btn btn-ghost" onClick={reset} disabled={running || elapsed === 0}>
          リセット
        </button>
      </div>
      {onUse && (
        <button className="btn btn-outline btn-block" onClick={() => onUse(Math.round(elapsed / 100) / 10)} disabled={running || elapsed === 0}>
          この秒数を記録に入れる
        </button>
      )}
    </div>
  );
}
