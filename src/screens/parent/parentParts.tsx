import type { CSSProperties, ReactNode } from 'react';
import { daysSince, LEVEL_LABELS, LEVEL_STYLE, type Lv } from '../../core/progress';
import { BackButton, Header, ParentStrip } from '../../ui/components';

// 保護者画面で共通に使う部品

export function ParentScreen({ title, sub, right, children }: { title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen">
      <Header left={<BackButton to="/" label="ホーム" />} right={right} />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 6 }}>
        <h1 className="h1">{title}</h1>
        {sub && (
          <p className="muted small" style={{ margin: '4px 0 0', lineHeight: 1.6 }}>
            {sub}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function LevelBadge({ level, short = false }: { level: Lv; short?: boolean }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className="level" style={{ background: s.bg, color: s.ink }} aria-label={`レベル${level} ${LEVEL_LABELS[level]}`}>
      Lv{level}
      {!short && ` ${LEVEL_LABELS[level]}`}
    </span>
  );
}

const SOURCE_STYLE: Record<string, { label: string; bg: string; ink: string }> = {
  本番: { label: '本番', bg: '#ffe8d9', ink: '#8f3a12' },
  ノート: { label: 'ノート', bg: 'var(--parent-soft)', ink: 'var(--parent)' },
  'ノート（予想）': { label: '予想', bg: 'var(--yellow-bg)', ink: 'var(--yellow-ink)' },
  とっくん42: { label: 'とっくん42', bg: '#eee6ff', ink: '#4f2fa0' },
  とっくん65: { label: 'とっくん65', bg: '#eee6ff', ink: '#4f2fa0' },
  '365日': { label: '365日', bg: '#e2f5e6', ink: '#1c5c3a' },
  仕様: { label: '仕様', bg: '#f0f3f8', ink: '#4f5e74' }
};

export function SourceChip({ source, style }: { source: string; style?: CSSProperties }) {
  const s = SOURCE_STYLE[source] ?? { label: source, bg: '#f0f3f8', ink: '#4f5e74' };
  return (
    <span className="chip" style={{ background: s.bg, color: s.ink, padding: '2px 8px', fontSize: 11, ...style }}>
      {s.label}
    </span>
  );
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span aria-label={`重要度 ${n}`} style={{ color: '#b4501a', letterSpacing: 1, fontSize: 12 }}>
      {'★'.repeat(n)}
      <span style={{ color: '#c9d2e0' }}>{'★'.repeat(Math.max(0, max - n))}</span>
    </span>
  );
}

export function fmtMD(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtMDHM(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function agoLabel(iso?: string): string {
  const n = daysSince(iso);
  if (n === undefined) return 'まだ';
  if (n <= 0) return 'きょう';
  if (n === 1) return 'きのう';
  return `${n}日前`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** 横棒（目標の線つき） */
export function PercentBar({ value, target, color = '#2f6fdb', height = 12 }: { value: number; target?: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="bar" style={{ height, position: 'relative', overflow: 'visible' }} role="img" aria-label={`${pct(v)}${target !== undefined ? `（目標 ${pct(target)}）` : ''}`}>
      <div style={{ width: `${v * 100}%`, background: color, height: '100%', borderRadius: 999 }} />
      {target !== undefined && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: `calc(${target * 100}% - 1px)`, top: -4, bottom: -4, width: 2, background: 'var(--ink)', borderRadius: 2 }}
        />
      )}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="between" style={{ margin: '20px 16px 8px' }}>
      <h2 className="h2" style={{ fontSize: 15 }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card" style={{ margin: '0 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>
      {children}
    </div>
  );
}

/** ラベルつきのボタン群（折り返す） */
export function ChipButtons<T extends string | number>({ options, value, onChange, label }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            aria-pressed={on}
            onClick={() => onChange(o.v)}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 999,
              border: `2px solid ${on ? 'var(--parent)' : 'var(--line2)'}`,
              background: on ? 'var(--parent)' : '#fff',
              color: on ? '#fff' : 'var(--muted)',
              fontSize: 12,
              fontWeight: 900
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
