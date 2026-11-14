import type { ModuleDef, QuestionType } from '../player/types';
import { HYOGEN_TYPES, hyogenModule } from './hyogen';
import { KAKITASHI_TYPES, kakitashiModule } from './kakitashi';
import { KOTOBA_TYPES, kotobaModule } from './kotoba';
import { OHANASHI_TYPES, ohanashiModule } from './ohanashi';
import { SHITSUGI_TYPES, shitsugiModule } from './shitsugi';
import { TAIKI_TYPES, taikiModule } from './taiki';
import { UTA_TYPES, utaModule } from './uta';
import { ZUKEI_TYPES, zukeiModule } from './zukei';

// すべてのモジュールと問題タイプ。画面（ホーム・進捗・カタログ）はここから読む。

export const MODULES: ModuleDef[] = [
  taikiModule,
  utaModule,
  kotobaModule,
  zukeiModule,
  ohanashiModule,
  kakitashiModule,
  shitsugiModule,
  hyogenModule
];

export const QUESTION_TYPES: QuestionType[] = [
  ...TAIKI_TYPES,
  ...UTA_TYPES,
  ...KOTOBA_TYPES,
  ...ZUKEI_TYPES,
  ...OHANASHI_TYPES,
  ...KAKITASHI_TYPES,
  ...SHITSUGI_TYPES,
  ...HYOGEN_TYPES
];

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

export function typeById(id: string): QuestionType | undefined {
  return QUESTION_TYPES.find((t) => t.id === id);
}

export function typesOfModule(moduleId: string): QuestionType[] {
  return QUESTION_TYPES.filter((t) => t.moduleId === moduleId);
}
