import type { QuestionType } from '../../player/types';
import { areaType, lengthType, waterType, weightType } from './b/compare';
import { glovesType, moreLessType } from './b/count';
import { kisetsuType, mukashiType, whoAmIType } from './b/knowledge';
import { pictureMemoryType, storyOrderType } from './b/memory';

// 図形・推理 B（長さ・水・重さ・広さ・多い少ない・手袋・お話の順番・絵の記憶・わたしはだれ・昔話・季節）

export const ZUKEI_B_TYPES: QuestionType[] = [
  lengthType,
  waterType,
  weightType,
  areaType,
  moreLessType,
  glovesType,
  storyOrderType,
  pictureMemoryType,
  whoAmIType,
  mukashiType,
  kisetsuType
];
