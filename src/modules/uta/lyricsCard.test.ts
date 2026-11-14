import { describe, expect, it } from 'vitest';
import { fitLyrics, LYRICS_AREA, LYRICS_LINE_HEIGHT, lineWidth, tokensToHiragana } from './lyricsCard';

// 歌詞の文はテストに入れない（著作権）。ここでは作った文で確かめる。

describe('ひらがなにする', () => {
  it('漢字は読み、カタカナはひらがな、ほかはそのまま', () => {
    const toks = [
      { surface: '赤い', reading: 'あかい' },
      { surface: ' ', reading: ' ' },
      { surface: 'ボール', reading: 'ぼーる' },
      { surface: 'が', reading: 'が' },
      { surface: '　', reading: '　' },
      { surface: '好き', reading: 'すき' }
    ];
    expect(tokensToHiragana(toks)).toBe('あかい ぼーるが　すき');
    expect(tokensToHiragana(toks, false)).toBe('あかい ボールが　すき');
  });
});

describe('A4 に入る大きさ', () => {
  it('短いときは大きく（上限 14mm）', () => {
    expect(fitLyrics('あいうえお\nかきくけこ').fontMm).toBe(14);
  });

  it('長い行はその長さで入る大きさにする', () => {
    const long = 'あ'.repeat(30);
    const f = fitLyrics(long).fontMm;
    expect(f * lineWidth(long)).toBeLessThanOrEqual(LYRICS_AREA.w);
    expect(f).toBeGreaterThan(5);
  });

  it('行が多いときは高さに入る大きさにする', () => {
    const many = Array.from({ length: 16 }, () => 'あいうえお').join('\n');
    const r = fitLyrics(many);
    expect(r.lines).toHaveLength(16);
    expect(r.fontMm * LYRICS_LINE_HEIGHT * 16).toBeLessThanOrEqual(LYRICS_AREA.h + 0.01);
  });

  it('前後の空行は外し、まん中の空行はのこす（1番と2番のあいだ など）', () => {
    expect(fitLyrics('\n\nあいう\n\nえお\n\n').lines).toEqual(['あいう', '', 'えお']);
  });

  it('改行コードが CRLF でも同じ', () => {
    expect(fitLyrics('あいう\r\nえお').lines).toEqual(['あいう', 'えお']);
  });
});
