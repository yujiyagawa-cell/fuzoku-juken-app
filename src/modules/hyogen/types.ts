import type { QuestionType } from '../../player/types';

// 表現・模倣の問題タイプ（すべて保護者判定）

export type HyogenKind = 'hyogen-rhythm-walk' | 'hyogen-pose' | 'hyogen-sing-copy' | 'hyogen-instrument' | 'hyogen-metronome' | 'hyogen-dance';

export const HYOGEN_TYPES: QuestionType[] = [
  {
    id: 'hyogen-rhythm-walk',
    name: '手拍子のリズムで歩く',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: '本番',
    description: '先生（アプリ）が手をたたく（4拍・3〜6回）。そのリズムのとおりに歩く。お手本は1回だけ。保護者が判定し、「すぐ はじめた」「どうどうと」をチェック。',
    priority: 3,
    answer: 'parent',
    sample: 'せんせいが てを たたきます。その リズムの とおりに あるいてください。'
  },
  {
    id: 'hyogen-pose',
    name: '手と足のまね（ポーズ）',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: '本番',
    description: '棒人間のポーズを見て同じように動く。「見てから まねる（2〜3ポーズを覚える）」と「いっしょに まねる（4秒ごとに変わる）」の2通り。',
    priority: 3,
    answer: 'parent',
    sample: 'せんせいが うごきます。おなじように うごいてください。'
  },
  {
    id: 'hyogen-sing-copy',
    name: 'まねして歌う',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: '本番',
    description: 'オリジナルの短いメロディ（毎回ちがう・2小節）を聞いて、「ら」でまねして歌う。本番は先生が作った知らない歌だった。',
    priority: 2,
    answer: 'parent',
    sample: 'せんせいが うたいます。おなじように 「ら」で うたってください。'
  },
  {
    id: 'hyogen-instrument',
    name: '楽器を選んで鳴らす',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: '本番',
    description: 'トライアングル・カスタネット・タンバリン・すずから好きな楽器を選び、音楽に合わせて鳴らす（画面の楽器をたたくと音が出る）。',
    priority: 2,
    answer: 'parent',
    sample: 'すきな がっきを えらんで、おんがくに あわせて ならしてください。'
  },
  {
    id: 'hyogen-metronome',
    name: 'メトロノームに合わせて歩く',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: 'ノート',
    description: 'メトロノームの速さに合わせて歩く（約16秒。半分の確率で途中から速さが変わる）。',
    priority: 2,
    answer: 'parent',
    sample: 'メトロノームの はやさに あわせて あるいてください。'
  },
  {
    id: 'hyogen-dance',
    name: '自由に踊る',
    genre: 'hyogen',
    moduleId: 'hyogen',
    source: 'ノート',
    description: '音楽に合わせて、手と足を動かして自由に踊る（約20秒）。恥ずかしがらず、すぐ・堂々と動けるか。',
    priority: 2,
    answer: 'parent',
    sample: 'てと あしを うごかして、じゆうに おどってください。'
  }
];
