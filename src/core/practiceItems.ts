// 運動・生活（巧緻性）の練習項目。保護者が「運動・生活ログ」で記録する。
// 出どころ：手書きノート（6・7・18・19枚目）、聞き取り（昨年の本番）、仕様 6.8。

export interface PracticeFields {
  /** 秒数を記録する。better：長いほどよい（ぶら下がり）／短いほどよい（くま歩き） */
  seconds?: { better: 'higher' | 'lower'; target?: number };
  /** ○／× を記録する */
  ok?: boolean;
  /** きれいさ（1〜3） */
  quality?: boolean;
  /** 回数を記録する。failure＝失敗の回数（0回がよい：転んだ・落ちた） */
  count?: { label: string; failure?: boolean };
}

export interface PracticeItem {
  id: string;
  name: string;
  genre: 'undo' | 'seikatsu';
  source: string; // '本番' | 'ノート' | 'ノート（予想）' | '仕様'
  priority: 1 | 2 | 3;
  fields: PracticeFields;
  tip?: string;
  /** ストップウォッチの時間（秒）の初期値。はさみ・折り紙・箸など */
  stopwatchSec?: number;
}

const COMMON_UNDO = '先生のお手本と注意をよく聞いて、そのとおりに。「途中で失敗してもやり直さないでください」と言われる。';

export const PRACTICE_ITEMS: PracticeItem[] = [
  // ---- 運動 ----
  {
    id: 'tetsubo-dangomushi',
    name: '鉄棒ダンゴムシ',
    genre: 'undo',
    source: '本番',
    priority: 3,
    fields: { seconds: { better: 'higher', target: 10 } },
    tip: 'あごを引いて ひじを曲げたまま ぶら下がる。昨年は10秒。「いいですよ」と言われるまでガマン。'
  },
  {
    id: 'tetsubo-tsubame',
    name: '鉄棒つばめ（頭を下げて戻る）',
    genre: 'undo',
    source: '本番',
    priority: 3,
    fields: { ok: true },
    tip: 'つばめの姿勢から頭を下げ、また元に戻る（昨年の本番）。'
  },
  {
    id: 'tetsubo-burasagari',
    name: '鉄棒ぶら下がり',
    genre: 'undo',
    source: '本番',
    priority: 3,
    fields: { seconds: { better: 'higher', target: 10 } },
    tip: '「1秒で落ちてしまった」子がいた。「いいですよ」まで手をはなさない。'
  },
  {
    id: 'kuma-aruki',
    name: 'くま歩き',
    genre: 'undo',
    source: '本番',
    priority: 3,
    fields: { seconds: { better: 'lower' }, count: { label: '転んだ回数', failure: true } },
    tip: '青テープから赤テープまで「なるべく速く」。ひざをつかない・転ばない。'
  },
  {
    id: 'tobibako',
    name: '跳び箱（登ってフワッと降りる）',
    genre: 'undo',
    source: '本番',
    priority: 3,
    fields: { ok: true },
    tip: '両足をそろえて3段の上に登る → マットや丸の中へ「フワッと降りてください」。'
  },
  {
    id: 'heikindai',
    name: '平均台（またいで進む）',
    genre: 'undo',
    source: 'ノート（予想）',
    priority: 1,
    fields: { seconds: { better: 'lower' }, count: { label: '落ちた回数', failure: true } },
    tip: '「なるべく速く歩いてから、フワッと降りてください」。'
  },
  {
    id: 'kenkenpa',
    name: 'ケンケンパ（左ケン・両パ）',
    genre: 'undo',
    source: 'ノート（予想）',
    priority: 1,
    fields: { ok: true },
    tip: '先生がやるとおりに：左ケンケン・両パ・左ケンケン・両パ。輪の線をふまない。'
  },
  {
    id: 'zenten',
    name: '前転',
    genre: 'undo',
    source: 'ノート',
    priority: 2,
    fields: { ok: true },
    tip: COMMON_UNDO
  },
  // ---- 生活・巧緻性 ----
  {
    id: 'zoukin',
    name: 'ぞうきん絞り',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true },
    tip: 'たてに持って、手首を内側にひねって絞る。水がたれなければ○。'
  },
  {
    id: 'hasami',
    name: 'はさみ（線のとおり・ひし形）',
    genre: 'seikatsu',
    source: '本番',
    priority: 3,
    fields: { seconds: { better: 'lower' }, quality: true },
    tip: '本番はひし形を切った。先生のストップウォッチが「ピピピ」と鳴ったら途中でも「おしまいです」。',
    stopwatchSec: 60
  },
  {
    id: 'origami',
    name: '折り紙（三角・四角）',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true, quality: true },
    tip: '角と角をきちんと合わせて、折り目をつける。',
    stopwatchSec: 60
  },
  {
    id: 'hashi',
    name: '箸で移す（おはじき3＋スポンジ3）',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { seconds: { better: 'lower' } },
    tip: '紙皿のお花のおはじき3個と白いスポンジ3個を、箸で別の皿へ。',
    stopwatchSec: 60
  },
  {
    id: 'chocho-musubi',
    name: 'ちょうちょ結び',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true }
  },
  {
    id: 'himo',
    name: 'しばったヒモをほどいて元通り',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true },
    tip: 'ほどいたあと「元通りに直してください」と言われる。'
  },
  {
    id: 'fuku-tatami',
    name: '服（シャツ）たたみ',
    genre: 'seikatsu',
    source: 'ノート（予想）',
    priority: 1,
    fields: { seconds: { better: 'lower' }, ok: true }
  },
  {
    id: 'kasa',
    name: '傘をたたむ',
    genre: 'seikatsu',
    source: 'ノート（予想）',
    priority: 1,
    fields: { ok: true }
  },
  {
    id: 'kyushokugi',
    name: '給食着を着る',
    genre: 'seikatsu',
    source: 'ノート（予想）',
    priority: 1,
    fields: { ok: true }
  },
  {
    id: 'kutsu',
    name: 'くつをそろえてしまう',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true },
    tip: 'くつをぬいでそろえ、決められたコーナーにしまう（見られている）。'
  },
  {
    id: 'katazuke',
    name: '合図で片付ける',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { ok: true },
    tip: '合図があったらすぐ手を止めて片付ける。'
  },
  {
    id: 'sentaku-basami',
    name: '洗濯バサミを戻す',
    genre: 'seikatsu',
    source: '仕様',
    priority: 1,
    fields: { ok: true }
  },
  {
    id: 'plate-puzzle',
    name: 'プレートパズル（見本と同じに）',
    genre: 'seikatsu',
    source: 'ノート',
    priority: 2,
    fields: { seconds: { better: 'lower' }, ok: true },
    tip: '机の上の見本（△○◇の組み合わせ）と同じように作る。'
  },
  {
    id: 'tsumiki-saigen',
    name: '積み木で見本を再現（ロボット）',
    genre: 'seikatsu',
    source: '本番',
    priority: 3,
    fields: { seconds: { better: 'lower' }, ok: true },
    tip: '昨年は積み木で作ったロボットの写真を見て、同じように重ねた。'
  },
  {
    id: 'tsumiki-kyoryoku',
    name: 'みんなで協力して積み木（声かけ）',
    genre: 'seikatsu',
    source: '本番',
    priority: 3,
    fields: { ok: true },
    tip: '声をかけ合って高く積む。ふざけない。終わったら片付けまで。'
  }
];

export function practiceItemById(id: string): PracticeItem | undefined {
  return PRACTICE_ITEMS.find((p) => p.id === id);
}
