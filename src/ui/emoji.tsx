import type { CSSProperties } from 'react';

// 絵文字の絵カード。kana は読み上げ・しりとり・aria 用のひらがな（長音は「ー」）。
// 外部画像は使わない（仕様）。端末の絵文字フォントで表示する。

export interface EmojiItem {
  id: string;
  char: string;
  kana: string;
  tags?: string[]; // 'animal' | 'food' | 'thing' | 'nature' | 'vehicle' | 'event' | 'person' | 'clothes' | 'bug' | 'sea'
}

const E = (id: string, char: string, kana: string, ...tags: string[]): EmojiItem => ({ id, char, kana, tags });

export const EMOJI: EmojiItem[] = [
  // どうぶつ
  E('inu', '🐶', 'いぬ', 'animal'),
  E('neko', '🐱', 'ねこ', 'animal'),
  E('usagi', '🐰', 'うさぎ', 'animal'),
  E('kuma', '🐻', 'くま', 'animal'),
  E('tanuki', '🦝', 'たぬき', 'animal'),
  E('kitsune', '🦊', 'きつね', 'animal'),
  E('buta', '🐷', 'ぶた', 'animal'),
  E('zou', '🐘', 'ぞう', 'animal'),
  E('kirin', '🦒', 'きりん', 'animal'),
  E('saru', '🐵', 'さる', 'animal'),
  E('nezumi', '🐭', 'ねずみ', 'animal'),
  E('ushi', '🐮', 'うし', 'animal'),
  E('uma', '🐴', 'うま', 'animal'),
  E('hitsuji', '🐑', 'ひつじ', 'animal'),
  E('raion', '🦁', 'らいおん', 'animal'),
  E('tora', '🐯', 'とら', 'animal'),
  E('panda', '🐼', 'ぱんだ', 'animal'),
  E('koara', '🐨', 'こあら', 'animal'),
  E('risu', '🐿️', 'りす', 'animal'),
  E('gorira', '🦍', 'ごりら', 'animal'),
  E('rakuda', '🐪', 'らくだ', 'animal'),
  E('shika', '🦌', 'しか', 'animal'),
  E('shimauma', '🦓', 'しまうま', 'animal'),
  E('harinezumi', '🦔', 'はりねずみ', 'animal'),
  E('rakko', '🦦', 'らっこ', 'animal', 'sea'),
  E('hiyoko', '🐤', 'ひよこ', 'animal', 'bird'),
  E('niwatori', '🐔', 'にわとり', 'animal', 'bird'),
  E('tori', '🐦', 'ことり', 'animal', 'bird'),
  E('pengin', '🐧', 'ぺんぎん', 'animal', 'bird'),
  E('fukurou', '🦉', 'ふくろう', 'animal', 'bird'),
  E('ahiru', '🦆', 'あひる', 'animal', 'bird'),
  E('kame', '🐢', 'かめ', 'animal'),
  E('hebi', '🐍', 'へび', 'animal'),
  E('kaeru', '🐸', 'かえる', 'animal'),
  E('wani', '🐊', 'わに', 'animal'),
  // うみ・かわ
  E('sakana', '🐟', 'さかな', 'sea'),
  E('tako', '🐙', 'たこ', 'sea'),
  E('ika', '🦑', 'いか', 'sea'),
  E('kani', '🦀', 'かに', 'sea'),
  E('ebi', '🦐', 'えび', 'sea'),
  E('kujira', '🐳', 'くじら', 'sea'),
  E('iruka', '🐬', 'いるか', 'sea'),
  E('kai', '🐚', 'かい', 'sea'),
  // むし
  E('ari', '🐜', 'あり', 'bug'),
  E('choucho', '🦋', 'ちょうちょ', 'bug'),
  E('hachi', '🐝', 'はち', 'bug'),
  E('tentoumushi', '🐞', 'てんとうむし', 'bug'),
  E('batta', '🦗', 'ばった', 'bug'),
  E('katatsumuri', '🐌', 'かたつむり', 'bug'),
  // たべもの
  E('ringo', '🍎', 'りんご', 'food', 'fruit'),
  E('mikan', '🍊', 'みかん', 'food', 'fruit'),
  E('banana', '🍌', 'ばなな', 'food', 'fruit'),
  E('ichigo', '🍓', 'いちご', 'food', 'fruit'),
  E('budou', '🍇', 'ぶどう', 'food', 'fruit'),
  E('suika', '🍉', 'すいか', 'food', 'fruit'),
  E('momo', '🍑', 'もも', 'food', 'fruit'),
  E('meron', '🍈', 'めろん', 'food', 'fruit'),
  E('sakuranbo', '🍒', 'さくらんぼ', 'food', 'fruit'),
  E('kuri', '🌰', 'くり', 'food'),
  E('ninjin', '🥕', 'にんじん', 'food', 'vegetable'),
  E('tomato', '🍅', 'とまと', 'food', 'vegetable'),
  E('nasu', '🍆', 'なす', 'food', 'vegetable'),
  E('kinoko', '🍄', 'きのこ', 'food'),
  E('toumorokoshi', '🌽', 'とうもろこし', 'food', 'vegetable'),
  E('pan', '🍞', 'ぱん', 'food'),
  E('onigiri', '🍙', 'おにぎり', 'food'),
  E('sushi', '🍣', 'すし', 'food'),
  E('keki', '🍰', 'けーき', 'food'),
  E('aisu', '🍦', 'あいす', 'food'),
  E('purin', '🍮', 'ぷりん', 'food'),
  E('donatsu', '🍩', 'どーなつ', 'food'),
  E('tamago', '🥚', 'たまご', 'food'),
  E('dango', '🍡', 'だんご', 'food'),
  E('gyunyu', '🥛', 'ぎゅうにゅう', 'food'),
  // もの
  E('isu', '🪑', 'いす', 'thing'),
  E('kasa', '☂️', 'かさ', 'thing'),
  E('kutsu', '👟', 'くつ', 'thing', 'clothes'),
  E('boushi', '🧢', 'ぼうし', 'thing', 'clothes'),
  E('megane', '👓', 'めがね', 'thing'),
  E('kaban', '👜', 'かばん', 'thing'),
  E('tebukuro', '🧤', 'てぶくろ', 'thing', 'clothes'),
  E('kutsushita', '🧦', 'くつした', 'thing', 'clothes'),
  E('shatsu', '👕', 'しゃつ', 'thing', 'clothes'),
  E('zubon', '👖', 'ずぼん', 'thing', 'clothes'),
  E('hon', '📕', 'ほん', 'thing'),
  E('enpitsu', '✏️', 'えんぴつ', 'thing'),
  E('hasami', '✂️', 'はさみ', 'thing'),
  E('tokei', '⏰', 'とけい', 'thing'),
  E('kagi', '🔑', 'かぎ', 'thing'),
  E('denwa', '☎️', 'でんわ', 'thing'),
  E('terebi', '📺', 'てれび', 'thing'),
  E('fuusen', '🎈', 'ふうせん', 'thing'),
  E('taiko', '🥁', 'たいこ', 'thing', 'music'),
  E('rappa', '🎺', 'らっぱ', 'thing', 'music'),
  E('piano', '🎹', 'ぴあの', 'thing', 'music'),
  E('maiku', '🎤', 'まいく', 'thing', 'music'),
  E('saikoro', '🎲', 'さいころ', 'thing'),
  E('booru', '⚽', 'ぼーる', 'thing'),
  E('nuigurumi', '🧸', 'ぬいぐるみ', 'thing'),
  E('mado', '🪟', 'まど', 'thing'),
  E('kagami', '🪞', 'かがみ', 'thing'),
  E('sori', '🛷', 'そり', 'thing'),
  E('koori', '🧊', 'こおり', 'thing'),
  E('mizu', '💧', 'みず', 'nature'),
  // のりもの
  E('densha', '🚃', 'でんしゃ', 'vehicle'),
  E('kuruma', '🚗', 'くるま', 'vehicle'),
  E('basu', '🚌', 'ばす', 'vehicle'),
  E('fune', '🚢', 'ふね', 'vehicle'),
  E('hikouki', '✈️', 'ひこうき', 'vehicle'),
  E('jitensha', '🚲', 'じてんしゃ', 'vehicle'),
  E('roketto', '🚀', 'ろけっと', 'vehicle'),
  // しぜん
  E('hoshi', '⭐', 'ほし', 'nature'),
  E('tsuki', '🌙', 'つき', 'nature'),
  E('taiyou', '☀️', 'たいよう', 'nature'),
  E('kumo', '☁️', 'くも', 'nature'),
  E('ame', '☔', 'あめ', 'nature'),
  E('yuki', '❄️', 'ゆき', 'nature', 'winter'),
  E('yukidaruma', '⛄', 'ゆきだるま', 'nature', 'winter'),
  E('niji', '🌈', 'にじ', 'nature'),
  E('kaminari', '⚡', 'かみなり', 'nature'),
  E('sakura', '🌸', 'さくら', 'nature', 'spring', 'flower'),
  E('himawari', '🌻', 'ひまわり', 'nature', 'summer', 'flower'),
  E('churippu', '🌷', 'ちゅーりっぷ', 'nature', 'spring', 'flower'),
  E('bara', '🌹', 'ばら', 'nature', 'flower'),
  E('ki', '🌳', 'き', 'nature'),
  E('momiji', '🍁', 'もみじ', 'nature', 'autumn'),
  E('yama', '⛰️', 'やま', 'nature'),
  E('ie', '🏠', 'いえ', 'thing'),
  E('gakkou', '🏫', 'がっこう', 'thing'),
  // ぎょうじ
  E('koinobori', '🎏', 'こいのぼり', 'event', 'spring'),
  E('tanabata', '🎋', 'たなばた', 'event', 'summer'),
  E('hinaningyou', '🎎', 'おひなさま', 'event', 'spring'),
  E('kadomatsu', '🎍', 'かどまつ', 'event', 'winter'),
  E('tako-kite', '🪁', 'たこ', 'event', 'winter'),
  E('hanabi', '🎆', 'はなび', 'event', 'summer'),
  E('otsukimi', '🎑', 'おつきみ', 'event', 'autumn'),
  E('kurisumasu', '🎄', 'くりすます', 'event', 'winter'),
  // ひと
  E('otokonoko', '👦', 'おとこのこ', 'person'),
  E('onnanoko', '👧', 'おんなのこ', 'person'),
  E('akachan', '👶', 'あかちゃん', 'person'),
  E('ojiisan', '👴', 'おじいさん', 'person'),
  E('obaasan', '👵', 'おばあさん', 'person'),
  E('omawarisan', '👮', 'おまわりさん', 'person')
];

const BY_ID = new Map(EMOJI.map((e) => [e.id, e]));

export function emo(id: string): EmojiItem {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`emoji not found: ${id}`);
  return e;
}

export function emojiByTag(tag: string): EmojiItem[] {
  return EMOJI.filter((e) => e.tags?.includes(tag));
}

/** 絵文字1つを絵として表示 */
export function Emoji({ char, size = 48, label, style }: { char: string; size?: number; label?: string; style?: CSSProperties }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', fontFamily: '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif', ...style }}
    >
      {char}
    </span>
  );
}

/** id から表示 */
export function EmojiOf({ id, size = 48 }: { id: string; size?: number }) {
  const e = emo(id);
  return <Emoji char={e.char} size={size} label={e.kana} />;
}
