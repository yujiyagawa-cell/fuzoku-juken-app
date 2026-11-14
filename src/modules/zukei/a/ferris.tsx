import type { Rng } from '../../../core/rng';
import type { QuestionType } from '../../../player/types';
import { Emoji, type EmojiItem } from '../../../ui/emoji';
import { ANIMALS } from './pools';
import { ArcArrow, FIG_STYLE, finalize, INK, numberDrafts, pickDistinct, STRONG, SvgEmoji, type Draft } from './svg';

// 観覧車 — 本番：「観覧車が1個動くと一番上に来る動物は？」。ノート：「どうしてその答えですか？」と聞かれる
// ゴンドラの番号 i は いちばん上が 0、時計回りに 1, 2, …

function Ferris({ animals, dir }: { animals: EmojiItem[]; dir: 'cw' | 'ccw' }) {
  const N = animals.length;
  const cx = 120;
  const cy = 120;
  const R = 76;
  const pos = (i: number) => {
    const a = ((-90 + (i * 360) / N) * Math.PI) / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  return (
    <svg viewBox="0 0 240 240" style={FIG_STYLE} aria-hidden="true">
      <path d={`M ${cx} ${cy} L ${cx - 50} 232 M ${cx} ${cy} L ${cx + 50} 232`} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={cx - 80} y1={232} x2={cx + 80} y2={232} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={3} />
      {animals.map((_, i) => {
        const [x, y] = pos(i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#8a97ab" strokeWidth={2} />;
      })}
      <circle cx={cx} cy={cy} r={9} fill={INK} />
      {animals.map((a, i) => {
        const [x, y] = pos(i);
        return (
          <g key={a.id}>
            <circle cx={x} cy={y} r={21} fill="#fff" stroke={INK} strokeWidth={2.5} />
            <SvgEmoji x={x} y={y + 1} size={25} char={a.char} />
          </g>
        );
      })}
      <polygon points={`${cx - 9},3 ${cx + 9},3 ${cx},16`} fill={STRONG.red} />
      <ArcArrow cx={cx} cy={cy} r={R + 34} a0={dir === 'cw' ? -55 : 5} a1={dir === 'cw' ? 5 : -55} />
    </svg>
  );
}

export function generateFerris(rng: Rng) {
  const N = rng.chance(0.6) ? 6 : 8;
  const animals = rng.sample(ANIMALS, N);
  const dir: 'cw' | 'ccw' = rng.chance(0.6) ? 'cw' : 'ccw';
  const formB = rng.chance(0.25);
  const mod = (x: number) => ((x % N) + N) % N;
  const figure = <Ferris animals={animals} dir={dir} />;
  const ids = animals.map((a) => a.id);

  if (!formB) {
    const k = rng.int(1, 3);
    // 時計回り：上に来るのは 上から反時計回りに k 番目（i = N-k）。反時計回り：i = k
    const src = dir === 'cw' ? mod(-k) : mod(k);
    const opp = dir === 'cw' ? mod(k) : mod(-k);
    const draft = (i: number, key = `i${i}`): Draft => ({
      key,
      sig: animals[i].id,
      node: <Emoji char={animals[i].char} size={54} />,
      label: animals[i].kana
    });
    const prefer = [opp, 0].filter((i) => i !== src).map((i) => draft(i));
    const near = [mod(src + 1), mod(src - 1), mod(src + 2), mod(src - 2)].filter((i) => i !== src).map((i) => draft(i));
    const others = pickDistinct(rng, [...prefer, ...rng.shuffle(near)], 3, [animals[src].id], true);
    return finalize(rng, {
      type: 'zukei-ferris',
      prompt: `かんらんしゃが やじるしの ほうに ${k}こ うごくと、いちばん うえに くる どうぶつは どれですか。`,
      speech: `観覧車が、矢印の ほうに ${k}個 動くと、いちばん 上に 来る 動物は どれですか。`,
      figure,
      choices: [draft(src, 'ok'), ...others],
      answerKey: 'ok',
      labelMode: 'content',
      askReason: true,
      params: { N, animals: ids, dir, form: 'A', k },
      explain: `${dir === 'cw' ? '時計回り' : '反時計回り'}に${k}こ → ${animals[src].kana}（今の上は${animals[0].kana}）`
    });
  }

  // B：「◯◯が いちばん うえに くるのは なんこ うごいた とき」
  const k = rng.int(1, Math.min(4, N - 1));
  const p = dir === 'cw' ? mod(-k) : mod(k);
  const target = animals[p];
  return finalize(rng, {
    type: 'zukei-ferris',
    prompt: `${target.kana}が いちばん うえに くるのは、やじるしの ほうに なんこ うごいた ときですか。`,
    speech: `${target.kana}が いちばん 上に 来るのは、矢印の ほうに 何個 動いた ときですか。`,
    figure,
    choices: numberDrafts(rng, k, { prefer: [N - k, k + 1, k - 1], min: 1, max: N - 1, unit: 'こ' }),
    answerKey: 'ok',
    labelMode: 'content',
    askReason: true,
    params: { N, animals: ids, dir, form: 'B', k, p },
    explain: `${target.kana}は 上から${dir === 'cw' ? '反時計回り' : '時計回り'}に${k}つ目 → ${k}こ`
  });
}

export const ferrisType: QuestionType = {
  id: 'zukei-ferris',
  name: '観覧車',
  genre: 'zukei',
  moduleId: 'zukei',
  source: '本番',
  description: '6〜8個のゴンドラに動物。矢印の向きに◯こ動くと一番上に来るのはどれか（または、◯◯が一番上に来るのは何こ動いたときか）。答えたあと「どうして その こたえですか」と理由を聞く。',
  priority: 3,
  answer: 'tap',
  speedTargetSec: 8,
  generate: generateFerris
};
