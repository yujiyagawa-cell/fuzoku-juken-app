import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { daysUntil } from '../core/dates';
import { useSettings } from '../core/settings';
import type { Judge } from '../core/types';
import { Icon, type IconName } from './icons';
import { useMode } from './mode';
import { goBack, navigate } from './router';

// ---- 試験までのカウントダウン ----
export function Countdown({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  const { isParent } = useMode();
  const n = daysUntil(settings.examDate);
  if (n < 0) return <span className="count-chip">しけん おわり</span>;
  if (n === 0) return <span className="count-chip">きょうが しけんび</span>;
  return (
    <span className="count-chip" aria-label={`試験まで あと ${n} 日`}>
      {!compact && (isParent ? '試験まで' : 'しけんまで')} あと<b>{n}</b>
      {isParent ? '日' : 'にち'}
    </span>
  );
}

// ---- モード切り替え（2秒長押し） ----
export function ModeButton() {
  const { mode, setMode, isParent } = useMode();
  const [pressing, setPressing] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = () => {
    fired.current = false;
    setHint(false);
    setPressing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      setPressing(false);
      setMode(mode === 'parent' ? 'child' : 'parent');
      if (navigator.vibrate) navigator.vibrate(40);
    }, 2000);
  };
  const end = () => {
    if (timer.current) clearTimeout(timer.current);
    setPressing(false);
  };
  const click = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    setHint(true);
    setTimeout(() => setHint(false), 1600);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        className={`mode-btn ${isParent ? 'parent' : ''}`}
        aria-label="モード切り替え（2秒長押し）"
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onClick={click}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name={isParent ? 'parents' : 'face'} size={24} />
        {pressing && (
          <svg className="mode-ring" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
            <circle cx="28" cy="28" r="27" />
          </svg>
        )}
      </button>
      <span className="mode-label" style={{ color: isParent ? 'var(--parent)' : undefined }}>
        {isParent ? 'ほごしゃ' : 'こども'}
      </span>
      {hint && (
        <div className="rise" role="status" style={{ position: 'absolute', right: 0, top: 64, zIndex: 30, whiteSpace: 'nowrap', padding: '8px 12px', borderRadius: 12, background: 'var(--ink)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          2びょう ながおしで きりかわります
        </div>
      )}
    </div>
  );
}

// ---- 画面のヘッダー ----
export function Header({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="hdr">
      <div className="row" style={{ minWidth: 0 }}>{left ?? <Countdown />}</div>
      <div className="row">
        {right}
        {left !== undefined && <Countdown compact />}
        <ModeButton />
      </div>
    </header>
  );
}

export function BackButton({ to, label = 'もどる' }: { to?: string; label?: string }) {
  return (
    <button className="back" onClick={() => (to ? navigate(to) : goBack())}>
      <Icon name="left" size={20} />
      {label}
    </button>
  );
}

export function ParentStrip() {
  const { isParent } = useMode();
  if (!isParent) return null;
  return <div className="parent-strip rise">保護者モード：記録・進捗・設定が使えます（2秒長押しで戻る）</div>;
}

// ---- 保護者パネル ----
// 画面の下に いつも出す。くわしい中身（.panel-box）は たためる（問題の絵や選択肢を かくさないため）。
const PANEL_KEY = 'fuzoku-panel-open';

export function ParentPanel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PANEL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(PANEL_KEY, v ? '0' : '1');
      } catch {
        /* noop */
      }
      return !v;
    });
  };
  return (
    <section className={`panel ${open ? '' : 'collapsed'}`} aria-label="保護者パネル">
      <div className="between">
        <button className="panel-title" onClick={toggle} aria-expanded={open} style={{ border: 0, background: 'none', padding: '4px 0' }}>
          <Icon name="parents" size={16} />
          ほごしゃ パネル
          <span style={{ fontWeight: 700, letterSpacing: 0, color: 'var(--muted)' }}>{open ? '▼ たたむ' : '▶ くわしく'}</span>
        </button>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---- ○×？ の判定ボタン ----
const JUDGE_DEFS: { v: Judge; mark: string; color: string }[] = [
  { v: 'correct', mark: '○', color: 'var(--good)' },
  { v: 'wrong', mark: '×', color: 'var(--bad)' },
  { v: 'unknown', mark: '？', color: 'var(--muted)' }
];

export function JudgeButtons({
  value,
  onChange,
  labels = { correct: 'せいかい', wrong: 'ちがう', unknown: 'わからない' },
  only
}: {
  value?: Judge;
  onChange: (j: Judge) => void;
  labels?: Partial<Record<Judge, string>>;
  only?: Judge[];
}) {
  const defs = only ? JUDGE_DEFS.filter((d) => only.includes(d.v)) : JUDGE_DEFS;
  return (
    <div className="judge-row" role="group" aria-label="はんてい" style={{ gridTemplateColumns: `repeat(${defs.length}, minmax(0, 1fr))` }}>
      {defs.map((d) => {
        const on = value === d.v;
        return (
          <button
            key={d.v}
            className="judge-btn"
            aria-pressed={on}
            onClick={() => onChange(d.v)}
            style={{ borderColor: d.color, background: on ? d.color : '#fff', color: on ? '#fff' : d.color }}
          >
            <span className="mark">{d.mark}</span>
            <span style={{ fontSize: 12 }}>{labels[d.v]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function JudgeMark({ judge }: { judge?: Judge }) {
  if (!judge) return null;
  const d = JUDGE_DEFS.find((x) => x.v === judge)!;
  return <b style={{ color: d.color, fontSize: 18 }}>{d.mark}</b>;
}

// ---- 進み具合の点 ----
export function Dots({ total, index }: { total: number; index: number }) {
  if (total > 12) {
    return (
      <span className="small muted" aria-label={`${index + 1}もんめ`}>
        {index + 1} / {total}
      </span>
    );
  }
  return (
    <span className="dots" role="img" aria-label={`${index + 1}もんめ（ぜんぶで ${total}もん）`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
      ))}
    </span>
  );
}

// ---- 小さな部品 ----
export function Seg<T extends string | number>({ options, value, onChange, label }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal rise" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 10 }}>
          <h2 className="h2">{title}</h2>
          <button className="btn btn-ghost btn-sm" aria-label="閉じる" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 2200);
  }, []);
  const node = msg ? (
    <div className="toast rise" role="status">
      {msg}
    </div>
  ) : null;
  return [node, show];
}

export function IconBadge({ name, bg, color, size = 42 }: { name: IconName; bg: string; color: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 14, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={name} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** 画面を暗くしない（待機練習などで使う） */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: any = null;
    let cancelled = false;
    const req = async () => {
      try {
        lock = await (navigator as any).wakeLock.request('screen');
      } catch {
        /* noop */
      }
    };
    req();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) req();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.();
    };
  }, [active]);
}
