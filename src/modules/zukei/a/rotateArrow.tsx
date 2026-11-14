import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { CHOICE_STYLE, FIG_STYLE, FILL, finalize, INK, RotateHint, STRONG, type Draft } from './svg';

// ▷の回転（ノート：90°、180°）— 向き 0=右 1=下 2=左 3=上（時計回りの順）

const DIR_KANA = ['みぎむき', 'したむき', 'ひだりむき', 'うえむき'];
const DIR_KANJI = ['右向き', '下向き', '左向き', '上向き'];

function Shape({ shape, d }: { shape: 'tri' | 'arrow'; d: number }) {
  const t = `rotate(${d * 90} 50 50)`;
  return shape === 'tri' ? (
    <polygon points="26,20 82,50 26,80" transform={t} fill={STRONG.orange} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  ) : (
    <polygon points="14,40 52,40 52,22 86,50 52,78 52,60 14,60" transform={t} fill={STRONG.blue} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  );
}

function ShapeSvg({ shape, d }: { shape: 'tri' | 'arrow'; d: number }) {
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      <Shape shape={shape} d={d} />
    </svg>
  );
}

export function generateRotateArrow(rng: Rng, only?: 'tri' | 'arrow') {
  const shape: 'tri' | 'arrow' = only ?? (rng.chance(0.65) ? 'tri' : 'arrow');
  const d0 = rng.int(0, 3);
  const n = rng.chance(0.55) ? 1 : 2;
  const dir: 'cw' | 'ccw' = rng.chance(0.6) ? 'cw' : 'ccw';
  const d1 = (((d0 + (dir === 'cw' ? n : -n)) % 4) + 4) % 4;
  const choices: Draft[] = [0, 1, 2, 3].map((d) => ({
    key: d === d1 ? 'ok' : `d${d}`,
    sig: `d${d}`,
    node: <ShapeSvg shape={shape} d={d} />,
    label: DIR_KANA[d]
  }));
  const name = shape === 'tri' ? 'さんかく' : 'やじるし';
  const nameK = shape === 'tri' ? '三角' : '矢印';
  const dirKana = dir === 'cw' ? 'みぎ' : 'ひだり';
  const dirK = dir === 'cw' ? '右' : '左';
  return finalize(rng, {
    type: 'zukei-rotate-arrow',
    prompt: `この ${name}を ${dirKana}に ${n}かい まわすと、どの むきに なりますか。`,
    speech: `この${nameK}を、${dirK}に ${n}回 まわすと、どの 向きに なりますか。`,
    figure: (
      <svg viewBox="0 0 240 120" style={FIG_STYLE} aria-hidden="true">
        <rect x={40} y={10} width={100} height={100} rx={14} fill={FILL.gray} stroke={INK} strokeWidth={2} />
        <g transform="translate(40 10)">
          <Shape shape={shape} d={d0} />
        </g>
        <RotateHint x={188} y={62} dir={dir} r={28} />
      </svg>
    ),
    choices,
    answerKey: 'ok',
    labelMode: 'content',
    params: { shape, d0, n, dir },
    explain: `${DIR_KANJI[d0]} →（${dirK}に${n * 90}°）→ ${DIR_KANJI[d1]}`
  });
}

export const rotateArrowType: QuestionType = {
  id: 'zukei-rotate-arrow',
  name: '▷の回転（90°・180°）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート',
  description: '▷（三角）を右（左）に1回＝90°、2回＝180°回すと、どの向きになるか。4つの向きから選ぶ。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 6,
  generate: (rng) => generateRotateArrow(rng, 'tri')
};

export const rotateMarkType: QuestionType = {
  id: 'zukei-rotate-arrow-mark',
  name: '矢印の回転',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'アプリ（追加）',
  description: '矢印を右（左）に1回＝90°、2回＝180°回すと、どの向きになるか。▷の回転と同じ形式で、プリントにはない（アプリで足した）。',
  priority: 1,
  answer: 'tap',
  speedTargetSec: 6,
  generate: (rng) => ({ ...generateRotateArrow(rng, 'arrow'), type: 'zukei-rotate-arrow-mark' })
};
