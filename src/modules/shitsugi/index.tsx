import { useEffect, useState, type ReactNode } from 'react';
import { judgeAge, judgeBirthday, judgeHand, judgeName, judgeNursery, judgeProperty, type FixedResult } from '../../core/judge';
import { fullReading } from '../../core/reading';
import { makeRng, weightedPick } from '../../core/rng';
import { useSettings } from '../../core/settings';
import type { PropertyKind, Settings } from '../../core/types';
import type { ModuleDef, QuestionType, RunnerProps } from '../../player/types';
import { VoiceQuestion, type AutoJudgeResult, type VoiceQSpec } from '../../player/VoiceQuestion';
import { Emoji } from '../../ui/emoji';
import { moduleColor } from '../common';
import { kotobaSpec, pickKotobaPairs } from '../kotoba';

export const SHITSUGI_TYPES: QuestionType[] = [
  {
    id: 'shitsugi-profile',
    name: '名前・年齢・誕生日・園・利き手',
    genre: 'shitsugi',
    moduleId: 'shitsugi',
    source: '本番',
    description: '設定した答えと照らして自動判定（名前・誕生日・利き手は本番で聞かれた）。「みぎてを あげてください」は保護者判定。',
    priority: 3,
    answer: 'voice',
    speedTargetSec: 2,
    sample: 'おなまえを おしえてください。'
  },
  {
    id: 'shitsugi-koekake',
    name: '声かけ（絵を見て）',
    genre: 'shitsugi',
    moduleId: 'shitsugi',
    source: '本番',
    description: 'お花を育てている子（本番）・寝ころんでいる子・バッタを見ている子・泣いている子に、なんと声をかけるか。答えたら仮に○、保護者が内容を見て直す。',
    priority: 3,
    answer: 'voice',
    speedTargetSec: 3,
    sample: 'この こたちが おはなを そだてています。なんと こえを かけますか。'
  },
  {
    id: 'shitsugi-free',
    name: '自由回答（がんばったこと・好きな動物となぜ）',
    genre: 'shitsugi',
    moduleId: 'shitsugi',
    source: 'ノート',
    description: '文字起こしと「理由あり」「敬語あり」の目安を表示。答えたら仮に○、保護者が「即答・理由・敬語」をチェックして直す。',
    priority: 2,
    answer: 'voice',
    speedTargetSec: 3,
    sample: 'すきな どうぶつは なんですか。どうして すきなのですか。'
  },
  {
    id: 'shitsugi-property',
    name: '性質（とげとげ・ぴかぴか・ふわふわ）',
    genre: 'shitsugi',
    moduleId: 'shitsugi',
    source: 'ノート',
    description: '候補リスト（設定で追加できる）と照合。リストにない答えは「？」にして保護者が判定。',
    priority: 2,
    answer: 'voice',
    speedTargetSec: 3,
    sample: 'とげとげした ものを ひとつ おしえてください。'
  }
];

// ---- 判定のヘルパー ----
function uniq(a: string[]) {
  return [...new Set(a.filter(Boolean))];
}

async function bestOf(t: string, alts: string[], f: (t: string, reading: string) => FixedResult & { matched?: string }): Promise<AutoJudgeResult> {
  let first: AutoJudgeResult | null = null;
  for (const a of uniq([t, ...alts])) {
    const r = f(a, await fullReading(a));
    if (r.judge === 'correct') return r;
    if (!first) first = r;
  }
  return first ?? { judge: 'unknown' };
}

const answered = async (t: string): Promise<AutoJudgeResult> =>
  t.trim() ? { judge: 'correct', note: '答えた（内容は保護者が確認）' } : { judge: 'unknown', note: 'きこえませんでした' };

// ---- 声かけの絵 ----
function Scene({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, padding: '6px 0 2px', borderBottom: '4px solid #cfe3c4' }}>
      {children}
    </div>
  );
}

const FIGURES: Record<string, ReactNode> = {
  hana: (
    <Scene>
      <Emoji char="👧" size={64} label="おんなのこ" />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Emoji char="💧" size={22} />
        <span>
          <Emoji char="🌷" size={44} label="ちゅーりっぷ" />
          <Emoji char="🌷" size={44} />
        </span>
      </span>
      <Emoji char="👦" size={64} label="おとこのこ" />
    </Scene>
  ),
  nekoron: (
    <Scene>
      <Emoji char="🧒" size={64} label="ねころんでいる こ" style={{ transform: 'rotate(-90deg) translateX(-10px)' }} />
      <Emoji char="🪑" size={44} />
    </Scene>
  ),
  batta: (
    <Scene>
      <Emoji char="👧" size={66} label="おんなのこ" />
      <span style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Emoji char="🌿" size={40} />
        <Emoji char="🦗" size={38} label="ばった" />
      </span>
    </Scene>
  ),
  naku: (
    <Scene>
      <Emoji char="😭" size={72} label="ないている こ" />
    </Scene>
  )
};

// ---- 質問バンク ----
interface SQ {
  key: string;
  type: 'shitsugi-profile' | 'shitsugi-koekake' | 'shitsugi-free' | 'shitsugi-property';
  w: number;
  make: (s: Settings) => VoiceQSpec;
}

const base = (type: SQ['type'], key: string) => ({ moduleId: 'shitsugi', questionType: type, params: { q: key } });

function propertySpec(kind: PropertyKind, label: string, kanji: string): (s: Settings) => VoiceQSpec {
  return (s) => ({
    ...base('shitsugi-property', kind),
    prompt: `${label}した ものを ひとつ おしえてください。`,
    speech: `${kanji}した ものを、ひとつ 教えてください。`,
    examples: s.propertyAnswers[kind].slice(0, 4),
    judge: (t, alts) => bestOf(t, alts, (x, r) => judgeProperty(x, r, s.propertyAnswers[kind]))
  });
}

const nurseryKana = (s: Settings) => (s.nurseryType === 'youchien' ? 'ようちえん' : 'ほいくえん');
const nurseryKanji = (s: Settings) => (s.nurseryType === 'youchien' ? '幼稚園' : '保育園');

export const SHITSUGI_BANK: SQ[] = [
  {
    key: 'name',
    type: 'shitsugi-profile',
    w: 3,
    make: (s) => ({
      ...base('shitsugi-profile', 'name'),
      prompt: 'おなまえを おしえてください。',
      speech: 'お名前を 教えてください。',
      examples: [s.childNameKanji || s.childName].filter(Boolean),
      judge: (t, alts) => bestOf(t, alts, (x, r) => judgeName(x, r, s))
    })
  },
  {
    key: 'age',
    type: 'shitsugi-profile',
    w: 2,
    make: (s) => ({
      ...base('shitsugi-profile', 'age'),
      prompt: 'なんさいですか。',
      speech: '何歳ですか。',
      examples: s.age ? [`${s.age}さいです`] : [],
      judge: (t, alts) => bestOf(t, alts, (x, r) => judgeAge(x, r, s))
    })
  },
  {
    key: 'birthday',
    type: 'shitsugi-profile',
    w: 3,
    make: (s) => ({
      ...base('shitsugi-profile', 'birthday'),
      prompt: 'おたんじょうびは いつですか。',
      speech: 'お誕生日は いつですか。',
      examples: s.birthday.month ? [`${s.birthday.month}がつ ${s.birthday.day}にちです`] : [],
      judge: (t, alts) => bestOf(t, alts, (x, r) => judgeBirthday(x, r, s))
    })
  },
  {
    key: 'nursery',
    type: 'shitsugi-profile',
    w: 1,
    make: (s) => ({
      ...base('shitsugi-profile', 'nursery'),
      prompt: 'ようちえんですか、ほいくえんですか。',
      speech: '幼稚園ですか、保育園ですか。',
      examples: [`${nurseryKana(s)}です`],
      judge: (t, alts) => bestOf(t, alts, (x, r) => judgeNursery(x, r, s))
    })
  },
  {
    key: 'handedness',
    type: 'shitsugi-profile',
    w: 3,
    make: (s) => ({
      ...base('shitsugi-profile', 'handedness'),
      prompt: 'みぎききですか、ひだりききですか。',
      speech: '右利きですか、左利きですか。',
      examples: s.handedness ? [s.handedness === 'right' ? 'みぎききです' : 'ひだりききです'] : [],
      judge: (t, alts) => bestOf(t, alts, (x, r) => judgeHand(x, r, s))
    })
  },
  {
    key: 'righthand',
    type: 'shitsugi-profile',
    w: 2,
    make: () => ({
      ...base('shitsugi-profile', 'righthand'),
      prompt: 'みぎては どちらですか。みぎてを あげてください。',
      speech: '右手は どちらですか。右手を あげてください。',
      parentOnly: true,
      judgeLabels: { correct: 'みぎて', wrong: 'ひだりて', unknown: 'あげない' }
    })
  },
  // 声かけ
  {
    key: 'hana',
    type: 'shitsugi-koekake',
    w: 3,
    make: () => ({
      ...base('shitsugi-koekake', 'hana'),
      prompt: 'この こたちが おはなを そだてています。それを みた あなたは、なんと こえを かけますか。',
      speech: 'この子たちが、お花を 育てています。それを見た あなたは、何と 声を かけますか。',
      figure: FIGURES.hana,
      examples: ['おはなが きれいだね', 'いっしょに みずを あげてもいいですか'],
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'nekoron',
    type: 'shitsugi-koekake',
    w: 2,
    make: () => ({
      ...base('shitsugi-koekake', 'nekoron'),
      prompt: 'ねころんで いる こが います。なんと こえを かけますか。',
      speech: '寝ころんでいる子が います。何と 声を かけますか。',
      figure: FIGURES.nekoron,
      examples: ['だいじょうぶですか', 'ちゃんと すわろうよ'],
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'batta',
    type: 'shitsugi-koekake',
    w: 2,
    make: () => ({
      ...base('shitsugi-koekake', 'batta'),
      prompt: 'バッタを みている おんなのこが います。なんと こえを かけますか。',
      speech: 'バッタを 見ている 女の子が います。何と 声を かけますか。',
      figure: FIGURES.batta,
      examples: ['なにを みているの', 'いっしょに みても いいですか'],
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'naku',
    type: 'shitsugi-koekake',
    w: 1,
    make: () => ({
      ...base('shitsugi-koekake', 'naku'),
      prompt: 'ないている こが います。なんと こえを かけますか。',
      speech: '泣いている子が います。何と 声を かけますか。',
      figure: FIGURES.naku,
      examples: ['だいじょうぶ？', 'どうしたの？ せんせいを よんでくるね'],
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  // 自由回答
  {
    key: 'ganbatta',
    type: 'shitsugi-free',
    w: 1,
    make: (s) => ({
      ...base('shitsugi-free', 'ganbatta'),
      prompt: `${nurseryKana(s)}で がんばったことは なんですか。`,
      speech: `${nurseryKanji(s)}で 頑張ったことは 何ですか。`,
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'tanoshikatta',
    type: 'shitsugi-free',
    w: 1,
    make: (s) => ({
      ...base('shitsugi-free', 'tanoshikatta'),
      prompt: `${nurseryKana(s)}で たのしかったことは なんですか。`,
      speech: `${nurseryKanji(s)}で 楽しかったことは 何ですか。`,
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'dekita',
    type: 'shitsugi-free',
    w: 1,
    make: (s) => ({
      ...base('shitsugi-free', 'dekita'),
      prompt: `${nurseryKana(s)}で できるように なって よかったことは なんですか。`,
      speech: `${nurseryKanji(s)}で できるようになって 良かったことは 何ですか。`,
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'shougakkou',
    type: 'shitsugi-free',
    w: 1,
    make: () => ({
      ...base('shitsugi-free', 'shougakkou'),
      prompt: 'しょうがっこうで がんばりたいことは なんですか。',
      speech: '小学校で 頑張りたいことは 何ですか。',
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  {
    key: 'doubutsu',
    type: 'shitsugi-free',
    w: 2,
    make: () => ({
      ...base('shitsugi-free', 'doubutsu'),
      prompt: 'すきな どうぶつは なんですか。どうして すきなのですか。',
      speech: '好きな 動物は 何ですか。どうして 好きなのですか。',
      examples: ['うさぎです。ふわふわで かわいいからです'],
      hints: true,
      checks: true,
      judge: (t) => answered(t)
    })
  },
  // 性質
  { key: 'togetoge', type: 'shitsugi-property', w: 2, make: propertySpec('togetoge', 'とげとげ', 'とげとげ') },
  { key: 'pikapika', type: 'shitsugi-property', w: 2, make: propertySpec('pikapika', 'ぴかぴか', 'ぴかぴか') },
  { key: 'fuwafuwa', type: 'shitsugi-property', w: 1, make: propertySpec('fuwafuwa', 'ふわふわ', 'ふわふわ') }
];

function ShitsugiRunner({ count, types, session, onDone }: RunnerProps) {
  const { settings } = useSettings();
  const [specs, setSpecs] = useState<VoiceQSpec[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const rng = makeRng();
      const t = types?.length ? types : null;
      let bank = SHITSUGI_BANK.filter((q) => !t || t.includes(q.type));
      const wantKotoba = t ? t.some((x) => x.startsWith('kotoba')) : settings.mixKotobaInShitsugi;
      if (!bank.length && !wantKotoba) bank = SHITSUGI_BANK;
      const out: VoiceQSpec[] = [];
      // 本番どおり、まず名前から
      const name = bank.find((q) => q.key === 'name');
      if (name) {
        out.push(name.make(settings));
        bank = bank.filter((q) => q !== name);
      }
      const nKotoba = wantKotoba ? (bank.length ? Math.max(1, Math.floor(count / 4)) : count) : 0;
      while (out.length < count - nKotoba && bank.length) {
        const q = weightedPick(rng, bank, (x) => x.w);
        bank = bank.filter((x) => x !== q);
        out.push(q.make(settings));
      }
      if (nKotoba) {
        const pairs = await pickKotobaPairs(Math.max(nKotoba, count - out.length), settings);
        for (const p of pairs) {
          const pos = rng.int(Math.min(1, out.length), out.length);
          out.splice(pos, 0, kotobaSpec(p, settings, 'shitsugi'));
        }
      }
      setSpecs(out.slice(0, count));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!specs) return <div className="stage" />;
  const spec = specs[idx];
  if (!spec) return null;
  return (
    <VoiceQuestion
      key={idx}
      spec={spec}
      session={session}
      index={idx}
      total={specs.length}
      onNext={() => (idx + 1 >= specs.length ? onDone() : setIdx(idx + 1))}
    />
  );
}

export const shitsugiModule: ModuleDef = {
  id: 'shitsugi',
  name: 'しつもん',
  label: '質疑応答',
  sub: 'すぐに こたえる',
  unit: 'もん',
  defaultCount: 5,
  minCount: 3,
  maxCount: 12,
  step: 1,
  minutesPer: 0.5,
  color: moduleColor('shitsugi'),
  icon: 'question',
  genre: 'shitsugi',
  omakase: true,
  Runner: ShitsugiRunner
};
