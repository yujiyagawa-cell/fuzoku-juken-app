import type { ComponentType, ReactNode } from 'react';
import type { Rng } from '../core/rng';
import type { AnswerMode, Attempt, GenreId, Judge, LatencySource, ParentChecks } from '../core/types';
import type { IconName } from '../ui/icons';

// ---- 記録 ----
export interface RecordInput {
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
  parentChecks?: ParentChecks;
  latencyMs?: number;
  latencySource?: LatencySource;
  meta?: Record<string, unknown>;
}

export interface SessionApi {
  sessionId: string;
  record(input: RecordInput): Promise<Attempt>;
  setParentJudge(attemptId: string, judge: Judge): Promise<void>;
  setChecks(attemptId: string, checks: ParentChecks): Promise<void>;
}

// ---- モジュール（「うた」「ことば」などの練習のまとまり） ----
export interface RunnerProps {
  count: number; // 出題数（待機練習は分）
  timeLimitSec?: number;
  types?: string[]; // 問題タイプをしぼる（進捗画面の「これを練習」から）
  session: SessionApi;
  onDone: () => void;
}

export interface ModuleColor {
  bg: string;
  ink: string;
  icon: string;
  shadow: string;
}

export interface ModuleDef {
  id: string;
  name: string; // 子ども向け（ひらがな）
  label: string; // 保護者向け
  sub: string; // タイルの説明（ひらがな）
  unit: 'もん' | 'ふん' | 'わ' | 'まい';
  defaultCount: number;
  minCount: number;
  maxCount: number;
  step: number;
  minutesPer: number; // 1単位あたりの目安の分
  color: ModuleColor;
  icon: IconName;
  genre: GenreId;
  omakase: boolean; // おまかせの対象
  Runner: ComponentType<RunnerProps>;
}

// ---- タップで答える問題 ----
export interface Choice {
  id: string;
  node: ReactNode; // 絵（SVG や絵文字）
  label: string; // 読み上げ・aria 用の名前（ひらがな）
  caption?: string; // 絵の下に出す文字（必要なときだけ）
}

export interface TapQuestion {
  type: string; // QuestionType.id
  prompt: string; // 問題文（ひらがな・分かち書き）。保護者パネルに出す
  speech?: string; // 読み上げ文（漢字まじり可）。省くと prompt
  figure?: ReactNode; // 問題の絵（選択肢の上）
  preview?: { node: ReactNode; seconds: number; speech?: string }; // 先に見せて隠す（絵の記憶）
  choices: Choice[];
  answer: string | string[]; // choice の id。order モードは正しい順の id 配列
  mode?: 'choice' | 'order';
  cols?: number; // 選択肢の列数
  choiceHeight?: number; // 選択肢の高さ px
  timeLimitSec?: number; // この問題だけの制限時間
  explain?: string; // 保護者向けの正解の説明
  askReason?: boolean; // 答えたあと「どうしてですか」と聞く
  params?: unknown; // 生成パラメータ（記録用）
}

export interface TapResult {
  choiceId?: string;
  order?: string[];
  judge: Judge;
  latencyMs?: number;
  timedOut: boolean;
}

// ---- 問題タイプ（カタログ・進捗・おまかせの単位） ----
export interface QuestionType {
  id: string;
  name: string; // 保護者向けの名前（例：回転（旗の箱））
  genre: GenreId;
  moduleId: string; // どのモジュールで出すか
  source: string; // 出どころ：'本番' 'とっくん42' 'とっくん65' '365日' 'ノート（予想）' 'ノート'
  description: string; // 作り方・ねらい
  priority: 1 | 2 | 3; // 3 = 最重要
  answer: 'tap' | 'voice' | 'parent' | 'draw';
  speedTargetSec?: number; // 速さの目標（回答までの秒数）
  sample?: string; // 問題文の例（カタログで見せる。タップ問題は generate の結果を見せる）
  generate?: (rng: Rng) => TapQuestion; // タップ問題の自動生成
}
