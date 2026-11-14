import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, finalize, INK, pickDistinct, RotateHint, STRONG, type Draft } from './svg';
import { applyCell, element, MIRROR, mul, rotN, type Mat } from './transform';

// マス目の回転（とっくん42 型）— 3×3 のマス目の印を、右（左）に回したらどうなるか

type Kind = 'circle' | 'square' | 'cross';
interface Mark {
  kind: Kind;
  r: number;
  c: number;
}

const KINDS: Kind[] = ['circle', 'square', 'cross'];
const CELL = 30;
const O = 5;

function apply(marks: Mark[], m: Mat): Mark[] {
  return marks.map((k) => {
    const [r, c] = applyCell(m, k.r, k.c, 3);
    return { kind: k.kind, r, c };
  });
}

function sigOf(marks: Mark[]): string {
  return marks
    .map((m) => `${m.kind[0]}${m.r}${m.c}`)
    .sort()
    .join('|');
}

function MarkShape({ m }: { m: Mark }) {
  const cx = O + m.c * CELL + CELL / 2;
  const cy = O + m.r * CELL + CELL / 2;
  if (m.kind === 'circle') return <circle cx={cx} cy={cy} r={9} fill={STRONG.red} />;
  if (m.kind === 'square') return <rect x={cx - 8} y={cy - 8} width={16} height={16} fill={STRONG.blue} />;
  return (
    <g stroke={STRONG.green} strokeWidth={5} strokeLinecap="round">
      <line x1={cx - 8} y1={cy - 8} x2={cx + 8} y2={cy + 8} />
      <line x1={cx + 8} y1={cy - 8} x2={cx - 8} y2={cy + 8} />
    </g>
  );
}

function Grid({ marks }: { marks: Mark[] }) {
  const lines = [];
  for (let i = 1; i < 3; i++) {
    lines.push(<line key={`v${i}`} x1={O + i * CELL} y1={O} x2={O + i * CELL} y2={O + 3 * CELL} stroke={INK} strokeWidth={2} />);
    lines.push(<line key={`h${i}`} x1={O} y1={O + i * CELL} x2={O + 3 * CELL} y2={O + i * CELL} stroke={INK} strokeWidth={2} />);
  }
  return (
    <>
      <rect x={O} y={O} width={3 * CELL} height={3 * CELL} rx={4} fill="#fff" stroke={INK} strokeWidth={3} />
      {lines}
      {marks.map((m, i) => (
        <MarkShape key={i} m={m} />
      ))}
    </>
  );
}

function GridSvg({ marks }: { marks: Mark[] }) {
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      <Grid marks={marks} />
    </svg>
  );
}

export function generateRotateGrid(rng: Rng) {
  for (let tries = 0; tries < 50; tries++) {
    const count = rng.chance(0.6) ? 2 : 3;
    const kinds = rng.shuffle(KINDS).slice(0, count);
    const cells = rng.shuffle([0, 1, 2, 3, 5, 6, 7, 8]).slice(0, count); // まんなか（4）は使わない
    const marks: Mark[] = kinds.map((kind, i) => ({ kind, r: Math.floor(cells[i] / 3), c: cells[i] % 3 }));
    const n = rng.chance(0.6) ? 1 : 2;
    const dir: 'cw' | 'ccw' = rng.chance(0.6) ? 'cw' : 'ccw';
    const k = dir === 'cw' ? n : 4 - n;
    const correct = apply(marks, rotN(k));
    const csig = sigOf(correct);
    const draft = (key: string, ms: Mark[]): Draft => ({ key, sig: sigOf(ms), node: <GridSvg marks={ms} /> });
    const trap = draft('mirror', apply(correct, MIRROR));
    if (trap.sig === csig) continue; // 左右対称の並びは作り直し
    const cands = [
      draft('under', apply(marks, rotN(k - 1))),
      draft('over', apply(marks, rotN(k + 1))),
      draft('orig', marks),
      draft('other', apply(marks, rotN(-k))),
      draft('flipV', apply(correct, mul(rotN(2), MIRROR))),
      draft('m2', apply(marks, element(1, k + 1)))
    ];
    const others = pickDistinct(rng, cands, 2, [csig, trap.sig]);
    if (others.length < 2) continue;
    const dirKana = dir === 'cw' ? 'みぎ' : 'ひだり';
    const dirK = dir === 'cw' ? '右' : '左';
    return finalize(rng, {
      type: 'zukei-rotate-grid',
      prompt: `この マスを ${dirKana}に ${n}かい まわすと、どう なりますか。`,
      speech: `このマス目を、${dirK}に ${n}回 まわすと、どうなりますか。`,
      figure: (
        <svg viewBox="0 0 240 120" style={FIG_STYLE} aria-hidden="true">
          <g transform="translate(40 10)">
            <Grid marks={marks} />
          </g>
          <RotateHint x={188} y={62} dir={dir} r={28} />
        </svg>
      ),
      choices: [draft('ok', correct), trap, ...others],
      answerKey: 'ok',
      params: { marks: marks.map((m) => [m.kind, m.r, m.c]), n, dir },
      explain: n === 2 ? '2回＝さかさま（180°）。印の位置がどこへ動くか' : `${dirK}に90°。角の印は となりの角へ動く`
    });
  }
  throw new Error('zukei-rotate-grid: 作れませんでした');
}

export const rotateGridType: QuestionType = {
  id: 'zukei-rotate-grid',
  name: 'マス目の回転',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'とっくん42',
  description: '3×3 のマス目に ●■✕ を2〜3個。右（左）に1回＝90°、2回＝180°回したマス目を選ぶ。裏返しと別の角度を混ぜる。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 10,
  generate: generateRotateGrid
};
