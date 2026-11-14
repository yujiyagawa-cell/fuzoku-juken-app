// アプリ全体で使う型

export type Judge = 'correct' | 'wrong' | 'unknown';
export type Mode = 'child' | 'parent';
export type AnswerMode = 'tap' | 'voice' | 'parent';
export type LatencySource = 'speechstart' | 'soundstart' | 'interim' | 'tap' | 'parent';

export interface MoraRules {
  youon: 'merge' | 'separate'; // ゃゅょ を前の字とまとめて1文字にするか
  sokuon: 'count' | 'skip'; // っ を数えるか
  chouon: 'count' | 'skip'; // ー を数えるか
}

export type PropertyKind = 'togetoge' | 'pikapika' | 'fuwafuwa';

export interface Settings {
  childName: string; // ひらがな
  childNameKanji: string;
  age: number; // 0 = 未設定
  birthday: { month: number; day: number }; // 0 = 未設定
  nurseryType: 'hoikuen' | 'youchien';
  handedness: '' | 'right' | 'left';
  examDate: string; // YYYY-MM-DD
  ttsRate: number; // 0.8 - 1.2
  voiceURI: string; // '' = 自動
  readTimes: 1 | 2;
  tapTimeLimitSec: number;
  silenceTimeoutSec: number;
  showResultImmediately: boolean;
  autoNextSec: number; // 声で答えたあと次へ進むまでの秒数（0 = ボタンで進む）
  moraRules: MoraRules;
  allowDakuonVariant: boolean;
  includeDakuon: boolean;
  kotobaRatio3: number; // 3文字の割合 0..1
  mixKotobaInShitsugi: boolean;
  kakitashiTimeLimitSec: number; // 0 = 制限なし
  kakitashiGuide: boolean;
  voiceEnabled: boolean;
  propertyAnswers: Record<PropertyKind, string[]>;
  onboarded: boolean;
  settingsVersion: number; // 既定値を変えたときの移行用
}

export interface SessionRec {
  id: string;
  startedAt: string;
  endedAt?: string;
  moduleIds: string[];
  mySetId?: string;
}

export interface ParentChecks {
  immediate?: boolean;
  reason?: boolean;
  keigo?: boolean;
}

export interface Attempt {
  id: string;
  sessionId: string;
  moduleId: string;
  questionType: string;
  prompt: string;
  params?: unknown;
  answerMode: AnswerMode;
  tappedChoice?: string;
  correctChoice?: string;
  transcript?: string;
  alternatives?: string[];
  matched?: string;
  autoJudge?: Judge;
  parentJudge?: Judge;
  finalJudge: Judge;
  parentChecks?: ParentChecks;
  latencyMs?: number;
  latencySource?: LatencySource;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface Drawing {
  id: string;
  shape: string;
  pngDataUrl: string;
  starred: boolean;
  sessionId?: string;
  seconds?: number; // かきはじめから かんせいまで
  createdAt: string;
}

export interface WaitingLog {
  id: string;
  sessionId?: string;
  durationMin: number;
  elapsedSec: number;
  counts: Record<string, number>;
  success: boolean;
  completed: boolean;
  createdAt: string;
}

export interface PracticeLog {
  id: string;
  itemId: string;
  seconds?: number;
  ok?: boolean;
  quality?: 1 | 2 | 3;
  count?: number;
  note?: string;
  createdAt: string;
}

export interface MySetItem {
  moduleId: string;
  count: number;
  timeLimitSec?: number;
  types?: string[];
}

export interface MySet {
  id: string;
  name: string;
  items: MySetItem[];
  createdAt: string;
}

export type ReviewMark = 'good' | 'fix' | 'off';

export interface Review {
  typeId: string;
  mark: ReviewMark | '';
  note?: string;
  updatedAt: string;
}

export interface SongLink {
  songId: string;
  url: string;
}

export interface Idea {
  id: string;
  text: string;
  createdAt: string;
}

/** ノートから取り込んだ「苦手な音」の初期データ（× がついていた音） */
export interface KanaSeed {
  key: string; // 'あ-3'
  kana: string;
  length: 2 | 3;
  source: 'note' | 'manual';
  createdAt: string;
}

export type GenreId =
  | 'taiki'
  | 'uta'
  | 'kotoba'
  | 'zukei'
  | 'kioku'
  | 'kakitashi'
  | 'shitsugi'
  | 'hyogen'
  | 'undo'
  | 'seikatsu';
