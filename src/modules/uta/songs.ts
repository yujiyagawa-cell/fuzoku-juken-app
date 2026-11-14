// 出題される可能性のある歌（ノート5枚目の「すべてにチェック」の12曲）
// 歌詞・音源はアプリに入れない。曲名とアイコン（絵文字）だけ。覚えるときは YouTube で聞く。

export interface Song {
  id: string;
  title: string; // 表示（ひらがな中心）
  speech: string; // 読み上げ
  icons: string[]; // 絵に出すアイコン（1つ目が代表）
  iconLabel: string; // 絵の説明（ひらがな）
}

export const SONGS: Song[] = [
  { id: 'inu-omawari', title: 'いぬの おまわりさん', speech: '犬のおまわりさん', icons: ['🐶', '👮', '🐱'], iconLabel: 'いぬと おまわりさんと まいごの ねこ' },
  { id: 'kobutanukitsuneko', title: 'こぶたぬきつねこ', speech: 'こぶたぬきつねこ', icons: ['🐷', '🦝', '🦊', '🐱'], iconLabel: 'ぶた・たぬき・きつね・ねこ' },
  { id: 'koinobori', title: 'こいのぼり', speech: 'こいのぼり', icons: ['🎏'], iconLabel: 'こいのぼり' },
  { id: 'kotori', title: 'ことりの うた', speech: 'ことりのうた', icons: ['🐦'], iconLabel: 'ことり' },
  { id: 'zousan', title: 'ぞうさん', speech: 'ぞうさん', icons: ['🐘'], iconLabel: 'ぞう' },
  { id: 'medaka', title: 'めだかの がっこう', speech: 'めだかの学校', icons: ['🐟', '🌊'], iconLabel: 'めだかと おがわ' },
  { id: 'choucho', title: 'ちょうちょう', speech: 'ちょうちょう', icons: ['🦋'], iconLabel: 'ちょうちょ' },
  { id: 'otsukai-arisan', title: 'おつかい ありさん', speech: 'おつかいありさん', icons: ['🐜'], iconLabel: 'あり' },
  { id: 'tulip', title: 'チューリップ', speech: 'チューリップ', icons: ['🌷'], iconLabel: 'ちゅーりっぷ' },
  { id: 'oshougatsu', title: 'おしょうがつ', speech: 'お正月', icons: ['🎍', '🪁'], iconLabel: 'かどまつと たこ' },
  { id: 'hinamatsuri', title: 'うれしい ひなまつり', speech: 'うれしいひなまつり', icons: ['🎎'], iconLabel: 'おひなさま' },
  { id: 'tanabata', title: 'たなばたさま', speech: 'たなばたさま', icons: ['🎋', '⭐'], iconLabel: 'ささかざりと ほし' }
];

export function songById(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}

/** 曲名で YouTube を検索するリンク（保護者が動画を決めたらそのリンクを使う） */
export function youtubeSearchUrl(song: Song): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.speech} 童謡`)}`;
}
