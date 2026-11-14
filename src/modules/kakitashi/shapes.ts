// 絵の書き足しの「形」。形の名前（shape）は ShapeGlyph（src/ui/icons.tsx）と同じ。
// 作例は手書きノート（10・12〜16枚目）と仕様 6.5 より。

export type ShapeId = 'rect' | 'triangle' | 'halfUp' | 'halfDown' | 'square' | 'diamond' | 'circle';

export interface ShapeDef {
  shape: ShapeId;
  typeId: string; // QuestionType.id（kakitashi-rect など）
  name: string; // 保護者向け
  kidName: string; // 子ども向け（ひらがな）
  source: string;
  priority: 1 | 2 | 3;
  examples: string[]; // 保護者向けの作例
  kidExamples: string[]; // 子どもに見せる作例（ひらがな）
}

export const SHAPES: ShapeDef[] = [
  {
    shape: 'rect',
    typeId: 'kakitashi-rect',
    name: '長方形',
    kidName: 'ながしかく',
    source: '本番',
    priority: 3,
    examples: ['電車（3両の真ん中の車両）', '旗（日の丸と棒）', 'マスク（ひも・ひだ）'],
    kidExamples: ['でんしゃ', 'はた', 'ますく']
  },
  {
    shape: 'triangle',
    typeId: 'kakitashi-triangle',
    name: '三角',
    kidName: 'さんかく',
    source: '本番',
    priority: 3,
    examples: ['トイレの案内マーク（人の形）', 'シーソー（三角が支点）', 'いえ（三角の屋根）', 'イカ（三角の頭）'],
    kidExamples: ['といれの まーく', 'しーそー', 'いえの やね', 'いか']
  },
  {
    shape: 'halfUp',
    typeId: 'kakitashi-halfUp',
    name: '半円（弧が上）',
    kidName: 'はんぶんの まる',
    source: '本番',
    priority: 3,
    examples: ['カメ（甲羅に格子もよう）', '帽子をかぶった子（帽子の上が半円）'],
    kidExamples: ['かめの こうら', 'ぼうし']
  },
  {
    shape: 'halfDown',
    typeId: 'kakitashi-halfDown',
    name: '半円（弧が下）',
    kidName: 'はんぶんの まる',
    source: 'ノート',
    priority: 2,
    examples: ['笑った顔（口が半円）', '風車（羽の1枚）', 'トンボ（羽）'],
    kidExamples: ['わらった くち', 'かざぐるま', 'とんぼの はね']
  },
  {
    shape: 'square',
    typeId: 'kakitashi-square',
    name: '正方形',
    kidName: 'ましかく',
    source: 'ノート',
    priority: 2,
    examples: ['サイコロ（目が4つ）', 'いえ（正方形の壁と三角の屋根）', 'おにぎり（正方形の海苔）'],
    kidExamples: ['さいころ', 'いえ', 'おにぎりの のり']
  },
  {
    shape: 'diamond',
    typeId: 'kakitashi-diamond',
    name: 'ひし形',
    kidName: 'ひしがた',
    source: 'ノート',
    priority: 2,
    examples: ['鳥（ひし形がくちばし）', '凧（たこ）'],
    kidExamples: ['とりの くちばし', 'たこあげの たこ']
  },
  {
    shape: 'circle',
    typeId: 'kakitashi-circle',
    name: '円',
    kidName: 'まる',
    source: '仕様',
    priority: 1,
    examples: ['顔', '太陽', 'ボール'],
    kidExamples: ['かお', 'たいよう', 'ぼーる']
  }
];

export function shapeDef(shape: string): ShapeDef | undefined {
  return SHAPES.find((s) => s.shape === shape);
}

export function shapeByType(typeId: string): ShapeDef | undefined {
  return SHAPES.find((s) => s.typeId === typeId);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 形の大きさの目安。s は基準の長さ（キャンバスの短い辺 × 0.3 くらい） */
export function shapeBox(shape: ShapeId, cx: number, cy: number, s: number): { x0: number; y0: number; x1: number; y1: number } {
  switch (shape) {
    case 'rect':
      return { x0: cx - 0.75 * s, y0: cy - 0.4 * s, x1: cx + 0.75 * s, y1: cy + 0.4 * s };
    case 'square':
      return { x0: cx - 0.5 * s, y0: cy - 0.5 * s, x1: cx + 0.5 * s, y1: cy + 0.5 * s };
    case 'triangle':
      return { x0: cx - 0.6 * s, y0: cy - 0.525 * s, x1: cx + 0.6 * s, y1: cy + 0.525 * s };
    case 'halfUp':
    case 'halfDown':
      return { x0: cx - 0.75 * s, y0: cy - 0.375 * s, x1: cx + 0.75 * s, y1: cy + 0.375 * s };
    case 'diamond':
      return { x0: cx - 0.55 * s, y0: cy - 0.75 * s, x1: cx + 0.55 * s, y1: cy + 0.75 * s };
    case 'circle':
    default:
      return { x0: cx - 0.6 * s, y0: cy - 0.6 * s, x1: cx + 0.6 * s, y1: cy + 0.6 * s };
  }
}

/** 形の SVG パス（Canvas の Path2D にも使う）。中心 (cx, cy)。 */
export function shapePathD(shape: ShapeId, cx: number, cy: number, s: number): string {
  const b = shapeBox(shape, cx, cy, s);
  switch (shape) {
    case 'rect':
    case 'square':
      return `M${r1(b.x0)} ${r1(b.y0)}H${r1(b.x1)}V${r1(b.y1)}H${r1(b.x0)}Z`;
    case 'triangle':
      return `M${r1(cx)} ${r1(b.y0)}L${r1(b.x1)} ${r1(b.y1)}L${r1(b.x0)} ${r1(b.y1)}Z`;
    case 'halfUp': {
      // 平らな辺が下、弧が上（カメの甲羅・帽子）
      const r = 0.75 * s;
      return `M${r1(cx - r)} ${r1(b.y1)}H${r1(cx + r)}A${r1(r)} ${r1(r)} 0 0 0 ${r1(cx - r)} ${r1(b.y1)}Z`;
    }
    case 'halfDown': {
      // 平らな辺が上、弧が下（笑った口）
      const r = 0.75 * s;
      return `M${r1(cx - r)} ${r1(b.y0)}H${r1(cx + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(cx - r)} ${r1(b.y0)}Z`;
    }
    case 'diamond':
      return `M${r1(cx)} ${r1(b.y0)}L${r1(b.x1)} ${r1(cy)}L${r1(cx)} ${r1(b.y1)}L${r1(b.x0)} ${r1(cy)}Z`;
    case 'circle':
    default: {
      const r = 0.6 * s;
      return `M${r1(cx - r)} ${r1(cy)}A${r1(r)} ${r1(r)} 0 1 0 ${r1(cx + r)} ${r1(cy)}A${r1(r)} ${r1(r)} 0 1 0 ${r1(cx - r)} ${r1(cy)}Z`;
    }
  }
}

/**
 * 形をえらぶ（つづけて同じ形にしない）。
 * 重み = priority × 2 ÷ (1 + これまでの回数 + この回で選んだ回数 × 2)
 */
export function pickShapes(
  candidates: ShapeDef[],
  count: number,
  pastCounts: Record<string, number>,
  next: () => number
): ShapeDef[] {
  const out: ShapeDef[] = [];
  if (!candidates.length) return out;
  const picked: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const prev = out[out.length - 1];
    const pool = candidates.length > 1 ? candidates.filter((c) => c !== prev) : candidates;
    const ws = pool.map((c) => (c.priority * 2) / (1 + (pastCounts[c.typeId] ?? 0) + (picked[c.typeId] ?? 0) * 2));
    const total = ws.reduce((a, b) => a + b, 0);
    let r = next() * total;
    let chosen = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) {
      r -= ws[j];
      if (r < 0) {
        chosen = pool[j];
        break;
      }
    }
    out.push(chosen);
    picked[chosen.typeId] = (picked[chosen.typeId] ?? 0) + 1;
  }
  return out;
}
