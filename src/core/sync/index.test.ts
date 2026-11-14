import { describe, expect, it } from 'vitest';
import { fromEnvSync, parseFirebaseConfig, toEnvSync } from './index';

describe('Firebase の設定の貼りつけ', () => {
  const consoleText = [
    '// Import the functions you need from the SDKs you need',
    'import { initializeApp } from "firebase/app";',
    'const firebaseConfig = {',
    '  apiKey: "AIzaSyTEST-123_abc",',
    '  authDomain: "juken-kiroku.firebaseapp.com",',
    '  projectId: "juken-kiroku",',
    '  storageBucket: "juken-kiroku.firebasestorage.app",',
    '  messagingSenderId: "123456",',
    '  appId: "1:123456:web:abcdef"',
    '};',
    'const app = initializeApp(firebaseConfig);'
  ].join('\n');

  it('Firebase の画面のコードをそのまま貼っても読める', () => {
    expect(parseFirebaseConfig(consoleText)).toEqual({
      apiKey: 'AIzaSyTEST-123_abc',
      projectId: 'juken-kiroku',
      appId: '1:123456:web:abcdef',
      authDomain: 'juken-kiroku.firebaseapp.com'
    });
  });

  it('JSON の形でも読める', () => {
    expect(parseFirebaseConfig('{"apiKey":"AIzaX","projectId":"p1"}')).toEqual({ apiKey: 'AIzaX', projectId: 'p1' });
  });

  it('apiKey か projectId がないときは読めない', () => {
    expect(parseFirebaseConfig('projectId: "p1"')).toBeNull();
    expect(parseFirebaseConfig('てきとうな文')).toBeNull();
  });

  it('設定つきURLに入れる形にして、もどせる', () => {
    const fb = parseFirebaseConfig(consoleText)!;
    expect(fromEnvSync(toEnvSync(fb))).toEqual(fb);
    expect(fromEnvSync({ p: 'x' } as never)).toBeNull();
  });
});
