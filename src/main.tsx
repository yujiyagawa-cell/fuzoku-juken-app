import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { unlockAudio } from './core/audio';
import { loadTokenizer } from './core/reading';
import { SettingsProvider } from './core/settings';
import { ModeProvider } from './ui/mode';
import './styles/app.css';

// Service Worker（オフラインで起動できるように。更新は自動）
registerSW({ immediate: true });

// 音（ブザー・手拍子）は最初のタップのあとで鳴らせるようになる
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

// 読み仮名の辞書を先に読み込んでおく（失敗しても練習はできる）
setTimeout(() => {
  loadTokenizer().catch((e) => console.warn('kuromoji', e));
}, 1500);

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ModeProvider>
      <App />
    </ModeProvider>
  </SettingsProvider>
);
