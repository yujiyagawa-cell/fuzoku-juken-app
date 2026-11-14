import { useMemo, useState } from 'react';
import { dayKey } from '../../core/dates';
import { db, useLive } from '../../core/db';
import { PRACTICE_ITEMS } from '../../core/practiceItems';
import { evalPracticeLogs, formatPracticeLog, TARGET_READINESS } from '../../core/progress';
import type { Attempt, Judge, KanaSeed, PracticeLog, WaitingLog } from '../../core/types';
import { computeWeakKana } from '../../core/weakKana';
import { MODULES, moduleById, typeById } from '../../modules/registry';
import { overrideJudge } from '../../player/session';
import { JudgeButtons, JudgeMark, Modal, Seg } from '../../ui/components';
import { navigate } from '../../ui/router';
import { LineChart, WaitBars, type Pt } from './charts';
import { ChipButtons, Empty, fmtMD, fmtMDHM, LevelBadge, ParentScreen, pct, SectionTitle } from './parentParts';

// 記録：正答率・回答秒数の推移、苦手な音、正答率の低い問題、待機練習、運動・生活ログの最新値、最近の記録（判定の上書き）

type Period = 7 | 14 | 30;

function daysBack(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({ key: dayKey(d), label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

function latencySec(a: Attempt): number | undefined {
  if (a.latencyMs === undefined || a.latencyMs === null || Number.isNaN(a.latencyMs)) return undefined;
  return a.latencyMs / 1000;
}

const JUDGE_TEXT: Record<Judge, string> = { correct: '○ 正解', wrong: '× ちがう', unknown: '？ わからない・時間切れ' };

export function AttemptDetail({ a, onClose }: { a: Attempt; onClose: () => void }) {
  const t = typeById(a.questionType);
  const m = moduleById(a.moduleId);
  const [j, setJ] = useState<Judge>(a.finalJudge);
  const rows: [string, string | undefined][] = [
    ['日時', fmtMDHM(a.createdAt)],
    ['練習', m?.label ?? a.moduleId],
    ['問題', t?.name ?? a.questionType],
    ['問題文', a.prompt],
    ['聞こえた言葉', a.transcript ? `「${a.transcript}」` : undefined],
    ['ほかの候補', a.alternatives && a.alternatives.length > 1 ? a.alternatives.slice(1).join('／') : undefined],
    ['判定に使った読み', a.matched],
    ['えらんだ', a.tappedChoice],
    ['正解', a.correctChoice],
    ['回答秒数', latencySec(a) !== undefined ? `${latencySec(a)!.toFixed(1)}秒（${a.latencySource ?? ''}）` : a.meta?.timedOut ? '時間切れ' : undefined],
    ['自動判定', a.autoJudge ? JUDGE_TEXT[a.autoJudge] : undefined],
    ['保護者の判定', a.parentJudge ? JUDGE_TEXT[a.parentJudge] : undefined],
    [
      'チェック',
      a.parentChecks
        ? [a.parentChecks.immediate ? '即答' : '', a.parentChecks.reason ? '理由あり' : '', a.parentChecks.keigo ? '敬語' : ''].filter(Boolean).join('・') || 'なし'
        : undefined
    ]
  ];
  return (
    <Modal open onClose={onClose} title="記録の中身">
      <div className="stack" style={{ gap: 6 }}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="row" style={{ alignItems: 'baseline', gap: 8, fontSize: 13 }}>
              <span className="tiny muted" style={{ minWidth: 86, flexShrink: 0 }}>
                {k}
              </span>
              <span style={{ fontWeight: 700, overflowWrap: 'anywhere', minWidth: 0 }}>{v}</span>
            </div>
          ))}
        <div className="tiny muted" style={{ marginTop: 8 }}>
          判定を直す（最終判定になります）
        </div>
        <JudgeButtons
          value={j}
          onChange={(x) => {
            setJ(x);
            overrideJudge(a.id, x);
          }}
        />
        <button className="btn btn-ghost" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Modal>
  );
}

export function RecordsScreen() {
  const attempts = useLive(() => db.attempts.toArray(), [], [] as Attempt[]);
  const waitingLogs = useLive(() => db.waitingLogs.toArray(), [], [] as WaitingLog[]);
  const practiceLogs = useLive(() => db.practiceLogs.toArray(), [], [] as PracticeLog[]);
  const seeds = useLive(() => db.kanaSeeds.toArray(), [], [] as KanaSeed[]);
  const [period, setPeriod] = useState<Period>(14);
  const [mod, setMod] = useState<string>('all');
  const [open, setOpen] = useState<Attempt | null>(null);

  const days = useMemo(() => daysBack(period), [period]);
  const startKey = days[0].key;
  const inPeriod = useMemo(() => attempts.filter((a) => dayKey(a.createdAt) >= startKey), [attempts, startKey]);

  const byDay = (list: Attempt[]) => {
    const m = new Map<string, Attempt[]>();
    for (const a of list) {
      const k = dayKey(a.createdAt);
      const l = m.get(k);
      if (l) l.push(a);
      else m.set(k, [a]);
    }
    return m;
  };

  const overall = useMemo(() => {
    const m = byDay(inPeriod);
    const pts: Pt[] = days.map((d) => {
      const l = m.get(d.key) ?? [];
      return { label: d.label, value: l.length ? l.filter((a) => a.finalJudge === 'correct').length / l.length : null, n: l.length };
    });
    const n = inPeriod.length;
    const acc = n ? inPeriod.filter((a) => a.finalJudge === 'correct').length / n : 0;
    return { pts, n, acc };
  }, [inPeriod, days]);

  const modulesWithData = useMemo(() => MODULES.filter((m) => inPeriod.some((a) => a.moduleId === m.id)), [inPeriod]);

  const modSeries = useMemo(() => {
    const list = mod === 'all' ? inPeriod : inPeriod.filter((a) => a.moduleId === mod);
    const m = byDay(list);
    const acc: Pt[] = [];
    const lat: Pt[] = [];
    for (const d of days) {
      const l = m.get(d.key) ?? [];
      acc.push({ label: d.label, value: l.length ? l.filter((a) => a.finalJudge === 'correct').length / l.length : null });
      const ls = l.map(latencySec).filter((x): x is number => x !== undefined);
      lat.push({ label: d.label, value: ls.length ? (mean(ls) as number) : null });
    }
    const latMax = Math.max(5, Math.ceil(Math.max(0, ...lat.map((p) => p.value ?? 0))));
    return { acc, lat, latMax };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPeriod, mod, days]);

  const moduleTable = useMemo(
    () =>
      MODULES.map((m) => {
        const l = inPeriod.filter((a) => a.moduleId === m.id);
        const ls = l.map(latencySec).filter((x): x is number => x !== undefined);
        return { m, n: l.length, acc: l.length ? l.filter((a) => a.finalJudge === 'correct').length / l.length : 0, lat: mean(ls) };
      }).filter((r) => r.n > 0),
    [inPeriod]
  );

  const weak = useMemo(() => computeWeakKana(attempts, seeds), [attempts, seeds]);
  const weakNow = weak.filter((r) => r.weak);
  const cleared = weak.filter((r) => !r.weak && r.tries > 0 && (r.misses > 0 || r.fromNote));

  const lowTypes = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of inPeriod) {
      const l = m.get(a.questionType);
      if (l) l.push(a);
      else m.set(a.questionType, [a]);
    }
    return [...m.entries()]
      .filter(([, l]) => l.length >= 3)
      .map(([id, l]) => ({ id, n: l.length, acc: l.filter((a) => a.finalJudge === 'correct').length / l.length, t: typeById(id) }))
      .sort((a, b) => a.acc - b.acc || b.n - a.n)
      .slice(0, 5);
  }, [inPeriod]);

  const waitBars = useMemo(
    () =>
      waitingLogs
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-12)
        .map((l) => ({ label: fmtMD(l.createdAt), minutes: l.durationMin, success: l.success })),
    [waitingLogs]
  );

  const practiceLatest = useMemo(
    () =>
      PRACTICE_ITEMS.map((p) => {
        const logs = practiceLogs.filter((l) => l.itemId === p.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (!logs.length) return null;
        const last = logs[logs.length - 1];
        return { p, last, ev: evalPracticeLogs(p, logs), n: logs.length };
      }).filter((x): x is NonNullable<typeof x> => !!x),
    [practiceLogs]
  );

  const recent = useMemo(() => attempts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40), [attempts]);

  const modOptions = [{ v: 'all', label: 'ぜんぶ' }, ...modulesWithData.map((m) => ({ v: m.id, label: m.name }))];

  return (
    <ParentScreen title="記録" sub="正答率と回答秒数の推移、苦手な音や問題、待機練習と運動・生活ログの記録。">
      <div className="pad" style={{ marginTop: 12 }}>
        <Seg
          options={[
            { v: 7 as Period, label: '7日' },
            { v: 14 as Period, label: '14日' },
            { v: 30 as Period, label: '30日' }
          ]}
          value={period}
          onChange={setPeriod}
          label="期間"
        />
      </div>

      <SectionTitle right={<span className="small">{overall.n ? `${pct(overall.acc)}（${overall.n}問）` : ''}</span>}>総合の正答率</SectionTitle>
      {overall.n ? (
        <div className="card" style={{ margin: '0 16px', padding: '10px 8px' }}>
          <LineChart
            points={overall.pts}
            max={1}
            target={TARGET_READINESS}
            targetLabel="目標 60%"
            format={(v) => pct(v)}
            ariaLabel={`日ごとの総合正答率。期間全体で${pct(overall.acc)}`}
          />
        </div>
      ) : (
        <Empty>この期間の記録はまだありません</Empty>
      )}

      {overall.n > 0 && (
        <>
          <SectionTitle>練習ごとの推移</SectionTitle>
          <div className="pad" style={{ marginBottom: 8 }}>
            <ChipButtons options={modOptions} value={mod} onChange={setMod} label="練習をえらぶ" />
          </div>
          <div className="card" style={{ margin: '0 16px', padding: '10px 8px' }}>
            <div className="tiny muted" style={{ margin: '0 8px 2px' }}>
              正答率
            </div>
            <LineChart points={modSeries.acc} max={1} target={TARGET_READINESS} targetLabel="目標 60%" format={(v) => pct(v)} ariaLabel="日ごとの正答率" />
            <div className="tiny muted" style={{ margin: '10px 8px 2px' }}>
              平均の回答秒数（短いほど速い）
            </div>
            <LineChart points={modSeries.lat} max={modSeries.latMax} format={(v) => `${v.toFixed(v >= 10 ? 0 : 1)}秒`} color="#c2531f" ariaLabel="日ごとの平均回答秒数" />
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {moduleTable.map((r) => (
              <div key={r.m.id} className="list-row">
                <span style={{ flex: 1, fontWeight: 900, fontSize: 14 }}>{r.m.label}</span>
                <span className="small" style={{ minWidth: 48, textAlign: 'right' }}>
                  {pct(r.acc)}
                </span>
                <span className="tiny muted" style={{ minWidth: 40, textAlign: 'right' }}>
                  {r.n}問
                </span>
                <span className="tiny muted" style={{ minWidth: 44, textAlign: 'right' }}>
                  {r.lat !== undefined ? `${r.lat.toFixed(1)}秒` : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle right={<span className="tiny muted">×か？、5秒をこえたら苦手。3回つづけて○（3秒以内）で外れる</span>}>苦手な音</SectionTitle>
      <div className="card" style={{ margin: '0 16px' }}>
        {weakNow.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {weakNow.map((r) => (
              <span key={r.key} className="chip chip-warn" title={r.fromNote ? 'ノートで×' : ''}>
                「{r.kana}」{r.length}文字
                <span style={{ fontWeight: 700, opacity: 0.8 }}>
                  {r.tries ? ` ${r.tries - r.misses}/${r.tries}` : ''}
                  {r.fromNote ? '・ノート' : ''}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="small muted">いまは苦手な音はありません</span>
        )}
        {cleared.length > 0 && (
          <div className="small" style={{ marginTop: 10, color: 'var(--good)' }}>
            苦手でなくなった音：{cleared.map((r) => `「${r.kana}」${r.length}`).join('・')}
          </div>
        )}
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/setup?m=kotoba&types=kotoba-2,kotoba-3')}>
          ことばを練習する
        </button>
      </div>

      <SectionTitle>正答率の低い問題（3問以上）</SectionTitle>
      {lowTypes.length ? (
        <div className="list">
          {lowTypes.map((r) => (
            <div key={r.id} className="list-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{r.t?.name ?? r.id}</div>
                <div className="tiny muted">
                  {pct(r.acc)}（{r.n}問）
                </div>
              </div>
              {r.t && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/setup?m=${r.t!.moduleId}&types=${r.id}`)}>
                  練習
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty>3問以上ある問題がまだありません</Empty>
      )}

      <SectionTitle right={<span className="tiny muted">塗り＝成功／点線＝失敗</span>}>待機練習</SectionTitle>
      {waitBars.length ? (
        <div className="card" style={{ margin: '0 16px', padding: '10px 8px' }}>
          <WaitBars bars={waitBars} />
        </div>
      ) : (
        <Empty>まだ記録がありません</Empty>
      )}

      <SectionTitle right={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/log')}>ログへ</button>}>運動・生活ログ（最新）</SectionTitle>
      {practiceLatest.length ? (
        <div className="list">
          {practiceLatest.map(({ p, last, ev, n }) => (
            <div key={p.id} className="list-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{p.name}</div>
                <div className="tiny muted">
                  {fmtMD(last.createdAt)}　{formatPracticeLog(p, last) || '記録'}（{n}回）
                </div>
              </div>
              <LevelBadge level={ev.level} short />
            </div>
          ))}
        </div>
      ) : (
        <Empty>まだ記録がありません</Empty>
      )}

      <SectionTitle right={<span className="tiny muted">タップで中身・判定を直す</span>}>最近の記録</SectionTitle>
      {recent.length ? (
        <div className="list">
          {recent.map((a) => {
            const t = typeById(a.questionType);
            return (
              <button
                key={a.id}
                className="list-row"
                onClick={() => setOpen(a)}
                style={{ width: '100%', background: 'transparent', border: 0, borderBottom: '1px solid #eef1f6', textAlign: 'left', color: 'inherit' }}
              >
                <span style={{ width: 22, textAlign: 'center' }}>
                  <JudgeMark judge={a.finalJudge} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>
                    {t?.name ?? a.questionType}
                    {a.parentJudge && <span className="tiny" style={{ color: 'var(--parent)', marginLeft: 6 }}>保護者判定</span>}
                  </div>
                  <div className="tiny muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.transcript ? `「${a.transcript}」 ` : ''}
                    {a.prompt}
                  </div>
                </div>
                <span className="tiny muted" style={{ flexShrink: 0 }}>
                  {fmtMDHM(a.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty>まだ記録がありません</Empty>
      )}

      {open && <AttemptDetail a={attempts.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </ParentScreen>
  );
}
