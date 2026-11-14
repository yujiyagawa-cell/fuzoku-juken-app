import { useEffect, useMemo, useState } from 'react';
import { db, nowIso, uid, useLive } from '../../core/db';
import { PRACTICE_ITEMS, practiceItemById, type PracticeItem } from '../../core/practiceItems';
import { evalPracticeLogs, formatPracticeLog, LEVEL_CRITERIA } from '../../core/progress';
import type { PracticeLog } from '../../core/types';
import { Modal, useToast } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { navigate, useRoute } from '../../ui/router';
import { fmtMD, LevelBadge, ParentScreen, SectionTitle, SourceChip } from './parentParts';
import { Stopwatch } from './Stopwatch';

// 運動・生活ログ：項目ごとに記録（秒数・○×・きれいさ・回数・メモ）と履歴。ストップウォッチつき。

function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`btn btn-sm ${armed ? 'btn-danger' : 'btn-ghost'}`}
      aria-label={armed ? 'もう一度押すと削除' : '削除'}
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? '削除する' : <Icon name="trash" size={14} />}
    </button>
  );
}

function OkButtons({ value, onChange }: { value?: boolean; onChange: (v: boolean | undefined) => void }) {
  const opts: { v: boolean; mark: string; label: string; color: string }[] = [
    { v: true, mark: '○', label: 'できた', color: 'var(--good)' },
    { v: false, mark: '×', label: 'できなかった', color: 'var(--bad)' }
  ];
  return (
    <div className="judge-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="group" aria-label="できたか">
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={String(o.v)}
            className="judge-btn"
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : o.v)}
            style={{ borderColor: o.color, background: on ? o.color : '#fff', color: on ? '#fff' : o.color }}
          >
            <span className="mark">{o.mark}</span>
            <span style={{ fontSize: 12 }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function QualityButtons({ value, onChange }: { value?: 1 | 2 | 3; onChange: (v: 1 | 2 | 3 | undefined) => void }) {
  return (
    <div className="row" style={{ gap: 6 }} role="group" aria-label="きれいさ">
      {([1, 2, 3] as const).map((q) => {
        const on = value === q;
        return (
          <button
            key={q}
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : q)}
            className="btn btn-sm"
            style={{ flex: 1, borderColor: on ? 'var(--parent)' : 'var(--line2)', background: on ? 'var(--parent)' : '#fff', color: on ? '#fff' : 'var(--muted)', fontSize: 14 }}
          >
            {'★'.repeat(q)}
          </button>
        );
      })}
    </div>
  );
}

export function ItemModal({ item, logs, onClose, onSaved }: { item: PracticeItem; logs: PracticeLog[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const f = item.fields;
  const [seconds, setSeconds] = useState('');
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  const [quality, setQuality] = useState<1 | 2 | 3 | undefined>(undefined);
  const [count, setCount] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const sorted = logs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ev = evalPracticeLogs(item, logs);

  const secNum = seconds.trim() === '' ? undefined : Number(seconds);
  const secValid = secNum === undefined || (!Number.isNaN(secNum) && secNum >= 0 && secNum < 3600);
  const hasAny = secNum !== undefined || ok !== undefined || quality !== undefined || count !== undefined || note.trim() !== '';

  const save = async () => {
    if (!hasAny || !secValid) return;
    const log: PracticeLog = { id: uid(), itemId: item.id, createdAt: nowIso() };
    if (secNum !== undefined) log.seconds = Math.round(secNum * 10) / 10;
    if (ok !== undefined) log.ok = ok;
    if (quality !== undefined) log.quality = quality;
    if (count !== undefined) log.count = count;
    if (note.trim()) log.note = note.trim();
    await db.practiceLogs.add(log);
    setSeconds('');
    setOk(undefined);
    setQuality(undefined);
    setCount(undefined);
    setNote('');
    onSaved('記録しました');
  };

  const target = f.seconds?.target;

  return (
    <Modal open onClose={onClose} title={item.name}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <LevelBadge level={ev.level} />
          <SourceChip source={item.source} />
          {ev.next && <span className="tiny muted">次：{ev.next}</span>}
        </div>
        {item.tip && (
          <p className="small" style={{ margin: 0, lineHeight: 1.6, color: 'var(--ink)', fontWeight: 500, background: '#f8fafd', borderRadius: 12, padding: '8px 10px' }}>
            {item.tip}
          </p>
        )}

        {f.seconds && (
          <div className="card" style={{ padding: 12 }}>
            <Stopwatch defaultLimit={item.stopwatchSec ?? 0} onUse={(s) => setSeconds(String(s))} compact />
          </div>
        )}

        {f.seconds && (
          <label className="stack" style={{ gap: 4 }}>
            <span className="small">
              秒数{target !== undefined ? `（目標 ${target}秒${f.seconds.better === 'higher' ? '以上' : '以内'}）` : f.seconds.better === 'lower' ? '（短いほどよい）' : '（長いほどよい）'}
            </span>
            <input
              className="input"
              inputMode="decimal"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="例 12"
              aria-invalid={!secValid}
              style={{ width: 140 }}
            />
          </label>
        )}

        {f.ok && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="small">できたか</span>
            <OkButtons value={ok} onChange={setOk} />
          </div>
        )}

        {f.quality && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="small">きれいさ</span>
            <QualityButtons value={quality} onChange={setQuality} />
          </div>
        )}

        {f.count && (
          <div className="between">
            <span className="small">{f.count.label}</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" aria-label="へらす" onClick={() => setCount((c) => (c === undefined ? 0 : Math.max(0, c - 1)))}>
                <Icon name="minus" size={16} />
              </button>
              <b style={{ minWidth: 36, textAlign: 'center', fontSize: 18 }}>{count ?? '—'}</b>
              <button className="btn btn-ghost btn-sm" aria-label="ふやす" onClick={() => setCount((c) => (c === undefined ? 1 : c + 1))}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        )}

        <label className="stack" style={{ gap: 4 }}>
          <span className="small">メモ（任意）</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="気づいたこと" />
        </label>

        <button className="btn btn-parent btn-block" disabled={!hasAny || !secValid} onClick={save}>
          記録する
        </button>

        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>
            これまでの記録（{sorted.length}回）
          </div>
          {sorted.length ? (
            <div className="stack" style={{ gap: 2 }}>
              {sorted.slice(0, 15).map((l) => (
                <div key={l.id} className="between" style={{ fontSize: 13, minHeight: 36 }}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span className="tiny muted" style={{ minWidth: 36 }}>
                      {fmtMD(l.createdAt)}
                    </span>
                    <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {formatPracticeLog(item, l) || '記録'}
                      {l.note ? <span className="tiny muted">　{l.note}</span> : null}
                    </span>
                  </span>
                  <ConfirmDelete onDelete={() => db.practiceLogs.delete(l.id)} />
                </div>
              ))}
            </div>
          ) : (
            <span className="small muted">まだ記録がありません</span>
          )}
        </div>
        <details>
          <summary className="tiny" style={{ color: 'var(--parent)', cursor: 'pointer' }}>
            レベルの条件
          </summary>
          <ul className="tiny muted" style={{ margin: '6px 0 0', paddingLeft: 16, lineHeight: 1.7, fontWeight: 500 }}>
            {LEVEL_CRITERIA.practice.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
        <button className="btn btn-ghost" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Modal>
  );
}

export function LogScreen() {
  const route = useRoute();
  const logs = useLive(() => db.practiceLogs.toArray(), [], [] as PracticeLog[]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const qItem = route.query.get('item');

  useEffect(() => {
    if (qItem && practiceItemById(qItem)) setOpenId(qItem);
  }, [qItem]);

  const byItem = useMemo(() => {
    const m = new Map<string, PracticeLog[]>();
    for (const l of logs) {
      const x = m.get(l.itemId);
      if (x) x.push(l);
      else m.set(l.itemId, [l]);
    }
    return m;
  }, [logs]);

  const open = openId ? practiceItemById(openId) : undefined;

  const close = () => {
    setOpenId(null);
    if (qItem) navigate('/log', { replace: true });
  };

  const groups: { genre: PracticeItem['genre']; title: string }[] = [
    { genre: 'undo', title: '運動' },
    { genre: 'seikatsu', title: '生活・巧緻性' }
  ];

  return (
    <ParentScreen title="運動・生活ログ" sub="家での練習を記録すると、進捗（レベル）一覧に反映されます。本番では「途中で失敗してもやり直さない」と言われます。">
      <SectionTitle>ストップウォッチ（はさみ・折り紙・箸）</SectionTitle>
      <div className="card" style={{ margin: '0 16px' }}>
        <Stopwatch defaultLimit={60} />
      </div>

      {groups.map((g) => (
        <section key={g.genre} aria-label={g.title}>
          <SectionTitle>{g.title}</SectionTitle>
          <div className="list">
            {PRACTICE_ITEMS.filter((p) => p.genre === g.genre)
              .slice()
              .sort((a, b) => b.priority - a.priority)
              .map((p) => {
                const l = (byItem.get(p.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                const ev = evalPracticeLogs(p, l);
                const last = l[l.length - 1];
                return (
                  <button
                    key={p.id}
                    className="list-row"
                    onClick={() => setOpenId(p.id)}
                    style={{ width: '100%', background: 'transparent', border: 0, borderBottom: '1px solid #eef1f6', textAlign: 'left', color: 'inherit' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{p.name}</div>
                      <div className="row" style={{ gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <SourceChip source={p.source} />
                        <span className="tiny muted">{last ? `${fmtMD(last.createdAt)} ${formatPracticeLog(p, last) || '記録'}` : 'まだ記録なし'}</span>
                      </div>
                    </div>
                    <LevelBadge level={ev.level} short />
                    <Icon name="right" size={18} style={{ color: 'var(--faint)' }} />
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      {open && <ItemModal item={open} logs={byItem.get(open.id) ?? []} onClose={close} onSaved={showToast} />}
      {toast}
    </ParentScreen>
  );
}
