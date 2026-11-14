import { normalizeReading } from '../../core/kana';
import type { Judge } from '../../core/types';
import type { Song } from './songs';

// 歌を聞き取った文（読み・ひらがな）に、その歌の ことば がいくつ出てきたかで判定する。
// 歌声は音声認識で文字になりにくいので、聞き取れなかったときは × ではなく ？（保護者が判定）にする。

export interface SongScore {
  song: Song;
  hits: string[];
}

export interface SongJudge {
  judge: Judge;
  best?: SongScore;
  scores: SongScore[];
  note: string;
}

const squash = (s: string) => normalizeReading(s).replace(/ー/g, '');

/** 長い言葉（4文字以上）は1つで、短い言葉は2つで「歌えた」とみなす */
export function songMatched(hits: string[]): boolean {
  if (hits.length >= 2) return true;
  return hits.some((h) => squash(h).length >= 4);
}

export function scoreSongs(reading: string, songs: Song[]): SongScore[] {
  const r = squash(reading);
  return songs
    .map((song) => ({ song, hits: song.keywords.filter((k) => r.includes(squash(k))) }))
    .sort((a, b) => b.hits.length - a.hits.length);
}

/** picked：カードで選んだ歌（あれば、同点ならそれを優先） */
export function judgeSinging(reading: string, songs: Song[], picked?: string | null): SongJudge {
  if (!squash(reading)) return { judge: 'unknown', scores: [], note: 'ことばは ききとれませんでした' };
  const scores = scoreSongs(reading, songs);
  let best = scores[0];
  if (picked) {
    const p = scores.find((s) => s.song.id === picked);
    if (p && p.hits.length >= best.hits.length) best = p;
  }
  if (best && songMatched(best.hits)) {
    return { judge: 'correct', best, scores, note: `「${best.song.title}」の ことば ${best.hits.length}こ（${best.hits.join('・')}）` };
  }
  return {
    judge: 'unknown',
    best: best?.hits.length ? best : undefined,
    scores,
    note: best?.hits.length ? `ことばが すこしだけ（${best.hits.join('・')}）` : '歌の ことばは ききとれませんでした'
  };
}
