import { dayKey } from './dates';
import type { Attempt, Drawing, PracticeLog, SessionRec, WaitingLog } from './types';

// がんばりカレンダー：日ごとに「やったこと」をまとめ、スタンプを押す

export interface DayModule {
  moduleId: string;
  count: number;
  correct: number;
  types: string[]; // やった問題の種類（questionType）
}

export interface DayEntry {
  day: string; // YYYY-MM-DD
  minutes: number; // 練習していた時間（セッションの長さの合計）
  modules: DayModule[];
  waiting: { durationMin: number; success: boolean; completed: boolean }[];
  practices: PracticeLog[];
  drawings: Drawing[];
  total: number; // 問題数
  correct: number;
}

export interface CalendarInput {
  sessions: SessionRec[];
  attempts: Attempt[];
  waitingLogs: WaitingLog[];
  practiceLogs: PracticeLog[];
  drawings: Drawing[];
}

function emptyDay(day: string): DayEntry {
  return { day, minutes: 0, modules: [], waiting: [], practices: [], drawings: [], total: 0, correct: 0 };
}

export function buildCalendar(input: CalendarInput): Map<string, DayEntry> {
  const map = new Map<string, DayEntry>();
  const get = (iso: string) => {
    const k = dayKey(iso);
    let e = map.get(k);
    if (!e) {
      e = emptyDay(k);
      map.set(k, e);
    }
    return e;
  };
  for (const s of input.sessions) {
    if (!s.endedAt) continue;
    const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
    if (ms <= 0) continue;
    get(s.startedAt).minutes += Math.min(ms, 60 * 60000) / 60000;
  }
  for (const a of input.attempts) {
    const e = get(a.createdAt);
    let m = e.modules.find((x) => x.moduleId === a.moduleId);
    if (!m) {
      m = { moduleId: a.moduleId, count: 0, correct: 0, types: [] };
      e.modules.push(m);
    }
    m.count++;
    if (a.finalJudge === 'correct') m.correct++;
    if (!m.types.includes(a.questionType)) m.types.push(a.questionType);
    e.total++;
    if (a.finalJudge === 'correct') e.correct++;
  }
  for (const w of input.waitingLogs) get(w.createdAt).waiting.push({ durationMin: w.durationMin, success: w.success, completed: w.completed });
  for (const p of input.practiceLogs) get(p.createdAt).practices.push(p);
  for (const d of input.drawings) get(d.createdAt).drawings.push(d);
  for (const e of map.values()) e.minutes = Math.round(e.minutes);
  return map;
}

/** その日に何かやったか（スタンプを押すか） */
export function isStamped(e: DayEntry | undefined): boolean {
  return !!e && (e.total > 0 || e.waiting.length > 0 || e.practices.length > 0 || e.drawings.length > 0);
}

/** たくさん がんばった日（はなまる）：20分以上、または3種類以上 */
export function isHanamaru(e: DayEntry | undefined): boolean {
  if (!e) return false;
  const kinds = e.modules.length + (e.waiting.length && !e.modules.some((m) => m.moduleId === 'taiki') ? 1 : 0) + (e.practices.length ? 1 : 0);
  return e.minutes >= 20 || kinds >= 3;
}

const STAMPS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐤', '🦊', '🐮', '🐷', '🐹', '🦄', '🐳', '🦋', '🐞'];

/** 日ごとに決まる スタンプの絵（同じ日はいつも同じ） */
export function stampFor(day: string): string {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return STAMPS[h % STAMPS.length];
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** きょう（またはきのう）から さかのぼって つづけて がんばった日数 */
export function streakDays(stamped: Set<string>, today: string): number {
  let d = stamped.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (stamped.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** 月のカレンダーのマス（日曜はじまり。前後の空きは null） */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month - 1, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}
