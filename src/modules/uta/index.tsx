import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../core/db';
import { fullReading } from '../../core/reading';
import { makeRng } from '../../core/rng';
import { useSettings } from '../../core/settings';
import { listenLong } from '../../core/speech/asr';
import { cancelSpeak, speak } from '../../core/speech/tts';
import { getVoiceState, markVoiceFailed } from '../../core/speech/voice';
import type { Attempt, Judge, LatencySource } from '../../core/types';
import { AttemptJudge, PanelLine, RunnerTop, secLabel } from '../../player/parts';
import type { ModuleDef, QuestionType, RunnerProps, SessionApi } from '../../player/types';
import { ParentPanel } from '../../ui/components';
import { Emoji } from '../../ui/emoji';
import { Icon } from '../../ui/icons';
import { moduleColor } from '../common';
import { judgeSinging } from './judgeSong';
import { SONGS, songById, type Song } from './songs';

export const UTA_TYPES: QuestionType[] = [
  {
    id: 'uta-picture',
    name: '絵から歌う',
    genre: 'uta',
    moduleId: 'uta',
    source: '本番',
    description:
      '1枚の絵（3〜4曲ぶんのアイコン）を見て、知っている歌を歌う。歌い出しまでの秒数を計る（目標3秒）。歌を聞き取って、その歌の ことば（1曲4〜7語）が出てきたら自動で○。聞き取れないときは？にして保護者が判定。',
    priority: 3,
    answer: 'voice',
    speedTargetSec: 3,
    sample: 'この えの なかで しっている おうたは ありますか。その おうたを うたってください。'
  },
  {
    id: 'uta-cards',
    name: '曲名カードから選んで歌う',
    genre: 'uta',
    moduleId: 'uta',
    source: 'ノート',
    description: '曲名＋アイコンのカード4〜5枚から好きな歌を選び、すぐに歌い出す。判定は「絵から歌う」と同じ（ことばが出てきたら○）。',
    priority: 2,
    answer: 'voice',
    speedTargetSec: 3,
    sample: 'どの おうたが すきですか。えらんで うたってください。'
  }
];

const JUDGE_LABELS: Partial<Record<Judge, string>> = { correct: 'うたえた', wrong: 'とまった', unknown: 'うたわない' };

type Phase = 'speaking' | 'choose' | 'waiting' | 'singing' | 'judging' | 'done';

function SongIcons({ song, size }: { song: Song; size: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }} role="img" aria-label={song.iconLabel}>
      {song.icons.slice(0, song.icons.length > 2 ? 2 : song.icons.length).map((c, i) => (
        <Emoji key={i} char={c} size={i === 0 ? size : Math.round(size * 0.7)} />
      ))}
    </span>
  );
}

/** 「絵」：いくつかの歌のアイコンを1枚の絵のように並べる */
function SongPicture({ songs }: { songs: Song[] }) {
  return (
    <div
      style={{
        width: '100%',
        borderRadius: 20,
        background: 'linear-gradient(#eaf4ff 0 62%, #e3f3df 62% 100%)',
        padding: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10
      }}
    >
      {songs.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 92 }}>
          <SongIcons song={s} size={64} />
        </div>
      ))}
    </div>
  );
}

const SING_MAX_MS = 40000; // 1番を歌い切るのに十分な長さ
const SING_END_SILENCE_MS = 3500; // 歌い終わったとみなす無音

function UtaQuestion({
  kind,
  index,
  total,
  session,
  onNext
}: {
  kind: 'uta-picture' | 'uta-cards';
  index: number;
  total: number;
  session: SessionApi;
  onNext: () => void;
}) {
  const { settings } = useSettings();
  const rng = useMemo(() => makeRng(), []);
  const songs = useMemo(() => rng.sample(SONGS, kind === 'uta-picture' ? rng.int(3, 4) : rng.int(4, 5)), [rng, kind]);
  const [phase, setPhase] = useState<Phase>('speaking');
  const [picked, setPicked] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [sung, setSung] = useState<string | null>(null);
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const [startMs, setStartMs] = useState<number | null>(null);
  const t0 = useRef(0);
  const recorded = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const pickedRef = useRef<string | null>(null);
  const parentStart = useRef<{ ms: number } | null>(null);

  const prompt =
    kind === 'uta-picture'
      ? 'この えの なかで しっている おうたは ありますか。その おうたを うたってください。'
      : 'どの おうたが すきですか。えらんで うたってください。';
  const speech =
    kind === 'uta-picture'
      ? 'この えの なかで、しっている おうたは ありますか。その おうたを うたってください。'
      : 'どの おうたが すきですか。えらんで うたってください。';

  const record = async (input: {
    voice: boolean;
    autoJudge?: Judge;
    parentJudge?: Judge;
    latencyMs?: number;
    latencySource?: LatencySource;
    transcript?: string;
    meta?: Record<string, unknown>;
  }) => {
    if (recorded.current) return;
    recorded.current = true;
    const a = await session.record({
      moduleId: 'uta',
      questionType: kind,
      prompt,
      params: { songs: songs.map((s) => s.id), picked: pickedRef.current },
      answerMode: input.voice ? 'voice' : 'parent',
      tappedChoice: pickedRef.current ?? undefined,
      transcript: input.transcript,
      autoJudge: input.autoJudge,
      parentJudge: input.parentJudge,
      latencyMs: input.latencyMs,
      latencySource: input.latencySource,
      meta: input.meta
    });
    if (alive.current) setAttempt(a);
  };

  // 歌い出しを待って、止まるまで聞き続ける → 歌のことばで判定
  const listenSinging = () => {
    t0.current = performance.now();
    setPhase('waiting');
    if (!getVoiceState().available) return; // 保護者のボタンで続ける
    const l = listenLong({
      startTimeoutMs: settings.silenceTimeoutSec * 1000,
      maxMs: SING_MAX_MS,
      endSilenceMs: SING_END_SILENCE_MS,
      onFirstSound: (ms) => {
        if (!alive.current) return;
        setStartMs(ms);
        setPhase('singing');
      },
      onText: (t) => alive.current && setHeard(t)
    });
    stopRef.current = l.stop;
    l.promise.then(async (r) => {
      stopRef.current = null;
      if (!alive.current || recorded.current) return;
      if (r.status === 'error' && r.fatal) {
        markVoiceFailed(r.error || 'error');
        setPhase(parentStart.current ? 'singing' : 'waiting');
        return; // 保護者のボタンで続ける
      }
      if (r.status === 'nospeech') {
        setPhase('done');
        await speak('だいじょうぶです。');
        await record({ voice: true, autoJudge: 'unknown', meta: { status: 'nospeech' } });
        return;
      }
      setPhase('judging');
      let reading = '';
      try {
        reading = await fullReading(r.transcript);
      } catch {
        reading = r.transcript;
      }
      const j = judgeSinging(reading, songs, pickedRef.current);
      if (!alive.current) return;
      setNote(j.note);
      if (j.best) setSung(j.best.song.id);
      setPhase('done');
      await record({
        voice: true,
        autoJudge: j.judge,
        latencyMs: r.latencyMs,
        latencySource: r.latencySource,
        transcript: r.transcript,
        meta: {
          note: j.note,
          sung: j.best?.song.id,
          hits: j.best?.hits ?? [],
          singingMs: r.activeMs !== undefined ? Math.round(r.activeMs) : undefined
        }
      });
    });
  };

  useEffect(() => {
    alive.current = true;
    (async () => {
      await speak(speech);
      if (!alive.current) return;
      if (kind === 'uta-cards') {
        t0.current = performance.now();
        setPhase('choose');
      } else listenSinging();
    })();
    return () => {
      alive.current = false;
      stopRef.current?.();
      cancelSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    if (phase !== 'choose') return;
    setPicked(id);
    pickedRef.current = id;
    setSung(id);
    listenSinging();
  };

  // 子ども：うたい おわった（聞くのをやめて判定へ）
  const finishSinging = () => {
    if (stopRef.current) stopRef.current();
    else if (!recorded.current) setPhase('done');
  };

  // 保護者：歌い出した（音声認識が使えないとき）
  const parentStarted = () => {
    parentStart.current = { ms: performance.now() - t0.current };
    setStartMs(parentStart.current.ms);
    setPhase('singing');
  };

  const parentJudgeNow = async (j: Judge) => {
    stopRef.current?.();
    if (recorded.current) return;
    setPhase('done');
    await record({
      voice: false,
      parentJudge: j,
      latencyMs: parentStart.current?.ms,
      latencySource: parentStart.current ? 'parent' : undefined,
      meta: { sung: pickedRef.current ?? undefined }
    });
  };

  const chooseSung = async (id: string) => {
    setSung(id);
    if (attempt) await db.attempts.update(attempt.id, { meta: { ...(attempt.meta || {}), sung: id } });
  };

  const done = phase === 'done' || !!attempt;

  return (
    <>
      <div className="play-main">
        <RunnerTop index={index} total={total} />
        {kind === 'uta-picture' ? (
          <SongPicture songs={songs} />
        ) : (
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {songs.map((s) => (
              <button
                key={s.id}
                className={`choice ${picked === s.id ? 'selected' : ''}`}
                style={{ minHeight: 104 }}
                aria-label={s.title}
                onClick={() => pick(s.id)}
              >
                <SongIcons song={s} size={44} />
                <span className="choice-label" style={{ fontSize: 16 }}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="stage" style={{ gap: 10, padding: '10px 0' }}>
          {phase === 'speaking' && (
            <span className="stage-text" style={{ fontSize: 21 }}>
              よく きいてください
            </span>
          )}
          {phase === 'choose' && (
            <span className="stage-text" style={{ fontSize: 21 }}>
              すきな おうたを えらんでください
            </span>
          )}
          {phase === 'waiting' && (
            <>
              <span className="blink" style={{ color: 'var(--primary)' }}>
                <Icon name="music" size={56} />
              </span>
              <span className="stage-text" style={{ fontSize: 22 }}>
                げんきに うたってください
              </span>
            </>
          )}
          {phase === 'singing' && (
            <>
              <span className="rise" style={{ fontSize: 48 }}>
                🎵
              </span>
              <span className="stage-text" style={{ fontSize: 22 }}>
                じょうずに うたってね
              </span>
              <button className="btn btn-primary" onClick={finishSinging}>
                うたいおわった
              </button>
            </>
          )}
          {phase === 'judging' && (
            <span className="stage-text" style={{ fontSize: 21 }}>
              ききました
            </span>
          )}
          {done && (
            <>
              <span className="stage-text" style={{ fontSize: 21 }}>
                {attempt?.finalJudge === 'correct' && settings.showResultImmediately ? 'じょうずに うたえました' : 'つぎに いきます'}
              </span>
              <button className="btn btn-primary" onClick={onNext}>
                つぎへ
                <Icon name="right" size={20} />
              </button>
            </>
          )}
        </div>
      </div>
      <ParentPanel
        right={
          done ? (
            <button className="btn btn-parent btn-sm" onClick={onNext}>
              つぎへ
              <Icon name="right" size={16} />
            </button>
          ) : undefined
        }
      >
        <div className="panel-box stack" style={{ gap: 4 }}>
          <PanelLine label="もんだい">{prompt}</PanelLine>
          <PanelLine label="うた">{songs.map((s) => s.title).join('・')}</PanelLine>
          {startMs !== null && <PanelLine label="うたいだし">{secLabel(startMs)}（目標 3秒）</PanelLine>}
          {heard && <PanelLine label="きこえた">{heard.slice(-80)}</PanelLine>}
          {note && <PanelLine label="じどう">{note}</PanelLine>}
        </div>
        {phase === 'waiting' && !attempt && !getVoiceState().available && (
          <button className="btn btn-outline" onClick={parentStarted}>
            うたいだした（ここで秒数を記録）
          </button>
        )}
        {attempt ? (
          <AttemptJudge attempt={attempt} session={session} labels={JUDGE_LABELS} />
        ) : (
          phase !== 'speaking' &&
          phase !== 'judging' && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="tiny muted">保護者がここで判定することもできます</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => parentJudgeNow('correct')}>
                  ○ うたえた
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => parentJudgeNow('wrong')}>
                  × とまった
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => parentJudgeNow('unknown')}>
                  ？ うたわない
                </button>
              </div>
            </div>
          )
        )}
        {attempt && (
          <div className="row panel-more" style={{ flexWrap: 'wrap', gap: 6 }}>
            <span className="tiny muted">うたった曲：</span>
            {songs.map((s) => (
              <button key={s.id} className={`chip ${sung === s.id ? 'chip-parent' : ''}`} style={{ border: 0 }} onClick={() => chooseSung(s.id)}>
                {s.title}
              </button>
            ))}
          </div>
        )}
      </ParentPanel>
    </>
  );
}

function UtaRunner({ count, types, session, onDone }: RunnerProps) {
  const kinds = useMemo(() => {
    const t = types?.length ? types : null;
    const allowed = (['uta-picture', 'uta-cards'] as const).filter((k) => !t || t.includes(k));
    const list = allowed.length ? allowed : (['uta-picture', 'uta-cards'] as const);
    // 絵から歌う（本番）を多めに：絵・絵・カード…
    return Array.from({ length: count }, (_, i) => (list.length === 1 ? list[0] : i % 3 === 2 ? 'uta-cards' : 'uta-picture'));
  }, [count, types]);
  const [idx, setIdx] = useState(0);
  const kind = kinds[idx];
  if (!kind) return null;
  return (
    <UtaQuestion
      key={idx}
      kind={kind}
      index={idx}
      total={kinds.length}
      session={session}
      onNext={() => (idx + 1 >= kinds.length ? onDone() : setIdx(idx + 1))}
    />
  );
}

export const utaModule: ModuleDef = {
  id: 'uta',
  name: 'うた',
  label: 'うた',
  sub: 'すぐに うたいだす',
  unit: 'もん',
  defaultCount: 3,
  minCount: 1,
  maxCount: 6,
  step: 1,
  minutesPer: 1,
  color: moduleColor('uta'),
  icon: 'music',
  genre: 'uta',
  omakase: true,
  Runner: UtaRunner
};

export { SONGS, songById };
