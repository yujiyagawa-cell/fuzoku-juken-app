import { useEffect } from 'react';
import { db, useLive } from '../core/db';
import { dayKey, examDateLabel } from '../core/dates';
import { computeProgress, recommendItems, TARGET_READINESS, type Recommendation } from '../core/progress';
import { useSettings } from '../core/settings';
import { useSyncStatus } from '../core/sync';
import { clearTrials } from '../core/trial';
import type { MySet, WaitingLog } from '../core/types';
import { MODULES, moduleById, QUESTION_TYPES } from '../modules/registry';
import { isTypeActive, markMap } from '../modules/scope';
import { TAIKI_STEPS } from '../modules/taiki';
import { startPlan, type Plan } from '../player/plan';
import type { ModuleDef } from '../player/types';
import { Header, IconBadge, ParentStrip } from '../ui/components';
import { Emoji } from '../ui/emoji';
import { Icon, type IconName } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate } from '../ui/router';
import { Stamp } from './Calendar';

// ホーム：モジュールのタイル・おまかせ・マイセット。保護者モードでは管理メニューも出す。

/** 待機練習：前回成功した時間の次の段階 */
export function nextTaikiMinutes(logs: WaitingLog[]): number {
  const best = Math.max(0, ...logs.filter((l) => l.success).map((l) => l.durationMin));
  return TAIKI_STEPS.find((m) => m > best) ?? TAIKI_STEPS[TAIKI_STEPS.length - 1];
}

/** おまかせ：直近7日の正答率が低い順に3モジュール、各5問 */
export async function omakasePlan(): Promise<Plan> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const atts = await db.attempts.where('createdAt').above(since).toArray();
  const rows = MODULES.filter((m) => m.omakase).map((m) => {
    const a = atts.filter((x) => x.moduleId === m.id);
    const c = a.filter((x) => x.finalJudge === 'correct').length;
    return { m, rate: a.length ? c / a.length : -1, r: Math.random() };
  });
  rows.sort((x, y) => x.rate - y.rate || x.r - y.r);
  return {
    label: 'おまかせ',
    items: rows.slice(0, 3).map(({ m }) => ({ moduleId: m.id, count: m.unit === 'わ' ? 1 : Math.min(5, m.maxCount) }))
  };
}

function setSummary(s: MySet): string {
  return s.items
    .map((it) => {
      const m = moduleById(it.moduleId);
      if (!m) return '';
      return `${m.name} ${it.count}${m.unit}`;
    })
    .filter(Boolean)
    .join('・');
}

const PARENT_MENU: { to: string; icon: IconName; label: string; sub: string }[] = [
  { to: '/progress', icon: 'level', label: '進捗レベル一覧', sub: '項目ごとのレベルと全体の進み具合' },
  { to: '/records', icon: 'chart', label: '記録', sub: '正答率・速さの推移、苦手な音' },
  { to: '/log', icon: 'activity', label: '運動・生活ログ', sub: 'ぞうきん絞り・鉄棒・はさみ など' },
  { to: '/netacho', icon: 'notebook', label: 'ネタ帳', sub: '書き足しで描いた絵' },
  { to: '/catalog', icon: 'grid', label: '問題カタログ', sub: '問題の見本と評価' },
  { to: '/songs', icon: 'youtube', label: 'うたの曲', sub: 'YouTube で聞いて覚える' },
  { to: '/settings', icon: 'sliders', label: '設定', sub: '子どもの情報・ルール・データ' }
];

/** 見る専用のスマホのメニュー（見る画面だけ） */
const VIEW_MENU = PARENT_MENU.filter((x) => x.to !== '/catalog');

/** 保護者：全体のじゅんび度と今日のおすすめ（くわしくは進捗レベル一覧）。見る専用のスマホでは、おすすめから練習へは行かない */
function ReadinessCard({ viewOnly = false }: { viewOnly?: boolean }) {
  const data = useLive(
    async () => {
      const [attempts, practiceLogs, waitingLogs] = await Promise.all([db.attempts.toArray(), db.practiceLogs.toArray(), db.waitingLogs.toArray()]);
      const marks = markMap(await db.reviews.toArray());
      const r = computeProgress({ attempts, practiceLogs, waitingLogs, types: QUESTION_TYPES.filter((t) => isTypeActive(t, marks)) });
      return { readiness: r.readiness, exam: r.examReadiness, recs: recommendItems(r.items) };
    },
    [],
    null as null | { readiness: number; exam: number; recs: Recommendation[] }
  );
  if (!data) return null;
  const pct = Math.round(data.readiness * 100);
  const go = (r: Recommendation) => {
    const it = r.item;
    if (viewOnly) navigate('/progress');
    else if (it.kind === 'practice' && it.practiceItemId) navigate(`/log?item=${it.practiceItemId}`);
    else if (it.moduleId) navigate(`/setup?m=${it.moduleId}${it.typeId && it.kind === 'type' ? `&types=${it.typeId}` : ''}`);
    else navigate('/progress');
  };
  return (
    <section className="card" style={{ margin: '16px 16px 0', borderColor: 'var(--parent-line)' }}>
      <div className="between">
        <span className="h2">じゅんび度</span>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/progress')}>
          進捗レベル一覧
          <Icon name="right" size={16} />
        </button>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <b style={{ fontSize: 30, color: pct >= TARGET_READINESS * 100 ? 'var(--good)' : 'var(--parent)' }}>{pct}%</b>
        <span className="small muted">目標 {Math.round(TARGET_READINESS * 100)}%　本番で出た項目 {Math.round(data.exam * 100)}%</span>
      </div>
      <div className="bar" style={{ marginTop: 6 }} role="img" aria-label={`じゅんび度 ${pct}%`}>
        <div style={{ width: `${pct}%` }} />
        <span style={{ position: 'absolute', left: `${TARGET_READINESS * 100}%`, top: -2, bottom: -2, width: 2, background: 'var(--ink)' }} />
      </div>
      {data.recs.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          <span className="small muted">きょうの おすすめ</span>
          {data.recs.map((r) => (
            <button
              key={r.item.id}
              onClick={() => go(r)}
              className="row"
              style={{ width: '100%', textAlign: 'left', background: 'var(--parent-bg)', border: 0, borderRadius: 12, padding: '8px 10px' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{r.item.name}</div>
                <div className="tiny muted">{r.reason}</div>
              </span>
              <Icon name="right" size={16} style={{ color: 'var(--parent)' }} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function Home() {
  const { settings } = useSettings();
  const { isParent } = useMode();
  // 見る専用のスマホ：記録を見るメニューを出す。タイルの練習は おためし（ホームにもどったら、その記録を消す）
  const { viewOnly } = useSyncStatus();
  useEffect(() => {
    if (viewOnly) void clearTrials();
  }, [viewOnly]);
  const mySets = useLive(() => db.mySets.toArray(), [], [] as MySet[]);
  // うたと え：かいた え の まい数と、うたった かい数
  const works = useLive(
    async () => {
      const [drawings, songs] = await Promise.all([db.drawings.count(), db.attempts.where('moduleId').equals('uta').count()]);
      return { drawings, songs };
    },
    [],
    { drawings: 0, songs: 0 }
  );
  const waits = useLive(() => db.waitingLogs.toArray(), [], [] as WaitingLog[]);
  const todayMin = useLive(
    async () => {
      const today = dayKey(new Date());
      const ss = await db.sessions.where('startedAt').above(new Date(Date.now() - 2 * 86400000).toISOString()).toArray();
      let ms = 0;
      for (const s of ss) {
        if (!s.endedAt || dayKey(s.startedAt) !== today) continue;
        ms += Math.max(0, Math.min(new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime(), 60 * 60000));
      }
      return Math.round(ms / 60000);
    },
    [],
    0
  );
  const exam = examDateLabel(settings.examDate);
  const stampedToday = useLive(
    async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const iso = start.toISOString();
      const [a, w, p] = await Promise.all([
        db.attempts.where('createdAt').aboveOrEqual(iso).count(),
        db.waitingLogs.where('createdAt').aboveOrEqual(iso).count(),
        db.practiceLogs.where('createdAt').aboveOrEqual(iso).count()
      ]);
      return a + w + p > 0;
    },
    [],
    false
  );

  const countFor = (m: ModuleDef) => (m.id === 'taiki' ? nextTaikiMinutes(waits) : m.defaultCount);
  const startOne = (m: ModuleDef) => startPlan({ items: [{ moduleId: m.id, count: countFor(m) }], label: m.name });

  return (
    <div className="screen">
      <Header />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">
          {viewOnly ? `${settings.childName ? `${settings.childName}さんの ` : ''}きろく` : `${settings.childName ? `${settings.childName}さん、` : ''}きょうも がんばろう`}
        </h1>
        <div className="small muted" style={{ marginTop: 4 }}>
          しけんは {exam.kana}
          {todayMin > 0 && <span>　きょう {todayMin}ぷん れんしゅうしました</span>}
        </div>
        {viewOnly && (
          <div className="card" style={{ marginTop: 10, padding: '10px 12px', background: 'var(--parent-bg)', borderColor: 'var(--parent-line)' }}>
            <div className="small" style={{ fontWeight: 900, color: 'var(--parent)' }}>見る専用のスマホ</div>
            <div className="tiny muted" style={{ marginTop: 2, lineHeight: 1.6, fontWeight: 500 }}>
              共有している記録を見るためのスマホです。下のタイルは おためしで できます（記録に残りません）。
            </div>
          </div>
        )}
        <button
          onClick={() => navigate('/calendar')}
          className="row"
          style={{ width: '100%', marginTop: 10, padding: '8px 12px', borderRadius: 16, border: '1px solid var(--line)', background: '#fff', textAlign: 'left' }}
        >
          <Icon name="calendar" size={24} style={{ color: '#d0453a' }} />
          <span style={{ flex: 1, fontWeight: 900, whiteSpace: 'nowrap' }}>カレンダー</span>
          {stampedToday ? (
            <span className="row small" style={{ gap: 6 }}>
              きょうの スタンプ
              <Stamp day={dayKey(new Date())} />
            </span>
          ) : (
            <span className="small muted">きょうは まだ</span>
          )}
          <Icon name="right" size={18} style={{ color: 'var(--faint)' }} />
        </button>
        <button
          onClick={() => navigate('/works')}
          className="row"
          style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 16, border: '1px solid var(--line)', background: '#fff', textAlign: 'left' }}
        >
          <Emoji char="🎨" size={22} />
          <span style={{ flex: 1, fontWeight: 900, whiteSpace: 'nowrap' }}>うたと え</span>
          <span className="small muted">
            え {works.drawings}まい・うた {works.songs}かい
          </span>
          <Icon name="right" size={18} style={{ color: 'var(--faint)' }} />
        </button>
      </div>

      {viewOnly && (
        <div className="tiny pad" style={{ marginTop: 14, fontWeight: 700, color: 'var(--parent)' }}>
          おためし：タイルから問題をためせます。やった結果は記録に残りません。
        </div>
      )}
      <div className="tiles">
        {MODULES.map((m) => (
          <button key={m.id} className="tile" style={{ background: m.color.bg, boxShadow: `0 4px 0 ${m.color.shadow}` }} onClick={() => startOne(m)}>
            <span className="tile-icon" style={{ color: m.color.icon }}>
              <Icon name={m.icon} size={26} />
            </span>
            <span style={{ minWidth: 0 }}>
              <div className="tile-name" style={{ color: m.color.ink }}>
                {m.name}
              </div>
              <div className="tile-sub">{m.sub}</div>
            </span>
          </button>
        ))}
      </div>

      <div className="pad row" style={{ marginTop: 14, gap: 10 }}>
        <button className="btn btn-primary btn-big" style={{ flex: 1 }} onClick={async () => startPlan(await omakasePlan())}>
          <Icon name="sparkle" size={24} />
          おまかせ
        </button>
        <button className="btn btn-outline btn-big" style={{ flex: 1, fontSize: 18 }} onClick={() => navigate('/setup')}>
          <Icon name="list" size={22} />
          えらんで
        </button>
      </div>

      {mySets.length > 0 && (
        <>
          <h2 className="section-title">マイセット</h2>
          <div className="list">
            {mySets.map((s) => (
              <div key={s.id} className="list-row">
                <IconBadge name="check" bg="#fff2c6" color="#9a6a00" size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>{s.name}</div>
                  <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {setSummary(s)}
                  </div>
                </div>
                {isParent && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/setup?set=${s.id}`)}>
                    へんしゅう
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => startPlan({ items: s.items, mySetId: s.id, label: s.name })}>
                  はじめる
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {(isParent || viewOnly) && <ReadinessCard viewOnly={viewOnly && !isParent} />}

      {(isParent || viewOnly) && (
        <>
          <h2 className="section-title">{isParent ? '保護者メニュー' : 'みる'}</h2>
          <div className="list">
            {(isParent ? PARENT_MENU : VIEW_MENU).map((x) => (
              <button
                key={x.to}
                className="list-row"
                style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid #eef1f6', textAlign: 'left', padding: '6px 0' }}
                onClick={() => navigate(x.to)}
              >
                <IconBadge name={x.icon} bg="var(--parent-soft)" color="var(--parent)" size={38} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>{x.label}</div>
                  <div className="tiny muted">{x.sub}</div>
                </span>
                <Icon name="right" size={18} style={{ color: 'var(--faint)' }} />
              </button>
            ))}
          </div>
        </>
      )}
      {!isParent && !viewOnly && (
        <p className="tiny muted pad" style={{ marginTop: 18, textAlign: 'center' }}>
          ほごしゃの かたは みぎうえを 2びょう ながおし
        </p>
      )}
    </div>
  );
}
