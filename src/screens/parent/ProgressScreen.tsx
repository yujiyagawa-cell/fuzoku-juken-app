import { useMemo, useState, type ReactNode } from 'react';
import { daysUntil } from '../../core/dates';
import { db, useLive } from '../../core/db';
import { GENRES } from '../../core/genres';
import { practiceItemById } from '../../core/practiceItems';
import {
  computeProgress,
  formatPracticeLog,
  LEVEL_CRITERIA,
  LEVEL_STYLE,
  LEVELS,
  recommendItems,
  TARGET_READINESS,
  type Lv,
  type ProgressItem
} from '../../core/progress';
import { useSettings } from '../../core/settings';
import type { Attempt, PracticeLog, Review, WaitingLog } from '../../core/types';
import { QUESTION_TYPES, typeById } from '../../modules/registry';
import { isTypeActive, markMap } from '../../modules/scope';
import { IconBadge, JudgeMark, Modal, Seg } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { navigate } from '../../ui/router';
import { agoLabel, Empty, fmtMD, fmtMDHM, LevelBadge, ParentScreen, pct, PercentBar, SectionTitle, SourceChip, Stars } from './parentParts';

// 進捗（レベル）一覧：アプリの正答率・速さ、運動・生活の練習ログ、待機練習から、項目ごとのレベルと全体の進み具合を見る

type Filter = 'all' | 'app' | 'log' | 'low';

const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'app', label: 'アプリ' },
  { v: 'log', label: '練習ログ' },
  { v: 'low', label: 'Lv2以下' }
];

function actionFor(it: ProgressItem): { label: string; go: () => void } | null {
  if (it.kind === 'practice' && it.practiceItemId) return { label: '記録する', go: () => navigate(`/log?item=${encodeURIComponent(it.practiceItemId!)}`) };
  if (it.moduleId) {
    const q = it.kind === 'type' && it.typeId ? `&types=${encodeURIComponent(it.typeId)}` : '';
    return { label: 'これを練習', go: () => navigate(`/setup?m=${encodeURIComponent(it.moduleId!)}${q}`) };
  }
  return null;
}

function matches(it: ProgressItem, f: Filter): boolean {
  if (f === 'app') return it.kind !== 'practice';
  if (f === 'log') return it.kind === 'practice';
  if (f === 'low') return it.level <= 2;
  return true;
}

function LevelMix({ counts, total }: { counts: Record<Lv, number>; total: number }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        role="img"
        aria-label={LEVELS.map((l) => `Lv${l} ${counts[l]}項目`).join('、')}
        style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#eef1f6' }}
      >
        {[...LEVELS].reverse().map((l) =>
          counts[l] ? (
            <div
              key={l}
              style={{
                width: `${(counts[l] / Math.max(1, total)) * 100}%`,
                background: LEVEL_STYLE[l].ink,
                opacity: l === 0 ? 0.25 : 0.35 + l * 0.16,
                borderRight: '2px solid #fff'
              }}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[...LEVELS].reverse().map((l) => (
          <span key={l} className="row" style={{ gap: 4 }}>
            <LevelBadge level={l} />
            <b style={{ fontSize: 13 }}>{counts[l]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function ItemRow({ it, onOpen }: { it: ProgressItem; onOpen: () => void }) {
  return (
    <button
      className="list-row"
      onClick={onOpen}
      style={{ width: '100%', background: 'transparent', border: 0, borderBottom: '1px solid #eef1f6', textAlign: 'left', padding: '8px 0', color: 'inherit' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.4 }}>{it.name}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
          <SourceChip source={it.source} />
          <span className="tiny muted">{it.metric}</span>
        </div>
        <div className="tiny" style={{ color: 'var(--faint)', marginTop: 2 }}>
          最後：{agoLabel(it.lastAt)}
          {it.count ? `・${it.kind === 'type' ? `${it.count}問` : `${it.count}回`}` : ''}
        </div>
      </div>
      <LevelBadge level={it.level} />
    </button>
  );
}

export function Detail({
  it,
  attempts,
  practiceLogs,
  waitingLogs,
  onClose
}: {
  it: ProgressItem;
  attempts: Attempt[];
  practiceLogs: PracticeLog[];
  waitingLogs: WaitingLog[];
  onClose: () => void;
}) {
  const act = actionFor(it);
  const type = it.typeId ? typeById(it.typeId) : undefined;
  const pitem = it.practiceItemId ? practiceItemById(it.practiceItemId) : undefined;
  const genre = GENRES.find((g) => g.id === it.genre);

  let history: ReactNode = null;
  if (it.kind === 'type') {
    const list = attempts
      .filter((a) => a.questionType === it.typeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
    history = list.length ? (
      <div className="stack" style={{ gap: 4 }}>
        {list.map((a) => (
          <div key={a.id} className="row" style={{ gap: 8, fontSize: 12, alignItems: 'baseline' }}>
            <span className="tiny muted" style={{ minWidth: 70 }}>
              {fmtMDHM(a.createdAt)}
            </span>
            <JudgeMark judge={a.finalJudge} />
            <span style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere', fontWeight: 700 }}>
              {a.transcript ? `「${a.transcript}」` : a.meta?.timedOut ? '時間切れ' : ''}
            </span>
            <span className="tiny muted">{a.latencyMs !== undefined ? `${(a.latencyMs / 1000).toFixed(1)}秒` : ''}</span>
          </div>
        ))}
      </div>
    ) : null;
  } else if (it.kind === 'practice' && pitem) {
    const list = practiceLogs
      .filter((l) => l.itemId === pitem.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
    history = list.length ? (
      <div className="stack" style={{ gap: 4 }}>
        {list.map((l) => (
          <div key={l.id} className="row" style={{ gap: 8, fontSize: 12 }}>
            <span className="tiny muted" style={{ minWidth: 40 }}>
              {fmtMD(l.createdAt)}
            </span>
            <span style={{ fontWeight: 700 }}>{formatPracticeLog(pitem, l) || '記録'}</span>
            {l.note && <span className="tiny muted">{l.note}</span>}
          </div>
        ))}
      </div>
    ) : null;
  } else if (it.kind === 'waiting') {
    const list = waitingLogs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    history = list.length ? (
      <div className="stack" style={{ gap: 4 }}>
        {list.map((l) => {
          const total = Object.values(l.counts || {}).reduce((s, n) => s + n, 0);
          return (
            <div key={l.id} className="row" style={{ gap: 8, fontSize: 12 }}>
              <span className="tiny muted" style={{ minWidth: 40 }}>
                {fmtMD(l.createdAt)}
              </span>
              <span style={{ fontWeight: 900 }}>{l.durationMin}分</span>
              <span style={{ fontWeight: 700 }}>{l.success ? '○ 成功' : l.completed ? `× 気になる動き${total}回` : '× とちゅうで終了'}</span>
            </div>
          );
        })}
      </div>
    ) : null;
  }

  return (
    <Modal open onClose={onClose} title={it.name}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <LevelBadge level={it.level} />
          <SourceChip source={it.source} />
          <Stars n={it.priority} />
          {genre && <span className="tiny muted">{genre.name}</span>}
        </div>
        <div className="card" style={{ padding: '10px 12px', background: '#f8fafd' }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{it.metric}</div>
          <div className="small" style={{ marginTop: 4, color: it.level >= 4 ? 'var(--good)' : 'var(--parent)' }}>
            {it.level >= 4 ? 'ばっちり。ときどき復習して保ちましょう' : `次のレベルまで：${it.next ?? ''}`}
          </div>
        </div>
        {(type?.description || pitem?.tip) && (
          <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {type?.description ?? pitem?.tip}
          </p>
        )}
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>
            レベルの条件
          </div>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }} className="stack">
            {LEVEL_CRITERIA[it.kind].map((c, i) => {
              const on = i === it.level;
              return (
                <li
                  key={i}
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: '4px 8px',
                    borderRadius: 8,
                    fontWeight: on ? 900 : 500,
                    background: on ? LEVEL_STYLE[i as Lv].bg : 'transparent',
                    color: on ? LEVEL_STYLE[i as Lv].ink : 'var(--muted)'
                  }}
                >
                  {on ? '▶ ' : ''}
                  {c}
                  {on ? '（いまここ）' : ''}
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>
            最近の記録
          </div>
          {history ?? <span className="small muted">まだ記録がありません</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {act && (
            <button
              className="btn btn-parent"
              style={{ flex: 1 }}
              onClick={() => {
                onClose();
                act.go();
              }}
            >
              {act.label}
            </button>
          )}
          <button className="btn btn-ghost" style={{ flex: act ? undefined : 1 }} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ProgressScreen() {
  const attempts = useLive(() => db.attempts.toArray(), [], [] as Attempt[]);
  const practiceLogs = useLive(() => db.practiceLogs.toArray(), [], [] as PracticeLog[]);
  const waitingLogs = useLive(() => db.waitingLogs.toArray(), [], [] as WaitingLog[]);
  const reviews = useLive(() => db.reviews.toArray(), [], [] as Review[]);
  const { settings } = useSettings();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<ProgressItem | null>(null);

  const result = useMemo(
    // ふだん出す問題（プリントにある問題＋カタログで「良い」にした問題）だけで進み具合を出す
    () => {
      const marks = markMap(reviews);
      return computeProgress({ attempts, practiceLogs, waitingLogs, types: QUESTION_TYPES.filter((t) => isTypeActive(t, marks)) });
    },
    [attempts, practiceLogs, waitingLogs, reviews]
  );
  const recs = useMemo(() => recommendItems(result.items), [result]);
  const days = daysUntil(settings.examDate);
  const total = result.items.length;
  const lv3up = result.counts[3] + result.counts[4];
  const reached = result.readiness >= TARGET_READINESS;

  return (
    <ParentScreen title="進捗（レベル）一覧" sub="アプリで解いた正答率・速さと、運動・生活の練習ログ、待機練習から、項目ごとのレベルを出しています。">
      {/* 全体 */}
      <section className="card" style={{ margin: '12px 16px 0' }} aria-label="全体のじゅんび度">
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="tiny muted">全体のじゅんび度</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>{pct(result.readiness)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny muted">試験まで</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{days >= 0 ? `あと${days}日` : 'おわり'}</div>
          </div>
        </div>
        <div style={{ margin: '10px 0 4px' }}>
          <PercentBar value={result.readiness} target={TARGET_READINESS} color={reached ? 'var(--good)' : '#2f6fdb'} />
        </div>
        <div className="tiny muted">
          縦の線＝目標 60%（合格の目安は全体で6割）。{reached ? '目標に届いています。' : `あと ${Math.max(0, Math.ceil((TARGET_READINESS - result.readiness) * 100))} ポイント。`}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="between">
            <span className="small">本番で出た項目だけ</span>
            <b style={{ fontSize: 15 }}>{pct(result.examReadiness)}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            <PercentBar value={result.examReadiness} target={TARGET_READINESS} color="#c2531f" height={8} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="between" style={{ marginBottom: 6 }}>
            <span className="small">レベルの内訳</span>
            <span className="tiny muted">
              Lv3以上 {lv3up} / {total} 項目
            </span>
          </div>
          <LevelMix counts={result.counts} total={total} />
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          記録：アプリ {attempts.length}問・練習ログ {practiceLogs.length}件・待機 {waitingLogs.length}回
        </div>
      </section>

      {/* 今日のおすすめ */}
      {recs.length > 0 && (
        <>
          <SectionTitle>今日のおすすめ</SectionTitle>
          <div className="list">
            {recs.map(({ item, reason }) => {
              const act = actionFor(item);
              return (
                <div key={item.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{item.name}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>
                      {reason}
                    </div>
                  </div>
                  {act ? (
                    <button className="btn btn-outline btn-sm" onClick={act.go}>
                      {act.label}
                    </button>
                  ) : (
                    <LevelBadge level={item.level} short />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 一覧 */}
      <SectionTitle>項目ごとのレベル</SectionTitle>
      <div className="pad" style={{ marginBottom: 6 }}>
        <Seg options={FILTERS} value={filter} onChange={setFilter} label="しぼりこみ" />
      </div>
      {GENRES.map((g) => {
        const gp = result.byGenre[g.id];
        const items = (gp?.items ?? []).filter((it) => matches(it, filter)).sort((a, b) => b.priority - a.priority);
        if (!items.length) return null;
        return (
          <section key={g.id} aria-label={g.name} style={{ marginTop: 14 }}>
            <div className="row" style={{ margin: '0 16px 6px', gap: 10 }}>
              <IconBadge name={g.icon} bg={g.bg} color={g.icon_color} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="between">
                  <b style={{ fontSize: 14 }}>{g.name}</b>
                  <span className="small">{pct(gp.readiness)}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <PercentBar value={gp.readiness} height={6} color={g.icon_color} />
                </div>
              </div>
            </div>
            <div className="list">
              {items.map((it) => (
                <ItemRow key={it.id} it={it} onOpen={() => setOpen(it)} />
              ))}
            </div>
          </section>
        );
      })}
      {result.items.filter((it) => matches(it, filter)).length === 0 && <Empty>この条件の項目はありません</Empty>}

      <div className="pad" style={{ marginTop: 18 }}>
        <details>
          <summary className="small" style={{ cursor: 'pointer', color: 'var(--parent)' }}>
            レベルの決め方
          </summary>
          <div className="stack small muted" style={{ marginTop: 8, lineHeight: 1.6, fontWeight: 500 }}>
            <div>
              <b>アプリの項目</b>：{LEVEL_CRITERIA.type.slice(1).join(' ／ ')}
            </div>
            <div>
              <b>練習ログ</b>：{LEVEL_CRITERIA.practice.slice(1).join(' ／ ')}
            </div>
            <div>
              <b>待機練習</b>：{LEVEL_CRITERIA.waiting.slice(1).join(' ／ ')}
            </div>
            <div>
              <b>じゅんび度</b>：各項目の「Lv÷4」を重要度（★1〜3）で重みづけした平均。本番で出た項目は★3。
            </div>
          </div>
        </details>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/log')}>
            <Icon name="activity" size={18} />
            運動・生活ログ
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/records')}>
            <Icon name="chart" size={18} />
            記録
          </button>
        </div>
      </div>

      {open && (
        <Detail
          it={result.items.find((x) => x.id === open.id) ?? open}
          attempts={attempts}
          practiceLogs={practiceLogs}
          waitingLogs={waitingLogs}
          onClose={() => setOpen(null)}
        />
      )}
    </ParentScreen>
  );
}

