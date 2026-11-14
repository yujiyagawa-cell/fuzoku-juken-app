import { useEffect, type ReactNode } from 'react';
import { useSettings } from './core/settings';
import { initVoice } from './core/speech/voice';
import { Home } from './screens/Home';
import { CatalogScreen } from './screens/parent/CatalogScreen';
import { LogScreen } from './screens/parent/LogScreen';
import { NetachoScreen } from './screens/parent/NetachoScreen';
import { OnboardingScreen } from './screens/parent/OnboardingScreen';
import { ProgressScreen } from './screens/parent/ProgressScreen';
import { RecordsScreen } from './screens/parent/RecordsScreen';
import { SettingsScreen } from './screens/parent/SettingsScreen';
import { Player } from './screens/Player';
import { Results } from './screens/Results';
import { SetSetup } from './screens/SetSetup';
import { Songs } from './screens/Songs';
import { Calendar } from './screens/Calendar';
import { Works } from './screens/Works';
import { Start } from './screens/Start';
import { SongCardEditor, SongCardPrint } from './screens/SongCard';
import { BackButton, Header } from './ui/components';
import { Icon } from './ui/icons';
import { useMode } from './ui/mode';
import { navigate, useRoute } from './ui/router';

// 画面の切り替え（#/ ではじまるハッシュ）
//  #/                ホーム
//  #/setup?m=a,b&types=x&set=id   セット設定
//  #/play            練習（plan.ts に保存した計画を実行）
//  #/results/<id>    セット結果
//  #/calendar        がんばりカレンダー（子どもも見られる）
//  #/works?tab=e|uta&day=YYYY-MM-DD  うたと え（うたった うたと、かいた え。子どもも見られる）
//  #/start?env=…     設定つきURL（ほかのスマホで同じ設定から始める）／ #/start?fresh=1 ゼロから始める
//  #/songs           うたの曲リスト（YouTube リンク）
//  #/songcard?song=id 歌詞カード（保護者が歌詞を貼りつける。この端末だけ）／ #/songcard-print?song=id|all 印刷
//  #/progress        進捗（レベル）一覧
//  #/records         記録（推移・苦手）
//  #/log?item=id     運動・生活ログ
//  #/netacho         ネタ帳（書き足しの絵）
//  #/catalog         問題カタログ
//  #/settings        設定
//  #/onboarding      はじめての設定

const PARENT_ONLY = new Set(['progress', 'records', 'log', 'netacho', 'catalog', 'settings', 'songs', 'songcard']);

function ParentLock() {
  return (
    <div className="screen">
      <Header left={<BackButton to="/" label="ホーム" />} />
      <div className="stage" style={{ minHeight: '60dvh', padding: 24 }}>
        <div className="orb" style={{ background: 'var(--parent-soft)', color: 'var(--parent)', width: 140, height: 140 }}>
          <Icon name="parents" size={72} />
        </div>
        <span className="stage-text" style={{ fontSize: 20 }}>ほごしゃ モードで ひらいてください</span>
        <span className="muted small">右上のボタンを 2秒 ながおしすると きりかわります</span>
      </div>
    </div>
  );
}

export function App() {
  const { settings, ready } = useSettings();
  const route = useRoute();
  const { isParent } = useMode();

  useEffect(() => {
    if (ready) initVoice(settings.voiceEnabled);
  }, [ready, settings.voiceEnabled]);

  useEffect(() => {
    // 設定つきURL・ゼロから始めるURL（#/start）は、はじめての設定より先に開く
    if (ready && !settings.onboarded && route.path !== '/onboarding' && route.path !== '/start' && route.path !== '/songcard-print') navigate('/onboarding', { replace: true });
  }, [ready, settings.onboarded, route.path]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  // 歌詞カードの印刷は A4 のまま出すので、アプリの枠（幅480px）の外に置く。設定を待たずに出す
  // （子どもが見るカードなので、印刷の画面は子どもモードでも開ける）
  if (route.parts[0] === 'songcard-print') return <SongCardPrint />;

  if (!ready) {
    return (
      <div className="app">
        <div className="stage" style={{ minHeight: '100dvh' }}>
          <span className="stage-text">よみこみちゅう…</span>
        </div>
      </div>
    );
  }

  const top = route.parts[0] ?? '';
  let screen: ReactNode;
  if (PARENT_ONLY.has(top) && !isParent) {
    screen = <ParentLock />;
  } else {
    switch (top) {
      case 'setup':
        screen = <SetSetup />;
        break;
      case 'play':
        screen = <Player />;
        break;
      case 'results':
        screen = <Results />;
        break;
      case 'songcard':
        screen = <SongCardEditor />;
        break;
      case 'start':
        screen = <Start />;
        break;
      case 'calendar':
        screen = <Calendar />;
        break;
      case 'works':
        screen = <Works />;
        break;
      case 'songs':
        screen = <Songs />;
        break;
      case 'progress':
        screen = <ProgressScreen />;
        break;
      case 'records':
        screen = <RecordsScreen />;
        break;
      case 'log':
        screen = <LogScreen />;
        break;
      case 'netacho':
        screen = <NetachoScreen />;
        break;
      case 'catalog':
        screen = <CatalogScreen />;
        break;
      case 'settings':
        screen = <SettingsScreen />;
        break;
      case 'onboarding':
        screen = <OnboardingScreen />;
        break;
      default:
        screen = <Home />;
    }
  }
  return <div className="app">{screen}</div>;
}
