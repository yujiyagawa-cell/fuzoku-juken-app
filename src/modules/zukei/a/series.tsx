import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { Emoji, emo } from '../../../ui/emoji';
import { CHOICE_STYLE, FIG_STYLE, finalize, INK, STRONG, SvgEmoji, type Draft } from './svg';

// 系列（きまりの並び）— ◯△□ や くだもの が くりかえし並ぶ。？に入るものを選ぶ

interface Sym {
  id: string;
  kana: string;
  shape?: 'circle' | 'triangle' | 'square' | 'diamond' | 'star' | 'heart';
  color?: string;
  char?: string;
}

const SHAPES: Sym[] = [
  { id: 'circle', kana: 'まる', shape: 'circle', color: STRONG.red },
  { id: 'triangle', kana: 'さんかく', shape: 'triangle', color: STRONG.blue },
  { id: 'square', kana: 'しかく', shape: 'square', color: STRONG.green },
  { id: 'diamond', kana: 'ひしがた', shape: 'diamond', color: STRONG.orange },
  { id: 'star', kana: 'ほし', shape: 'star', color: STRONG.yellow },
  { id: 'heart', kana: 'ハート', shape: 'heart', color: STRONG.pink }
];

const toSym = (id: string): Sym => {
  const e = emo(id);
  return { id: e.id, kana: e.kana, char: e.char };
};
const FRUITS: Sym[] = ['ringo', 'banana', 'budou', 'ichigo', 'mikan', 'momo'].map(toSym);
const PETS: Sym[] = ['inu', 'neko', 'usagi', 'kuma', 'panda', 'buta'].map(toSym);

const TEMPLATES = ['AB', 'AAB', 'ABB', 'ABC', 'AABB', 'ABAC', 'ABCB'];

function starPoints(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rr = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function SymMark({ s, cx, cy, size }: { s: Sym; cx: number; cy: number; size: number }) {
  if (s.char) return <SvgEmoji x={cx} y={cy} size={size * 0.85} char={s.char} />;
  const k = size / 2;
  const common = { fill: s.color, stroke: INK, strokeWidth: Math.max(1.5, size / 20), strokeLinejoin: 'round' as const };
  switch (s.shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={k * 0.82} {...common} />;
    case 'triangle':
      return <polygon points={`${cx},${cy - k * 0.9} ${cx + k * 0.95},${cy + k * 0.75} ${cx - k * 0.95},${cy + k * 0.75}`} {...common} />;
    case 'square':
      return <rect x={cx - k * 0.75} y={cy - k * 0.75} width={k * 1.5} height={k * 1.5} {...common} />;
    case 'diamond':
      return <polygon points={`${cx},${cy - k} ${cx + k * 0.8},${cy} ${cx},${cy + k} ${cx - k * 0.8},${cy}`} {...common} />;
    case 'star':
      return <polygon points={starPoints(cx, cy, k, k * 0.45)} {...common} />;
    default:
      return (
        <path
          d={`M ${cx} ${cy + k * 0.85} C ${cx - k * 1.3} ${cy - k * 0.1} ${cx - k * 0.6} ${cy - k * 1.05} ${cx} ${cy - k * 0.4} C ${cx + k * 0.6} ${cy - k * 1.05} ${cx + k * 1.3} ${cy - k * 0.1} ${cx} ${cy + k * 0.85} Z`}
          {...common}
        />
      );
  }
}

function SymChoice({ s }: { s: Sym }) {
  if (s.char) return <Emoji char={s.char} size={56} />;
  return (
    <svg viewBox="0 0 100 100" style={CHOICE_STYLE} aria-hidden="true">
      <SymMark s={s} cx={50} cy={50} size={70} />
    </svg>
  );
}

export function generateSeries(rng: Rng) {
  const tpl = rng.pick(TEMPLATES);
  const p = tpl.length;
  const letters = [...new Set(tpl.split(''))];
  const setName = rng.pick(['shape', 'shape', 'fruit', 'pet']);
  const alphabet = setName === 'shape' ? SHAPES : setName === 'fruit' ? FRUITS : PETS;
  const syms = rng.sample(alphabet, letters.length);
  const symOf = (ch: string) => syms[letters.indexOf(ch)];
  const L = Math.min(9, Math.max(6, rng.int(2 * p + 1, 3 * p)));
  const seq = Array.from({ length: L }, (_, i) => symOf(tpl[i % p]));
  const miss = rng.chance(0.5) ? L - 1 : rng.int(p, L - 2);
  const answer = seq[miss];

  const cell = 38;
  const W = L * cell + 6;
  const figure = (
    <svg viewBox={`0 0 ${W} 52`} style={{ ...FIG_STYLE, maxHeight: 120 }} aria-hidden="true">
      {seq.map((s, i) => {
        const cx = 3 + i * cell + cell / 2;
        if (i === miss) {
          return (
            <g key={i}>
              <rect x={cx - 16} y={8} width={32} height={36} rx={7} fill="#fff" stroke={INK} strokeWidth={2} strokeDasharray="5 4" />
              <text x={cx} y={27} fontSize={22} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#8a97ab">
                ？
              </text>
            </g>
          );
        }
        return <SymMark key={i} s={s} cx={cx} cy={26} size={30} />;
      })}
    </svg>
  );

  const others = [...syms.filter((s) => s.id !== answer.id), ...rng.shuffle(alphabet.filter((s) => !syms.includes(s)))].slice(0, 3);
  const choices: Draft[] = [answer, ...others].map((s) => ({ key: s.id === answer.id ? 'ok' : s.id, sig: s.id, node: <SymChoice s={s} />, label: s.kana }));
  return finalize(rng, {
    type: 'zukei-series',
    prompt: 'きまりよく ならんでいます。？に はいるのは どれですか。',
    speech: 'きまりよく 並んでいます。はてなの ところに 入るのは どれですか。',
    figure,
    choices,
    answerKey: 'ok',
    labelMode: 'content',
    params: { tpl, seq: seq.map((s) => s.id), miss },
    explain: `「${letters.map((ch) => symOf(ch).kana).join('・')}」の くりかえし（${tpl}）`
  });
}

export const seriesType: QuestionType = {
  id: 'zukei-series',
  name: '系列（きまりの並び）',
  genre: 'zukei',
  moduleId: 'zukei',
  source: 'ノート（予想）',
  description: '◯△□ や くだもの・どうぶつが決まった順にくりかえし並ぶ（AB・AAB・ABC・AABB など）。？に入るものを選ぶ。',
  priority: 2,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateSeries
};
