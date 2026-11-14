import { useState } from 'react';
import { disableSync, enableSync, FIRESTORE_RULES, parseFirebaseConfig, syncNow, useSyncStatus } from '../../core/sync';
import { describeSyncError } from '../../core/sync/remote';
import { Icon } from '../../ui/icons';
import { copyText } from './ShareLinks';

// 設定：記録の共有（スマホどうし）
// 保護者が作った Firebase プロジェクトの設定を貼りつけると、記録・設定・歌詞カードをスマホどうしでそろえる。

function timeLabel(ms?: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === new Date().toDateString() ? `きょう ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

const STEP_STYLE = { margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 13, fontWeight: 500 } as const;

function SetupSteps({ onToast }: { onToast: (m: string) => void }) {
  return (
    <div className="stack" style={{ gap: 8, background: 'var(--parent-soft)', borderRadius: 12, padding: '10px 12px' }}>
      <ol style={STEP_STYLE}>
        <li>
          PCで <b>console.firebase.google.com</b> を開き、個人の Google アカウントでログイン（会社のアカウントは使わない）
        </li>
        <li>「プロジェクトを作成」。名前は何でもよい。Google アナリティクスはオフ</li>
        <li>「構築」→「Firestore Database」→「データベースを作成」。Standard・asia-northeast1（東京）・本番環境モード</li>
        <li>Firestore Database の「ルール」に、下の文をまるごと貼りつけて「公開」</li>
      </ol>
      <pre
        style={{
          margin: 0,
          padding: 8,
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.5,
          overflowX: 'auto',
          fontFamily: 'ui-monospace, monospace'
        }}
      >
        {FIRESTORE_RULES}
      </pre>
      <button
        className="btn btn-outline btn-sm"
        onClick={async () => onToast((await copyText(FIRESTORE_RULES)) ? 'ルールの文をコピーしました' : 'コピーできませんでした（長押しで選んでください）')}
      >
        ルールの文をコピー
      </button>
      <ol start={5} style={STEP_STYLE}>
        <li>「構築」→「Authentication」→「始める」→「ログイン方法」で「匿名」を有効にして保存</li>
        <li>「プロジェクトの概要」→「アプリを追加」→ ウェブ（&lt;/&gt;）。名前を入れて登録し、出てくる「const firebaseConfig = {'{ … }'}」をコピーして、下に貼りつける</li>
      </ol>
      <div className="tiny muted" style={{ lineHeight: 1.6, fontWeight: 500 }}>
        有料プラン（Blaze）にはせず、無料のまま使ってください。1家族分なら無料の範囲で足ります。
      </div>
    </div>
  );
}

export function SyncPanel({ onToast }: { onToast: (m: string) => void }) {
  const st = useSyncStatus();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showSteps, setShowSteps] = useState(false);

  if (!st.on) {
    return (
      <div className="stack" style={{ gap: 10, padding: '10px 0' }}>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
          子どものスマホと保護者のスマホで、記録（進捗・カレンダー・描いた絵）・設定・歌詞カードを同じにします。保存先は、保護者が作る Firebase（Google の無料のデータベース）です。
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps}>
          <Icon name={showSteps ? 'x' : 'book'} size={16} />
          {showSteps ? '手順をとじる' : 'Firebase の準備（はじめに1回）'}
        </button>
        {showSteps && <SetupSteps onToast={onToast} />}
        <div style={{ fontWeight: 900, fontSize: 14 }}>Firebase の設定を貼りつけ</div>
        <textarea
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr('');
          }}
          placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "…",\n  projectId: "…",\n  …\n};'}
          rows={6}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Firebase の設定"
          style={{ height: 'auto', padding: 8, fontSize: 12, lineHeight: 1.5, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
        />
        {err && (
          <div className="small" style={{ color: 'var(--bad)', lineHeight: 1.6, fontWeight: 700 }}>
            {err}
          </div>
        )}
        <button
          className="btn btn-parent"
          disabled={busy || !text.trim()}
          onClick={async () => {
            const fb = parseFirebaseConfig(text);
            if (!fb) {
              setErr('apiKey と projectId が見つかりません。Firebase の「const firebaseConfig = { … }」の部分を、まるごと貼りつけてください。');
              return;
            }
            setBusy(true);
            setErr('');
            try {
              await enableSync(fb);
              setText('');
              onToast('共有を始めました');
            } catch (e) {
              setErr(describeSyncError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'つないでいます…' : '共有を始める'}
        </button>
      </div>
    );
  }

  const label = st.starting ? 'つないでいます…' : st.error ? 'そろっていません' : st.connected ? '共有中' : 'ネットを待っています';
  const chip = st.error ? 'chip-warn' : st.connected ? 'chip-good' : '';
  return (
    <div className="stack" style={{ gap: 10, padding: '10px 0' }}>
      <div className="between">
        <span className={`chip ${chip}`} role="status">
          {label}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await syncNow();
            onToast('そろえています');
          }}
        >
          <Icon name="refresh" size={16} />
          いま そろえる
        </button>
      </div>
      <div className="tiny muted" style={{ fontWeight: 500 }}>
        最後にそろえた時刻：{timeLabel(st.lastAt)}
        {st.pending ? `　まだ送っていない変更：${st.pending}件` : ''}
      </div>
      {st.error && (
        <div className="small" style={{ color: 'var(--bad)', lineHeight: 1.6, fontWeight: 700 }}>
          {st.error}
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
        記録（進捗・カレンダー・描いた絵）・設定・歌詞カードが、共有しているスマホでそろいます。声の種類と、保護者モードかどうかは、スマホごとです。ほかのスマホをつなぐときは、下の「設定つきURL」をそのスマホで開いてください。
      </p>
      <button
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          if (!window.confirm('このスマホの共有をやめますか？（このスマホの記録も、共有している記録も消えません）')) return;
          await disableSync();
          onToast('このスマホの共有をやめました');
        }}
      >
        このスマホの共有をやめる
      </button>
    </div>
  );
}
