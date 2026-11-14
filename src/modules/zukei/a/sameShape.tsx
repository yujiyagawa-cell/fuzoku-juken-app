import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, FILL, finalize, INK, type Draft } from './svg';

// 同じ形さがし（ノート：同図形の選択）
// マス目をつないだ形（4〜6マス）。正解＝見本を回したもの。まちがい＝裏返し（を回したもの）と、1マスちがう形。
// 見本は「回しても裏返しても、ほかの向きと重ならない」形だけを使う（正解が1つに決まるように）。

export type Cells = [number, number][]; // [x, y]

export function normalize(cells: Cells): Cells {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function shapeKey(cells: Cells): string {
  return normalize(cells)
    .map((c) => c.join(','))
    .join(';');
}

/** 時計回りに 90°（画面座標） */
export function rotCW(cells: Cells): Cells {
  return normalize(cells.map(([x, y]) => [-y, x] as [number, number]));
}

export function mirrorX(cells: Cells): Cells {
  return normalize(cells.map(([x, y]) => [-x, y] as [number, number]));
}

export function rotations(cells: Cells): Cells[] {
  const out: Cells[] = [normalize(cells)];
  for (let i = 1; i < 4; i++) out.push(rotCW(out[i - 1]));
  return out;
}

export function allForms(cells: Cells): string[] {
  return [...rotations(cells), ...rotations(mirrorX(cells))].map(shapeKey);
}

function isConnected(cells: Cells): boolean {
  if (!cells.length) return false;
  const set = new Set(cells.map((c) => c.join(',')));
  const seen = new Set([cells[0].join(',')]);
  const q = [cells[0]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        q.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function growPoly(rng: Rng, k: number): Cells {
  const cells: Cells = [[1, 1]];
  const has = (x: number, y: number) => cells.some((c) => c[0] === x && c[1] === y);
  let guard = 0;
  while (cells.length < k && guard++ < 200) {
    const [x, y] = rng.pick(cells);
    const [dx, dy] = rng.pick(DIRS);
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx > 3 || ny > 3 || has(nx, ny)) continue;
    cells.push([nx, ny]);
  }
  return normalize(cells);
}

/** 1マスだけ場所をかえた形（見本とは回しても裏返しても重ならないもの） */
function nearMiss(rng: Rng, cells: Cells): Cells | null {
  const forms = new Set(allForms(cells));
  for (let t = 0; t < 40; t++) {
    const i = rng.int(0, cells.length - 1);
    const rest = cells.filter((_, j) => j !== i);
    if (!isConnected(rest)) continue;
    const [bx, by] = rng.pick(rest);
    const [dx, dy] = rng.pick(DIRS);
    const nx = bx + dx;
    const ny = by + dy;
    if (rest.some((c) => c[0] === nx && c[1] === ny)) continue;
    if (nx === cells[i][0] && ny === cells[i][1]) continue;
    const cand = normalize([...rest, [nx, ny]]);
    if (Math.max(...cand.map((c) => c[0])) > 4 || Math.max(...cand.map((c) => c[1])) > 4) continue;
    if (forms.has(shapeKey(cand))) continue;
    return cand;
  }
  return null;
}

export interface SameShapeModel {
  sample: Cells;
  rot: number;
  choices: { key: string; cells: Cells }[]; // key 'ok' が正解
}

export function sameShapeModel(rng: Rng): SameShapeModel {
  for (let t = 0; t < 200; t++) {
    const k = rng.pick([4, 5, 5, 6]);
    const sample = growPoly(rng, k);
    if (sample.length !== k) continue;
    const forms = allForms(sample);
    if (new Set(forms).size !== 8) continue; // 対称な形は使わない
    const rots = rotations(sample);
    const mirs = rotations(mirrorX(sample));
    const rot = rng.int(1, 3);
    const choices: { key: string; cells: Cells }[] = [{ key: 'ok', cells: rots[rot] }];
    const mirPick = rng.sample([0, 1, 2, 3], 3);
    choices.push({ key: 'm1', cells: mirs[mirPick[0]] }, { key: 'm2', cells: mirs[mirPick[1]] });
    const nm = nearMiss(rng, sample);
    if (nm) choices.push({ key: 'near', cells: rotations(nm)[rng.int(0, 3)] });
    else choices.push({ key: 'm3', cells: mirs[mirPick[2]] });
    return { sample, rot, choices };
  }
  throw new Error('zukei-same-shape: 作れませんでした');
}

const CELL = 16;

function Poly({ cells, cx, cy, cell = CELL, fill = FILL.purple }: { cells: Cells; cx: number; cy: number; cell?: number; fill?: string }) {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  const x0 = cx - (w * cell) / 2;
  const y0 = cy - (h * cell) / 2;
  return (
    <>
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x0 + x * cell} y={y0 + y * cell} width={cell} height={cell} fill={fill} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      ))}
    </>
  );
}

function PolySvg({ cells }: { cells: Cells }) {
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      <Poly cells={cells} cx={50} cy={50} />
    </svg>
  );
}

export function generateSameShape(rng: Rng) {
  const m = sameShapeModel(rng);
  const choices: Draft[] = m.choices.map((c) => ({ key: c.key, sig: shapeKey(c.cells), node: <PolySvg cells={c.cells} /> }));
  return finalize(rng, {
    type: 'zukei-same-shape',
    prompt: 'みほんと おなじ かたちは どれですか。むきが かわって いる ものも あります。',
    speech: '見本と 同じ 形は どれですか。向きが 変わっている ものも あります。',
    figure: (
      <svg viewBox="0 0 220 124" style={{ ...FIG_STYLE, maxHeight: 170 }} aria-hidden="true">
        <rect x={55} y={4} width={110} height={116} rx={14} fill={FILL.gray} stroke={INK} strokeWidth={2} />
        <text x={110} y={20} fontSize={13} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill={INK}>
          みほん
        </text>
        <Poly cells={m.sample} cx={110} cy={70} cell={18} />
      </svg>
    ),
    choices,
    answerKey: 'ok',
    params: { sample: m.sample, rot: m.rot },
    explain: `見本を右に${m.rot * 90}°回した形（裏返しはちがう形）`
  });
}

export const sameShapeType: QuestionType = {
  id: 'zukei-same-shape',
  name: '同じ形さがし',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '見本と同じ形を選ぶ。正解は見本を回したもの。まちがいに裏返し（鏡に映した形）と1マスちがう形を混ぜる。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateSameShape
};
