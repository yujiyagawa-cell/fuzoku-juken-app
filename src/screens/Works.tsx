import { useMemo, useState } from 'react';
import { dayKey } from '../core/dates';
import { db, useLive } from '../core/db';
import type { Attempt, Drawing } from '../core/types';
import { songById, type Song } from '../modules/uta/songs';
import { secLabel } from '../player/parts';
import { BackButton, Header, ParentStrip, Seg } from '../ui/components';
import { Emoji } from '../ui/emoji';
import { Icon, ShapeGlyph } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate, useRoute } from '../ui/router';
import { Viewer } from './parent/NetachoScreen';

// うたと え：子どもが うたった うたと、かいた え を、日ごとに見かえす（子どももみられる）。
// うたは録音しないので、どの歌か・うたえたか・歌い出しの秒数・聞き取れた ことば（保護者モード）を出す。
// #/works?tab=uta|e&day=YYYY-MM-DD（カレンダーの日から開くと、その日だけ）

const WEEK = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];

function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${m}がつ ${d}にち（${w}）`;
}

function hm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupByDay<T extends { createdAt: string }>(list: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const x of list) {
    const k = dayKey(x.createdAt);
    const arr = map.get(k);
    if (arr) arr.push(x);
    else map.set(k, [x]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

/** うたった うた（自動判定でわかった歌 → カードで選んだ歌） */
function songOf(a: Attempt): Song | undefined {
  const id = (a.meta?.sung as string | undefined) || a.tappedChoice;
  return id ? songById(id) : undefined;
}

function resultOf(a: Attempt): { label: string; className: string } {
  if (a.meta?.status === 'nospeech') return { label: 'こえが きこえなかった', className: '' };
  if (a.finalJudge === 'correct') return { label: '○ うたえた', className: 'chip-good' };
  if (a.finalJudge === 'wrong') return { label: '△ とちゅうで とまった', className: 'chip-warn' };
  return { label: '？', className: '' };
}

function SongRow({ a, isParent }: { a: Attempt; isParent: boolean }) {
  const [open, setOpen] = useState(false);
  const song = songOf(a);
  const r = resultOf(a);
  const singingMs = typeof a.meta?.singingMs === 'number' ? (a.meta.singingMs as number) : undefined;
  const hits = Array.isArray(a.meta?.hits) ? (a.meta!.hits as string[]) : [];
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: '#fff5e6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {song ? <Emoji char={song.icons[0]} size={28} /> : <Icon name="music" size={24} style={{ color: 'var(--muted)' }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{song ? song.title : 'どの うたか わからない'}</div>
          <div className="tiny muted" style={{ fontWeight: 500 }}>{hm(a.createdAt)}</div>
        </div>
        <span className={`chip ${r.className}`} style={{ fontSize: 13, flexShrink: 0 }}>
          {r.label}
        </span>
      </div>
      {isParent && (
        <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7, fontWeight: 500 }}>
          歌い出し {secLabel(a.latencyMs)}
          {singingMs !== undefined ? `・歌った長さ ${Math.round(singingMs / 1000)}秒` : ''}
          {hits.length ? `・聞き取れた歌の ことば：${hits.join('、')}` : ''}
          {a.transcript ? (
            <>
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 28, padding: '0 8px', marginLeft: 6 }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                {open ? 'とじる' : '聞き取った文'}
              </button>
              {open && <div style={{ marginTop: 4, color: 'var(--ink)', wordBreak: 'break-all' }}>「{a.transcript}」</div>}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DrawingGrid({ list, onOpen }: { list: Drawing[]; onOpen: (d: Drawing) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {list.map((d) => (
        <div key={d.id} style={{ position: 'relative' }}>
          <button
            onClick={() => onOpen(d)}
            aria-label={`${hm(d.createdAt)}に かいた え を おおきく みる`}
            style={{ width: '100%', padding: 0, border: `2px solid ${d.starred ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 14, background: '#fff', overflow: 'hidden', display: 'block' }}
          >
            <img src={d.pngDataUrl} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', display: 'block' }} />
          </button>
          <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 4, color: '#d0453a', background: 'rgba(255,255,255,0.9)', borderRadius: 8, display: 'inline-flex', padding: 2 }}>
            <ShapeGlyph shape={d.shape} size={16} />
          </span>
          {d.starred && (
            <span aria-hidden="true" style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 900, padding: '1px 6px' }}>
              ◎
            </span>
          )}
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 2 }}>
            {hm(d.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Works() {
  const route = useRoute();
  const { isParent } = useMode();
  const day = route.query.get('day') || '';
  const [tab, setTab] = useState<'e' | 'uta'>(route.query.get('tab') === 'uta' ? 'uta' : 'e');
  const [open, setOpen] = useState<Drawing | null>(null);

  const drawings = useLive(() => db.drawings.orderBy('createdAt').reverse().toArray(), [], [] as Drawing[]);
  const sings = useLive(
    async () => (await db.attempts.where('moduleId').equals('uta').toArray()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [],
    [] as Attempt[]
  );

  const dList = useMemo(() => (day ? drawings.filter((d) => dayKey(d.createdAt) === day) : drawings), [drawings, day]);
  const sList = useMemo(() => (day ? sings.filter((a) => dayKey(a.createdAt) === day) : sings), [sings, day]);

  // どの うたを なんかい うたったか
  const songCounts = useMemo(() => {
    const m = new Map<string, { song: Song; n: number; ok: number }>();
    for (const a of sList) {
      const s = songOf(a);
      if (!s) continue;
      const c = m.get(s.id) ?? { song: s, n: 0, ok: 0 };
      c.n++;
      if (a.finalJudge === 'correct') c.ok++;
      m.set(s.id, c);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [sList]);

  return (
    <div className="screen" style={{ paddingBottom: 32 }}>
      <Header left={<BackButton to="/" label="ホーム" />} />
      <ParentStrip />
      <div className="pad" style={{ marginTop: 8 }}>
        <h1 className="h1">うたと え</h1>
        <div className="small muted" style={{ marginTop: 4 }}>
          うたった うたと、かいた え が ならびます
        </div>
        {day && (
          <button className="chip" style={{ marginTop: 8, border: '1px solid var(--line)', fontSize: 14 }} onClick={() => navigate(`/works?tab=${tab}`, { replace: true })}>
            {dayLabel(day)} だけ
            <Icon name="x" size={14} />
          </button>
        )}
        <div style={{ marginTop: 10 }}>
          <Seg
            label="えらぶ"
            value={tab}
            onChange={setTab}
            options={[
              { v: 'e', label: `え（${dList.length}）` },
              { v: 'uta', label: `うた（${sList.length}）` }
            ]}
          />
        </div>
      </div>

      {tab === 'e' &&
        (dList.length === 0 ? (
          <p className="small muted pad" style={{ marginTop: 16 }}>
            {day ? 'この ひは え を かいていません' : 'まだ え が ありません。「おえかき」で かくと、ここに ならびます。'}
          </p>
        ) : (
          groupByDay(dList).map(([k, list]) => (
            <section key={k} className="pad" style={{ marginTop: 14 }} aria-label={dayLabel(k)}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                {dayLabel(k)}　<span className="small muted">{list.length}まい</span>
              </div>
              <DrawingGrid list={list} onOpen={setOpen} />
            </section>
          ))
        ))}

      {tab === 'uta' &&
        (sList.length === 0 ? (
          <p className="small muted pad" style={{ marginTop: 16 }}>
            {day ? 'この ひは うたって いません' : 'まだ うた が ありません。「うた」で うたうと、ここに ならびます。'}
          </p>
        ) : (
          <>
            {songCounts.length > 0 && (
              <section className="pad" style={{ marginTop: 14 }} aria-label="うたった かいすう">
                <div style={{ fontWeight: 900, marginBottom: 6 }}>うたった うた</div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {songCounts.map((c) => (
                    <span key={c.song.id} className="chip" style={{ fontSize: 14, border: '1px solid var(--line)', background: '#fff' }}>
                      <Emoji char={c.song.icons[0]} size={18} />
                      {c.song.title} {c.n}かい
                      {isParent && c.ok > 0 ? <span style={{ color: 'var(--good)' }}>（○{c.ok}）</span> : null}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {groupByDay(sList).map(([k, list]) => (
              <section key={k} className="pad stack" style={{ marginTop: 14, gap: 8 }} aria-label={dayLabel(k)}>
                <div style={{ fontWeight: 900 }}>{dayLabel(k)}</div>
                {list.map((a) => (
                  <SongRow key={a.id} a={a} isParent={isParent} />
                ))}
              </section>
            ))}
            {isParent && (
              <p className="tiny muted pad" style={{ marginTop: 12, lineHeight: 1.6 }}>
                うたの声は録音していません。聞き取れた ことばは、音声認識（Google）が文字にしたものです。
              </p>
            )}
          </>
        ))}

      {open && <Viewer d={drawings.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} readOnly={!isParent} />}
    </div>
  );
}
