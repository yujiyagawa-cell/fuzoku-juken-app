import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { reloadForNewVersion } from './core/appUpdate';
import { unlockAudio } from './core/audio';
import { loadTokenizer } from './core/reading';
import { SettingsProvider } from './core/settings';
import { startSyncIfConfigured } from './core/sync';
import { ModeProvider } from './ui/mode';
import './styles/app.css';

// Service Worker（オフラインで起動できるように。更新は自動）
registerSW({ immediate: true });

// 新しい版に入れかわったあと、古い画面のまま部品を読めなかったら、開き直して新しい版にする
window.addEventListener('vite:preloadError', () => {
  reloadForNewVersion();
});

// 音（ブザー・手拍子）は最初のタップのあとで鳴らせるようになる
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

// 読み仮名の辞書を先に読み込んでおく（失敗しても練習はできる）
setTimeout(() => {
  loadTokenizer().catch((e) => console.warn('kuromoji', e));
}, 1500);

// 記録の共有（スマホどうし）をしていれば、つなぐ（Firebase は、共有しているときだけ読みこむ）
setTimeout(() => {
  startSyncIfConfigured().catch((e) => console.warn('sync', e));
}, 800);

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ModeProvider>
      <App />
    </ModeProvider>
  </SettingsProvider>
);
