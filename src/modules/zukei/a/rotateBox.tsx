import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, FILL, finalize, INK, pickDistinct, RotateHint, STRONG, type Draft } from './svg';
import { element, matKey, MIRROR, mul, rotN, svgMatrix, type Mat } from './transform';

// 回転（旗の箱）— 本番：「四角い箱に旗。これを2回まわすとどれになりますか？」（4択を指差し）

function Content({ dot }: { dot: boolean }) {
  return (
    <>
      <line x1={30} y1={22} x2={30} y2={66} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <polygon points="30,22 60,32 30,42" fill={STRONG.red} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {dot && <circle cx={72} cy={72} r={8} fill={STRONG.blue} />}
    </>
  );
}

function Box({ mat, dot }: { mat: Mat; dot: boolean }) {
  return (
    <>
      <rect x={5} y={5} width={90} height={90} rx={12} fill={FILL.yellow} stroke={INK} strokeWidth={3} />
      <g transform={svgMatrix(mat)}>
        <Content dot={dot} />
      </g>
    </>
  );
}

function BoxSvg({ mat, dot }: { mat: Mat; dot: boolean }) {
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      <Box mat={mat} dot={dot} />
    </svg>
  );
}

export function generateRotateBox(rng: Rng) {
  const bm = rng.int(0, 1);
  const br = rng.int(0, 3);
  const base = element(bm, br);
  const n = rng.chance(0.5) ? 1 : 2;
  const dir: 'cw' | 'ccw' = rng.chance(0.6) ? 'cw' : 'ccw';
  const dot = rng.chance(0.5);
  const k = dir === 'cw' ? n : 4 - n;
  const correct = mul(rotN(k), base);

  const draft = (key: string, m: Mat): Draft & { sig: string } => ({ key, sig: matKey(m), node: <BoxSvg mat={m} dot={dot} /> });
  const trap = draft('mirror', mul(MIRROR, correct)); // 裏返し
  const cands = [
    draft('under', mul(rotN(k - 1), base)),
    draft('over', mul(rotN(k + 1), base)),
    draft('orig', base),
    draft('other', mul(rotN(-k), base)),
    draft('flipV', mul(rotN(2), mul(MIRROR, correct)))
  ];
  const others = pickDistinct(rng, cands, 2, [matKey(correct), trap.sig]);
  const dirKana = dir === 'cw' ? 'みぎ' : 'ひだり';
  const dirK = dir === 'cw' ? '右' : '左';
  return finalize(rng, {
    type: 'zukei-rotate-box',
    prompt: `この はこを ${dirKana}に ${n}かい まわすと、どれに なりますか。`,
    speech: `この箱を、${dirK}に ${n}回 まわすと、どれに なりますか。`,
    figure: (
      <svg viewBox="0 0 240 120" style={FIG_STYLE} aria-hidden="true">
        <g transform="translate(40 10)">
          <Box mat={base} dot={dot} />
        </g>
        <RotateHint x={188} y={62} dir={dir} r={28} />
      </svg>
    ),
    choices: [draft('ok', correct), trap, ...others],
    answerKey: 'ok',
    params: { base: [bm, br], n, dir, dot },
    explain: n === 2 ? '2回＝さかさま（180°）' : `${dirK}に90°（1回）。旗の向きと位置を見る`
  });
}

export const rotateBoxType: QuestionType = {
  id: 'zukei-rotate-box',
  name: '回転（旗の箱）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '本番',
  description: '旗などの印を描いた四角い箱を、右（左）に1回＝90°ずつ回したらどうなるか。選択肢に裏返し（鏡像）と別の角度を混ぜる。',
  priority: 3,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateRotateBox
};
