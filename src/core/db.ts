import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'react';
import type {
  Attempt,
  Drawing,
  Idea,
  KanaSeed,
  MySet,
  PracticeLog,
  Review,
  SessionRec,
  Settings,
  SongLink,
  SongText,
  WaitingLog
} from './types';

class AppDB extends Dexie {
  settings!: Table<{ key: string; value: Settings }, string>;
  sessions!: Table<SessionRec, string>;
  attempts!: Table<Attempt, string>;
  drawings!: Table<Drawing, string>;
  waitingLogs!: Table<WaitingLog, string>;
  practiceLogs!: Table<PracticeLog, string>;
  mySets!: Table<MySet, string>;
  reviews!: Table<Review, string>;
  songLinks!: Table<SongLink, string>;
  ideas!: Table<Idea, string>;
  kanaSeeds!: Table<KanaSeed, string>;
  songTexts!: Table<SongText, string>;

  constructor() {
    super('fuzoku-juken');
    this.version(1).stores({
      settings: 'key',
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, moduleId, questionType, createdAt',
      drawings: 'id, shape, createdAt',
      waitingLogs: 'id, createdAt',
      practiceLogs: 'id, itemId, createdAt',
      mySets: 'id',
      reviews: 'typeId',
      songLinks: 'songId',
      ideas: 'id, createdAt',
      kanaSeeds: 'key'
    });
    // v2：うたのカードに保護者が貼りつけた歌詞（このスマホの中だけ）
    this.version(2).stores({ songTexts: 'songId' });
  }
}

export const db = new AppDB();

export const TABLE_NAMES = [
  'settings',
  'sessions',
  'attempts',
  'drawings',
  'waitingLogs',
  'practiceLogs',
  'mySets',
  'reviews',
  'songLinks',
  'ideas',
  'kanaSeeds',
  'songTexts'
] as const;

export function uid(): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${r}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Dexie の liveQuery を React で使うためのフック */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(v),
      error: (e) => console.error('liveQuery', e)
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
