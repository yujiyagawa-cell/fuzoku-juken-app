import { useEffect, useMemo, useState } from 'react';
import { db } from '../../core/db';
import { judgeKotoba } from '../../core/judge';
import { answerCandidates } from '../../core/reading';
import { makeRng, weightedPick } from '../../core/rng';
import { useSettings } from '../../core/settings';
import type { Settings } from '../../core/types';
import { computeWeakKana, EXAM_KANA } from '../../core/weakKana';
import { TapOne } from '../../player/TapOne';
import type { ModuleDef, QuestionType, RunnerProps } from '../../player/types';
import { VoiceQuestion, type VoiceQSpec } from '../../player/VoiceQuestion';
import { moduleColor } from '../common';
import { generateShiritori } from './shiritori';
import { examplesFor, kanaPool } from './words';

export const KOTOBA_TYPES: QuestionType[] = [
  {
    id: 'kotoba-2',
    name: '「◯」ではじまる2文字',
    genre: 'kotoba',
    moduleId: 'kotoba',
    source: '本番',
    description: '声で答える。読み仮名に直して、はじめの音と文字数を自動で判定。苦手な音（ノートの×・まちがえた音）と本番で聞かれた音（い・ぴ・き・か・お）を多めに出す。',
    priority: 3,
    answer: 'voice',
    speedTargetSec: 3,
    sample: '「い」で はじまる 2もじの ことばを おしえてください。'
  },
  {
    id: 'kotoba-3',
    name: '「◯」ではじまる3文字',
    genre: 'kotoba',
    moduleId: 'kotoba',
    source: '本番',
    description: '本番で「か」「お」がつく3文字を聞かれた。答えに詰まると「大丈夫です」で次へ進む。',
    priority: 3,
    answer: 'voice',
    speedTargetSec: 3,
    sample: '「か」で はじまる 3もじの ことばを おしえてください。'
  },
  {
    id: 'shiritori',
    name: 'しりとり並べ',
    genre: 'kotoba',
    moduleId: 'kotoba',
    source: 'ノート（予想）',
    description: '絵カード3〜4枚を、しりとりになる順にタップする。並べ方が1通りになる組み合わせだけ出す。',
    priority: 2,
    answer: 'tap',
    speedTargetSec: 10,
    sample: 'しりとりに なるように じゅんばんに さわってください。',
    generate: (rng) => generateShiritori(rng)
  }
];

export interface KotobaPair {
  kana: string;
  length: 2 | 3;
}

/** 出す音と文字数を選ぶ（苦手な音×4、本番で出た音×2、2文字と3文字の割合は設定） */
export async function pickKotobaPairs(n: number, settings: Settings, lengths: (2 | 3)[] = [2, 3]): Promise<KotobaPair[]> {
  const rng = makeRng();
  const [atts, seeds] = await Promise.all([
    db.attempts.where('questionType').anyOf('kotoba-2', 'kotoba-3').toArray(),
    db.kanaSeeds.toArray()
  ]);
  const weak = new Set(
    computeWeakKana(atts, seeds)
      .filter((r) => r.weak)
      .map((r) => r.key)
  );
  const both = lengths.includes(2) && lengths.includes(3);
  const pairs: (KotobaPair & { w: number })[] = [];
  for (const kana of kanaPool(settings.includeDakuon)) {
    for (const length of lengths) {
      if (!examplesFor(kana, length, settings.moraRules).length) continue;
      let w = 1;
      if (weak.has(`${kana}-${length}`)) w *= 4;
      if (EXAM_KANA.includes(kana)) w *= 2;
      if (both) w *= length === 3 ? settings.kotobaRatio3 * 2 : (1 - settings.kotobaRatio3) * 2;
      pairs.push({ kana, length, w });
    }
  }
  const out: KotobaPair[] = [];
  const used = new Set<string>();
  while (out.length < n && pairs.length) {
    const fresh = pairs.filter((p) => !used.has(p.kana));
    const p = weightedPick(rng, fresh.length ? fresh : pairs, (x) => x.w);
    used.add(p.kana);
    out.push({ kana: p.kana, length: p.length });
  }
  return out;
}

export function kotobaSpec(p: KotobaPair, settings: Settings, moduleId = 'kotoba'): VoiceQSpec {
  return {
    moduleId,
    questionType: `kotoba-${p.length}`,
    prompt: `「${p.kana}」で はじまる ${p.length}もじの ことばを おしえてください。`,
    speech: `「${p.kana}」で はじまる、${p.length}文字の 言葉を 教えてください。`,
    params: { kana: p.kana, length: p.length },
    examples: examplesFor(p.kana, p.length, settings.moraRules),
    judge: async (t, alts) => {
      const cands = new Set<string>();
      for (const a of [t, ...alts]) for (const c of await answerCandidates(a)) cands.add(c);
      return judgeKotoba([...cands], p.kana, p.length, settings.moraRules, settings.allowDakuonVariant);
    }
  };
}

type KQ = { kind: 'voice'; pair: KotobaPair } | { kind: 'shiritori' };

function KotobaRunner({ count, types, timeLimitSec, session, onDone }: RunnerProps) {
  const { settings } = useSettings();
  const [plan, setPlan] = useState<KQ[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const t = types?.length ? types : null;
      const onlyShiri = !!t && t.every((x) => x === 'shiritori');
      if (onlyShiri) {
        setPlan(Array.from({ length: count }, () => ({ kind: 'shiritori' as const })));
        return;
      }
      const lengths = ([2, 3] as const).filter((l) => !t || t.includes(`kotoba-${l}`));
      const wantShiri = t ? t.includes('shiritori') : count >= 5;
      const nShiri = wantShiri ? (t ? Math.max(1, Math.round(count / 3)) : Math.max(1, Math.floor(count / 5))) : 0;
      const pairs = await pickKotobaPairs(count - nShiri, settings, lengths.length ? [...lengths] : [2, 3]);
      const list: KQ[] = pairs.map((pair) => ({ kind: 'voice', pair }));
      // しりとりは間に入れる
      for (let i = 0; i < nShiri; i++) {
        const pos = Math.min(list.length, Math.round(((i + 1) * list.length) / (nShiri + 1)) + i);
        list.splice(pos, 0, { kind: 'shiritori' });
      }
      setPlan(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shiriQ = useMemo(() => (plan?.[idx]?.kind === 'shiritori' ? generateShiritori(makeRng()) : null), [plan, idx]);

  if (!plan) return <div className="stage" />;
  const q = plan[idx];
  const next = () => (idx + 1 >= plan.length ? onDone() : setIdx(idx + 1));
  if (!q) return null;
  if (q.kind === 'shiritori' && shiriQ) {
    return <TapOne key={idx} q={shiriQ} moduleId="kotoba" session={session} index={idx} total={plan.length} timeLimitSec={timeLimitSec} onNext={next} />;
  }
  if (q.kind === 'voice') {
    return <VoiceQuestion key={idx} spec={kotobaSpec(q.pair, settings)} session={session} index={idx} total={plan.length} onNext={next} />;
  }
  return null;
}

export const kotobaModule: ModuleDef = {
  id: 'kotoba',
  name: 'ことば',
  label: 'ことば即答・しりとり',
  sub: '2もじ・3もじ',
  unit: 'もん',
  defaultCount: 6,
  minCount: 3,
  maxCount: 15,
  step: 1,
  minutesPer: 0.4,
  color: moduleColor('kotoba'),
  icon: 'bubble',
  genre: 'kotoba',
  omakase: true,
  Runner: KotobaRunner
};
