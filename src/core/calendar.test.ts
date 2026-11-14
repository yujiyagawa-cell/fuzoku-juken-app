import { describe, expect, it } from 'vitest';
import { buildCalendar, isHanamaru, isStamped, monthCells, stampFor, streakDays } from './calendar';
import type { Attempt } from './types';

const at = (iso: string, moduleId: string, judge: Attempt['finalJudge'] = 'correct', questionType = `${moduleId}-x`): Attempt => ({
  id: Math.random().toString(36),
  sessionId: 's',
  moduleId,
  questionType,
  prompt: '',
  answerMode: 'tap',
  finalJudge: judge,
  createdAt: iso
});

describe('がんばりカレンダー', () => {
  it('日ごとに やった練習と ○ の数をまとめる', () => {
    const cal = buildCalendar({
      sessions: [{ id: 's', startedAt: '2026-11-14T09:00:00', endedAt: '2026-11-14T09:12:00', moduleIds: ['kotoba'] }],
      attempts: [at('2026-11-14T09:01:00', 'kotoba'), at('2026-11-14T09:02:00', 'kotoba', 'wrong'), at('2026-11-14T09:05:00', 'zukei')],
      waitingLogs: [{ id: 'w', durationMin: 5, elapsedSec: 300, counts: {}, success: true, completed: true, createdAt: '2026-11-14T10:00:00' }],
      practiceLogs: [{ id: 'p', itemId: 'zoukin', ok: true, createdAt: '2026-11-13T18:00:00' }],
      drawings: []
    });
    const d14 = cal.get('2026-11-14')!;
    expect(d14.minutes).toBe(12);
    expect(d14.total).toBe(3);
    expect(d14.correct).toBe(2);
    expect(d14.modules.find((m) => m.moduleId === 'kotoba')).toMatchObject({ count: 2, correct: 1 });
    expect(d14.waiting).toHaveLength(1);
    expect(isStamped(d14)).toBe(true);
    expect(isStamped(cal.get('2026-11-13'))).toBe(true);
    expect(isStamped(cal.get('2026-11-12'))).toBe(false);
    expect(isHanamaru(d14)).toBe(true); // ことば・ずけい・まつ の3種類
  });

  it('つづけた日数（きょうがまだでも、きのうまで続いていれば数える）', () => {
    const s = new Set(['2026-11-12', '2026-11-13', '2026-11-14']);
    expect(streakDays(s, '2026-11-14')).toBe(3);
    expect(streakDays(s, '2026-11-15')).toBe(3);
    expect(streakDays(s, '2026-11-16')).toBe(0);
  });

  it('スタンプは日ごとに決まる', () => {
    expect(stampFor('2026-11-14')).toBe(stampFor('2026-11-14'));
  });

  it('月のマス（2026年11月は日曜はじまり・30日）', () => {
    const c = monthCells(2026, 11);
    expect(c.length % 7).toBe(0);
    expect(c[0]).toBe('2026-11-01');
    expect(c.filter(Boolean)).toHaveLength(30);
  });
});
