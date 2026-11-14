import { useState } from 'react';
import { db, useLive } from '../core/db';
import type { SongLink } from '../core/types';
import { lyricsSearchUrl, lyricVideoSearchUrl, SONGS, youtubeSearchUrl } from '../modules/uta/songs';
import { BackButton, Header, Modal, ParentStrip, useToast } from '../ui/components';
import { Emoji } from '../ui/emoji';
import { Icon } from '../ui/icons';
import { navigate } from '../ui/router';

// うたの曲（保護者）：出るかもしれない12曲。歌詞・音源はアプリに入れず、YouTube で聞いて覚える。

function isYoutubeUrl(u: string) {
  try {
    const x = new URL(u);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(x.hostname);
  } catch {
    return false;
  }
}

export function Songs() {
  const links = useLive(() => db.songLinks.toArray(), [], [] as SongLink[]);
  const [edit, setEdit] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [toast, showToast] = useToast();
  const linkOf = (id: string) => links.find((l) => l.songId === id)?.url;
  const editing = SONGS.find((s) => s.id === edit);

  return (
    <div className="screen">
      <Header left={<BackButton to="/" label="ホーム" />} />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">うたの曲</h1>
        <p className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
          ノートで「出題可能性あり」とされた12曲。歌詞と音源は著作権があるのでアプリに入れていません。
          「歌詞を見る」で歌詞サイト（歌ネットなど）を探すか、「歌詞付き動画」で画面に歌詞が出る動画を見て、1番だけ元気に歌えるようにします。
          よく使う動画が決まったら「動画を決める」でリンクを登録できます。
        </p>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {SONGS.map((s) => {
          const own = linkOf(s.id);
          return (
            <div key={s.id} className="list-row">
              <span style={{ width: 52, display: 'flex', justifyContent: 'center' }}>
                <Emoji char={s.icons[0]} size={34} label={s.iconLabel} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900 }}>{s.title}</div>
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                  <a className="tiny" href={lyricsSearchUrl(s)} target="_blank" rel="noopener noreferrer">
                    歌詞を見る
                  </a>
                  <a className="tiny" href={lyricVideoSearchUrl(s)} target="_blank" rel="noopener noreferrer">
                    歌詞付き動画
                  </a>
                  <button className="tiny" style={{ border: 0, background: 'none', padding: 0, color: 'var(--parent)', textDecoration: 'underline' }} onClick={() => navigate(`/songcard?song=${s.id}`)}>
                    歌詞カード
                  </button>
                  <button className="tiny" style={{ border: 0, background: 'none', padding: 0, color: 'var(--parent)' }} onClick={() => { setEdit(s.id); setUrl(own ?? ''); }}>
                    {own ? '動画を変える' : '動画を決める'}
                  </button>
                </div>
              </div>
              <a className="btn btn-outline btn-sm" href={own ?? youtubeSearchUrl(s)} target="_blank" rel="noopener noreferrer">
                <Icon name="youtube" size={18} />
                {own ? 'ひらく' : 'さがす'}
              </a>
            </div>
          );
        })}
      </div>
      <p className="tiny muted pad" style={{ marginTop: 12, lineHeight: 1.6 }}>
        本番は「絵の中から知っている歌」「カードから好きな歌」を、できるだけ早く歌い出すのがポイント（目標3秒）。練習は「うた」のタイルから。
      </p>
      <Modal open={!!editing} onClose={() => setEdit(null)} title={`${editing?.title ?? ''} の動画`}>
        <div className="stack">
          <span className="small muted">YouTube の動画のリンクを貼りつけてください。</span>
          <input className="input" value={url} inputMode="url" placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => setUrl(e.target.value.trim())} />
          <div className="row">
            {linkOf(edit ?? '') && (
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (edit) await db.songLinks.delete(edit);
                  setEdit(null);
                  showToast('検索リンクに戻しました');
                }}
              >
                もとに戻す
              </button>
            )}
            <button
              className="btn btn-parent"
              style={{ flex: 1 }}
              onClick={async () => {
                if (!edit) return;
                if (!isYoutubeUrl(url)) {
                  showToast('YouTube のリンクを入れてください');
                  return;
                }
                await db.songLinks.put({ songId: edit, url });
                setEdit(null);
                showToast('動画を登録しました');
              }}
            >
              登録する
            </button>
          </div>
        </div>
      </Modal>
      {toast}
    </div>
  );
}
