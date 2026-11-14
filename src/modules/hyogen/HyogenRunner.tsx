import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { playClaps, playMelody, startMetronome, startTune, type Note } from '../../core/audio';
import { db } from '../../core/db';
import { makeRng, type Rng } from '../../core/rng';
import { cancelSpeak, speak } from '../../core/speech/tts';
import type { Judge } from '../../core/types';
import { PanelLine, RunnerTop, secLabel } from '../../player/parts';
import { buildSequence } from '../../player/TapSetRunner';
import type { QuestionType, RunnerProps, SessionApi } from '../../player/types';
import { VoiceStage } from '../../player/voice';
import { JudgeButtons, ParentPanel, Switch, useWakeLock } from '../../ui/components';
import { Emoji } from '../../ui/emoji';
import { Icon } from '../../ui/icons';
import { InstrumentIcon } from './Instruments';
import { clapTimesMs, makeMelody, makeRhythm, melodyBeats, melodyLabel, noteTimesMs, rhythmLabel } from './melody';
import { makePoseSequence, poseLabel, type Pose } from './poses';
import { INSTRUMENTS, playInstrument, type InstrumentId } from './sounds';
import { StickFigure } from './StickFigure';
import { HYOGEN_TYPES, type HyogenKind } from './types';

// 表現・模倣：指示を1回だけ読み上げ → お手本（音・ポーズ）→ 子どもがやる → 保護者が判定

interface HQ {
  kind: HyogenKind;
  type: QuestionType;
  prompt: string; // 記録用（ひらがな）
  params: Record<string, unknown>;
  detail: string; // 保護者向けのお手本の説明
  performSec: number;
  bpm: number;
  bpm2?: number;
  rhythm?: number[];
  poses?: Pose[];
  variant?: 'memory' | 'follow';
  melody?: Note[];
}

const TEMPOS = [60, 72, 96, 120];

export function makeHQ(type: QuestionType, rng: Rng): HQ {
  const kind = type.id as HyogenKind;
  switch (kind) {
    case 'hyogen-rhythm-walk': {
      const rhythm = makeRhythm(rng);
      const bpm = rng.pick([84, 92, 100]);
      return {
        kind,
        type,
        rhythm,
        bpm,
        performSec: 12,
        prompt: 'せんせいが たたいた リズムの とおりに あるいてください。',
        params: { rhythm, bpm },
        detail: `${rhythmLabel(rhythm)}（${rhythm.length}回・テンポ${bpm}）`
      };
    }
    case 'hyogen-pose': {
      const variant: 'memory' | 'follow' = rng.chance(0.5) ? 'memory' : 'follow';
      const poses = makePoseSequence(rng, variant === 'memory' ? rng.int(2, 3) : rng.int(3, 4));
      const labels = poses.map(poseLabel);
      return {
        kind,
        type,
        poses,
        variant,
        bpm: 0,
        performSec: variant === 'memory' ? 10 : poses.length * 4,
        prompt: variant === 'memory' ? 'せんせいの うごきを みて、おなじように うごいてください。' : 'せんせいと おなじように うごいてください。',
        params: { variant, poses: labels },
        detail: `${variant === 'memory' ? '見てから まねる' : 'いっしょに まねる（4秒ごと）'}：${labels.join(' → ')}`
      };
    }
    case 'hyogen-sing-copy': {
      const melody = makeMelody(rng);
      const bpm = 100;
      return {
        kind,
        type,
        melody,
        bpm,
        performSec: Math.ceil((melodyBeats(melody) * 60) / bpm) + 6,
        prompt: 'せんせいの まねを して、「ら」で うたってください。',
        params: { melody: melody.map((n) => [n.midi, n.beats]), bpm },
        detail: melodyLabel(melody)
      };
    }
    case 'hyogen-instrument': {
      const bpm = rng.pick([96, 108]);
      return {
        kind,
        type,
        bpm,
        performSec: 15,
        prompt: 'すきな がっきを えらんで、おんがくに あわせて ならしてください。',
        params: { bpm },
        detail: `音楽 15秒（テンポ${bpm}）`
      };
    }
    case 'hyogen-metronome': {
      const bpm = rng.pick(TEMPOS);
      const bpm2 = rng.chance(0.5) ? rng.pick(TEMPOS.filter((b) => Math.abs(b - bpm) >= 24)) : undefined;
      return {
        kind,
        type,
        bpm,
        bpm2,
        performSec: 16,
        prompt: 'メトロノームの はやさに あわせて あるいてください。',
        params: { bpm, bpm2 },
        detail: bpm2 ? `テンポ ${bpm} → 8秒後に ${bpm2}` : `テンポ ${bpm}（変わらない）`
      };
    }
    case 'hyogen-dance':
    default: {
      const bpm = rng.pick([100, 112, 120]);
      return {
        kind: 'hyogen-dance',
        type,
        bpm,
        performSec: 20,
        prompt: 'てと あしを うごかして、じゆうに おどってください。',
        params: { bpm },
        detail: `音楽 20秒（テンポ${bpm}）`
      };
    }
  }
}

type Phase = 'intro' | 'demo' | 'go' | 'choose' | 'perform' | 'judge';

const STYLES = `
@keyframes hyPulse { 0% { transform: scale(1); } 12% { transform: scale(1.22); } 100% { transform: scale(1); } }
@keyframes hyBounce { 0%, 100% { transform: translateY(0) rotate(-5deg); } 50% { transform: translateY(-12px) rotate(5deg); } }
`;

function Big({ char, label, bounce = false }: { char: string; label: string; bounce?: boolean }) {
  return (
    <span style={{ display: 'inline-block', animation: bounce ? 'hyBounce 0.9s ease-in-out infinite' : undefined }}>
      <Emoji char={char} size={110} label={label} />
    </span>
  );
}

function StageText({ children }: { children: string }) {
  return <span className="stage-text">{children}</span>;
}

function HyogenQuestion({ type, index, total, session, onNext }: { type: QuestionType; index: number; total: number; session: SessionApi; onNext: () => void }) {
  const q = useMemo(() => makeHQ(type, makeRng()), [type]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [beatIdx, setBeatIdx] = useState(-1);
  const [poseIdx, setPoseIdx] = useState(-1);
  const [left, setLeft] = useState(q.performSec);
  const [curBpm, setCurBpm] = useState(q.bpm);
  const [choice, setChoice] = useState<InstrumentId | null>(null);
  const [hit, setHit] = useState(0);
  const [judge, setJudge] = useState<Judge | undefined>();
  const [immediate, setImmediate] = useState(false);
  const [confident, setConfident] = useState(false);
  const [latency, setLatency] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  const performStart = useRef(0);
  const endPerform = useRef<(() => void) | null>(null);
  const chooseResolve = useRef<(() => void) | null>(null);
  const chooseStart = useRef(0);
  const chooseMs = useRef<number | undefined>(undefined);
  const stopSound = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const endedEarly = useRef(false);

  useEffect(() => {
    const tok = { alive: true };
    const ok = () => tok.alive;
    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        timers.current.push(setTimeout(r, ms));
      });

    const demoRhythm = async () => {
      const times = clapTimesMs(q.rhythm!, q.bpm);
      times.forEach((t, i) => timers.current.push(setTimeout(() => ok() && setBeatIdx(i), t + 100)));
      await playClaps(q.rhythm!, q.bpm);
      setBeatIdx(-1);
    };
    const demoMelody = async () => {
      const times = noteTimesMs(q.melody!, q.bpm);
      times.forEach((t, i) => timers.current.push(setTimeout(() => ok() && setBeatIdx(i), t + 100)));
      await playMelody(q.melody!, q.bpm);
      setBeatIdx(-1);
    };
    const demoPoses = async (ms: number) => {
      for (let i = 0; i < q.poses!.length; i++) {
        if (!ok()) return;
        setPoseIdx(i);
        await sleep(ms);
        if (!ok()) return;
        setPoseIdx(-1);
        await sleep(350);
      }
    };
    const perform = () =>
      new Promise<void>((resolve) => {
        performStart.current = performance.now();
        setLeft(q.performSec);
        setPhase('perform');
        let done = false;
        let switched = false;
        let iv: ReturnType<typeof setInterval> | undefined;
        const finish = () => {
          if (done) return;
          done = true;
          if (iv) clearInterval(iv);
          endPerform.current = null;
          resolve();
        };
        endPerform.current = finish;
        iv = setInterval(() => {
          const el = (performance.now() - performStart.current) / 1000;
          setLeft(Math.max(0, q.performSec - el));
          if (q.kind === 'hyogen-pose' && q.variant === 'follow') setPoseIdx(Math.min(q.poses!.length - 1, Math.floor(el / 4)));
          if (q.kind === 'hyogen-metronome' && q.bpm2 && !switched && el >= q.performSec / 2) {
            switched = true;
            stopSound.current?.();
            stopSound.current = startMetronome(q.bpm2);
            setCurBpm(q.bpm2);
          }
          if (el >= q.performSec) finish();
        }, 200);
      });

    const run = async () => {
      setPhase('intro');
      switch (q.kind) {
        case 'hyogen-rhythm-walk':
          await speak('先生が 手を たたきます。よく 聞いてください。');
          if (!ok()) return;
          setPhase('demo');
          await sleep(400);
          await demoRhythm();
          if (!ok()) return;
          setPhase('go');
          await speak('いまの リズムの とおりに、歩いてください。どうぞ。');
          break;
        case 'hyogen-pose':
          if (q.variant === 'memory') {
            await speak('先生が うごきます。よく 見ていてください。');
            if (!ok()) return;
            setPhase('demo');
            await demoPoses(2600);
            if (!ok()) return;
            setPhase('go');
            await speak('おなじように、うごいてください。どうぞ。');
          } else {
            await speak('先生と おなじように、うごいてください。');
          }
          break;
        case 'hyogen-sing-copy':
          await speak('先生が うたいます。よく 聞いてください。');
          if (!ok()) return;
          setPhase('demo');
          await sleep(300);
          await demoMelody();
          if (!ok()) return;
          setPhase('go');
          await speak('おなじように、ラで うたってください。どうぞ。');
          break;
        case 'hyogen-instrument':
          await speak('好きな 楽器を、ひとつ 選んでください。');
          if (!ok()) return;
          chooseStart.current = performance.now();
          setPhase('choose');
          await new Promise<void>((r) => {
            chooseResolve.current = r;
          });
          if (!ok()) return;
          setPhase('go');
          await speak('音楽に あわせて、ならしてください。');
          break;
        case 'hyogen-metronome':
          await speak('メトロノームの 速さに あわせて、歩いてください。');
          break;
        case 'hyogen-dance':
          await speak('手と 足を うごかして、自由に おどってください。');
          break;
      }
      if (!ok()) return;
      if (q.kind === 'hyogen-metronome') stopSound.current = startMetronome(q.bpm);
      if (q.kind === 'hyogen-dance' || q.kind === 'hyogen-instrument') stopSound.current = startTune(q.bpm);
      if (q.kind === 'hyogen-pose' && q.variant === 'follow') setPoseIdx(0);
      await perform();
      stopSound.current?.();
      stopSound.current = null;
      if (!ok()) return;
      setPoseIdx(-1);
      setPhase('judge');
      await speak('おしまいです。', { times: 1 });
    };

    run();
    return () => {
      tok.alive = false;
      cancelSpeak();
      stopSound.current?.();
      stopSound.current = null;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      endPerform.current?.();
      chooseResolve.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: InstrumentId) => {
    playInstrument(id);
    if (phase === 'choose') {
      setChoice(id);
      chooseMs.current = performance.now() - chooseStart.current;
      const r = chooseResolve.current;
      chooseResolve.current = null;
      r?.();
    }
  };

  const strike = () => {
    if (!choice) return;
    playInstrument(choice);
    setHit((h) => h + 1);
  };

  const started = () => {
    if (latency !== undefined || phase !== 'perform') return;
    const ms = performance.now() - performStart.current;
    setLatency(ms);
    setImmediate(ms <= 3000);
  };

  const endNow = () => {
    endedEarly.current = true;
    endPerform.current?.();
  };

  const next = async () => {
    if (saving) return;
    setSaving(true);
    await session.record({
      moduleId: 'hyogen',
      questionType: q.type.id,
      prompt: q.prompt,
      params: { ...q.params, ...(choice ? { instrument: choice } : {}) },
      answerMode: 'parent',
      parentJudge: judge,
      parentChecks: { immediate },
      latencyMs: latency !== undefined ? Math.round(latency) : undefined,
      latencySource: latency !== undefined ? 'parent' : undefined,
      meta: {
        confident,
        endedEarly: endedEarly.current,
        performSec: q.performSec,
        ...(chooseMs.current !== undefined ? { chooseMs: Math.round(chooseMs.current) } : {}),
        ...(q.kind === 'hyogen-instrument' ? { hits: hit } : {})
      }
    });
    onNext();
  };

  // ---- 子どもに見せる画面 ----
  let stage: ReactNode;
  if (phase === 'intro' || (phase === 'go' && q.kind !== 'hyogen-instrument')) {
    stage = <VoiceStage phase="speaking" />;
  } else if (phase === 'demo' && q.kind === 'hyogen-rhythm-walk') {
    stage = (
      <div className="stage">
        <Big char="👏" label="てを たたく" />
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }} aria-hidden="true">
          {q.rhythm!.map((d, i) => {
            const s = d >= 2 ? 44 : d >= 1 ? 34 : 24;
            const on = i === beatIdx;
            return (
              <span
                key={i}
                style={{
                  width: s,
                  height: s,
                  borderRadius: 999,
                  background: on ? '#a8338a' : i < beatIdx ? '#e7c3dd' : '#f3e3ee',
                  transform: on ? 'scale(1.2)' : undefined,
                  transition: 'transform .08s, background .08s'
                }}
              />
            );
          })}
        </div>
        <StageText>よく きいてください</StageText>
      </div>
    );
  } else if (phase === 'demo' && q.kind === 'hyogen-sing-copy') {
    stage = (
      <div className="stage">
        <Big char="🎵" label="おんがく" />
        <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 90 }} aria-hidden="true">
          {q.melody!.map((n, i) => (
            <span
              key={i}
              style={{
                width: 12 + n.beats * 12,
                height: 20 + (n.midi - 58) * 4.5,
                borderRadius: 10,
                background: i === beatIdx ? '#a8338a' : i < beatIdx ? '#e7c3dd' : '#f3e3ee',
                transition: 'background .08s'
              }}
            />
          ))}
        </div>
        <StageText>よく きいてください</StageText>
      </div>
    );
  } else if ((phase === 'demo' || phase === 'perform') && q.kind === 'hyogen-pose' && (phase === 'demo' || q.variant === 'follow')) {
    const pose = poseIdx >= 0 ? q.poses![poseIdx] : null;
    stage = (
      <div className="stage" style={{ gap: 12 }}>
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pose ? <StickFigure key={poseIdx} pose={pose} size={236} /> : <span style={{ width: 168, height: 236 }} />}
        </div>
        <div className="row" style={{ gap: 6 }} aria-hidden="true">
          {q.poses!.map((_, i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: i === poseIdx ? '#a8338a' : i < poseIdx ? '#e7c3dd' : '#e3e8f0' }} />
          ))}
        </div>
        <StageText>{phase === 'demo' ? 'よく みていてください' : 'おなじように うごいてください'}</StageText>
      </div>
    );
  } else if (phase === 'choose' || (phase === 'go' && q.kind === 'hyogen-instrument')) {
    stage = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="stage-text" style={{ fontSize: 21, textAlign: 'center' }}>
          すきな がっきを えらんでください
        </div>
        <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {INSTRUMENTS.map((it) => (
            <button key={it.id} className={`choice ${choice === it.id ? 'selected' : ''}`} style={{ minHeight: 140 }} aria-label={it.kana} onClick={() => pick(it.id)}>
              <InstrumentIcon id={it.id} size={84} />
              <span className="choice-label">{it.kana}</span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (phase === 'perform') {
    switch (q.kind) {
      case 'hyogen-rhythm-walk':
        stage = (
          <div className="stage">
            <Big char="👣" label="あしあと" />
            <StageText>リズムの とおりに あるいてください</StageText>
          </div>
        );
        break;
      case 'hyogen-pose':
        stage = (
          <div className="stage">
            <Big char="🙆" label="まねを する こ" />
            <StageText>おなじように うごいてください</StageText>
          </div>
        );
        break;
      case 'hyogen-sing-copy':
        stage = (
          <div className="stage">
            <Big char="🎤" label="まいく" />
            <StageText>「ら」で うたってください</StageText>
          </div>
        );
        break;
      case 'hyogen-instrument':
        stage = (
          <div className="stage" style={{ gap: 14 }}>
            <button
              className="choice selected"
              style={{ width: 220, minHeight: 220, borderRadius: 999 }}
              aria-label={`${INSTRUMENTS.find((x) => x.id === choice)?.kana ?? 'がっき'}を ならす`}
              onPointerDown={(e) => {
                e.preventDefault();
                strike();
              }}
            >
              {choice && (
                <span key={hit} style={{ display: 'inline-block', animation: 'hyPulse 0.25s ease-out' }}>
                  <InstrumentIcon id={choice} size={140} />
                </span>
              )}
            </button>
            <StageText>おんがくに あわせて ならしてください</StageText>
          </div>
        );
        break;
      case 'hyogen-metronome':
        stage = (
          <div className="stage">
            <span
              key={curBpm}
              aria-hidden="true"
              style={{ width: 130, height: 130, borderRadius: 999, background: '#fde8f6', border: '6px solid #a8338a', animation: `hyPulse ${60 / curBpm}s ease-out infinite` }}
            />
            <StageText>メトロノームに あわせて あるいてください</StageText>
          </div>
        );
        break;
      case 'hyogen-dance':
      default:
        stage = (
          <div className="stage">
            <Big char="💃" label="おどる こ" bounce />
            <StageText>じゆうに おどってください</StageText>
          </div>
        );
    }
  } else {
    // judge
    stage = (
      <div className="stage rise">
        <div className="orb" style={{ background: '#fff', border: '4px solid var(--line)', color: 'var(--muted)' }}>
          <Icon name="smile" size={96} style={{ strokeWidth: 1.6 }} />
        </div>
        <StageText>おしまいです</StageText>
        <span className="small muted">すこし まっていてください</span>
      </div>
    );
  }

  const judging = phase === 'perform' || phase === 'judge';

  return (
    <>
      <style>{STYLES}</style>
      <div className="play-main">
        <RunnerTop index={index} total={total} />
        {stage}
      </div>
      <ParentPanel
        right={
          phase === 'judge' ? (
            <button className="btn btn-parent btn-sm" onClick={next} disabled={saving}>
              つぎへ
              <Icon name="right" size={16} />
            </button>
          ) : phase === 'perform' ? (
            <button className="btn btn-outline btn-sm" onClick={endNow}>
              おわりにする
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={onNext}>
              とばす
            </button>
          )
        }
      >
        <div className="panel-box stack" style={{ gap: 4 }}>
          <PanelLine label="もんだい">{q.type.name}</PanelLine>
          <PanelLine label="おてほん">
            {q.detail}
            {choice ? `・えらんだ楽器：${INSTRUMENTS.find((x) => x.id === choice)?.name}` : ''}
          </PanelLine>
          {phase === 'perform' && (
            <PanelLine label="のこり">
              {Math.ceil(left)}秒{latency !== undefined ? `・動きだし ${secLabel(latency)}` : ''}
            </PanelLine>
          )}
          {phase === 'judge' && latency !== undefined && <PanelLine label="動きだし">{secLabel(latency)}</PanelLine>}
        </div>
        {phase === 'perform' && (
          <button className="btn btn-outline btn-sm" onClick={started} disabled={latency !== undefined}>
            {latency !== undefined ? `うごきだした（${secLabel(latency)}）` : 'うごきだした（タップで秒数を記録）'}
          </button>
        )}
        {judging && (
          <>
            <JudgeButtons value={judge} onChange={setJudge} only={['correct', 'wrong']} labels={{ correct: 'できた', wrong: 'できなかった' }} />
            <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <span className="row small">
                <Switch on={immediate} onChange={setImmediate} label="すぐ はじめた" />
                すぐ はじめた
              </span>
              <span className="row small">
                <Switch on={confident} onChange={setConfident} label="どうどうと できた" />
                どうどうと
              </span>
            </div>
          </>
        )}
      </ParentPanel>
    </>
  );
}

export function HyogenRunner({ count, types, session, onDone }: RunnerProps) {
  useWakeLock(true);
  const [seq, setSeq] = useState<QuestionType[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const reviews = await db.reviews.toArray();
      const off = new Set(reviews.filter((r) => r.mark === 'off').map((r) => r.typeId));
      const chosen = types?.length ? HYOGEN_TYPES.filter((t) => types.includes(t.id)) : [];
      let list = chosen;
      if (!list.length) {
        const on = HYOGEN_TYPES.filter((t) => !off.has(t.id));
        list = on.length ? on : HYOGEN_TYPES;
      }
      const s = buildSequence(makeRng(), list, Math.max(1, count));
      if (alive) setSeq(s);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!seq) return <div className="stage" />;
  const type = seq[idx];
  if (!type) return null;
  return (
    <HyogenQuestion
      key={idx}
      type={type}
      index={idx}
      total={seq.length}
      session={session}
      onNext={() => (idx + 1 >= seq.length ? onDone() : setIdx(idx + 1))}
    />
  );
}
