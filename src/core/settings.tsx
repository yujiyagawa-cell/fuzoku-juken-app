import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from './db';
import type { Settings } from './types';
import { setTtsConfig } from './speech/tts';

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
  tapTimeLimitSec: 20,
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
  voiceEnabled: true,
  propertyAnswers: {
    togetoge: ['サボテン', 'くりのいが', 'いが', 'ハリネズミ', 'オナモミ', 'ウニ', 'バラ', 'ヤマアラシ', 'まつぼっくり'],
    pikapika: ['10えんだま', 'じゅうえんだま', 'ダイヤモンド', 'ほうせき', 'かがみ', 'きんメダル', 'ほし', 'まど', 'あたらしいくつ'],
    fuwafuwa: ['わたがし', 'くも', 'ひつじ', 'うさぎ', 'ふとん', 'わた', 'クッション', 'わたげ', 'たんぽぽのわたげ', 'ぬいぐるみ']
  },
  onboarded: false
};

function merge(saved: Partial<Settings> | undefined): Settings {
  if (!saved) return { ...DEFAULT_SETTINGS };
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
  return merge(row?.value);
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
  }, []);

  useEffect(() => {
    setTtsConfig({ rate: settings.ttsRate, voiceURI: settings.voiceURI, readTimes: settings.readTimes });
  }, [settings.ttsRate, settings.voiceURI, settings.readTimes]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = merge({ ...prev, ...patch });
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
