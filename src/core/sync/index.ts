import { useSyncExternalStore } from 'react';
import { db, uid } from '../db';
import * as dirty from './dirty';
import type { SyncEngine } from './engine';
import { describeSyncError, type Remote } from './remote';

// 記録の共有（スマホどうし）：始める・やめる・ようすを見る。
// 保存先は、保護者が作った Firebase プロジェクト（設定を貼りつける）。設定はアプリ（公開しているもの）には入れず、
// このスマホと、設定つきURLで渡した家族のスマホにだけ置く。

/** Firebase の設定（共有に使うものだけ） */
export interface FirebaseLite {
  apiKey: string;
  projectId: string;
  appId?: string;
  authDomain?: string;
}

export interface SyncConfig {
  fb: FirebaseLite;
  deviceId: string;
  since: string;
}

export interface SyncStatus {
  on: boolean; // 共有している
  starting: boolean;
  connected: boolean; // 保存先とつながっている
  lastAt?: number; // 最後にそろえた時刻
  peerAt?: number; // ほかのスマホから届いた、いちばん新しい変更の時刻
  error?: string;
  pending: number; // まだ送っていない変更
}

/** Firestore のルール（Firebase の「Firestore Database → ルール」に貼る） */
export const FIRESTORE_RULES = [
  "rules_version = '2';",
  'service cloud.firestore {',
  '  match /databases/{database}/documents {',
  '    match /rows/{rowId} {',
  '      allow read, write: if request.auth != null;',
  '    }',
  '  }',
  '}'
].join('\n');

/** 貼りつけられた firebaseConfig（JS のまま・JSON どちらでも）から、使う項目を取り出す */
export function parseFirebaseConfig(text: string): FirebaseLite | null {
  const pick = (name: string): string | undefined => {
    const m = text.match(new RegExp(`["']?\\b${name}["']?\\s*[:=]\\s*["'\`]([^"'\`\\s]+)["'\`]`));
    return m?.[1];
  };
  const apiKey = pick('apiKey');
  const projectId = pick('projectId');
  if (!apiKey || !projectId) return null;
  const out: FirebaseLite = { apiKey, projectId };
  const appId = pick('appId');
  const authDomain = pick('authDomain');
  if (appId) out.appId = appId;
  if (authDomain) out.authDomain = authDomain;
  return out;
}

export async function loadSyncConfig(): Promise<SyncConfig | undefined> {
  const v = (await db.syncMeta.get('config'))?.value as SyncConfig | undefined;
  return v?.fb?.apiKey && v.fb.projectId && v.deviceId ? v : undefined;
}

// ---- ようす ----
let status: SyncStatus = { on: false, starting: false, connected: false, pending: dirty.dirtyCount() };
const subs = new Set<() => void>();

function setStatus(p: Partial<SyncStatus>): void {
  status = { ...status, ...p, pending: dirty.dirtyCount() };
  for (const f of subs) f();
}

dirty.onDirtyChange(() => {
  if (status.pending !== dirty.dirtyCount()) setStatus({});
});

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => status
  );
}

// ---- 動かす ----
let engine: SyncEngine | null = null;
let restartTimer: ReturnType<typeof setTimeout> | undefined;

async function makeRemote(fb: FirebaseLite): Promise<Remote> {
  const { createFirestoreRemote } = await import('./firestoreRemote');
  return createFirestoreRemote(fb);
}

async function stopEngine(): Promise<void> {
  clearTimeout(restartTimer);
  const e = engine;
  engine = null;
  if (e) await e.stop();
}

async function runEngine(cfg: SyncConfig, remote?: Remote): Promise<void> {
  await stopEngine();
  setStatus({ on: true, starting: true, error: '', peerAt: undefined });
  const r = remote ?? (await makeRemote(cfg.fb));
  const { SyncEngine } = await import('./engine');
  const e = new SyncEngine(r, cfg.deviceId, (rep) => {
    if (engine === e) setStatus(rep);
  });
  engine = e;
  try {
    await e.start();
    if (engine === e) setStatus({ starting: false });
  } catch (err) {
    if (engine !== e) return;
    setStatus({ starting: false, connected: false, error: describeSyncError(err) });
    // ネットがないときなど：つながったら・しばらくしたら、もう一度
    await stopEngine();
    const again = () => {
      window.removeEventListener('online', again);
      clearTimeout(restartTimer);
      void loadSyncConfig().then((c) => {
        if (c && !engine) return runEngine(c);
      });
    };
    window.addEventListener('online', again);
    restartTimer = setTimeout(again, 60_000);
  }
}

/** アプリを開いたとき：共有していれば始める */
export async function startSyncIfConfigured(): Promise<void> {
  const cfg = await loadSyncConfig();
  if (!cfg) {
    if (dirty.isTracking()) dirty.setTracking(false);
    return;
  }
  if (!dirty.isTracking()) dirty.setTracking(true);
  await runEngine(cfg);
}

/**
 * 共有を始める（このスマホで初めて／家族のスマホから受けとったURLで）。
 * 保存先にすでにある行は保存先の方に合わせ、保存先にない行（このスマホだけの記録）を送る。
 * 設定がまちがっているときは、ここでエラーになる（何も保存しない）。
 */
export async function enableSync(fb: FirebaseLite): Promise<void> {
  await stopEngine();
  const remote = await makeRemote(fb);
  try {
    await remote.connect();
  } catch (e) {
    await remote.close();
    throw e;
  }
  const prev = await loadSyncConfig();
  const cfg: SyncConfig = { fb, deviceId: prev?.deviceId ?? uid(), since: new Date().toISOString() };
  dirty.setTracking(false); // 前のしるしを消す
  await db.transaction('rw', db.syncMeta, db.syncState, async () => {
    await db.syncState.clear();
    await db.syncMeta.clear();
    await db.syncMeta.put({ key: 'config', value: cfg });
  });
  dirty.setTracking(true);
  await runEngine(cfg, remote);
}

/** このスマホの共有をやめる（このスマホの記録も、保存先の記録も消さない） */
export async function disableSync(): Promise<void> {
  await stopEngine();
  dirty.setTracking(false);
  await db.transaction('rw', db.syncMeta, db.syncState, async () => {
    await db.syncState.clear();
    await db.syncMeta.clear();
  });
  setStatus({ on: false, starting: false, connected: false, error: '', lastAt: undefined, peerAt: undefined });
}

/** いますぐ そろえる */
export async function syncNow(): Promise<void> {
  if (engine) {
    await engine.syncNow();
    return;
  }
  const cfg = await loadSyncConfig();
  if (cfg) await runEngine(cfg);
}

// アプリが裏に回るときは、まだ送っていない変更をすぐ送る。表に戻ったら そろえる
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      dirty.flushDirty();
      void engine?.pushNow();
    } else if (engine) {
      void engine.syncNow();
    }
  });
}

// ---- 設定つきURL に入れる形 ----
export interface EnvSync {
  a: string; // apiKey
  p: string; // projectId
  i?: string; // appId
  d?: string; // authDomain
}

export function toEnvSync(fb: FirebaseLite): EnvSync {
  const y: EnvSync = { a: fb.apiKey, p: fb.projectId };
  if (fb.appId) y.i = fb.appId;
  if (fb.authDomain) y.d = fb.authDomain;
  return y;
}

export function fromEnvSync(y: EnvSync): FirebaseLite | null {
  if (!y || typeof y.a !== 'string' || typeof y.p !== 'string') return null;
  const fb: FirebaseLite = { apiKey: y.a, projectId: y.p };
  if (typeof y.i === 'string') fb.appId = y.i;
  if (typeof y.d === 'string') fb.authDomain = y.d;
  return fb;
}
