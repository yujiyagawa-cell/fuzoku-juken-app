import { useMemo, useState } from 'react';
import { db, useLive } from '../../core/db';
import type { Drawing } from '../../core/types';
import { Modal, Seg } from '../../ui/components';
import { Icon, ShapeGlyph } from '../../ui/icons';
import { navigate } from '../../ui/router';
import { ShapeExamples } from '../../modules/kakitashi/examples';
import type { ShapeId } from '../../modules/kakitashi/shapes';
import { Empty, fmtMDHM, ParentScreen, SectionTitle } from './parentParts';

// ネタ帳：絵の書き足しで描いた絵を形ごとに一覧。◎＝本番で使う絵。

const SHAPES: { id: string; name: string; examples: string }[] = [
  { id: 'rect', name: '長方形', examples: '電車（真ん中の車両）、旗（日の丸）、マスク' },
  { id: 'triangle', name: '三角', examples: 'トイレマーク、シーソー（支点）、いえの屋根、イカの頭' },
  { id: 'halfUp', name: '半円（弧が上）', examples: 'カメの甲羅、帽子' },
  { id: 'halfDown', name: '半円（弧が下）', examples: '笑った口、風車の羽、トンボの羽' },
  { id: 'square', name: '正方形', examples: 'サイコロ、いえの壁、おにぎりの海苔' },
  { id: 'diamond', name: 'ひし形', examples: '鳥のくちばし' },
  { id: 'circle', name: '円', examples: '顔、太陽、ボール' }
];

function StarButton({ d }: { d: Drawing }) {
  return (
    <button
      aria-pressed={d.starred}
      aria-label={d.starred ? '本番で使う（◎）をはずす' : '本番で使う（◎）にする'}
      onClick={(e) => {
        e.stopPropagation();
        db.drawings.update(d.id, { starred: !d.starred });
      }}
      style={{
        minWidth: 44,
        minHeight: 32,
        borderRadius: 10,
        border: `2px solid ${d.starred ? 'var(--accent)' : 'var(--line2)'}`,
        background: d.starred ? 'var(--accent)' : '#fff',
        color: d.starred ? '#fff' : 'var(--muted)',
        fontWeight: 900,
        fontSize: 14
      }}
    >
      ◎
    </button>
  );
}

/** 絵を大きく見る。readOnly（子どもモード）では、◎と削除を出さない */
export function Viewer({ d, onClose, readOnly = false }: { d: Drawing; onClose: () => void; readOnly?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const shape = SHAPES.find((s) => s.id === d.shape);
  if (readOnly) {
    return (
      <Modal open onClose={onClose} title="かいた え">
        <div className="stack" style={{ gap: 10 }}>
          <img src={d.pngDataUrl} alt="かいた え" style={{ width: '100%', borderRadius: 16, border: '1px solid var(--line)', background: '#fff' }} />
          <button className="btn btn-primary btn-block" onClick={onClose}>
            とじる
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title={`${shape?.name ?? d.shape}の絵`}>
      <div className="stack" style={{ gap: 10 }}>
        <img src={d.pngDataUrl} alt={`${shape?.name ?? d.shape}を使った絵`} style={{ width: '100%', borderRadius: 16, border: '1px solid var(--line)', background: '#fff' }} />
        <div className="between">
          <span className="tiny muted">
            {fmtMDHM(d.createdAt)}
            {d.seconds !== undefined ? `・${Math.round(d.seconds)}秒` : ''}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <span className="small">{d.starred ? '本番で使う' : ''}</span>
            <StarButton d={d} />
          </div>
        </div>
        {shape && <div className="small muted">作例：{shape.examples}</div>}
        {confirm ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="small" style={{ color: 'var(--bad)' }}>
              この絵を削除します。元に戻せません。
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={async () => {
                  await db.drawings.delete(d.id);
                  onClose();
                }}
              >
                削除する
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(false)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(true)}>
              <Icon name="trash" size={16} />
              削除
            </button>
            <button className="btn btn-parent" style={{ flex: 1 }} onClick={onClose}>
              閉じる
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function NetachoScreen() {
  const drawings = useLive(() => db.drawings.orderBy('createdAt').reverse().toArray(), [], [] as Drawing[]);
  const [onlyStar, setOnlyStar] = useState<'all' | 'star'>('all');
  const [open, setOpen] = useState<Drawing | null>(null);
  const [showEx, setShowEx] = useState(true);

  const groups = useMemo(() => {
    const list = onlyStar === 'star' ? drawings.filter((d) => d.starred) : drawings;
    const known = new Set(SHAPES.map((s) => s.id));
    const out = SHAPES.map((s) => ({ ...s, items: list.filter((d) => d.shape === s.id) }));
    const other = list.filter((d) => !known.has(d.shape));
    if (other.length) out.push({ id: 'other', name: 'その他', examples: '', items: other });
    return out;
  }, [drawings, onlyStar]);

  const starCount = drawings.filter((d) => d.starred).length;

  return (
    <ParentScreen title="ネタ帳" sub="絵の書き足しで描いた絵です。本番で使いたい絵に ◎ をつけておくと、当日の前に見返せます。">
      <div className="pad" style={{ marginTop: 12 }}>
        <div className="between">
          <Seg
            options={[
              { v: 'all' as const, label: `すべて（${drawings.length}）` },
              { v: 'star' as const, label: `◎だけ（${starCount}）` }
            ]}
            value={onlyStar}
            onChange={setOnlyStar}
            label="しぼりこみ"
          />
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/setup?m=kakitashi')}>
            描く
          </button>
        </div>
      </div>

      <section aria-label="見本">
        <SectionTitle
          right={
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEx((v) => !v)}>
              {showEx ? 'たたむ' : 'ひらく'}
            </button>
          }
        >
          見本の絵（ノートの作例）
        </SectionTitle>
        {showEx && (
          <div className="stack pad" style={{ gap: 12 }}>
            <div className="tiny muted">赤い線が紙にかいてある形、黒い線がかきたした所。子どもと一緒に見て、自分の「ネタ」を決めておきます。</div>
            {SHAPES.map((s) => (
              <div key={s.id}>
                <div className="row small" style={{ gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#d0453a', display: 'inline-flex' }}>
                    <ShapeGlyph shape={s.id} size={18} />
                  </span>
                  {s.name}
                </div>
                <ShapeExamples shape={s.id as ShapeId} size={84} />
              </div>
            ))}
          </div>
        )}
      </section>

      {drawings.length === 0 && (
        <div style={{ marginTop: 14 }}>
          <Empty>まだ絵がありません。「おえかき」で描くとここに入ります。</Empty>
        </div>
      )}

      {drawings.length > 0 &&
        groups.map((g) => (
          <section key={g.id} aria-label={g.name}>
            <SectionTitle right={<span className="tiny muted">{g.items.length}枚</span>}>
              <span className="row" style={{ gap: 8 }}>
                {g.id !== 'other' && (
                  <span style={{ color: '#d0453a', display: 'inline-flex' }}>
                    <ShapeGlyph shape={g.id} size={22} />
                  </span>
                )}
                {g.name}
              </span>
            </SectionTitle>
            {g.examples && (
              <div className="tiny muted" style={{ margin: '-4px 16px 8px', lineHeight: 1.6 }}>
                作例：{g.examples}
              </div>
            )}
            {g.items.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, margin: '0 16px' }}>
                {g.items.map((d) => (
                  <div key={d.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpen(d)}
                      aria-label={`${g.name}の絵（${fmtMDHM(d.createdAt)}）を大きく見る`}
                      style={{ width: '100%', padding: 0, border: `2px solid ${d.starred ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 14, background: '#fff', overflow: 'hidden', display: 'block' }}
                    >
                      <img src={d.pngDataUrl} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', display: 'block' }} />
                    </button>
                    {d.starred && (
                      <span
                        aria-hidden="true"
                        style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 900, padding: '1px 6px' }}
                      >
                        ◎
                      </span>
                    )}
                    <div className="tiny muted" style={{ textAlign: 'center', marginTop: 2 }}>
                      {fmtMDHM(d.createdAt).split(' ')[0]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tiny muted" style={{ margin: '0 16px' }}>
                {onlyStar === 'star' ? '◎の絵はありません' : 'まだありません'}
              </div>
            )}
          </section>
        ))}
      {open && <Viewer d={drawings.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </ParentScreen>
  );
}
