import Dexie, { liveQuery, type DBCore, type DBCoreMutateRequest, type DBCoreTable, type Middleware, type Table } from 'dexie';
import { useEffect, useState } from 'react';
import { isTracking, markCleared, markDirty } from './sync/dirty';
import { SYNC_TABLE_SET } from './sync/rows';
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

/** 記録の共有の管理用（このスマホだけ。書き出し・共有には入れない） */
export interface SyncMetaRow {
  key: string; // 'config' | 'cursor'
  value: unknown;
}

/** 共有と最後にそろえたときの、行ごとの中身のハッシュ */
export interface SyncStateRow {
  k: string; // 表の名前 ~ 主キー
  h: string; // ハッシュ（消した行は 'DEL'）
  u: number; // 変わった時刻 ms
}

/** 共有から入れた行・表を消したあとに入れ直した行のしるし（トランザクションにつける） */
export interface SyncMarks {
  __fzSync?: boolean;
  __fzCleared?: Set<string>;
}

// 共有中は、変わった行を見張っておぼえる（dirty.ts）。
// ・共有から入れた行（engine.ts が __fzSync をつけたトランザクション）はおぼえない
// ・表をまるごと消したとき（JSON の読み込みなど）は、行を消したとは扱わず、共有の内容と合わせ直す
const syncTracker: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'fz-sync-tracker',
  create(down) {
    return {
      ...down,
      table(name: string): DBCoreTable {
        const t = down.table(name);
        if (!SYNC_TABLE_SET.has(name)) return t;
        return {
          ...t,
          mutate(req: DBCoreMutateRequest) {
            const marks = req.trans as unknown as SyncMarks;
            const fromSync = !!marks.__fzSync || !!(Dexie.currentTransaction as unknown as SyncMarks | null)?.__fzSync;
            if (req.type === 'deleteRange' && !fromSync) (marks.__fzCleared ??= new Set()).add(name);
            return t.mutate(req).then((res) => {
              if (!isTracking() || fromSync) return res;
              if (req.type === 'deleteRange') markCleared(name);
              else if (marks.__fzCleared?.has(name)) {
                // 消したあとに入れ直した行は、合わせ直すときに見る（ここではおぼえない）
              } else if (req.type === 'delete') markDirty(name, req.keys);
              else markDirty(name, res.results ?? req.keys ?? []);
              return res;
            });
          }
        };
      }
    };
  }
};

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
  syncMeta!: Table<SyncMetaRow, string>;
  syncState!: Table<SyncStateRow, string>;

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
    // v3：記録の共有（スマホどうし）の管理用
    this.version(3).stores({ syncMeta: 'key', syncState: 'k' });
    this.use(syncTracker);
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
