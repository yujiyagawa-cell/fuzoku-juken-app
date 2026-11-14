// 新しい版を公開したあと、古い版の画面のまま「もう無いファイル」を読もうとして失敗したときに、
// ページを開き直して新しい版にする。
// （Service Worker が新しい版に入れかわると、古い版のファイルは消える。共有の Firebase の部品や、
//   読み仮名の辞書の部品は、使うときに読みこむので、古い画面のままだと読めなくなる）

const KEY = 'fz-reload-for-new-version';

/** ファイル（部品）を読めなかったエラーか（Chrome・Safari・Firefox の文） */
export function isChunkLoadError(e: unknown): boolean {
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}

/** 開き直す。続けて何度も開き直さないよう、1分に1回まで。開き直したら true */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // 覚えておけないときは、開き直しをくり返さないよう、何もしない
  }
  window.location.reload();
  return true;
}
