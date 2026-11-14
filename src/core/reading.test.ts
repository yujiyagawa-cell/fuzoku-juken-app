import { describe, expect, it } from 'vitest';
import { kanaOnlyCandidates } from './reading';

describe('かなだけの答えの候補', () => {
  it('つなぎの言葉と終わりの「です」を外す', () => {
    expect(kanaOnlyCandidates('えっと、かえるです')).toEqual(['かえる']);
    expect(kanaOnlyCandidates('うーん きつね')).toEqual(['きつね']);
    expect(kanaOnlyCandidates('あのね、いすだよ')).toEqual(['いす']);
  });

  it('1文字の終わり（ね・よ）は外さない', () => {
    expect(kanaOnlyCandidates('きつね')).toEqual(['きつね']);
    expect(kanaOnlyCandidates('ふね')).toEqual(['ふね']);
  });

  it('「え、いか」を「えいか」とつなげない（「え」で始まる3文字と誤判定しない）', () => {
    expect(kanaOnlyCandidates('え、いか')).toEqual(['いか']);
  });

  it('カタカナはひらがなにする', () => {
    expect(kanaOnlyCandidates('リンゴ')).toEqual(['りんご']);
  });
});
