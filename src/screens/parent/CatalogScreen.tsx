import { useEffect, useMemo, useState } from 'react';
import { db, nowIso, uid, useLive } from '../../core/db';
import { GENRES } from '../../core/genres';
import type { GenreId, Idea, Review, ReviewMark } from '../../core/types';
import { QUESTION_TYPES } from '../../modules/registry';
import type { QuestionType } from '../../player/types';
import { IconBadge } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { navigate } from '../../ui/router';
import { ChipButtons, fmtMD, ParentScreen, SourceChip, Stars } from './parentParts';
import { QuestionPreview } from './QuestionPreview';
import { isInPrint } from '../../modules/scope';

// 問題カタログ：ジャンルごとに全タイプの見本を見て、良い／直す／外す を決める。外すとおまかせ・連続出題で出なくなる。

const MARKS: { v: ReviewMark; label: string; desc: string; color: string; bg: string }[] = [
  { v: 'good', label: '良い', desc: 'このまま出す', color: 'var(--good)', bg: 'var(--good-bg)' },
  { v: 'fix', label: '直す', desc: '見直しが必要', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  { v: 'off', label: '外す', desc: '出題しない', color: 'var(--bad)', bg: 'var(--bad-bg)' }
];

const ANSWER_LABEL: Record<QuestionType['answer'], string> = {
  tap: 'タップで答える',
  voice: '声で答える',
  parent: '保護者が判定',
  draw: '描く'
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const shortGenre = (name: string) => name.split('（')[0];

function ReviewControls({ typeId, review }: { typeId: string; review?: Review }) {
  const [note, setNote] = useState(review?.note ?? '');
  useEffect(() => setNote(review?.note ?? ''), [review?.note]);
  const mark = review?.mark || '';
  const save = (patch: Partial<Review>) =>
    db.reviews.put({ typeId, mark: review?.mark ?? '', note: review?.note ?? '', ...patch, updatedAt: nowIso() });
  return (
    <div className="stack" style={{ gap: 6, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }} role="group" aria-label="評価">
        {MARKS.map((m) => {
          const on = mark === m.v;
          return (
            <button
              key={m.v}
              aria-pressed={on}
              onClick={() => save({ mark: on ? '' : m.v })}
              style={{
                minHeight: 44,
                borderRadius: 12,
                border: `2px solid ${m.color}`,
                background: on ? m.color : '#fff',
                color: on ? '#fff' : m.color,
                fontWeight: 900,
                fontSize: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1.2
              }}
            >
              {on ? `✓ ${m.label}` : m.label}
              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{m.desc}</span>
            </button>
          );
        })}
      </div>
      <input
        className="input"
        value={note}
        placeholder="メモ（直したいところなど）"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if ((review?.note ?? '') !== note) save({ note });
        }}
        aria-label="メモ"
      />
    </div>
  );
}

function TypeCard({ t, review, seed, onReseed }: { t: QuestionType; review?: Review; seed: number; onReseed: () => void }) {
  const m = MARKS.find((x) => x.v === review?.mark);
  return (
    <div className="card" style={{ margin: '0 16px 10px', borderColor: m ? m.color : undefined, borderWidth: m ? 2 : 1 }}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="h2" style={{ fontSize: 15, lineHeight: 1.4 }}>
            {t.name}
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <SourceChip source={t.source} />
            {!isInPrint(t) && (
              <span className="chip" style={{ background: review?.mark === 'good' ? 'var(--good-bg)' : '#f0f3f8', color: review?.mark === 'good' ? 'var(--good)' : 'var(--muted)' }}>
                {review?.mark === 'good' ? 'プリント外・出す' : 'プリント外・ふだんは出さない'}
              </span>
            )}
            <Stars n={t.priority} />
            <span className="tiny muted">
              {ANSWER_LABEL[t.answer]}
              {t.speedTargetSec ? `・目標${t.speedTargetSec}秒` : ''}
            </span>
          </div>
        </div>
        {m && (
          <span className="chip" style={{ background: m.bg, color: m.color, flexShrink: 0 }}>
            {m.label}
          </span>
        )}
      </div>
      <p className="small muted" style={{ lineHeight: 1.6, fontWeight: 500, margin: '8px 0' }}>
        {t.description}
      </p>
      {t.generate ? (
        <div className="stack" style={{ gap: 6 }}>
          <QuestionPreview type={t} seed={seed} />
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onReseed}>
            <Icon name="refresh" size={14} />
            べつの もんだい
          </button>
        </div>
      ) : t.sample ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: 6, background: 'var(--yellow-bg)', color: 'var(--yellow-ink)', borderRadius: 14, padding: '8px 10px' }}>
          <Icon name="speaker" size={16} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{t.sample}</span>
        </div>
      ) : null}
      <ReviewControls typeId={t.id} review={review} />
    </div>
  );
}

export function CatalogScreen() {
  const reviews = useLive(() => db.reviews.toArray(), [], [] as Review[]);
  const ideas = useLive(() => db.ideas.orderBy('createdAt').reverse().toArray(), [], [] as Idea[]);
  const [genre, setGenre] = useState<'all' | GenreId>('all');
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  const [ideaText, setIdeaText] = useState('');
  const [markFilter, setMarkFilter] = useState<'all' | 'none' | ReviewMark>('all');

  const reviewMap = useMemo(() => new Map(reviews.map((r) => [r.typeId, r])), [reviews]);
  const genresWithTypes = GENRES.filter((g) => QUESTION_TYPES.some((t) => t.genre === g.id));
  const reviewed = QUESTION_TYPES.filter((t) => reviewMap.get(t.id)?.mark);
  const countOf = (v: ReviewMark) => QUESTION_TYPES.filter((t) => reviewMap.get(t.id)?.mark === v).length;

  const matchMark = (t: QuestionType) => {
    const mk = reviewMap.get(t.id)?.mark || '';
    if (markFilter === 'all') return true;
    if (markFilter === 'none') return !mk;
    return mk === markFilter;
  };

  const addIdea = async () => {
    const text = ideaText.trim();
    if (!text) return;
    await db.ideas.add({ id: uid(), text, createdAt: nowIso() });
    setIdeaText('');
  };

  return (
    <ParentScreen title="問題カタログ" sub="ジャンルごとに、出る問題の見本を見て評価します。「外す」にした問題は、おまかせ・連続出題で出なくなります。">
      <div className="card" style={{ margin: '12px 16px 0' }}>
        <div className="between">
          <b>
            {genresWithTypes.length}ジャンル・{QUESTION_TYPES.length}種類
          </b>
          <span className="small">
            評価ずみ {reviewed.length} ／ {QUESTION_TYPES.length}
          </span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {MARKS.map((m) => (
            <span key={m.v} className="chip" style={{ background: m.bg, color: m.color }}>
              {m.label} {countOf(m.v)}
              <span style={{ fontWeight: 700 }}>　{m.desc}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="pad stack" style={{ marginTop: 12, gap: 8 }}>
        <ChipButtons
          label="ジャンル"
          value={genre}
          onChange={setGenre}
          options={[{ v: 'all' as const, label: 'すべて' }, ...genresWithTypes.map((g) => ({ v: g.id, label: shortGenre(g.name) }))]}
        />
        <ChipButtons
          label="評価"
          value={markFilter}
          onChange={setMarkFilter}
          options={[
            { v: 'all' as const, label: '評価：すべて' },
            { v: 'none' as const, label: 'まだ' },
            { v: 'good' as const, label: '良い' },
            { v: 'fix' as const, label: '直す' },
            { v: 'off' as const, label: '外す' }
          ]}
        />
      </div>

      {genresWithTypes
        .filter((g) => genre === 'all' || g.id === genre)
        .map((g) => {
          const types = QUESTION_TYPES.filter((t) => t.genre === g.id && matchMark(t));
          if (!types.length) return null;
          return (
            <section key={g.id} aria-label={g.name}>
              <div className="row" style={{ margin: '18px 16px 8px', gap: 8 }}>
                <IconBadge name={g.icon} bg={g.bg} color={g.icon_color} size={32} />
                <h2 className="h2" style={{ flex: 1 }}>
                  {g.name}
                </h2>
                <span className="tiny muted">{types.length}種類</span>
              </div>
              {types.map((t) => (
                <TypeCard
                  key={t.id}
                  t={t}
                  review={reviewMap.get(t.id)}
                  seed={seeds[t.id] ?? hashSeed(t.id)}
                  onReseed={() => setSeeds((s) => ({ ...s, [t.id]: Math.floor(Math.random() * 2 ** 31) }))}
                />
              ))}
            </section>
          );
        })}

      <div className="row" style={{ margin: '20px 16px 8px', gap: 8 }}>
        <Icon name="notebook" size={20} style={{ color: 'var(--parent)' }} />
        <h2 className="h2">追加したい問題のメモ</h2>
      </div>
      <div className="card" style={{ margin: '0 16px' }}>
        <textarea
          className="input"
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value)}
          placeholder="例：時計の読み方、左右の区別、重さくらべ（3つ）"
          rows={3}
          style={{ width: '100%', height: 'auto', padding: 10, resize: 'vertical' }}
          aria-label="追加したい問題のメモ"
        />
        <div className="between" style={{ marginTop: 8 }}>
          <span className="tiny muted">データの書き出し（JSON）にも入ります</span>
          <button className="btn btn-parent btn-sm" onClick={addIdea} disabled={!ideaText.trim()}>
            メモに残す
          </button>
        </div>
        {ideas.length > 0 && (
          <div className="stack" style={{ gap: 4, marginTop: 10 }}>
            {ideas.map((i) => (
              <div key={i.id} className="between" style={{ alignItems: 'flex-start', borderTop: '1px solid #eef1f6', paddingTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0 }}>
                  <span className="tiny muted">{fmtMD(i.createdAt)}　</span>
                  {i.text}
                </span>
                <button className="btn btn-ghost btn-sm" aria-label="メモを削除" onClick={() => db.ideas.delete(i.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pad" style={{ marginTop: 16 }}>
        <button className="btn btn-outline btn-block" onClick={() => navigate('/progress')}>
          <Icon name="level" size={18} />
          進捗（レベル）一覧へ
        </button>
      </div>
    </ParentScreen>
  );
}
