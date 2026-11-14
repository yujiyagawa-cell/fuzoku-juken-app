import { useEffect, useState } from 'react';

// ハッシュでの画面切り替え（#/play?modules=... のように使う）。Android の戻るボタンで前の画面に戻れる。

export interface Route {
  path: string; // '/', '/play', '/results/abc'
  parts: string[]; // ['results', 'abc']
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = p.startsWith('/') ? p : `/${p}`;
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = to.startsWith('#') ? to : `#${to}`;
  if (opts.replace) {
    window.location.replace(hash);
  } else {
    window.location.hash = hash;
  }
}

export function goBack(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
}
