import { useEffect, useMemo, useState } from 'react';
import { db, nowIso, uid, useLive } from '../core/db';
import { funLabel } from '../core/dates';
import type { MySet, MySetItem, WaitingLog } from '../core/types';
import { MODULES, typesOfModule } from '../modules/registry';
import { TAIKI_STEPS } from '../modules/taiki';
import { isInPrint } from '../modules/scope';
import { startPlan } from '../player/plan';
import type { ModuleDef } from '../player/types';
import { BackButton, Header, Modal, Seg, useToast } from '../ui/components';
import { Icon } from '../ui/icons';
import { useMode } from '../ui/mode';
import { navigate, useRoute } from '../ui/router';
import { nextTaikiMinutes } from './Home';

// セット設定：モジュールを選んで、出題数・制限時間・問題の種類を決める。マイセットに保存できる。

interface Entry {
  on: boolean;
  count: number;
  timeLimitSec?: number;
  types: string[];
}

const TAP_MODULES = new Set(['zukei', 'ohanashi', 'kotoba']);

function unitLabel(m: ModuleDef, n: number) {
  return m.unit === 'ふん' ? funLabel(n) : `${n}${m.unit}`;
}

export function SetSetup() {
  const route = useRoute();
  const { isParent } = useMode();
  const [toast, showToast] = useToast();
  const setId = route.query.get('set') || '';
  const qModules = (route.query.get('m') || '').split(',').filter(Boolean);
  const qTypes = (route.query.get('types') || '').split(',').filter(Boolean);
  const waits = useLive(() => db.waitingLogs.toArray(), [], [] as WaitingLog[]);
  const taikiSuggest = nextTaikiMinutes(waits);
  const [entries, setEntries] = useState<Record<string, Entry> | null>(null);
  const [mySet, setMySet] = useState<MySet | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const init: Record<string, Entry> = {};
      for (const m of MODULES) init[m.id] = { on: false, count: m.defaultCount, types: [] };
      if (setId) {
        const s = await db.mySets.get(setId);
        if (s) {
          setMySet(s);
          setName(s.name);
          for (const it of s.items) {
            if (init[it.moduleId]) init[it.moduleId] = { on: true, count: it.count, timeLimitSec: it.timeLimitSec, types: it.types ?? [] };
          }
        }
      } else {
        for (const id of qModules) {
          if (!init[id]) continue;
          const own = typesOfModule(id).map((t) => t.id);
          init[id] = { ...init[id], on: true, types: qTypes.filter((t) => own.includes(t)) };
        }
      }
      setEntries(init);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const items: MySetItem[] = useMemo(() => {
    if (!entries) return [];
    return MODULES.filter((m) => entries[m.id]?.on).map((m) => {
      const e = entries[m.id];
      const it: MySetItem = { moduleId: m.id, count: e.count };
      if (e.timeLimitSec) it.timeLimitSec = e.timeLimitSec;
      if (e.types.length) it.types = e.types;
      return it;
    });
  }, [entries]);

  if (!entries) return <div className="screen" />;

  const minutes = Math.round(items.reduce((a, it) => a + it.count * (MODULES.find((m) => m.id === it.moduleId)?.minutesPer ?? 1), 0));
  const patch = (id: string, p: Partial<Entry>) => setEntries((e) => (e ? { ...e, [id]: { ...e[id], ...p } } : e));

  const saveSet = async () => {
    const nm = name.trim() || 'マイセット';
    if (mySet) {
      await db.mySets.put({ ...mySet, name: nm, items });
      showToast('マイセットを上書きしました');
    } else {
      const s: MySet = { id: uid(), name: nm, items, createdAt: nowIso() };
      await db.mySets.add(s);
      setMySet(s);
      showToast('マイセットに保存しました');
    }
    setSaveOpen(false);
  };

  return (
    <div className="screen" style={{ paddingBottom: 150 }}>
      <Header left={<BackButton to="/" label="ホーム" />} />
      <div className="pad">
        <h1 className="h1">{mySet ? `「${mySet.name}」` : 'えらんで れんしゅう'}</h1>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          やりたい ものを えらんでください（うえから じゅんばんに やります）
        </p>
      </div>
      <div className="stack pad" style={{ marginTop: 12 }}>
        {MODULES.map((m) => {
          const e = entries[m.id];
          const types = typesOfModule(m.id);
          return (
            <div key={m.id} className="card" style={{ padding: 0, borderColor: e.on ? m.color.icon : undefined, borderWidth: e.on ? 2 : 1 }}>
              <button
                onClick={() => patch(m.id, { on: !e.on, count: m.id === 'taiki' && !e.on && !mySet ? taikiSuggest : e.count })}
                aria-pressed={e.on}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'none', border: 0, textAlign: 'left' }}
              >
                <span className="tile-icon" style={{ background: m.color.bg, color: m.color.icon }}>
                  <Icon name={m.icon} size={24} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, color: m.color.ink }}>{m.name}</div>
                  <div className="tiny muted">{isParent ? m.label : m.sub}</div>
                </span>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: `2px solid ${e.on ? m.color.icon : 'var(--line2)'}`,
                    background: e.on ? m.color.icon : '#fff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {e.on && <Icon name="check" size={20} />}
                </span>
              </button>
              {e.on && (
                <div className="stack" style={{ padding: '0 12px 12px', gap: 8 }}>
                  {m.id === 'taiki' ? (
                    <div className="stack" style={{ gap: 4 }}>
                      <Seg options={TAIKI_STEPS.map((n) => ({ v: n, label: funLabel(n) }))} value={e.count} onChange={(v) => patch(m.id, { count: v })} label="じかん" />
                      <span className="tiny muted">おすすめ：{funLabel(taikiSuggest)}（まえに せいこうした じかんの つぎ）</span>
                    </div>
                  ) : (
                    <div className="between">
                      <span className="small muted">かず</span>
                      <div className="row">
                        <button className="btn btn-ghost btn-sm" aria-label="へらす" disabled={e.count <= m.minCount} onClick={() => patch(m.id, { count: Math.max(m.minCount, e.count - m.step) })}>
                          <Icon name="minus" size={18} />
                        </button>
                        <b style={{ minWidth: 64, textAlign: 'center', fontSize: 18 }}>{unitLabel(m, e.count)}</b>
                        <button className="btn btn-ghost btn-sm" aria-label="ふやす" disabled={e.count >= m.maxCount} onClick={() => patch(m.id, { count: Math.min(m.maxCount, e.count + m.step) })}>
                          <Icon name="plus" size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                  {isParent && TAP_MODULES.has(m.id) && (
                    <div className="between">
                      <span className="small muted">制限時間</span>
                      <Seg
                        options={[
                          { v: 0, label: '設定' },
                          { v: 10, label: '10秒' },
                          { v: 15, label: '15秒' },
                          { v: 30, label: '30秒' }
                        ]}
                        value={e.timeLimitSec ?? 0}
                        onChange={(v) => patch(m.id, { timeLimitSec: v || undefined })}
                        label="制限時間"
                      />
                    </div>
                  )}
                  {isParent && types.length > 1 && (
                    <div className="stack" style={{ gap: 6 }}>
                      <span className="small muted">問題の種類（えらばないと ぜんぶ）</span>
                      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        {types.map((t) => {
                          const on = e.types.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              className={`chip ${on ? 'chip-parent' : ''}`}
                              style={{ border: on ? '1px solid var(--parent)' : '1px solid var(--line)', whiteSpace: 'normal', textAlign: 'left' }}
                              aria-pressed={on}
                              onClick={() => patch(m.id, { types: on ? e.types.filter((x) => x !== t.id) : [...e.types, t.id] })}
                            >
                              {t.name}
                              {isInPrint(t) ? '' : '（プリント外）'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 0,
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderTop: '1px solid var(--line)',
          padding: '10px 16px calc(12px + env(safe-area-inset-bottom))',
          zIndex: 10
        }}
      >
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="small muted">{items.length ? `${items.length}こ・やく ${Math.max(1, minutes)}ぷん` : 'まだ えらんでいません'}</span>
          {isParent && items.length > 0 && (
            <div className="row">
              {mySet && (
                <button className="btn btn-ghost btn-sm" onClick={() => setDelOpen(true)}>
                  削除
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSaveOpen(true)}>
                {mySet ? 'マイセットを上書き' : 'マイセットに保存'}
              </button>
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-big btn-block" disabled={!items.length} onClick={() => startPlan({ items, mySetId: mySet?.id, label: mySet?.name })}>
          はじめる
        </button>
      </div>

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="マイセットの名前">
        <div className="stack">
          <input className="input" value={name} placeholder="例：朝10分セット" onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-parent btn-block" onClick={saveSet}>
            保存する
          </button>
        </div>
      </Modal>
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="マイセットを削除しますか">
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>「{mySet?.name}」を削除します。練習の記録は消えません。</p>
          <button
            className="btn btn-danger btn-block"
            onClick={async () => {
              if (mySet) await db.mySets.delete(mySet.id);
              navigate('/', { replace: true });
            }}
          >
            削除する
          </button>
        </div>
      </Modal>
      {toast}
    </div>
  );
}
