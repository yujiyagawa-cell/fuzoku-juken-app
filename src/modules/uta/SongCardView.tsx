import type { CSSProperties } from 'react';
import { fitLyrics, LYRICS_LINE_HEIGHT } from './lyricsCard';
import type { Song } from './songs';

// うたのカード（A4・1まい）。印刷するときはこのまま 210mm × 297mm。画面では scale で小さく見せる。

const COLORS: Record<string, { bg: string; ink: string }> = {
  'inu-omawari': { bg: '#e7f0ff', ink: '#1d4e9e' },
  kobutanukitsuneko: { bg: '#ffe9e2', ink: '#9b3a1c' },
  koinobori: { bg: '#e3f2ff', ink: '#1d5f9e' },
  kotori: { bg: '#eaf7e6', ink: '#24734a' },
  zousan: { bg: '#eef0f6', ink: '#3b4a66' },
  medaka: { bg: '#e2f4f5', ink: '#0f5b59' },
  choucho: { bg: '#fff6d9', ink: '#7a5600' },
  'otsukai-arisan': { bg: '#f3ece4', ink: '#6b4a2b' },
  tulip: { bg: '#ffe8f0', ink: '#a32a5c' },
  oshougatsu: { bg: '#fff0e0', ink: '#9b4a12' },
  hinamatsuri: { bg: '#ffeef5', ink: '#a12b5b' },
  tanabata: { bg: '#eae9ff', ink: '#3d33a0' }
};

// カードの題名はひらがなで
const KANA_TITLE: Record<string, string> = { tulip: 'ちゅーりっぷ' };

export const A4_PX = { w: 793.7, h: 1122.5 }; // 96dpi での 210mm × 297mm

function titleSize(t: string): number {
  const n = t.replace(/\s/g, '').length + (t.match(/\s/g) || []).length * 0.5;
  return Math.min(19, Math.floor(160 / n));
}

export function SongCardView({ song, text, scale = 1, style }: { song: Song; text: string; scale?: number; style?: CSSProperties }) {
  const c = COLORS[song.id] ?? { bg: '#f0f3f8', ink: '#33415a' };
  const title = KANA_TITLE[song.id] ?? song.title;
  const fit = fitLyrics(text);
  const card = (
    <section className="songcard" style={{ ['--bg' as string]: c.bg, ['--ink' as string]: c.ink }}>
      <header className="sc-head">
        <div className="sc-icons">
          {song.icons.slice(0, 4).map((ch, i) => (
            <span key={i} className="sc-emo">
              {ch}
            </span>
          ))}
        </div>
        <h1 className="sc-title" style={{ fontSize: `${titleSize(title)}mm` }}>
          {title}
        </h1>
        <div className="sc-ban">1ばん</div>
      </header>
      {fit.lines.length ? (
        <div className="sc-lyrics">
          {fit.lines.map((l, i) => (
            <div key={i} className="sc-lyric" style={{ fontSize: `${fit.fontMm}mm`, lineHeight: LYRICS_LINE_HEIGHT }}>
              {l || ' '}
            </div>
          ))}
        </div>
      ) : (
        <div className="sc-lines">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="sc-line">
              <span />
            </div>
          ))}
        </div>
      )}
      <footer className="sc-foot">うたは「うたの曲」の 歌詞付き動画で きけます</footer>
    </section>
  );
  if (scale === 1) return <div style={style}>{card}</div>;
  return (
    <div className="sc-scaler" style={{ width: A4_PX.w * scale, height: A4_PX.h * scale, ...style }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: A4_PX.w, height: A4_PX.h }}>{card}</div>
    </div>
  );
}
