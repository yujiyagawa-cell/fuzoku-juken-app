import { useEffect, useRef, useState } from 'react';
import { buzzer } from '../../core/audio';
import { db, nowIso, uid } from '../../core/db';
import { cancelSpeak, speak } from '../../core/speech/tts';
import type { ModuleDef, QuestionType, RunnerProps } from '../../player/types';
import { ParentPanel, Switch, useWakeLock } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { moduleColor } from '../common';

export const TAIKI_TYPES: QuestionType[] = [
  {
    id: 'taiki-wait',
    name: '待機（しずかに待つ）',
    genre: 'taiki',
    moduleId: 'taiki',
    source: '本番',
    description:
      '何もせず座って待つ（本番は最長20分ほど。廊下から先生が見ている）。保護者が「ふりかえり・足バタバタ・手遊び・おしゃべり・体をひねる・席を立つ」を数え、0回なら成功。5→10→15→20分と延ばす。',
    priority: 3,
    answer: 'parent',
    sample: 'しずかに すわって まっていてください。'
  }
];

export const TAIKI_COUNTERS: { key: string; label: string }[] = [
  { key: 'furikaeri', label: 'ふりかえり' },
  { key: 'ashi', label: 'あしバタバタ' },
  { key: 'teasobi', label: 'てあそび' },
  { key: 'oshaberi', label: 'おしゃべり' },
  { key: 'hineri', label: 'からだを ひねる' },
  { key: 'seki', label: 'せきを たつ' }
];

export const TAIKI_STEPS = [5, 10, 15, 20];

const ROLEPLAY: { title: string; body: string }[] = [
  { title: '先生が楽しそうに話しかけてくる', body: 'はしゃがず、敬語で短く答える（わざとフレンドリーにする先生もいる＝ひっかけ。つられてふざけると×）' },
  { title: '「すわっていてください」とだけ言われ、何も起きない', body: '座ったまま待つ。親のほうを振り返らない・反対向きに座らない' },
  { title: 'まちがえた・ぶつかった', body: '「ごめんなさい」と言える' },
  { title: 'トイレに行きたい・困った', body: '手をあげて「せんせい、トイレに いきたいです」と言える（遠慮なく言ってよいと説明がある）' },
  { title: '鼻をかみたい', body: '持ち物は持ち込めない。自分で先生か在校生に「ティッシュを ください」と言う' }
];

const TEASES = ['みんな、げんきですか。', 'きょうは さむいですね。', 'なにか ききたい ことは ありますか。', 'もうすこし まっていてくださいね。'];

function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TaikiRunner({ count, session, onDone }: RunnerProps) {
  const minutes = count;
  const total = minutes * 60;
  const [elapsed, setElapsed] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<'running' | 'done'>('running');
  const [result, setResult] = useState<{ success: boolean; completed: boolean } | null>(null);
  const [tease, setTease] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const startAt = useRef(0);
  const saved = useRef(false);
  const countsRef = useRef(counts);
  countsRef.current = counts;
  useWakeLock(phase === 'running');

  const finish = async (completed: boolean) => {
    if (saved.current) return;
    saved.current = true;
    const el = Math.round((performance.now() - startAt.current) / 1000);
    const c = countsRef.current;
    const sum = Object.values(c).reduce((a, b) => a + b, 0);
    const success = completed && sum === 0;
    setPhase('done');
    setResult({ success, completed });
    if (completed) {
      buzzer(1);
      await speak('おしまいです。');
    } else cancelSpeak();
    await db.waitingLogs.add({
      id: uid(),
      sessionId: session.sessionId,
      durationMin: minutes,
      elapsedSec: Math.min(el, total),
      counts: c,
      success,
      completed,
      createdAt: nowIso()
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await speak('しずかに すわって、まっていてください。');
      if (!alive) return;
      startAt.current = performance.now();
    })();
    const id = setInterval(() => {
      if (!startAt.current || saved.current) return;
      const e = (performance.now() - startAt.current) / 1000;
      setElapsed(e);
      if (e >= total) finish(true);
    }, 500);
    return () => {
      alive = false;
      clearInterval(id);
      cancelSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 先生役の声かけ（ひっかけ）：オンにすると 1〜3分おきに話しかける
  useEffect(() => {
    if (!tease || phase !== 'running') return;
    let t: ReturnType<typeof setTimeout>;
    const plan = () => {
      t = setTimeout(() => {
        speak(TEASES[Math.floor(Math.random() * TEASES.length)]);
        plan();
      }, (60 + Math.random() * 120) * 1000);
    };
    plan();
    return () => clearTimeout(t);
  }, [tease, phase]);

  const add = (k: string, d: number) => setCounts((c) => ({ ...c, [k]: Math.max(0, (c[k] || 0) + d) }));
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="play-main">
        {phase === 'running' ? (
          <div className="stage">
            <div className="orb" style={{ background: '#dff3f2', color: '#157a78' }}>
              <Icon name="chair" size={110} style={{ strokeWidth: 1.6 }} />
            </div>
            <span className="stage-text">
              しずかに すわって
              <br />
              まっていてください
            </span>
          </div>
        ) : (
          <div className="stage rise">
            <div className="orb" style={{ background: result?.success ? 'var(--good-bg)' : '#fff', color: result?.success ? 'var(--good)' : 'var(--muted)' }}>
              <Icon name="smile" size={100} style={{ strokeWidth: 1.6 }} />
            </div>
            <span className="stage-text">{result?.success ? 'じょうずに まてました！' : 'おしまいです'}</span>
            <button className="btn btn-primary btn-big" onClick={onDone}>
              つぎへ
            </button>
          </div>
        )}
      </div>
      <ParentPanel
        right={
          phase === 'running' ? (
            <span className="small" style={{ color: 'var(--parent)' }}>
              のこり {mmss(total - elapsed)}
            </span>
          ) : (
            <span className={`chip ${result?.success ? 'chip-good' : 'chip-warn'}`}>{result?.success ? '成功' : result?.completed ? `${sum}回` : 'とちゅうで終了'}</span>
          )
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {TAIKI_COUNTERS.map((c) => (
            <div key={c.key} style={{ position: 'relative' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ width: '100%', minHeight: 50, flexDirection: 'column', gap: 0, padding: '2px 4px' }}
                disabled={phase !== 'running'}
                onClick={() => add(c.key, 1)}
              >
                <span style={{ fontSize: 11 }}>{c.label}</span>
                <b style={{ fontSize: 17 }}>{counts[c.key] || 0}</b>
              </button>
              {(counts[c.key] || 0) > 0 && phase === 'running' && (
                <button
                  aria-label={`${c.label}を1へらす`}
                  onClick={() => add(c.key, -1)}
                  style={{ position: 'absolute', top: -6, right: -4, width: 22, height: 22, borderRadius: 999, border: '1px solid var(--line2)', background: '#fff', fontSize: 12, lineHeight: 1, padding: 0 }}
                >
                  −
                </button>
              )}
            </div>
          ))}
        </div>
        {phase === 'running' && (
          <div className="between">
            <div className="row">
              <Switch on={tease} onChange={setTease} label="先生役の声かけ" />
              <span className="tiny">先生役の声かけ（ひっかけ）</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => finish(false)}>
              とちゅうで おわる
            </button>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCards((v) => !v)}>
          ロールプレイ カード {showCards ? 'をとじる' : 'をひらく'}
        </button>
        {showCards && (
          <div className="panel-box stack" style={{ gap: 8 }}>
            {ROLEPLAY.map((r) => (
              <div key={r.title}>
                <div className="small">{r.title}</div>
                <div className="tiny muted" style={{ fontWeight: 500 }}>
                  → {r.body}
                </div>
              </div>
            ))}
            <div className="tiny muted" style={{ fontWeight: 500 }}>
              ノートより：当日うるさくて注意された子は不合格だった／5人グループ全員が落ちたこともある（つられても×）。
            </div>
          </div>
        )}
      </ParentPanel>
    </>
  );
}

export const taikiModule: ModuleDef = {
  id: 'taiki',
  name: 'まつ',
  label: '待機練習',
  sub: 'しずかに まつ',
  unit: 'ふん',
  defaultCount: 5,
  minCount: 5,
  maxCount: 20,
  step: 5,
  minutesPer: 1,
  color: moduleColor('taiki'),
  icon: 'chair',
  genre: 'taiki',
  omakase: false,
  Runner: TaikiRunner
};
