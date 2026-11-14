import type { QuestionType } from '../player/types';
import { GENRES } from './genres';
import { PRACTICE_ITEMS, type PracticeItem } from './practiceItems';
import type { Attempt, GenreId, PracticeLog, WaitingLog } from './types';

// 進捗（レベル）の計算。
// - アプリの項目（問題タイプごと）：子どもが解いた最近10回の正答率・回答の速さ
// - 練習ログ（運動・生活）：保護者が記録した ○×・秒数・きれいさ
// - 待機練習：何分しずかに待てたか
// じゅんび度 = Σ(priority × level/4) ÷ Σ(priority)

export type Lv = 0 | 1 | 2 | 3 | 4;
export const LEVELS: Lv[] = [0, 1, 2, 3, 4];

export const LEVEL_LABELS: Record<Lv, string> = {
  0: 'まだ',
  1: 'れんしゅう中',
  2: 'もうすこし',
  3: 'できる',
  4: 'ばっちり'
};

/** レベルの色（文字ラベルと一緒に使う。色だけで区別させない） */
export const LEVEL_STYLE: Record<Lv, { bg: string; ink: string }> = {
  0: { bg: '#eef1f6', ink: '#4f5e74' },
  1: { bg: '#fbe9e7', ink: '#a8321f' },
  2: { bg: '#fff2c6', ink: '#6b4a00' },
  3: { bg: '#dceeff', ink: '#1d4e9e' },
  4: { bg: '#e3f3ea', ink: '#1c6a43' }
};

export const RECENT_WINDOW = 10;
export const TARGET_READINESS = 0.6; // 合格の目安は全体で6割

export type ProgressKind = 'type' | 'practice' | 'waiting';

export const LEVEL_CRITERIA: Record<ProgressKind, string[]> = {
  type: [
    'Lv0 まだ：記録なし',
    'Lv1 れんしゅう中：最近10回の正答率が50%未満',
    'Lv2 もうすこし：50〜79%（80%以上でも5回未満）',
    'Lv3 できる：80%以上・5回以上',
    'Lv4 ばっちり：Lv3 ＋ 目標の秒数以内（正解の回答秒数の中央値）・さいご3回つづけて正解・2日以上に分けて練習'
  ],
  practice: [
    'Lv0 まだ：記録なし',
    'Lv1 れんしゅう中：まだ成功なし（× か目標に届かない）',
    'Lv2 もうすこし：1回でも成功',
    'Lv3 できる：最新2回つづけて成功',
    'Lv4 ばっちり：最新3回つづけて成功（きれいさは★3、秒の目標があれば達成）'
  ],
  waiting: [
    'Lv0 まだ：記録なし',
    'Lv1 れんしゅう中：やってみた',
    'Lv2 もうすこし：5分 成功（気になる動き0回）',
    'Lv3 できる：10分 成功',
    'Lv4 ばっちり：20分 成功（本番は最長20分ほど待つ）'
  ]
};

export interface ProgressItem {
  id: string; // 'type:zukei-ferris' | 'practice:zoukin' | 'waiting:taiki-wait'
  kind: ProgressKind;
  name: string;
  genre: GenreId;
  source: string;
  priority: 1 | 2 | 3;
  level: Lv;
  metric: string; // 例「8/10 正解・3.2秒」「最新 12秒・○」
  next?: string; // 次のレベルに足りないこと
  lastAt?: string;
  count: number; // 記録の数
  moduleId?: string;
  typeId?: string;
  practiceItemId?: string;
  accuracy?: number; // 0..1（最近10回）
  medianSec?: number; // 正解の回答秒数の中央値
}

export interface ProgressInput {
  attempts: Attempt[];
  practiceLogs: PracticeLog[];
  waitingLogs: WaitingLog[];
  types: QuestionType[];
  practiceItems?: PracticeItem[]; // 省略で PRACTICE_ITEMS
}

export interface GenreProgress {
  readiness: number;
  items: ProgressItem[];
}

export interface ProgressResult {
  items: ProgressItem[];
  readiness: number; // 0..1
  examReadiness: number; // 0..1（出どころが「本番」の項目だけ）
  byGenre: Record<GenreId, GenreProgress>;
  counts: Record<Lv, number>;
}

// ---- 小物 ----

const byTime = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** その日から何日たったか（きょう＝0）。記録がなければ undefined */
export function daysSince(iso: string | undefined, now: Date = new Date()): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export function readinessOf(items: ProgressItem[]): number {
  let w = 0;
  let s = 0;
  for (const it of items) {
    w += it.priority;
    s += (it.priority * it.level) / 4;
  }
  return w ? s / w : 0;
}

// ---- アプリの項目（問題タイプ） ----

export interface TypeEval {
  level: Lv;
  metric: string;
  next?: string;
  accuracy?: number;
  medianSec?: number;
  recentCount: number;
  correctCount: number;
  days: number;
  last3: boolean;
  speedOk: boolean;
}

export function evalTypeAttempts(list: Attempt[], speedTargetSec?: number): TypeEval {
  const sorted = list.slice().sort(byTime);
  const recent = sorted.slice(-RECENT_WINDOW);
  const n = recent.length;
  const correct = recent.filter((a) => a.finalJudge === 'correct').length;
  const acc = n ? correct / n : 0;
  const lat = recent
    .filter((a) => a.finalJudge === 'correct' && typeof a.latencyMs === 'number' && !Number.isNaN(a.latencyMs))
    .map((a) => (a.latencyMs as number) / 1000);
  const med = median(lat);
  const last3 = n >= 3 && recent.slice(-3).every((a) => a.finalJudge === 'correct');
  const days = new Set(sorted.map((a) => localDayKey(a.createdAt))).size;
  const speedOk = speedTargetSec === undefined ? true : med !== undefined && med <= speedTargetSec;

  let level: Lv;
  if (n === 0) level = 0;
  else if (acc < 0.5) level = 1;
  else if (acc < 0.8 || n < 5) level = 2;
  else level = speedOk && last3 && days >= 2 ? 4 : 3;

  const metric = n ? `${correct}/${n} 正解${med !== undefined ? `・${med.toFixed(1)}秒` : ''}` : '記録なし';

  let next: string | undefined;
  if (level === 0) next = 'まず1回やってみる';
  else if (level === 1) next = '最近10回の正答率を50%以上に';
  else if (level === 2) next = acc >= 0.8 && n < 5 ? `あと${5 - n}回やると Lv3（正答率80%以上のまま）` : '最近10回の正答率を80%以上に';
  else if (level === 3) {
    const need: string[] = [];
    if (!speedOk && speedTargetSec !== undefined) {
      need.push(med === undefined ? `回答の秒数の記録がまだ（目標${speedTargetSec}秒以内）` : `回答を${speedTargetSec}秒以内に（いま${med.toFixed(1)}秒）`);
    }
    if (!last3) need.push('さいご3回つづけて正解');
    if (days < 2) need.push('2日以上に分けて練習');
    next = `${need.join('・')} で Lv4`;
  }

  return { level, metric, next, accuracy: n ? acc : undefined, medianSec: med, recentCount: n, correctCount: correct, days, last3, speedOk };
}

// ---- 練習ログ（運動・生活） ----

function meetsTarget(item: PracticeItem, seconds: number): boolean {
  const s = item.fields.seconds;
  if (!s || s.target === undefined) return true;
  return s.better === 'higher' ? seconds >= s.target : seconds <= s.target;
}

/** 1回の記録が「成功」か。判断できる材料がなければ「やった」＝成功 */
export function practiceLogSuccess(item: PracticeItem, log: PracticeLog): boolean {
  const checks: boolean[] = [];
  const f = item.fields;
  if (f.ok && log.ok !== undefined) checks.push(log.ok);
  if (f.seconds?.target !== undefined && log.seconds !== undefined) checks.push(meetsTarget(item, log.seconds));
  if (f.count?.failure && log.count !== undefined) checks.push(log.count === 0);
  if (f.quality && !f.ok && log.quality !== undefined) checks.push(log.quality >= 2);
  return checks.length ? checks.every(Boolean) : true;
}

export function formatPracticeLog(item: PracticeItem, log: PracticeLog): string {
  const parts: string[] = [];
  if (log.seconds !== undefined) parts.push(`${Number.isInteger(log.seconds) ? log.seconds : log.seconds.toFixed(1)}秒`);
  if (log.ok !== undefined) parts.push(log.ok ? '○' : '×');
  if (log.quality !== undefined) parts.push(`きれいさ${'★'.repeat(log.quality)}${'☆'.repeat(3 - log.quality)}`);
  if (log.count !== undefined && item.fields.count) parts.push(`${item.fields.count.label}${log.count}`);
  return parts.join('・');
}

export interface PracticeEval {
  level: Lv;
  metric: string;
  next?: string;
  flags: boolean[];
}

export function evalPracticeLogs(item: PracticeItem, logs: PracticeLog[]): PracticeEval {
  const sorted = logs.slice().sort(byTime);
  if (!sorted.length) return { level: 0, metric: '記録なし', next: '記録してみる', flags: [] };
  const flags = sorted.map((l) => practiceLogSuccess(item, l));
  const latest = sorted[sorted.length - 1];
  const any = flags.some(Boolean);
  const last2 = flags.length >= 2 && flags.slice(-2).every(Boolean);
  const last3 = flags.length >= 3 && flags.slice(-3).every(Boolean);
  const qualityOk = !item.fields.quality || latest.quality === 3;
  const target = item.fields.seconds?.target;
  const targetOk = target === undefined || (latest.seconds !== undefined && meetsTarget(item, latest.seconds));

  let level: Lv;
  if (!any) level = 1;
  else if (!last2) level = 2;
  else level = last3 && qualityOk && targetOk ? 4 : 3;

  const shown = formatPracticeLog(item, latest);
  const metric = shown ? `最新 ${shown}` : '記録あり';

  const targetText = target !== undefined ? `目標${target}秒${item.fields.seconds?.better === 'higher' ? '以上' : '以内'}` : '';
  let next: string | undefined;
  if (level === 1) next = targetText ? `${targetText}で成功` : item.fields.count?.failure ? `${item.fields.count.label}0回で成功` : '○が出るまで練習';
  else if (level === 2) next = 'つづけて2回成功で Lv3';
  else if (level === 3) {
    const need = ['つづけて3回成功'];
    if (item.fields.quality) need.push('きれいさ★3');
    if (targetText) need.push(targetText);
    next = `${need.join('・')} で Lv4`;
  }
  return { level, metric, next, flags };
}

// ---- 待機練習 ----

export interface WaitingEval {
  level: Lv;
  metric: string;
  next?: string;
  maxSuccessMin: number;
}

export function evalWaitingLogs(logs: WaitingLog[]): WaitingEval {
  if (!logs.length) return { level: 0, metric: '記録なし', next: '5分の待機をやってみる', maxSuccessMin: 0 };
  const maxOk = Math.max(0, ...logs.filter((l) => l.success).map((l) => l.durationMin));
  const level: Lv = maxOk >= 20 ? 4 : maxOk >= 10 ? 3 : maxOk >= 5 ? 2 : 1;
  const longest = Math.max(0, ...logs.map((l) => Math.floor((l.elapsedSec ?? l.durationMin * 60) / 60)));
  const metric = maxOk ? `成功 最長${maxOk}分（${logs.length}回）` : `成功まだ（最長${longest}分まで）`;
  const next = level === 1 ? '5分で気になる動き0回' : level === 2 ? '10分で成功' : level === 3 ? '20分で成功' : undefined;
  return { level, metric, next, maxSuccessMin: maxOk };
}

// ---- 全体 ----

export function computeProgress(input: ProgressInput): ProgressResult {
  const practiceItems = input.practiceItems ?? PRACTICE_ITEMS;
  const byType = new Map<string, Attempt[]>();
  for (const a of input.attempts) {
    const l = byType.get(a.questionType);
    if (l) l.push(a);
    else byType.set(a.questionType, [a]);
  }
  const byPractice = new Map<string, PracticeLog[]>();
  for (const p of input.practiceLogs) {
    const l = byPractice.get(p.itemId);
    if (l) l.push(p);
    else byPractice.set(p.itemId, [p]);
  }

  const items: ProgressItem[] = [];
  let waitingDone = false;
  for (const t of input.types) {
    if (t.moduleId === 'taiki') {
      if (waitingDone) continue;
      waitingDone = true;
      const logs = input.waitingLogs.slice().sort(byTime);
      const ev = evalWaitingLogs(logs);
      items.push({
        id: `waiting:${t.id}`,
        kind: 'waiting',
        name: t.name,
        genre: t.genre,
        source: t.source,
        priority: t.priority,
        level: ev.level,
        metric: ev.metric,
        next: ev.next,
        lastAt: logs.length ? logs[logs.length - 1].createdAt : undefined,
        count: logs.length,
        moduleId: t.moduleId,
        typeId: t.id
      });
      continue;
    }
    const list = (byType.get(t.id) ?? []).slice().sort(byTime);
    const ev = evalTypeAttempts(list, t.speedTargetSec);
    items.push({
      id: `type:${t.id}`,
      kind: 'type',
      name: t.name,
      genre: t.genre,
      source: t.source,
      priority: t.priority,
      level: ev.level,
      metric: ev.metric,
      next: ev.next,
      lastAt: list.length ? list[list.length - 1].createdAt : undefined,
      count: list.length,
      moduleId: t.moduleId,
      typeId: t.id,
      accuracy: ev.accuracy,
      medianSec: ev.medianSec
    });
  }
  for (const p of practiceItems) {
    const logs = (byPractice.get(p.id) ?? []).slice().sort(byTime);
    const ev = evalPracticeLogs(p, logs);
    items.push({
      id: `practice:${p.id}`,
      kind: 'practice',
      name: p.name,
      genre: p.genre,
      source: p.source,
      priority: p.priority,
      level: ev.level,
      metric: ev.metric,
      next: ev.next,
      lastAt: logs.length ? logs[logs.length - 1].createdAt : undefined,
      count: logs.length,
      practiceItemId: p.id
    });
  }

  const byGenre = {} as Record<GenreId, GenreProgress>;
  for (const g of GENRES) byGenre[g.id] = { readiness: 0, items: [] };
  for (const it of items) {
    if (!byGenre[it.genre]) byGenre[it.genre] = { readiness: 0, items: [] };
    byGenre[it.genre].items.push(it);
  }
  for (const k of Object.keys(byGenre) as GenreId[]) byGenre[k].readiness = readinessOf(byGenre[k].items);

  const counts: Record<Lv, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const it of items) counts[it.level]++;

  return {
    items,
    readiness: readinessOf(items),
    examReadiness: readinessOf(items.filter((i) => i.source === '本番')),
    byGenre,
    counts
  };
}

// ---- 今日のおすすめ ----

export interface Recommendation {
  item: ProgressItem;
  reason: string;
}

/** priority が高く Lv が低い、または3日以上やっていない項目（ジャンルが重ならないように） */
export function recommendItems(items: ProgressItem[], now: Date = new Date(), n = 3): Recommendation[] {
  const scored = items
    .filter((i) => i.level < 4)
    .map((i) => {
      const ds = daysSince(i.lastAt, now);
      const stale = ds === undefined || ds >= 3;
      const score = i.priority * 3 + (4 - i.level) * 2 + (stale ? 2 : 0);
      const why: string[] = [];
      if (i.source === '本番') why.push('本番で出た');
      if (i.level === 0) why.push('まだ記録なし');
      else why.push(`Lv${i.level} ${LEVEL_LABELS[i.level]}`);
      if (ds !== undefined && ds >= 3) why.push(`${ds}日やっていない`);
      return { item: i, score, reason: why.join('・') };
    })
    .sort((a, b) => b.score - a.score || a.item.level - b.item.level);
  const out: typeof scored = [];
  const used = new Set<GenreId>();
  for (const s of scored) {
    if (out.length >= n) break;
    if (used.has(s.item.genre)) continue;
    out.push(s);
    used.add(s.item.genre);
  }
  for (const s of scored) {
    if (out.length >= n) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.map(({ item, reason }) => ({ item, reason }));
}
