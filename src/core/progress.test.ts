import { describe, expect, it } from 'vitest';
import type { QuestionType } from '../player/types';
import type { PracticeItem } from './practiceItems';
import {
  computeProgress,
  daysSince,
  evalPracticeLogs,
  evalTypeAttempts,
  evalWaitingLogs,
  readinessOf,
  recommendItems,
  type ProgressItem,
  type ProgressResult
} from './progress';
import type { Attempt, Judge, PracticeLog, WaitingLog } from './types';

const T = (id: string, over: Partial<QuestionType> = {}): QuestionType => ({
  id,
  name: id,
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート',
  description: '',
  priority: 2,
  answer: 'tap',
  ...over
});

let seq = 0;
/** day = 2026年11月の日（日本時間の昼）。同じ日の中は作った順に並ぶ */
function at(day: number): string {
  seq++;
  return new Date(Date.UTC(2026, 10, day, 3, 0, 0) + seq * 1000).toISOString();
}

function att(type: string, judge: Judge, opts: { day?: number; ms?: number } = {}): Attempt {
  return {
    id: `a${seq + 1}`,
    sessionId: 's',
    moduleId: 'zukei',
    questionType: type,
    prompt: '',
    answerMode: 'tap',
    finalJudge: judge,
    latencyMs: opts.ms,
    createdAt: at(opts.day ?? 1)
  };
}

const many = (type: string, judges: Judge[], opts: { day?: number; ms?: number } = {}) => judges.map((j) => att(type, j, opts));
const C = 'correct' as const;
const W = 'wrong' as const;
const U = 'unknown' as const;

function run(types: QuestionType[], attempts: Attempt[] = [], extra: Partial<Parameters<typeof computeProgress>[0]> = {}): ProgressResult {
  return computeProgress({ attempts, practiceLogs: [], waitingLogs: [], types, practiceItems: [], ...extra });
}
const item = (r: ProgressResult, id: string): ProgressItem => {
  const x = r.items.find((i) => i.id === id);
  if (!x) throw new Error(`no item ${id}`);
  return x;
};

describe('アプリの項目（問題タイプ）', () => {
  it('記録なしは Lv0', () => {
    const r = run([T('x')]);
    expect(item(r, 'type:x').level).toBe(0);
    expect(item(r, 'type:x').metric).toBe('記録なし');
  });

  it('正答率50%未満は Lv1', () => {
    expect(evalTypeAttempts(many('x', [C, C, W, W, U])).level).toBe(1);
  });

  it('ちょうど50%は Lv2', () => {
    expect(evalTypeAttempts(many('x', [C, W, C, W, C, W, C, W, C, W])).level).toBe(2);
  });

  it('80%以上でも5回未満は Lv2', () => {
    const e = evalTypeAttempts(many('x', [C, C, C, C]));
    expect(e.level).toBe(2);
    expect(e.next).toContain('あと1回');
  });

  it('80%・5回で Lv3（さいご3回が続けて正解でない）', () => {
    const e = evalTypeAttempts(many('x', [C, C, W, C, C], { day: 1 }).concat(), undefined);
    expect(e.accuracy).toBeCloseTo(0.8);
    expect(e.level).toBe(3);
  });

  it('全部正解でも1日だけなら Lv3', () => {
    const e = evalTypeAttempts(many('x', [C, C, C, C, C], { day: 1 }));
    expect(e.level).toBe(3);
    expect(e.next).toContain('2日以上');
  });

  it('2日・さいご3回正解・目標秒数以内で Lv4', () => {
    const list = [...many('x', [C, C, C], { day: 1, ms: 2000 }), ...many('x', [C, C, C], { day: 2, ms: 2500 })];
    expect(evalTypeAttempts(list, 3).level).toBe(4);
    expect(evalTypeAttempts(list, 3).medianSec).toBeCloseTo(2.25);
    // 目標が 2秒なら中央値 2.25秒で届かない
    const e = evalTypeAttempts(list, 2);
    expect(e.level).toBe(3);
    expect(e.next).toContain('2秒以内');
  });

  it('目標秒数があるのに回答秒数の記録がなければ Lv3 のまま', () => {
    const list = [...many('x', [C, C, C], { day: 1 }), ...many('x', [C, C, C], { day: 2 })];
    const e = evalTypeAttempts(list, 3);
    expect(e.level).toBe(3);
    expect(e.next).toContain('記録がまだ');
  });

  it('最近10回だけを見る（古いまちがいは数えない）', () => {
    const list = [...many('x', Array(10).fill(W), { day: 1 }), ...many('x', Array(5).fill(C), { day: 2 }), ...many('x', Array(5).fill(C), { day: 3 })];
    const e = evalTypeAttempts(list);
    expect(e.recentCount).toBe(10);
    expect(e.level).toBe(4);
  });

  it('computeProgress はタイプごとに分けて数える', () => {
    const r = run([T('x'), T('y')], [...many('x', [W, W, W]), ...many('y', [C, C, C, C, C])]);
    expect(item(r, 'type:x').level).toBe(1);
    expect(item(r, 'type:y').level).toBe(3);
    expect(item(r, 'type:y').count).toBe(5);
  });
});

describe('待機練習', () => {
  const taiki = T('taiki-wait', { moduleId: 'taiki', genre: 'taiki', source: '本番', priority: 3, answer: 'parent' });
  let n = 0;
  const wl = (durationMin: number, success: boolean): WaitingLog => ({
    id: `w${++n}`,
    durationMin,
    elapsedSec: durationMin * 60,
    counts: {},
    success,
    completed: true,
    createdAt: at(5)
  });

  it('記録なしは Lv0', () => {
    expect(evalWaitingLogs([]).level).toBe(0);
    const r = run([taiki]);
    expect(item(r, 'waiting:taiki-wait').kind).toBe('waiting');
    expect(item(r, 'waiting:taiki-wait').level).toBe(0);
  });
  it('失敗だけなら Lv1', () => expect(evalWaitingLogs([wl(5, false)]).level).toBe(1));
  it('5分成功で Lv2', () => expect(evalWaitingLogs([wl(5, true)]).level).toBe(2));
  it('10分成功で Lv3', () => expect(evalWaitingLogs([wl(5, true), wl(10, true)]).level).toBe(3));
  it('15分成功も Lv3', () => expect(evalWaitingLogs([wl(15, true)]).level).toBe(3));
  it('20分成功で Lv4（そのあと失敗しても最長で見る）', () => expect(evalWaitingLogs([wl(20, true), wl(5, false)]).level).toBe(4));
  it('waitingLogs が computeProgress に入る', () => {
    const r = run([taiki], [], { waitingLogs: [wl(10, true)] });
    expect(item(r, 'waiting:taiki-wait').level).toBe(3);
  });
});

describe('練習ログ（運動・生活）', () => {
  const P = (id: string, fields: PracticeItem['fields'], priority: 1 | 2 | 3 = 2): PracticeItem => ({ id, name: id, genre: 'seikatsu', source: 'ノート', priority, fields });
  const zoukin = P('zoukin', { ok: true });
  const origami = P('origami', { ok: true, quality: true });
  const dango = P('dango', { seconds: { better: 'higher', target: 10 } });
  const kuma = P('kuma', { seconds: { better: 'lower' }, count: { label: '転んだ回数', failure: true } });
  let n = 0;
  const lg = (itemId: string, f: Partial<PracticeLog>): PracticeLog => ({ id: `p${++n}`, itemId, createdAt: at(7), ...f });

  it('○×の項目', () => {
    expect(evalPracticeLogs(zoukin, []).level).toBe(0);
    expect(evalPracticeLogs(zoukin, [lg('zoukin', { ok: false })]).level).toBe(1);
    expect(evalPracticeLogs(zoukin, [lg('zoukin', { ok: true }), lg('zoukin', { ok: false })]).level).toBe(2);
    expect(evalPracticeLogs(zoukin, [lg('zoukin', { ok: false }), lg('zoukin', { ok: true }), lg('zoukin', { ok: true })]).level).toBe(3);
    expect(evalPracticeLogs(zoukin, [lg('zoukin', { ok: true }), lg('zoukin', { ok: true }), lg('zoukin', { ok: true })]).level).toBe(4);
  });

  it('きれいさがある項目は ★3 で Lv4', () => {
    const q2 = [1, 2, 3].map(() => lg('origami', { ok: true, quality: 2 }));
    expect(evalPracticeLogs(origami, q2).level).toBe(3);
    const q3 = [lg('origami', { ok: true, quality: 2 }), lg('origami', { ok: true, quality: 3 }), lg('origami', { ok: true, quality: 3 })];
    expect(evalPracticeLogs(origami, q3).level).toBe(4);
  });

  it('秒の目標（長いほどよい）', () => {
    expect(evalPracticeLogs(dango, [lg('dango', { seconds: 8 })]).level).toBe(1);
    expect(evalPracticeLogs(dango, [lg('dango', { seconds: 8 }), lg('dango', { seconds: 12 })]).level).toBe(2);
    expect(evalPracticeLogs(dango, [lg('dango', { seconds: 12 }), lg('dango', { seconds: 12 }), lg('dango', { seconds: 9 })]).level).toBe(2);
    expect(evalPracticeLogs(dango, [lg('dango', { seconds: 11 }), lg('dango', { seconds: 12 }), lg('dango', { seconds: 10 })]).level).toBe(4);
  });

  it('失敗の回数（転んだ）は 0回で成功', () => {
    expect(evalPracticeLogs(kuma, [lg('kuma', { seconds: 20, count: 1 })]).level).toBe(1);
    expect(evalPracticeLogs(kuma, [lg('kuma', { seconds: 20, count: 1 }), lg('kuma', { seconds: 18, count: 0 })]).level).toBe(2);
  });

  it('computeProgress に練習ログが入る', () => {
    const r = run([], [], { practiceItems: [zoukin], practiceLogs: [lg('zoukin', { ok: true }), lg('zoukin', { ok: true })] });
    expect(item(r, 'practice:zoukin').level).toBe(3);
    expect(item(r, 'practice:zoukin').metric).toContain('○');
  });
});

describe('じゅんび度（重みづけ）', () => {
  it('priority で重みをつける', () => {
    const a = T('a', { priority: 3, source: '本番' });
    const b = T('b', { priority: 1, source: 'ノート（予想）' });
    const list = [...many('a', [C, C, C], { day: 1 }), ...many('a', [C, C, C], { day: 2 })];
    const r = run([a, b], list);
    expect(item(r, 'type:a').level).toBe(4);
    expect(item(r, 'type:b').level).toBe(0);
    expect(r.readiness).toBeCloseTo((3 * 1 + 1 * 0) / 4);
    expect(r.examReadiness).toBeCloseTo(1);
    expect(r.counts[4]).toBe(1);
    expect(r.counts[0]).toBe(1);
  });

  it('ジャンルごとのじゅんび度', () => {
    const a = T('a', { genre: 'kotoba', moduleId: 'kotoba', priority: 2 });
    const r = run([a], many('a', [C, W, C, W]));
    expect(r.byGenre.kotoba.items.length).toBe(1);
    expect(r.byGenre.kotoba.readiness).toBeCloseTo(2 / 4);
    expect(r.byGenre.uta.items.length).toBe(0);
    expect(r.byGenre.uta.readiness).toBe(0);
  });

  it('readinessOf は空なら 0', () => expect(readinessOf([])).toBe(0));
});

describe('今日のおすすめ', () => {
  const mk = (id: string, level: 0 | 1 | 2 | 3 | 4, priority: 1 | 2 | 3, genre: ProgressItem['genre'], lastAt?: string): ProgressItem => ({
    id,
    kind: 'type',
    name: id,
    genre,
    source: priority === 3 ? '本番' : 'ノート',
    priority,
    level,
    metric: '',
    count: 0,
    lastAt
  });
  const now = new Date(2026, 10, 14, 12);

  it('Lv4 は出さず、priority が高く Lv が低いものから。ジャンルは重ならない', () => {
    const items = [
      mk('done', 4, 3, 'uta'),
      mk('high-low', 1, 3, 'zukei', new Date(2026, 10, 14).toISOString()),
      mk('high-low2', 1, 3, 'zukei', new Date(2026, 10, 14).toISOString()),
      mk('mid', 2, 2, 'kotoba', new Date(2026, 10, 14).toISOString()),
      mk('low', 0, 1, 'undo')
    ];
    const rec = recommendItems(items, now, 3).map((r) => r.item.id);
    expect(rec).not.toContain('done');
    expect(rec[0]).toBe('high-low');
    expect(rec).not.toContain('high-low2');
    expect(rec.length).toBe(3);
  });

  it('daysSince', () => {
    expect(daysSince(undefined, now)).toBeUndefined();
    expect(daysSince(new Date(2026, 10, 11, 20).toISOString(), now)).toBe(3);
  });
});
