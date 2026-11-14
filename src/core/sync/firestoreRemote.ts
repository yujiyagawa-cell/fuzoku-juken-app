import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  terminate,
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import type { FirebaseLite } from './index';
import { chunkRows, type Remote, type RemoteDoc } from './remote';
import { docIdOf } from './rows';

// 記録の共有の保存先：保護者の Firebase プロジェクトの Firestore。
// 1つの家族だけが使うプロジェクトなので、行はすべて rows コレクションに入れる（合言葉はなし）。
// 読み書きできるのは、匿名でログインしたアプリだけ（ルールは index.ts の FIRESTORE_RULES）。
// このファイルは、共有を使うときだけ読みこむ（アプリの最初の読みこみを重くしない）。

const APP_NAME = 'fz-sync';

async function freshApp(fb: FirebaseLite): Promise<FirebaseApp> {
  for (const a of getApps()) if (a.name === APP_NAME) await deleteApp(a);
  return initializeApp(
    {
      apiKey: fb.apiKey,
      projectId: fb.projectId,
      appId: fb.appId,
      authDomain: fb.authDomain || `${fb.projectId}.firebaseapp.com`
    },
    APP_NAME
  );
}

export async function createFirestoreRemote(fb: FirebaseLite): Promise<Remote> {
  const app = await freshApp(fb);
  // ログインは端末に残す（開くたびに新しい匿名ユーザーを作らない）
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  const fs = initializeFirestore(app, {});
  const rows = collection(fs, 'rows');

  return {
    async connect() {
      await auth.authStateReady();
      if (!auth.currentUser) await signInAnonymously(auth);
      // 読めるか（データベースがあるか・ルールが入っているか）を確かめる
      await getDocs(query(rows, limit(1)));
    },

    async push(list) {
      for (const chunk of chunkRows(list)) {
        const batch = writeBatch(fs);
        for (const r of chunk) {
          batch.set(doc(rows, docIdOf(r.t, r.k)), { t: r.t, k: r.k, j: r.j, del: r.del, u: r.u, d: r.d, su: serverTimestamp() });
        }
        await batch.commit();
      }
    },

    listen(after, onDocs, onError) {
      const q = after ? query(rows, where('su', '>', new Timestamp(after.s, after.n)), orderBy('su')) : query(rows, orderBy('su'));
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          const docs: RemoteDoc[] = [];
          for (const ch of snap.docChanges()) {
            if (ch.type === 'removed') continue;
            const d = ch.doc;
            if (d.metadata.hasPendingWrites) continue; // まだ届いていない、このスマホの書きこみ
            const v = d.data();
            const su = v.su as Timestamp | null | undefined;
            if (!su || typeof v.t !== 'string' || typeof v.k !== 'string') continue;
            docs.push({
              t: v.t,
              k: v.k,
              j: typeof v.j === 'string' ? v.j : '',
              del: v.del === true,
              u: Number(v.u) || 0,
              d: String(v.d ?? ''),
              at: { s: su.seconds, n: su.nanoseconds }
            });
          }
          onDocs(docs, { fromServer: !snap.metadata.fromCache });
        },
        onError
      );
    },

    async close() {
      try {
        await terminate(fs);
      } catch {
        /* noop */
      }
      try {
        await deleteApp(app);
      } catch {
        /* noop */
      }
    }
  };
}
