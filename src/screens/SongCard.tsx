import { useEffect, useRef, useState } from 'react';
import { db, nowIso, useLive } from '../core/db';
import type { SongText } from '../core/types';
import { lyricsToHiragana } from '../modules/uta/lyricsCard';
import { A4_PX, SongCardView } from '../modules/uta/SongCardView';
import { PUBLIC_DOMAIN_LYRICS, SONGS, songById } from '../modules/uta/songs';
import { BackButton, Header, ParentStrip, useToast } from '../ui/components';
import { Emoji } from '../ui/emoji';
import { Icon } from '../ui/icons';
import { goBack, navigate, useRoute } from '../ui/router';

// 歌詞カード：保護者が調べた歌詞を貼りつけると、A4 のカードにちょうどよく入る。印刷・PDF 保存もできる。
// 歌詞はこのスマホ（ブラウザ）の中だけに保存し、アプリ（公開しているもの）には入れない。

export function SongCardEditor() {
  const route = useRoute();
  const song = songById(route.query.get('song') || '') ?? SONGS[0];
  const saved = useLive(() => db.songTexts.get(song.id), [song.id], undefined as SongText | undefined);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);

  useEffect(() => {
    setText(saved?.text ?? PUBLIC_DOMAIN_LYRICS[song.id] ?? '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, saved?.updatedAt]);

  // 打つのが止まったら保存
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(async () => {
      await db.songTexts.put({ songId: song.id, text, updatedAt: nowIso() });
      setDirty(false);
    }, 700);
    return () => clearTimeout(id);
  }, [text, dirty, song.id]);

  useEffect(() => {
    const on = () => setW(wrapRef.current?.clientWidth ?? 320);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const change = (t: string) => {
    setText(t);
    setDirty(true);
  };

  const toKana = async () => {
    setBusy(true);
    try {
      change(await lyricsToHiragana(text));
      showToast('ひらがなにしました。読みがちがう所は直してください');
    } catch {
      showToast('辞書を読み込めませんでした。ネットにつないで、もう一度押してください');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <Header left={<BackButton to="/songs" label="うたの曲" />} />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">歌詞カード</h1>
        <p className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.6, fontWeight: 500 }}>
          歌詞サイトなどで調べた1番の歌詞を貼りつけると、A4のカードにちょうどよく入ります。貼りつけた歌詞は、このスマホの中だけに保存します（公開しているアプリには入りません）。
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px 4px' }}>
        {SONGS.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/songcard?song=${s.id}`, { replace: true })}
            className={`chip ${s.id === song.id ? 'chip-parent' : ''}`}
            style={{ border: s.id === song.id ? '1.5px solid var(--parent)' : '1px solid var(--line)', flexShrink: 0, fontSize: 13 }}
            aria-pressed={s.id === song.id}
          >
            <Emoji char={s.icons[0]} size={16} />
            {s.title}
          </button>
        ))}
      </div>

      <div className="pad stack" style={{ marginTop: 8, gap: 8 }}>
        <textarea
          className="input"
          value={text}
          onChange={(e) => change(e.target.value)}
          placeholder={'ここに 1番の歌詞を はりつけてください。\n改行は そのまま カードの改行に なります。'}
          rows={9}
          style={{ height: 'auto', padding: 10, lineHeight: 1.6, fontSize: 16, resize: 'vertical' }}
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-parent btn-sm" disabled={busy || !text.trim()} onClick={toKana}>
            {busy ? 'へんかん中…' : '漢字・カタカナを ひらがなにする'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!text}
            onClick={() => {
              if (window.confirm('この曲の歌詞を消しますか？')) change('');
            }}
          >
            けす
          </button>
          <span className="tiny muted">{dirty ? '保存中…' : saved ? '保存しました' : ''}</span>
        </div>
      </div>

      <h2 className="section-title">カードの見本</h2>
      <div className="pad" ref={wrapRef}>
        <SongCardView song={song} text={text} scale={w / A4_PX.w} />
      </div>

      <div className="pad stack" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn btn-primary btn-block" onClick={() => navigate(`/songcard-print?song=${song.id}`)}>
          <Icon name="download" size={20} />
          このカードを 印刷・PDFで保存
        </button>
        <button className="btn btn-outline btn-block" onClick={() => navigate('/songcard-print?song=all')}>
          12曲まとめて 印刷・PDFで保存
        </button>
      </div>
      {toast}
    </div>
  );
}

/** 印刷用（ヘッダーなし・A4 のまま）。画面では小さく見せ、印刷ではそのままの大きさ */
export function SongCardPrint() {
  const route = useRoute();
  const which = route.query.get('song') || 'all';
  const texts = useLive(() => db.songTexts.toArray(), [], [] as SongText[]);
  const songs = which === 'all' ? SONGS : SONGS.filter((s) => s.id === which);
  const textOf = (id: string) => texts.find((t) => t.songId === id)?.text ?? PUBLIC_DOMAIN_LYRICS[id] ?? '';
  const scale = Math.min(1, (Math.min(window.innerWidth, 820) - 24) / A4_PX.w);

  return (
    <div style={{ minHeight: '100dvh', background: '#e9edf3' }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid var(--line)', padding: '10px 12px' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => goBack(`/songcard?song=${which === 'all' ? SONGS[0].id : which}`)}>
            <Icon name="left" size={16} />
            もどる
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={async () => {
              try {
                await document.fonts.ready;
              } catch {
                /* noop */
              }
              window.print();
            }}
          >
            印刷する／PDFで保存
          </button>
        </div>
        <div className="tiny muted" style={{ marginTop: 6, fontWeight: 500 }}>
          印刷の画面で「PDFとして保存」を選ぶとPDFになります（用紙はA4・余白なし）。{songs.length > 1 ? `${songs.length}枚です。` : ''}
        </div>
      </div>
      {/* 画面用（小さく） */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 12 }}>
        {songs.map((s) => (
          <SongCardView key={s.id} song={s} text={textOf(s.id)} scale={scale} />
        ))}
      </div>
      {/* 印刷用（A4 のまま） */}
      <div className="print-only">
        {songs.map((s) => (
          <div key={s.id} className="print-card">
            <SongCardView song={s} text={textOf(s.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
