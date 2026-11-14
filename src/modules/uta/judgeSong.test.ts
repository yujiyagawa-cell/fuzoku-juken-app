import { describe, expect, it } from 'vitest';
import { judgeSinging, scoreSongs } from './judgeSong';
import { SONGS, songById } from './songs';

const pick = (...ids: string[]) => ids.map((id) => songById(id)!);

describe('歌のことばで判定', () => {
  it('ことばが2つ以上あれば ○ で、どの歌かも分かる', () => {
    const r = judgeSinging('ぞうさんぞうさんおはながながいのね', pick('zousan', 'tulip', 'koinobori'));
    expect(r.judge).toBe('correct');
    expect(r.best?.song.id).toBe('zousan');
    expect(r.best?.hits).toEqual(expect.arrayContaining(['ぞうさん', 'おはな', 'ながい']));
  });

  it('4文字以上の言葉なら1つでも ○', () => {
    expect(judgeSinging('ちゅーりっぷのはな', pick('tulip', 'zousan')).judge).toBe('correct');
  });

  it('ききとれないときは × ではなく ？', () => {
    expect(judgeSinging('', SONGS).judge).toBe('unknown');
    expect(judgeSinging('らららららら', SONGS).judge).toBe('unknown');
  });

  it('のばす音（ー）があってもなくても合う', () => {
    const s = scoreSongs('ちゅうりっぷ', pick('tulip'));
    expect(s[0].hits.length).toBe(0); // 「ちゅう」は別の音
    expect(scoreSongs('チューリップ', pick('tulip'))[0].hits).toEqual(['ちゅーりっぷ']);
  });

  it('カードで選んだ歌が同点なら優先', () => {
    const r = judgeSinging('かあさん', pick('kotori', 'zousan'), 'zousan');
    expect(r.best?.song.id).toBe('zousan');
  });

  it('どの歌のことばも ひらがなで、1語ずつ（歌詞の文は入れない）', () => {
    for (const s of SONGS) {
      expect(s.keywords.length).toBeGreaterThanOrEqual(4);
      for (const k of s.keywords) {
        expect(k).toMatch(/^[ぁ-ゖー]+$/);
        expect(k.length).toBeLessThanOrEqual(7);
      }
    }
  });
});
