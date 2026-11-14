// 出題される可能性のある歌（ノート5枚目の「すべてにチェック」の12曲）
// 歌詞（文）と音源はアプリに入れない（著作権。アプリとリポジトリは公開している）。
// 正しく歌えているかの自動判定のために、1番に出てくる ふつうの ことばを 1語ずつ（順番は並べかえて）だけ持つ。
// 覚えるときは YouTube で聞く。

export interface Song {
  id: string;
  title: string; // 表示（ひらがな中心）
  speech: string; // 検索用の曲名
  icons: string[]; // 絵に出すアイコン（1つ目が代表）
  iconLabel: string; // 絵の説明（ひらがな）
  keywords: string[]; // 判定用のことば（ひらがな・1語ずつ）
}

export const SONGS: Song[] = [
  {
    id: 'inu-omawari',
    title: 'いぬの おまわりさん',
    speech: '犬のおまわりさん',
    icons: ['🐶', '👮', '🐱'],
    iconLabel: 'いぬと おまわりさんと まいごの ねこ',
    keywords: ['おうち', 'おまわりさん', 'こねこ', 'なまえ', 'まいご', 'わんわん']
  },
  {
    id: 'kobutanukitsuneko',
    title: 'こぶたぬきつねこ',
    speech: 'こぶたぬきつねこ',
    icons: ['🐷', '🦝', '🦊', '🐱'],
    iconLabel: 'ぶた・たぬき・きつね・ねこ',
    keywords: ['きつね', 'こぶた', 'こんこん', 'たぬき', 'ぽんぽこ', 'ねこ']
  },
  {
    id: 'koinobori',
    title: 'こいのぼり',
    speech: 'こいのぼり',
    icons: ['🎏'],
    iconLabel: 'こいのぼり',
    keywords: ['おとうさん', 'こいのぼり', 'こども', 'たかい', 'ひごい', 'まごい', 'やね']
  },
  {
    id: 'kotori',
    title: 'ことりの うた',
    speech: 'ことりのうた',
    icons: ['🐦'],
    iconLabel: 'ことり',
    keywords: ['うた', 'かあさん', 'ことり', 'すき', 'ちいちい', 'とっても']
  },
  {
    id: 'zousan',
    title: 'ぞうさん',
    speech: 'ぞうさん',
    icons: ['🐘'],
    iconLabel: 'ぞう',
    keywords: ['おはな', 'かあさん', 'ぞうさん', 'ながい']
  },
  {
    id: 'medaka',
    title: 'めだかの がっこう',
    speech: 'めだかの学校',
    icons: ['🐟', '🌊'],
    iconLabel: 'めだかと おがわ',
    keywords: ['おゆうぎ', 'かわ', 'がっこう', 'そっと', 'のぞいて', 'めだか']
  },
  {
    id: 'choucho',
    title: 'ちょうちょう',
    speech: 'ちょうちょう',
    icons: ['🦋'],
    iconLabel: 'ちょうちょ',
    keywords: ['あそべ', 'さくら', 'ちょうちょう', 'とまれ', 'なのは']
  },
  {
    id: 'otsukai-arisan',
    title: 'おつかい ありさん',
    speech: 'おつかいありさん',
    icons: ['🐜'],
    iconLabel: 'あり',
    keywords: ['ありさん', 'あんまり', 'いそいで', 'こっつんこ']
  },
  {
    id: 'tulip',
    title: 'チューリップ',
    speech: 'チューリップ',
    icons: ['🌷'],
    iconLabel: 'ちゅーりっぷ',
    keywords: ['きいろ', 'きれい', 'さいた', 'ちゅーりっぷ', 'ならんだ']
  },
  {
    id: 'oshougatsu',
    title: 'おしょうがつ',
    speech: 'お正月',
    icons: ['🎍', '🪁'],
    iconLabel: 'かどまつと たこ',
    keywords: ['あそびましょう', 'いくつ', 'おしょうがつ', 'こま', 'たこ', 'まわして']
  },
  {
    id: 'hinamatsuri',
    title: 'うれしい ひなまつり',
    speech: 'うれしいひなまつり',
    icons: ['🎎'],
    iconLabel: 'おひなさま',
    keywords: ['あかり', 'ごにんばやし', 'ひなまつり', 'ぼんぼり', 'もも']
  },
  {
    id: 'tanabata',
    title: 'たなばたさま',
    speech: 'たなばたさま',
    icons: ['🎋', '⭐'],
    iconLabel: 'ささかざりと ほし',
    keywords: ['おほしさま', 'きらきら', 'きんぎん', 'さらさら', 'のきば', 'ささ']
  }
];

export function songById(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}

// 検索のことば（同じ題名の別の歌とまちがえないように、よく知られた呼び方を足す）
const QUERY: Record<string, string> = {
  'inu-omawari': '犬のおまわりさん',
  kobutanukitsuneko: 'こぶたぬきつねこ',
  koinobori: 'こいのぼり 屋根より高い',
  kotori: 'ことりのうた 童謡',
  zousan: 'ぞうさん 童謡',
  medaka: 'めだかの学校',
  choucho: 'ちょうちょう 童謡',
  'otsukai-arisan': 'おつかいありさん',
  tulip: 'チューリップ 童謡',
  oshougatsu: 'お正月 もういくつねると',
  hinamatsuri: 'うれしいひなまつり',
  tanabata: 'たなばたさま 童謡'
};

export function songQuery(song: Song): string {
  return QUERY[song.id] ?? `${song.speech} 童謡`;
}

/** 曲名で YouTube を検索するリンク（保護者が動画を決めたらそのリンクを使う） */
export function youtubeSearchUrl(song: Song): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(songQuery(song))}`;
}

/** 歌詞を探す（歌詞はアプリに入れない。許諾を受けた歌詞サイトなどで見る） */
export function lyricsSearchUrl(song: Song): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${songQuery(song)} 歌詞`)}`;
}

/** 画面に歌詞が出る動画を探す */
export function lyricVideoSearchUrl(song: Song): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${songQuery(song)} 歌詞付き`)}`;
}
