import { useEffect, useMemo, useRef, useState } from 'react';
import { buzzer } from '../../core/audio';
import { db, nowIso, uid } from '../../core/db';
import { makeRng } from '../../core/rng';
import { useSettings } from '../../core/settings';
import { cancelSpeak, speak } from '../../core/speech/tts';
import type { Attempt } from '../../core/types';
import { AttemptJudge, PanelLine, RunnerTop, secLabel } from '../../player/parts';
import type { RunnerProps } from '../../player/types';
import { Modal, ParentPanel, Switch, useWakeLock } from '../../ui/components';
import { Icon, ShapeGlyph } from '../../ui/icons';
import { useMode } from '../../ui/mode';
import { DrawCanvas, renderPng, shapePainter, tracePainter, type Painter } from './DrawCanvas';
import { ExampleCard, SHAPE_EXAMPLES, ShapeExamples } from './examples';
import { pickShapes, SHAPES, type ShapeDef } from './shapes';
import {
  evaluateTrace,
  makeTracePath,
  traceInstruction,
  traceSummary,
  TRACE_KINDS,
  TRACE_NAMES,
  type Pt,
  type TraceEval,
  type TraceKind
} from './trace';
import { SHAPE_INSTRUCTION, SHAPE_SPEECH, TRACE_TYPE_ID } from './types';

// 絵の書き足し（＋点線なぞり）のランナー
// 形を見せる → 1回だけ読み上げ → 指で描く（描き始めまでの時間を記録）→「できた」→ PNG をネタ帳へ → 作例 → 保護者が判定・◎

type Item = { kind: 'shape'; def: ShapeDef } | { kind: 'trace'; trace: TraceKind; seed: number };

type Phase = 'speaking' | 'drawing' | 'saving' | 'review';

interface Result {
  png: string;
  drawingId?: string;
  seconds: number;
  strokes: number;
  eval?: TraceEval;
  attempt: Attempt;
  timeUp: boolean;
}

/** 出す順番を決める（types に形のタイプ・zukei-trace があればその中から） */
async function buildItems(count: number, types: string[] | undefined): Promise<Item[]> {
  const [reviews, past] = await Promise.all([db.reviews.toArray(), db.attempts.where('moduleId').equals('kakitashi').toArray()]);
  const off = new Set(reviews.filter((r) => r.mark === 'off').map((r) => r.typeId));
  const counts: Record<string, number> = {};
  for (const a of past) counts[a.questionType] = (counts[a.questionType] ?? 0) + 1;
  const want = new Set(types ?? []);
  let shapeCands = SHAPES.filter((s) => want.has(s.typeId));
  const wantTrace = want.has(TRACE_TYPE_ID);
  if (!shapeCands.length && !wantTrace) {
    shapeCands = SHAPES.filter((s) => !off.has(s.typeId));
    if (!shapeCands.length) shapeCands = SHAPES;
  }
  const rng = makeRng();
  const n = Math.max(1, count);
  const kinds = rng.shuffle(TRACE_KINDS);
  const traceItem = (i: number): Item => ({ kind: 'trace', trace: kinds[i % kinds.length], seed: rng.int(1, 2 ** 30) });
  if (!shapeCands.length) return Array.from({ length: n }, (_, i) => traceItem(i));
  if (!wantTrace) return pickShapes(shapeCands, n, counts, rng.next).map((def) => ({ kind: 'shape', def }));
  // 形と なぞり を交互に
  const nShape = Math.ceil(n / 2);
  const shapes = pickShapes(shapeCands, nShape, counts, rng.next);
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? { kind: 'shape', def: shapes[i >> 1] } : traceItem(i >> 1)));
}

export function KakitashiRunner({ count, types, session, onDone }: RunnerProps) {
  const { settings, update } = useSettings();
  const { isParent } = useMode();
  useWakeLock(true);

  const [items, setItems] = useState<Item[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('speaking');
  const [resetKey, setResetKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [nStrokes, setNStrokes] = useState(0);
  const [firstMs, setFirstMs] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [starred, setStarred] = useState(false);
  const [timeUpNow, setTimeUpNow] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Pt[][]>([]);
  const t0 = useRef(0);
  const firstAt = useRef<number | null>(null);
  const finishing = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    buildItems(count, types).then((list) => {
      if (alive.current) setItems(list);
    });
    return () => {
      alive.current = false;
      cancelSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // キャンバスの大きさ（最初に1回だけ測る）
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || size) return;
    // 画面の空いている高さを使う（形のまわりに描く場所を広くとる）。
    // 下の「さいしょから・できた」と保護者パネルには重ならないように（スクロールせずに描けるように）
    const w = Math.max(260, Math.floor(el.clientWidth));
    const canvasTop = el.getBoundingClientRect().top + 40; // 上の案内（チップ）の分
    const below = 84 + 76; // ボタンの列 ＋ 下の保護者パネル
    const h = Math.round(Math.max(260, Math.min(w * 1.35, window.innerHeight - canvasTop - below)));
    setSize({ w, h });
  }, [items, size]);

  const item = items?.[idx];

  const tracePath = useMemo<Pt[] | null>(() => {
    if (!item || item.kind !== 'trace' || !size) return null;
    return makeTracePath(item.trace, size.w, size.h, makeRng(item.seed));
  }, [item, size]);

  const painter = useMemo<Painter | null>(() => {
    if (!item || !size) return null;
    if (item.kind === 'shape') return shapePainter(item.def.shape);
    return tracePath ? tracePainter(tracePath, item.trace) : null;
  }, [item, size, tracePath]);

  // 1枚ごとのはじまり：読み上げ（1回）→ 描ける
  useEffect(() => {
    if (!item || !size) return;
    let live = true;
    strokesRef.current = [];
    firstAt.current = null;
    finishing.current = false;
    setFirstMs(null);
    setNStrokes(0);
    setElapsed(0);
    setResult(null);
    setStarred(false);
    setResetKey((k) => k + 1);
    setPhase('speaking');
    const text = item.kind === 'shape' ? SHAPE_SPEECH : traceInstruction(item.trace);
    speak(text).then(() => {
      if (!live) return;
      t0.current = performance.now();
      setPhase('drawing');
    });
    return () => {
      live = false;
      cancelSpeak();
    };
  }, [item, size]);

  const finish = async (byTime: boolean) => {
    if (finishing.current || !item || !size || !painter) return;
    finishing.current = true;
    const seconds = Math.round((performance.now() - t0.current) / 100) / 10;
    setTimeUpNow(byTime);
    setPhase('saving');
    if (byTime) {
      await buzzer(3);
      await speak('おしまいです。', { times: 1 });
    }
    if (!alive.current) return;
    const strokes = strokesRef.current.map((s) => s.slice());
    const png = renderPng(size.w, size.h, painter, strokes);
    let drawingId: string | undefined;
    let ev: TraceEval | undefined;
    if (item.kind === 'shape') {
      if (strokes.length) {
        drawingId = uid();
        await db.drawings.add({
          id: drawingId,
          shape: item.def.shape,
          pngDataUrl: png,
          starred: false,
          sessionId: session.sessionId,
          seconds,
          createdAt: nowIso()
        });
      }
    } else if (tracePath) {
      ev = evaluateTrace(tracePath, strokes, Math.max(10, size.w * 0.04));
    }
    const latency = firstAt.current !== null ? Math.round(firstAt.current - t0.current) : undefined;
    const attempt = await session.record({
      moduleId: 'kakitashi',
      questionType: item.kind === 'shape' ? item.def.typeId : TRACE_TYPE_ID,
      prompt: item.kind === 'shape' ? SHAPE_INSTRUCTION : traceInstruction(item.trace),
      params: item.kind === 'shape' ? { shape: item.def.shape } : { trace: item.trace, seed: item.seed, w: size.w, h: size.h },
      answerMode: 'parent',
      autoJudge: strokes.length ? undefined : 'unknown',
      latencyMs: latency,
      latencySource: latency !== undefined ? 'tap' : undefined,
      meta: {
        drawingId,
        seconds,
        strokes: strokes.length,
        timeUp: byTime,
        ...(ev ? { coverage: ev.coverage, outside: ev.outside, meanDev: ev.meanDev, maxDev: ev.maxDev } : {})
      }
    });
    if (!alive.current) return;
    setResult({ png, drawingId, seconds, strokes: strokes.length, eval: ev, attempt, timeUp: byTime });
    setPhase('review');
  };

  // 描いている時間（制限時間は書き足しだけ。設定 0 = なし）
  useEffect(() => {
    if (phase !== 'drawing' || !item) return;
    const limit = item.kind === 'shape' ? settings.kakitashiTimeLimitSec : 0;
    const id = setInterval(() => {
      const el = (performance.now() - t0.current) / 1000;
      setElapsed(el);
      if (limit > 0 && el >= limit) {
        clearInterval(id);
        finish(true);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, item]);

  const next = () => {
    if (!items || idx + 1 >= items.length) onDone();
    else setIdx((i) => i + 1);
  };

  const toggleStar = (v: boolean) => {
    setStarred(v);
    if (result?.drawingId) db.drawings.update(result.drawingId, { starred: v });
  };

  const limit = item?.kind === 'shape' ? settings.kakitashiTimeLimitSec : 0;
  const shapeItem = item?.kind === 'shape' ? item.def : null;

  return (
    <>
      <div className="play-main">
        <RunnerTop
          index={idx}
          total={items?.length ?? Math.max(1, count)}
          right={
            shapeItem ? (
              <span className="chip" style={{ color: '#b23a2f' }}>
                <ShapeGlyph shape={shapeItem.shape} size={18} />
                {shapeItem.kidName}
              </span>
            ) : item ? (
              <span className="chip">なぞる</span>
            ) : undefined
          }
        />
        <div ref={wrapRef} style={{ width: '100%' }}>
          {item && size && painter && (
            <>
              <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                {phase === 'speaking' && (
                  <span className="row muted small">
                    <Icon name="speaker" size={18} />
                    よく きいてください
                  </span>
                )}
                {phase === 'drawing' && shapeItem && settings.kakitashiGuide && (
                  <span className="chip chip-sample rise" style={{ fontSize: 14 }}>
                    かたちの そとにも かこう
                  </span>
                )}
                {phase === 'drawing' && !shapeItem && (
                  <span className="chip chip-good rise" style={{ fontSize: 14 }}>
                    みどりの まるから はじめます
                  </span>
                )}
                {phase === 'review' && <span className="chip chip-good rise" style={{ fontSize: 15 }}>できました</span>}
              </div>
              {phase === 'review' && result ? (
                <img
                  src={result.png}
                  alt="かいた え"
                  style={{
                    display: 'block',
                    width: Math.round(size.w * (shapeItem ? 0.62 : 1)),
                    height: Math.round(size.h * (shapeItem ? 0.62 : 1)),
                    margin: '0 auto',
                    borderRadius: 18,
                    border: '2px solid var(--line)',
                    background: '#fff'
                  }}
                />
              ) : (
                <DrawCanvas
                  key={idx}
                  width={size.w}
                  height={size.h}
                  paint={painter}
                  enabled={phase === 'drawing'}
                  resetKey={resetKey}
                  strokesRef={strokesRef}
                  onFirstStroke={() => {
                    if (firstAt.current === null) {
                      firstAt.current = performance.now();
                      setFirstMs(firstAt.current - t0.current);
                    }
                  }}
                  onStrokesChange={setNStrokes}
                />
              )}
            </>
          )}
        </div>

        {phase === 'drawing' && (
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => setResetKey((k) => k + 1)} disabled={nStrokes === 0}>
              <Icon name="refresh" size={18} />
              さいしょから
            </button>
            <button className="btn btn-primary btn-big" style={{ flex: 1 }} onClick={() => finish(false)}>
              <Icon name="check" size={24} />
              できた
            </button>
          </div>
        )}
        {phase === 'saving' && timeUpNow && (
          <div className="stage" style={{ flex: 'none', padding: '14px 0' }}>
            <span className="stage-text" style={{ fontSize: 20 }}>おしまいです</span>
          </div>
        )}
        {phase === 'review' && result && (
          <div className="stack rise" style={{ marginTop: 12, gap: 10 }}>
            {shapeItem ? (
              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  こんな えも かけるよ（あかい せんが はじめの かたち）
                </div>
                <ShapeExamples shape={shapeItem.shape} />
              </div>
            ) : (
              <div className="card" style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900 }}>
                よく みて ゆっくり なぞれましたか
              </div>
            )}
            <button className="btn btn-primary btn-big btn-block" onClick={next}>
              {items && idx + 1 >= items.length ? 'おわり' : 'つぎへ'}
              <Icon name="right" size={22} />
            </button>
          </div>
        )}
      </div>

      <ParentPanel
        right={
          phase === 'drawing' ? (
            <button className="btn btn-parent btn-sm" onClick={() => finish(false)}>
              おわりにする
            </button>
          ) : undefined
        }
      >
        {item && (
          <div className="panel-box stack" style={{ gap: 4 }}>
            {shapeItem ? (
              <>
                <PanelLine label="かたち">{shapeItem.name}</PanelLine>
                <PanelLine label="作例">{shapeItem.examples.join('・')}</PanelLine>
                <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowExamples(true)}>
                  見本の絵を見る
                </button>
              </>
            ) : (
              item.kind === 'trace' && <PanelLine label="なぞり">{TRACE_NAMES[item.trace]}</PanelLine>
            )}
            {phase !== 'review' && (
              <PanelLine label="じかん">
                {elapsed.toFixed(0)}秒{limit > 0 ? ` ／ 制限 ${limit}秒` : '（制限なし）'}・描き始め {firstMs !== null ? secLabel(firstMs) : '—'}・線 {nStrokes}本
              </PanelLine>
            )}
            {phase === 'review' && result && (
              <PanelLine label="けっか">
                {result.seconds}秒・描き始め {secLabel(result.attempt.latencyMs)}・線 {result.strokes}本{result.timeUp ? '・時間切れ' : ''}
                {result.eval ? `・${traceSummary(result.eval)}` : ''}
              </PanelLine>
            )}
          </div>
        )}
        {phase === 'drawing' && shapeItem && isParent && (
          <div className="between">
            <span className="small">ガイド「かたちの そとにも かこう」</span>
            <Switch on={settings.kakitashiGuide} label="ガイドを表示" onChange={(v) => update({ kakitashiGuide: v })} />
          </div>
        )}
        {phase === 'review' && result && (
          <>
            <AttemptJudge
              attempt={result.attempt}
              session={session}
              only={['correct', 'wrong']}
              labels={{ correct: 'よくできた', wrong: 'もうすこし' }}
            />
            {result.drawingId && (
              <div className="between">
                <span className="small">◎ 本番で使う（ネタ帳）</span>
                <Switch on={starred} label="本番で使う" onChange={toggleStar} />
              </div>
            )}
          </>
        )}
      </ParentPanel>
      {shapeItem && (
        <Modal open={showExamples} onClose={() => setShowExamples(false)} title={`${shapeItem.name}の見本`}>
          <p className="small muted" style={{ marginTop: 0 }}>
            赤い線が紙にかいてある形、黒い線がかきたした所です（ノートの作例より）。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {SHAPE_EXAMPLES[shapeItem.shape].map((ex) => (
              <ExampleCard key={ex.id} ex={ex} size={140} />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
