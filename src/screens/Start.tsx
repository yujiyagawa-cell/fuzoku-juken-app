import { useEffect, useState, type ReactNode } from 'react';
import { appBaseUrl, applyEnv, decodeEnv, hasLocalData, wipeAll, type EnvSnapshot } from '../core/envLink';
import { examDateLabel } from '../core/dates';
import { Header } from '../ui/components';
import { Icon } from '../ui/icons';
import { navigate, useRoute } from '../ui/router';

// 「設定つきURL」「ゼロから始めるURL」を開いたときの画面（#/start?env=… ／ #/start?fresh=1）

function goHomeReload(path: string) {
  // 設定を読み直すために、ページごと開き直す（URL に入っていた設定は履歴に残さない）
  window.location.replace(`${appBaseUrl()}#${path}`);
  window.location.reload();
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="screen">
      <Header />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">{title}</h1>
      </div>
      <div className="stack pad" style={{ marginTop: 12 }}>
        {children}
      </div>
    </div>
  );
}

export function Start() {
  const route = useRoute();
  const env = route.query.get('env');
  const fresh = route.query.get('fresh');
  const [snap, setSnap] = useState<EnvSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hasLocalData().then(setHasData);
    if (env) decodeEnv(env).then(setSnap, () => setError(true));
  }, [env]);

  // ゼロから：このスマホに何もなければ、そのまま はじめての設定へ
  useEffect(() => {
    if (fresh && hasData === false) navigate('/onboarding', { replace: true });
  }, [fresh, hasData]);

  if (env) {
    if (error) {
      return (
        <Shell title="リンクを読めませんでした">
          <p className="muted" style={{ margin: 0 }}>
            URL が途中で切れているか、古い形式です。もとのスマホの「設定 → ほかのスマホで使う」で、もう一度URLを作ってください。
          </p>
          <button className="btn btn-ghost btn-block" onClick={() => navigate('/', { replace: true })}>
            ホームへ
          </button>
        </Shell>
      );
    }
    if (!snap || hasData === null) return <Shell title="よみこみちゅう…">{null}</Shell>;
    const s = snap.s;
    const name = [s.childName, s.childNameKanji ? `（${s.childNameKanji}）` : ''].join('');
    return (
      <Shell title="設定つきで はじめる">
        <div className="card stack" style={{ gap: 6 }}>
          <div className="small muted">このリンクに入っている設定</div>
          {name && (
            <div>
              子ども：<b>{name}</b>
              {s.age ? `　${s.age}さい` : ''}
              {s.birthday?.month ? `　${s.birthday.month}月${s.birthday.day}日生まれ` : ''}
            </div>
          )}
          {s.examDate && <div>試験日：{examDateLabel(s.examDate).kanji}</div>}
          <div className="small muted">
            回答の制限時間 {s.tapTimeLimitSec ?? '—'}秒／読み上げ {s.readTimes ?? 1}回
            {snap.r?.length ? `／問題カタログの評価 ${snap.r.length}件` : ''}
            {snap.m?.length ? `／マイセット ${snap.m.length}件` : ''}
            {snap.l?.length ? `／うたの動画 ${snap.l.length}件` : ''}
          </div>
        </div>
        {hasData && (
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f3d2b8' }}>
            <div className="small" style={{ color: 'var(--warn)' }}>
              このスマホの設定は、リンクの設定に置きかわります。このスマホの記録（進捗）や描いた絵は消えません。
            </div>
          </div>
        )}
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
          記録（進捗）は入っていません。記録も移すときは、もとのスマホの「設定 → データの書き出し」で作ったファイルを、このスマホで読み込んでください。マイクの許可は、はじめて声で答えるときに聞かれます。
        </p>
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await applyEnv(snap);
            goHomeReload('/');
          }}
        >
          <Icon name="check" size={22} />
          この設定で はじめる
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => navigate('/', { replace: true })}>
          やめる
        </button>
      </Shell>
    );
  }

  if (fresh) {
    if (hasData === null || hasData === false) return <Shell title="よみこみちゅう…">{null}</Shell>;
    return (
      <Shell title="ゼロから はじめる">
        <div className="card" style={{ background: 'var(--bad-bg)', borderColor: '#f1c6c0' }}>
          <div style={{ fontWeight: 900, color: 'var(--bad)' }}>このスマホの記録・描いた絵・設定を すべて消して、はじめての設定から始めます。</div>
          <div className="small" style={{ color: 'var(--bad)', marginTop: 4 }}>消したデータは元に戻せません。</div>
        </div>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
          残しておきたいときは、先に「設定 → データの書き出し」でファイルに保存してください。
        </p>
        <button
          className="btn btn-danger btn-big btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await wipeAll();
            goHomeReload('/onboarding');
          }}
        >
          すべて消して ゼロから はじめる
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => navigate('/', { replace: true })}>
          やめる（このまま使う）
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="はじめる">
      <button className="btn btn-primary btn-block" onClick={() => navigate('/', { replace: true })}>
        ホームへ
      </button>
    </Shell>
  );
}
