import { useMemo, useState } from 'react';
import { buildCalendar, isHanamaru, isStamped, monthCells, stampFor, streakDays, type DayEntry } from '../core/calendar';
import { dayKey, examDateLabel } from '../core/dates';
import { db, useLive } from '../core/db';
import { practiceItemById } from '../core/practiceItems';
import { useSettings } from '../core/settings';
import { moduleById, typeById } from '../modules/registry';
import { BackButton, Header, ParentStrip } from '../ui/components';
import { Emoji } from '../ui/emoji';
import { Icon } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate } from '../ui/router';

// がんばりカレンダー：れんしゅうした日に スタンプ。日をタップすると、その日にやったことが ならぶ。

const WEEK = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];

export function Stamp({ day, big = false, hanamaru = false }: { day: string; big?: boolean; hanamaru?: boolean }) {
  const s = big ? 64 : 30;
  return (
    <span
      style={{
        position: 'relative',
        width: s,
        height: s,
        borderRadius: 999,
        border: `${big ? 4 : 2}px solid #d0453a`,
        background: '#fff5f2',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-8deg)'
      }}
    >
      <Emoji char={stampFor(day)} size={big ? 38 : 18} />
      {hanamaru && (
        <span style={{ position: 'absolute', right: big ? -10 : -7, top: big ? -10 : -8, fontSize: big ? 26 : 14 }} aria-label="はなまる">
          💮
        </span>
      )}
    </span>
  );
}

export function Calendar() {
  const { settings } = useSettings();
  const { isParent } = useMode();
  const today = dayKey(new Date());
  const data = useLive(
    async () => {
      const [sessions, attempts, waitingLogs, practiceLogs, drawings] = await Promise.all([
        db.sessions.toArray(),
        db.attempts.toArray(),
        db.waitingLogs.toArray(),
        db.practiceLogs.toArray(),
        db.drawings.toArray()
      ]);
      return buildCalendar({ sessions, attempts, waitingLogs, practiceLogs, drawings });
    },
    [],
    new Map<string, DayEntry>()
  );
  const stamped = useMemo(() => new Set([...data.values()].filter(isStamped).map((e) => e.day)), [data]);
  const streak = streakDays(stamped, today);
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });
  const [sel, setSel] = useState<string>(today);
  const exam = settings.examDate;
  const cells = monthCells(ym.y, ym.m);
  const monthCount = [...stamped].filter((d) => d.startsWith(`${ym.y}-${String(ym.m).padStart(2, '0')}`)).length;
  const move = (n: number) =>
    setYm((v) => {
      const d = new Date(v.y, v.m - 1 + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });
  const e = data.get(sel);

  return (
    <div className="screen">
      <Header left={<BackButton to="/" label="ホーム" />} />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">がんばり カレンダー</h1>
        <div className="row" style={{ marginTop: 8, gap: 10, flexWrap: 'wrap' }}>
          <span className="chip chip-good" style={{ fontSize: 14 }}>
            れんぞく <b style={{ fontSize: 18, margin: '0 2px' }}>{streak}</b> にち
          </span>
          <span className="chip" style={{ fontSize: 14 }}>
            {ym.m}がつは <b style={{ fontSize: 18, margin: '0 2px' }}>{monthCount}</b> にち がんばった
          </span>
        </div>
      </div>

      <section className="card" style={{ margin: '12px 16px 0', padding: '10px 10px 12px' }}>
        <div className="between" style={{ marginBottom: 6 }}>
          <button className="btn btn-ghost btn-sm" aria-label="まえの つき" onClick={() => move(-1)}>
            <Icon name="left" size={18} />
          </button>
          <b style={{ fontSize: 18 }}>
            {ym.y}ねん {ym.m}がつ
          </b>
          <button className="btn btn-ghost btn-sm" aria-label="つぎの つき" onClick={() => move(1)}>
            <Icon name="right" size={18} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {WEEK.map((w, i) => (
            <div key={w} className="tiny" style={{ textAlign: 'center', color: i === 0 ? '#c0392b' : i === 6 ? '#2457b5' : 'var(--muted)' }}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`x${i}`} />;
            const has = stamped.has(d);
            const isExam = d === exam;
            const isToday = d === today;
            const isSel = d === sel;
            const day = Number(d.slice(8));
            return (
              <button
                key={d}
                onClick={() => setSel(d)}
                aria-label={`${ym.m}がつ ${day}にち${has ? '（スタンプ）' : ''}${isExam ? '（しけんの ひ）' : ''}`}
                aria-pressed={isSel}
                style={{
                  minHeight: 54,
                  padding: '2px 0 4px',
                  borderRadius: 12,
                  border: isSel ? '2px solid var(--parent)' : isToday ? '2px solid var(--line2)' : '1px solid transparent',
                  background: isExam ? '#fff2c6' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <span className="tiny" style={{ color: isToday ? 'var(--primary)' : 'var(--muted)', fontWeight: 900 }}>
                  {day}
                </span>
                {has ? (
                  <Stamp day={d} hanamaru={isHanamaru(data.get(d))} />
                ) : isExam ? (
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#9a6a00' }}>しけん</span>
                ) : (
                  <span style={{ height: 30 }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ margin: '12px 16px 0' }}>
        <div className="between">
          <b style={{ fontSize: 17 }}>
            {Number(sel.slice(5, 7))}がつ {Number(sel.slice(8))}にち{sel === today ? '（きょう）' : ''}
          </b>
          {isStamped(e) && <Stamp day={sel} big hanamaru={isHanamaru(e)} />}
        </div>
        {sel === exam && <div className="small" style={{ marginTop: 6, color: '#9a6a00' }}>しけんの ひ（{examDateLabel(exam).kana}）</div>}
        {!isStamped(e) ? (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            {sel > today ? 'まだ さきの ひです' : 'この ひは まだ スタンプが ありません'}
          </p>
        ) : (
          <div className="stack" style={{ marginTop: 8, gap: 6 }}>
            {e!.minutes > 0 && <div className="small muted">れんしゅう やく {e!.minutes}ぷん</div>}
            {e!.modules.map((m) => {
              const mod = moduleById(m.moduleId);
              if (!mod) return null;
              return (
                <div key={m.moduleId} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <span className="tile-icon" style={{ width: 34, height: 34, borderRadius: 10, background: mod.color.bg, color: mod.color.icon }}>
                    <Icon name={mod.icon} size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>
                      {mod.name}　{m.count}もん
                      <span style={{ color: 'var(--good)', marginLeft: 6 }}>○{m.correct}</span>
                    </div>
                    {isParent && (
                      <div className="tiny muted" style={{ fontWeight: 500 }}>
                        {m.types
                          .map((t) => typeById(t)?.name)
                          .filter(Boolean)
                          .join('・')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {e!.waiting.map((w, i) => (
              <div key={`w${i}`} className="row" style={{ gap: 8 }}>
                <span className="tile-icon" style={{ width: 34, height: 34, borderRadius: 10, background: '#dff3f2', color: '#157a78' }}>
                  <Icon name="chair" size={20} />
                </span>
                <span style={{ fontWeight: 900 }}>
                  まつ　{w.durationMin}ふん {w.success ? '（せいこう）' : w.completed ? '' : '（とちゅうまで）'}
                </span>
              </div>
            ))}
            {e!.practices.map((p) => {
              const it = practiceItemById(p.itemId);
              return (
                <div key={p.id} className="row" style={{ gap: 8 }}>
                  <span className="tile-icon" style={{ width: 34, height: 34, borderRadius: 10, background: '#e6f4ff', color: '#1d6fa8' }}>
                    <Icon name="activity" size={20} />
                  </span>
                  <span style={{ fontWeight: 900 }}>
                    {it?.name ?? p.itemId}
                    {p.ok !== undefined ? (p.ok ? ' ○' : ' △') : ''}
                    {p.seconds !== undefined ? ` ${p.seconds}びょう` : ''}
                  </span>
                </div>
              );
            })}
            {e!.drawings.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {e!.drawings.slice(0, 6).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/works?tab=e&day=${sel}`)}
                    aria-label="かいた え を みる"
                    style={{ padding: 0, border: 'none', background: 'none' }}
                  >
                    <img src={d.pngDataUrl} alt="かいた え" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
            {(e!.drawings.length > 0 || e!.modules.some((m) => m.moduleId === 'uta')) && (
              <button
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => navigate(`/works?tab=${e!.drawings.length > 0 ? 'e' : 'uta'}&day=${sel}`)}
              >
                <Emoji char="🎨" size={16} />
                この ひの うたと え を みる
              </button>
            )}
          </div>
        )}
      </section>
      <p className="tiny muted pad" style={{ marginTop: 10 }}>
        れんしゅうした ひに スタンプ。たくさん がんばった ひ（20ぷん いじょう、または 3しゅるい いじょう）は 💮
      </p>
    </div>
  );
}
