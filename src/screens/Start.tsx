import { useEffect, useRef, useState, type ReactNode } from 'react';
import { appBaseUrl, applyEnv, decodeEnv, hasLocalData, wipeAll, type EnvSnapshot } from '../core/envLink';
import { examDateLabel } from '../core/dates';
import { enableSync, fromEnvSync, loadSyncConfig } from '../core/sync';
import { describeSyncError } from '../core/sync/remote';
import { clearTrials } from '../core/trial';
import { Header } from '../ui/components';
import { navigate, useRoute } from '../ui/router';

// 「設定つきURL」「ゼロから始めるURL」を開いたときの画面（#/start?env=… ／ #/start?fresh=1）
// ・設定つきURL：開いたら確認なしで、すぐに設定を入れて（共有先が入っていれば記録の共有にもつないで）ホームへ行く。
//   すでに同じ共有に入っているスマホでは、リンクの設定は入れない（リンクの設定は古いかもしれない。共有の設定が正しい）。
//   開いたスマホに記録や設定がすでにあり、共有先が入ったリンクのときだけ、どちらの内容に そろえるかを聞く
//   （子どもが使ってきたスマホを、あとから共有に入れるとき。「このスマホの内容に そろえる」なら、こちらの設定が残る）。
// ・見る専用URL（ro）：開いたスマホは共有の記録を受けとって見るだけ（何も送らない）。聞かずに すぐ入る。
//   ふつうの共有に入っているスマホで開いても、見る専用にはしない。見る専用のスマホで ふつうの設定つきURLを開くと、ふつうの共有になる。
//   LINE の中のブラウザで開いたときだけ止めて、Chrome で開き直すよう案内する（記録が Chrome とは別になるため）。
// ・ゼロから始めるURL：記録を消すので、確認してから消す。

function goHomeReload(path: string) {
  // 設定を読み直すために、ページごと開き直す（URL に入っていた設定は履歴に残さない）
  window.location.replace(`${appBaseUrl()}#${path}`);
  window.location.reload();
}

/** LINE の中のブラウザで開いているか */
function inLineBrowser(): boolean {
  return typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);
}

/**
 * 設定つきURLで始める：設定を入れて、共有先が入っていれば つなぐ。
 * keepMine（このスマホの内容に そろえる）のときは、リンクの設定は入れずに共有につなぎ、同じ行は このスマホの方を残す。
 */
async function startWithLink(snap: EnvSnapshot, keepMine = false): Promise<void> {
  const fb = snap.y ? fromEnvSync(snap.y) : null;
  const cur = await loadSyncConfig();
  const same = !!(fb && cur && cur.fb.projectId === fb.projectId && cur.fb.apiKey === fb.apiKey);
  if (snap.ro) {
    // 見る専用URL：もう共有に入っているスマホは そのまま（ふつうの共有のスマホを、見る専用にはしない）
    if (!fb || same) return;
    await applyEnv(snap);
    await enableSync(fb, { viewOnly: true });
    return;
  }
  if (same) {
    if (cur?.viewOnly && fb) {
      // 見る専用だったスマホを、ふつうの共有にする（おためしの記録は送らないよう、先に消す）
      await clearTrials();
      await enableSync(fb);
    }
    return; // もう同じ共有に入っている
  }
  if (fb && keepMine) {
    await enableSync(fb, { preferLocal: true });
    return;
  }
  await applyEnv(snap);
  if (fb) await enableSync(fb);
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
  const [joinError, setJoinError] = useState('');
  const [allowInLine, setAllowInLine] = useState(false);
  const [choice, setChoice] = useState<'auto' | 'ask' | null>(null);
  const started = useRef(false);
  const keepMine = useRef(false);
  const inLine = inLineBrowser();

  useEffect(() => {
    hasLocalData().then(setHasData);
    if (env) decodeEnv(env).then(setSnap, () => setError(true));
  }, [env]);

  // 開いたスマホに記録や設定がすでにあって、まだその共有に入っていないときだけ、どちらの内容に そろえるかを聞く
  useEffect(() => {
    if (!snap || hasData === null) return;
    const fb = snap.y ? fromEnvSync(snap.y) : null;
    if (!fb || !hasData || snap.ro) {
      setChoice('auto');
      return;
    }
    void loadSyncConfig().then((cur) => setChoice(cur && cur.fb.projectId === fb.projectId && cur.fb.apiKey === fb.apiKey ? 'auto' : 'ask'));
  }, [snap, hasData]);

  const run = async (s: EnvSnapshot) => {
    setBusy(true);
    setJoinError('');
    try {
      await startWithLink(s, keepMine.current);
      goHomeReload('/');
    } catch (e) {
      setJoinError(describeSyncError(e));
      setBusy(false);
    }
  };

  const choose = (mine: boolean) => {
    if (!snap || started.current) return;
    started.current = true;
    keepMine.current = mine;
    void run(snap);
  };

  // 設定つきURL：開いたら、すぐに始める（聞くときは、選んでから）
  useEffect(() => {
    if (!snap || choice !== 'auto' || started.current || (inLine && !allowInLine)) return;
    started.current = true;
    void run(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, choice, allowInLine]);

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
    if (!snap) return <Shell title="よみこみちゅう…">{null}</Shell>;
    if (joinError) {
      return (
        <Shell title="記録の共有に つなげませんでした">
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f3d2b8' }}>
            <div className="small" style={{ color: 'var(--warn)', lineHeight: 1.6, fontWeight: 700 }}>
              {joinError}
            </div>
          </div>
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {keepMine.current ? 'このスマホの設定と記録は、そのままです。' : '設定は入りました。'}
            共有は「もう一度」で、つなぎ直せます。あとから、このURLをもう一度開いてもつながります。
          </p>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(snap)}>
            {busy ? 'つないでいます…' : 'もう一度'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => goHomeReload('/')}>
            共有なしで はじめる
          </button>
        </Shell>
      );
    }
    if (inLine && !allowInLine) {
      return (
        <Shell title="Chrome で ひらいてください">
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f3d2b8' }}>
            <div className="small" style={{ color: 'var(--warn)', lineHeight: 1.6, fontWeight: 700 }}>
              LINE の中で開いています。このまま始めると、記録が Chrome とは別になります。
            </div>
          </div>
          <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>
            LINE のメニュー（右上の︙など）から「ブラウザで開く」を選んで、開き直してください。iPhone は Safari で開きます。
          </p>
          <button className="btn btn-ghost btn-block" onClick={() => setAllowInLine(true)}>
            このまま LINE の中で はじめる
          </button>
        </Shell>
      );
    }
    if (choice === 'ask' && !busy) {
      return (
        <Shell title="どちらの内容に そろえますか？">
          <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>
            このスマホには、記録や設定がすでにあります。どちらを選んでも、このスマホの記録（練習・描いた絵・うたの録音）は消えずに共有に入り、ほかのスマホの記録も このスマホに届きます。
          </p>
          <div className="card stack" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-block" onClick={() => choose(true)}>
              このスマホの内容に そろえる
            </button>
            <div className="tiny muted" style={{ lineHeight: 1.6, fontWeight: 500 }}>
              設定（子どもの情報・試験日・ルールなど）と、両方のスマホにある歌詞カード・カタログの評価などは、このスマホのものを使います。共有している ほかのスマホも、この内容になります。
            </div>
          </div>
          <div className="card stack" style={{ gap: 8 }}>
            <button className="btn btn-outline btn-block" onClick={() => choose(false)}>
              送ってきたスマホの内容に そろえる
            </button>
            <div className="tiny muted" style={{ lineHeight: 1.6, fontWeight: 500 }}>
              設定などは、このURLを送ってきたスマホのものに置きかわります。
            </div>
          </div>
        </Shell>
      );
    }
    const s = snap.s;
    const name = [s.childName, s.childNameKanji ? `（${s.childNameKanji}）` : ''].join('');
    return (
      <Shell title="はじめています…">
        <div className="card stack" style={{ gap: 6 }}>
          {name && (
            <div>
              子ども：<b>{name}</b>
            </div>
          )}
          {s.examDate && <div>試験日：{examDateLabel(s.examDate).kanji}</div>}
          <div className="small muted" style={{ lineHeight: 1.6 }}>
            {snap.ro
              ? '見る専用で、記録の共有に つないでいます。少しお待ちください。'
              : snap.y
                ? '設定を入れて、記録の共有に つないでいます。少しお待ちください。'
                : '設定を入れています。'}
          </div>
        </div>
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
