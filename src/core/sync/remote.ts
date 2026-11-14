import { isChunkLoadError } from '../appUpdate';

// 記録の共有：ネット上の保存先（Firestore）とのやりとりの形。
// engine.ts はこの形だけを使う（テストでは、メモリの中のにせものに置きかえる）。

/** 共有する1行 */
export interface RemoteRow {
  t: string; // 表の名前
  k: string; // 主キー
  j: string; // 行の中身（canonical な JSON。消した行は ''）
  del: boolean; // 消した行
  u: number; // 変わった時刻 ms（同じ行が両方のスマホで変わったときに、新しい方を残す）
  d: string; // 送ったスマホの ID
}

/** 保存先の時刻（Firestore の Timestamp：秒とナノ秒） */
export interface Cursor {
  s: number;
  n: number;
}

export interface RemoteDoc extends RemoteRow {
  at: Cursor; // 保存先に書きこまれた時刻（ここより新しいものだけを、次に受けとる）
}

export interface ListenMeta {
  fromServer: boolean; // 保存先から届いた（false：ネットにつながっていない）
}

export interface Remote {
  /** ログイン（匿名）。保存先が読めるかも確かめる */
  connect(): Promise<void>;
  /** 行を送る（届いたら終わる） */
  push(rows: RemoteRow[]): Promise<void>;
  /** after より新しい行を受けとり続ける。止めるときは返り値を呼ぶ */
  listen(after: Cursor | null, onDocs: (docs: RemoteDoc[], meta: ListenMeta) => void, onError: (e: unknown) => void): () => void;
  close(): Promise<void>;
}

export function cursorAfter(a: Cursor, b: Cursor | null): boolean {
  if (!b) return true;
  return a.s > b.s || (a.s === b.s && a.n > b.n);
}

/** まとめて送るときの区切り（1回 100件・合計 4MB まで。はじめての共有で一度に送りすぎないように） */
export function chunkRows(rows: RemoteRow[], maxCount = 100, maxChars = 4_000_000): RemoteRow[][] {
  const out: RemoteRow[][] = [];
  let cur: RemoteRow[] = [];
  let size = 0;
  for (const r of rows) {
    const n = r.j.length + r.k.length + 64;
    if (cur.length && (cur.length >= maxCount || size + n > maxChars)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(r);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** エラーを、保護者に見せる文にする */
export function describeSyncError(e: unknown): string {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? '');
  if (isChunkLoadError(e))
    return 'アプリの新しい版を読みこみます。自動で開き直らないときは、アプリを閉じて開き直してから、もう一度ためしてください。';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation')
    return 'Firebase の「Authentication」→「ログイン方法」で「匿名」を有効にしてください。';
  if (code.startsWith('auth/invalid-api-key') || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || /api[- ]key/i.test(msg))
    return '貼りつけた Firebase の設定（apiKey）がちがうようです。もう一度コピーしてください。';
  if (code === 'permission-denied' || code === 'firestore/permission-denied')
    return 'Firestore の「ルール」がまだ入っていません。このページの「ルールの文」を Firebase に貼りつけて、公開してください。';
  if (/database .*does not exist|NOT_FOUND|not-found/i.test(code + ' ' + msg))
    return 'Firestore のデータベースがまだ作られていません。Firebase の「Firestore Database」で作成してください。';
  if (code === 'unavailable' || code === 'auth/network-request-failed' || /offline|network/i.test(msg))
    return 'ネットにつながっていません。つながると、自動で続きをします。';
  return `うまくいきませんでした（${code || msg.slice(0, 80)}）`;
}

/** 少し待てばなおる失敗か（ネットなど） */
export function isTransientError(e: unknown): boolean {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const msg = String((e as { message?: unknown } | null)?.message ?? '');
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed' || /offline|network/i.test(msg);
}
