import { db, useLive } from '../core/db';
import { useSettings } from '../core/settings';
import type { Attempt, Drawing, Judge, SessionRec, WaitingLog } from '../core/types';
import { kotobaParams } from '../core/weakKana';
import { examplesFor } from '../modules/kotoba/words';
import { moduleById, typeById } from '../modules/registry';
import { TAIKI_COUNTERS } from '../modules/taiki';
import { startPlan } from '../player/plan';
import { overrideJudge } from '../player/session';
import { Header, JudgeButtons, JudgeMark, ParentStrip } from '../ui/components';
import { Icon } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate, useRoute } from '../ui/router';
import { dayKey } from '../core/dates';
import { Stamp } from './Calendar';

// セット結果：モジュール別の正答数・平均回答秒数・苦手だった問題、保護者向けのやり直し候補

const avgSec = (list: Attempt[]) => {
  const xs = list.map((a) => a.latencyMs).filter((x): x is number => typeof x === 'number');
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length / 1000;
};

function detail(a: Attempt): string {
  if (a.transcript) return `「${a.transcript}」`;
  if (a.meta && (a.meta as { timedOut?: boolean }).timedOut) return '時間切れ';
  if (a.meta && (a.meta as { status?: string }).status === 'nospeech') return 'こたえなし';
  return '';
}

export function Results() {
  const route = useRoute();
  const id = route.parts[1] || '';
  const { isParent } = useMode();
  const { settings } = useSettings();
  const session = useLive(() => db.sessions.get(id), [id], undefined as SessionRec | undefined);
  const attempts = useLive(() => db.attempts.where('sessionId').equals(id).sortBy('createdAt'), [id], [] as Attempt[]);
  const waits = useLive(() => db.waitingLogs.filter((w) => w.sessionId === id).toArray(), [id], [] as WaitingLog[]);
  const drawings = useLive(() => db.drawings.filter((d) => d.sessionId === id).toArray(), [id], [] as Drawing[]);

  const moduleIds = session?.moduleIds ?? [...new Set(attempts.map((a) => a.moduleId))];
  const total = attempts.length;
  const correct = attempts.filter((a) => a.finalJudge === 'correct').length;

  const weakTypes = [...new Set(attempts.filter((a) => a.finalJudge !== 'correct').map((a) => a.questionType))].filter((t) => typeById(t));
  const retry = () => {
    const byModule = new Map<string, string[]>();
    for (const t of weakTypes) {
      const qt = typeById(t)!;
      const mid = attempts.find((a) => a.questionType === t)?.moduleId ?? qt.moduleId;
      byModule.set(mid, [...(byModule.get(mid) ?? []), t]);
    }
    startPlan({
      label: 'やりなおし',
      items: [...byModule.entries()].map(([moduleId, types]) => {
        const m = moduleById(moduleId);
        return { moduleId, count: m?.unit === 'わ' ? 1 : Math.min(m?.maxCount ?? 5, Math.max(3, types.length * 2)), types };
      })
    });
  };

  const setJudge = (a: Attempt, j: Judge) => overrideJudge(a.id, j);

  return (
    <div className="screen">
      <Header />
      <ParentStrip />
      <div className="stage rise" style={{ flex: 'none', padding: '8px 16px 4px', gap: 8 }}>
        <button
          onClick={() => navigate('/calendar')}
          aria-label="がんばり カレンダーを みる"
          style={{ border: 0, background: 'none', padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <Stamp day={dayKey(session?.startedAt ?? new Date())} big />
          <span className="small" style={{ color: '#d0453a' }}>
            きょうの スタンプを おしたよ（カレンダー）
          </span>
        </button>
        <span className="stage-text" style={{ fontSize: 24 }}>
          よく がんばりました！
        </span>
        {total > 0 && (
          <span className="small muted">
            {total}もん ちゅう <b style={{ fontSize: 20, color: 'var(--good)' }}>{correct}</b> もん せいかい
          </span>
        )}
      </div>

      {moduleIds.map((mid) => {
        const m = moduleById(mid);
        if (!m) return null;
        const list = attempts.filter((a) => a.moduleId === mid);
        const ok = list.filter((a) => a.finalJudge === 'correct').length;
        const av = avgSec(list);
        const w = waits.filter(() => mid === 'taiki');
        const dr = drawings.filter(() => mid === 'kakitashi');
        return (
          <section key={mid} className="card" style={{ margin: '12px 16px 0' }}>
            <div className="between">
              <span className="module-chip" style={{ background: m.color.bg, color: m.color.ink, fontSize: 14 }}>
                <Icon name={m.icon} size={18} style={{ color: m.color.icon }} />
                {m.name}
              </span>
              {list.length > 0 && (
                <span className="small">
                  ○ {ok} / {list.length}
                  {av !== null && <span className="muted">　へいきん {av.toFixed(1)}びょう</span>}
                </span>
              )}
            </div>
            {w.map((x) => {
              const sum = Object.values(x.counts).reduce((a, b) => a + b, 0);
              return (
                <div key={x.id} className="stack" style={{ marginTop: 8, gap: 4 }}>
                  <div className="row">
                    <span className={`chip ${x.success ? 'chip-good' : 'chip-warn'}`}>{x.success ? 'せいこう' : x.completed ? `${sum}かい` : 'とちゅうで おわり'}</span>
                    <span className="small muted">
                      {x.durationMin}ふん（{Math.floor(x.elapsedSec / 60)}ふん {x.elapsedSec % 60}びょう）
                    </span>
                  </div>
                  {sum > 0 && (
                    <div className="tiny muted">
                      {TAIKI_COUNTERS.filter((c) => x.counts[c.key])
                        .map((c) => `${c.label} ${x.counts[c.key]}`)
                        .join('・')}
                    </div>
                  )}
                </div>
              );
            })}
            {dr.length > 0 && (
              <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                {dr.map((d) => (
                  <img key={d.id} src={d.pngDataUrl} alt="かいた え" style={{ width: 96, height: 96, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 12 }} />
                ))}
              </div>
            )}
            {list.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {list.map((a) => {
                  const kp = kotobaParams(a);
                  const ex = kp ? examplesFor(kp.kana, kp.length, settings.moraRules) : [];
                  return (
                    <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #eef1f6' }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <span style={{ width: 22, flexShrink: 0 }}>
                          <JudgeMark judge={a.finalJudge} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.prompt}</div>
                          <div className="tiny muted">
                            {isParent && typeById(a.questionType) ? `${typeById(a.questionType)!.name}　` : ''}
                            {detail(a)}
                            {a.latencyMs !== undefined ? `　${(a.latencyMs / 1000).toFixed(1)}びょう` : ''}
                          </div>
                          {ex.length > 0 && <div className="tiny" style={{ color: 'var(--good)' }}>れい：{ex.join('・')}</div>}
                        </div>
                      </div>
                      {isParent && (
                        <div style={{ marginTop: 6 }}>
                          <JudgeButtons value={a.finalJudge} onChange={(j) => setJudge(a, j)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {isParent && weakTypes.length > 0 && (
        <section className="card" style={{ margin: '12px 16px 0', background: 'var(--parent-bg)', borderColor: 'var(--parent-line)' }}>
          <div className="h2" style={{ color: 'var(--parent)' }}>
            やり直し候補
          </div>
          <div className="tiny muted" style={{ margin: '4px 0 8px' }}>
            ×・？だった問題の種類：{weakTypes.map((t) => typeById(t)?.name).join('、')}
          </div>
          <button className="btn btn-parent btn-block" onClick={retry}>
            この種類だけ もう一度
          </button>
        </section>
      )}

      <div className="pad row" style={{ marginTop: 16, gap: 10 }}>
        <button className="btn btn-ghost btn-big" style={{ flex: 1, fontSize: 18 }} onClick={() => navigate('/', { replace: true })}>
          <Icon name="home" size={22} />
          ホーム
        </button>
        {session && (
          <button
            className="btn btn-primary btn-big"
            style={{ flex: 1, fontSize: 18 }}
            onClick={() =>
              startPlan({
                items: session.moduleIds.map((mid) => ({ moduleId: mid, count: moduleById(mid)?.defaultCount ?? 3 })),
                mySetId: session.mySetId
              })
            }
          >
            <Icon name="refresh" size={22} />
            もういちど
          </button>
        )}
      </div>
    </div>
  );
}
