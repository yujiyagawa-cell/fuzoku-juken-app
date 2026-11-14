import { useEffect, useState } from 'react';
import { buildEnvSnapshot, encodeEnv, envLinkUrl, freshLinkUrl } from '../../core/envLink';
import { useSyncStatus } from '../../core/sync';
import { Icon } from '../../ui/icons';

// 設定：ほかのスマホで使う（設定つきURL／ゼロから始めるURL）

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function shareUrl(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, url });
      return 'shared';
    } catch {
      /* 取り消し・未対応 → コピーへ */
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

export function UrlBox({ url, label, onToast }: { url: string; label: string; onToast: (m: string) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <textarea
        className="input"
        readOnly
        value={url}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        style={{ height: 64, padding: 8, fontSize: 12, resize: 'none', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}
      />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={async () => onToast((await copyText(url)) ? 'URLをコピーしました' : 'コピーできませんでした（長押しで選んでください）')}>
          コピー
        </button>
        <button
          className="btn btn-parent btn-sm"
          style={{ flex: 1 }}
          onClick={async () => {
            const r = await shareUrl(url, label);
            if (r === 'copied') onToast('URLをコピーしました');
            if (r === 'failed') onToast('送れませんでした（長押しで選んでコピーしてください）');
          }}
        >
          <Icon name="upload" size={16} />
          LINEなどで送る
        </button>
      </div>
    </div>
  );
}

export function ShareLinks({ onToast }: { onToast: (m: string) => void }) {
  const [envUrl, setEnvUrl] = useState('');
  const [making, setMaking] = useState(false);
  const sync = useSyncStatus();
  const fresh = freshLinkUrl();

  // 共有を始めた・やめたら、URL を作り直す（共有先が入る・入らない）
  useEffect(() => setEnvUrl(''), [sync.on]);

  return (
    <div className="stack" style={{ gap: 14, padding: '10px 0' }}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
        {sync.on
          ? '記録の共有をしているので、設定つきURLで開いたスマホは、設定がそろい、記録の共有にも入ります。'
          : '記録と設定は、スマホ（ブラウザ）ごとに保存されます。ほかのスマホでも同じ設定で始めたいときは「設定つきURL」を送ってください。'}
      </p>

      <div className="stack" style={{ gap: 6 }}>
        <div style={{ fontWeight: 900 }}>{sync.on ? '設定つきURL（ほかのスマホをつなぐ）' : '設定つきURL（登録ずみの設定から始める）'}</div>
        <div className="tiny muted" style={{ fontWeight: 500, lineHeight: 1.6 }}>
          {sync.on ? (
            <>
              子どもの情報・試験日・ルールなどの設定と、記録の共有先（Firebase）が入ります。開いたスマホの記録・描いた絵・歌詞も、共有にそろいます。
              <b style={{ color: 'var(--warn)' }}> このURLを知っている人は、記録を見たり書きかえたりできます。家族だけに送ってください。</b>
            </>
          ) : (
            <>
              子どもの情報・試験日・ルール・問題カタログの評価・マイセット・うたの動画が入ります。記録（進捗）と描いた絵は入りません。
              <b style={{ color: 'var(--warn)' }}> 子どもの名前と誕生日が入るので、家族だけに送ってください。</b>
              設定を変えたら、作り直してください。
            </>
          )}
        </div>
        {envUrl ? (
          <UrlBox url={envUrl} label="設定つきURL" onToast={onToast} />
        ) : (
          <button
            className="btn btn-parent"
            disabled={making}
            onClick={async () => {
              setMaking(true);
              try {
                setEnvUrl(envLinkUrl(await encodeEnv(await buildEnvSnapshot())));
              } finally {
                setMaking(false);
              }
            }}
          >
            設定つきURLを作る
          </button>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div style={{ fontWeight: 900 }}>ゼロから始めるURL</div>
        <div className="tiny muted" style={{ fontWeight: 500, lineHeight: 1.6 }}>
          はじめての設定から始まります。記録があるスマホで開いたときは、消してよいか確認してから消します。
        </div>
        <UrlBox url={fresh} label="ゼロから始めるURL" onToast={onToast} />
      </div>

      <div className="tiny muted" style={{ fontWeight: 500, lineHeight: 1.6, background: 'var(--yellow-bg)', color: 'var(--yellow-ink)', padding: '8px 10px', borderRadius: 10 }}>
        LINEで受け取ったら、右上のメニューから「ブラウザで開く」を選んで Chrome で開いてください。LINEの中で開くと、記録が Chrome とは別になります。開いたら Chrome のメニューから「ホーム画面に追加」してください。
      </div>
    </div>
  );
}
