import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from './db';
import type { Settings } from './types';
import { setTtsConfig } from './speech/tts';
import { SETTINGS_REMOTE_EVENT } from './sync/rows';

export const DEFAULT_SETTINGS: Settings = {
  childName: '',
  childNameKanji: '',
  age: 0,
  birthday: { month: 0, day: 0 },
  nurseryType: 'hoikuen',
  handedness: '',
  examDate: '2026-12-04',
  ttsRate: 1,
  voiceURI: '',
  readTimes: 1,
  tapTimeLimitSec: 10, // 本番は即答が必要（2026-11-14 10秒に）
  silenceTimeoutSec: 10,
  showResultImmediately: false,
  autoNextSec: 2,
  moraRules: { youon: 'merge', sokuon: 'count', chouon: 'count' },
  allowDakuonVariant: false,
  includeDakuon: true,
  kotobaRatio3: 0.5,
  mixKotobaInShitsugi: true,
  kakitashiTimeLimitSec: 0,
  kakitashiGuide: true,
  kakitashiShapeSize: 'medium', // 形のまわりに描く場所を広く（2026-11-14 保護者の指摘「余白が狭い」）
  voiceEnabled: true,
  utaRecord: true, // 2026-11-15 保護者の依頼「録音して（あとで聞けるように）」
  propertyAnswers: {
    togetoge: ['サボテン', 'くりのいが', 'いが', 'ハリネズミ', 'オナモミ', 'ウニ', 'バラ', 'ヤマアラシ', 'まつぼっくり'],
    pikapika: ['10えんだま', 'じゅうえんだま', 'ダイヤモンド', 'ほうせき', 'かがみ', 'きんメダル', 'ほし', 'まど', 'あたらしいくつ'],
    fuwafuwa: ['わたがし', 'くも', 'ひつじ', 'うさぎ', 'ふとん', 'わた', 'クッション', 'わたげ', 'たんぽぽのわたげ', 'ぬいぐるみ']
  },
  onboarded: false,
  settingsVersion: 2
};

/** 前の版で保存された設定を、新しい既定値に合わせる */
export function migrateSettings(saved: Partial<Settings>): Partial<Settings> {
  const v = saved.settingsVersion ?? 1;
  const out = { ...saved };
  // v2：タップの制限時間の既定を 20秒 → 10秒（即答が必要なため）
  if (v < 2 && (out.tapTimeLimitSec === undefined || out.tapTimeLimitSec === 20)) out.tapTimeLimitSec = 10;
  out.settingsVersion = DEFAULT_SETTINGS.settingsVersion;
  return out;
}

export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  if (!saved) return { ...DEFAULT_SETTINGS };
  saved = migrateSettings(saved);
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    birthday: { ...DEFAULT_SETTINGS.birthday, ...(saved.birthday || {}) },
    moraRules: { ...DEFAULT_SETTINGS.moraRules, ...(saved.moraRules || {}) },
    propertyAnswers: { ...DEFAULT_SETTINGS.propertyAnswers, ...(saved.propertyAnswers || {}) }
  };
}

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get('main');
  return mergeSettings(row?.value);
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ key: 'main', value: s });
}

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, ready: false, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
    // 記録の共有で、ほかのスマホから設定が届いたら読み直す
    const reload = () => {
      loadSettings().then(setSettings);
    };
    window.addEventListener(SETTINGS_REMOTE_EVENT, reload);
    return () => window.removeEventListener(SETTINGS_REMOTE_EVENT, reload);
  }, []);

  useEffect(() => {
    setTtsConfig({ rate: settings.ttsRate, voiceURI: settings.voiceURI, readTimes: settings.readTimes });
  }, [settings.ttsRate, settings.voiceURI, settings.readTimes]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = mergeSettings({ ...prev, ...patch });
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsContext);
}
