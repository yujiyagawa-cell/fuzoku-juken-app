import type { QuestionType } from '../../player/types';
import { coordinatesType } from './a/coordinates';
import { ferrisReverseType, ferrisType } from './a/ferris';
import { puzzleType } from './a/puzzle';
import { rotateArrowType, rotateMarkType } from './a/rotateArrow';
import { rotateBoxType } from './a/rotateBox';
import { rotateGridType } from './a/rotateGrid';
import { rotateTableType } from './a/rotateTable';
import { sameShapeType } from './a/sameShape';
import { seriesType } from './a/series';
import { splitType } from './a/split';
import { tsumikiCountType, tsumikiDonguriType, tsumikiViewsType } from './a/tsumiki';

// 図形・推理 A（回転・観覧車・積み木・四方・同じ形・系列・座標・パズル・等分）

export const ZUKEI_A_TYPES: QuestionType[] = [
  rotateBoxType,
  rotateGridType,
  rotateArrowType,
  ferrisType,
  rotateTableType,
  tsumikiCountType,
  tsumikiDonguriType,
  tsumikiViewsType,
  sameShapeType,
  seriesType,
  coordinatesType,
  puzzleType,
  splitType,
  // プリントにない聞き方（ふだんは出さない。カタログで「良い」にすると出る）
  ferrisReverseType,
  rotateMarkType
];
