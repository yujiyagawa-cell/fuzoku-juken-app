import { useEffect, useRef, useState, type ReactNode } from 'react';
import { examDateLabel } from '../../core/dates';
import { db, nowIso, TABLE_NAMES } from '../../core/db';
import { DEFAULT_SETTINGS, useSettings } from '../../core/settings';
import { getVoices, japaneseVoices, speak } from '../../core/speech/tts';
import { resetVoiceFailure, useVoiceState, voiceReasonText } from '../../core/speech/voice';
import type { PropertyKind, Settings } from '../../core/types';
import { Modal, Seg, Switch, useToast } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { navigate } from '../../ui/router';
import { ChipButtons, ParentScreen, SectionTitle } from './parentParts';

// 設定：子どもの情報・試験日・本番再現ルール・読み上げ・ことば・書き足し・音声認識・性質の候補・データ

function Field({ label, hint, children, inline = false }: { label: string; hint?: ReactNode; children: ReactNode; inline?: boolean }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #eef1f6' }}>
      {inline ? (
        <div className="between">
          <span style={{ fontSize: 14, fontWeight: 900 }}>{label}</span>
          {children}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>{label}</div>
          {children}
        </>
      )}
      {hint && (
        <div className="tiny muted" style={{ marginTop: 4, lineHeight: 1.6, fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="card" style={{ margin: '0 16px', padding: '2px 14px' }}>
      {children}
    </div>
  );
}

/** 入力が終わったら保存する（1文字ごとに保存しない） */
function TextField({ value, onCommit, placeholder, label }: { value: string; onCommit: (v: string) => void; placeholder?: string; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="input"
      value={v}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      style={{ width: '100%' }}
    />
  );
}

export function ChildInfoFields({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <>
      <Field label="なまえ（ひらがな）" hint="質疑応答の「おなまえを おしえてください」の自動判定に使います">
        <TextField label="なまえ（ひらがな）" value={s.childName} placeholder="例 やがわ はなこ" onCommit={(v) => update({ childName: v })} />
      </Field>
      <Field label="なまえ（漢字・任意）">
        <TextField label="なまえ（漢字）" value={s.childNameKanji} placeholder="例 山田 花子" onCommit={(v) => update({ childNameKanji: v })} />
      </Field>
      <Field label="年齢">
        <ChipButtons
          label="年齢"
          value={s.age}
          onChange={(v) => update({ age: v })}
          options={[
            { v: 4, label: '4さい' },
            { v: 5, label: '5さい' },
            { v: 6, label: '6さい' },
            { v: 7, label: '7さい' }
          ]}
        />
      </Field>
      <Field label="誕生日">
        <div className="row" style={{ gap: 6 }}>
          <select className="input" aria-label="誕生日の月" value={s.birthday.month} onChange={(e) => update({ birthday: { ...s.birthday, month: Number(e.target.value) } })}>
            <option value={0}>—</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <span className="small">月</span>
          <select className="input" aria-label="誕生日の日" value={s.birthday.day} onChange={(e) => update({ birthday: { ...s.birthday, day: Number(e.target.value) } })}>
            <option value={0}>—</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <span className="small">日</span>
        </div>
      </Field>
      <Field label="通っているところ">
        <Seg
          label="通っているところ"
          value={s.nurseryType}
          onChange={(v) => update({ nurseryType: v })}
          options={[
            { v: 'hoikuen' as const, label: '保育園' },
            { v: 'youchien' as const, label: '幼稚園' }
          ]}
        />
      </Field>
      <Field label="利き手">
        <Seg
          label="利き手"
          value={s.handedness}
          onChange={(v) => update({ handedness: v })}
          options={[
            { v: 'right' as const, label: '右きき' },
            { v: 'left' as const, label: '左きき' },
            { v: '' as const, label: '未設定' }
          ]}
        />
      </Field>
    </>
  );
}

const PROPERTY_LABELS: { k: PropertyKind; label: string }[] = [
  { k: 'togetoge', label: 'とげとげ' },
  { k: 'pikapika', label: 'ぴかぴか' },
  { k: 'fuwafuwa', label: 'ふわふわ' }
];

function PropertyEditor({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  const [drafts, setDrafts] = useState<Record<PropertyKind, string>>({ togetoge: '', pikapika: '', fuwafuwa: '' });
  const set = (k: PropertyKind, list: string[]) => update({ propertyAnswers: { ...s.propertyAnswers, [k]: list } });
  return (
    <>
      {PROPERTY_LABELS.map(({ k, label }) => {
        const list = s.propertyAnswers[k] ?? [];
        const add = () => {
          const v = drafts[k].trim();
          if (!v || list.includes(v)) return;
          set(k, [...list, v]);
          setDrafts({ ...drafts, [k]: '' });
        };
        return (
          <Field key={k} label={`${label}したもの`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {list.map((w) => (
                <span key={w} className="chip" style={{ paddingRight: 4 }}>
                  {w}
                  <button
                    aria-label={`${w}を消す`}
                    onClick={() => set(k, list.filter((x) => x !== w))}
                    style={{ border: 0, background: 'transparent', color: 'var(--muted)', padding: '0 4px', minHeight: 24, fontWeight: 900 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={drafts[k]}
                aria-label={`${label}の候補を追加`}
                placeholder="ひらがな・カタカナで"
                onChange={(e) => setDrafts({ ...drafts, [k]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <button className="btn btn-outline btn-sm" onClick={add} disabled={!drafts[k].trim()}>
                追加
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => set(k, DEFAULT_SETTINGS.propertyAnswers[k])}>
                最初に戻す
              </button>
            </div>
          </Field>
        );
      })}
    </>
  );
}

interface Backup {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function exportAll(): Promise<number> {
  const tables: Record<string, unknown[]> = {};
  let n = 0;
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray();
    n += tables[name].length;
  }
  const data: Backup = { app: 'fuzoku-juken', version: 1, exportedAt: nowIso(), tables };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuzoku-juken-backup-${ymd()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return n;
}

function parseBackup(text: string): Backup | null {
  try {
    const o = JSON.parse(text);
    if (!o || o.app !== 'fuzoku-juken' || typeof o.tables !== 'object' || !o.tables) return null;
    return o as Backup;
  } catch {
    return null;
  }
}

async function importAll(b: Backup) {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const rows = b.tables[name];
      if (!Array.isArray(rows)) continue;
      await db.table(name).clear();
      if (rows.length) await db.table(name).bulkPut(rows);
    }
  });
}

async function deleteAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

export function SettingsScreen() {
  const { settings: s, update } = useSettings();
  const voice = useVoiceState();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [toast, showToast] = useToast();
  const [pending, setPending] = useState<Backup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getVoices().then((v) => setVoices(japaneseVoices(v)));
  }, []);

  const exam = examDateLabel(s.examDate);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const b = parseBackup(await f.text());
    if (!b) {
      showToast('このアプリの書き出しファイルではありません');
      return;
    }
    setPending(b);
  };

  return (
    <ParentScreen title="設定">
      <SectionTitle>こどもの情報</SectionTitle>
      <Group>
        <ChildInfoFields s={s} update={update} />
      </Group>

      <SectionTitle>試験日</SectionTitle>
      <Group>
        <Field label="試験の日" hint={exam.kanji}>
          <input
            className="input"
            type="date"
            value={s.examDate}
            aria-label="試験の日"
            onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && update({ examDate: e.target.value })}
          />
        </Field>
      </Group>

      <SectionTitle>本番再現ルール</SectionTitle>
      <Group>
        <Field label="問題の読み上げ回数" hint="本番は1回だけ。聞き返しはできません">
          <Seg
            label="読み上げ回数"
            value={s.readTimes}
            onChange={(v) => update({ readTimes: v })}
            options={[
              { v: 1 as const, label: '1回（本番どおり）' },
              { v: 2 as const, label: '2回（練習用）' }
            ]}
          />
        </Field>
        <Field label="タップで答える問題の制限時間" hint="本番は即答が必要なので10秒。時間がきたら「大丈夫です」と言って次へ進みます">
          <ChipButtons
            label="タップの制限時間"
            value={s.tapTimeLimitSec}
            onChange={(v) => update({ tapTimeLimitSec: v })}
            options={[10, 15, 20, 30, 45].map((v) => ({ v, label: `${v}秒` }))}
          />
        </Field>
        <Field label="声で答えるときの待ち時間" hint="黙ったままこの秒数がたつと「？（こたえられず）」で次へ">
          <ChipButtons
            label="無音タイムアウト"
            value={s.silenceTimeoutSec}
            onChange={(v) => update({ silenceTimeoutSec: v })}
            options={[5, 8, 10, 15].map((v) => ({ v, label: `${v}秒` }))}
          />
        </Field>
        <Field label="正誤をその場で見せる" hint="オフ（本番どおり）：セットの最後にまとめて見せます" inline>
          <Switch label="正誤をその場で見せる" on={s.showResultImmediately} onChange={(v) => update({ showResultImmediately: v })} />
        </Field>
        <Field label="声で答えたあと次へ進むまで">
          <ChipButtons
            label="自動で次へ"
            value={s.autoNextSec}
            onChange={(v) => update({ autoNextSec: v })}
            options={[
              { v: 0, label: 'ボタンで進む' },
              { v: 1, label: '1秒' },
              { v: 2, label: '2秒' },
              { v: 3, label: '3秒' }
            ]}
          />
        </Field>
      </Group>

      <SectionTitle>読み上げ</SectionTitle>
      <Group>
        <Field label="速さ">
          <ChipButtons
            label="読み上げの速さ"
            value={s.ttsRate}
            onChange={(v) => update({ ttsRate: v })}
            options={[0.8, 0.9, 1, 1.1, 1.2].map((v) => ({ v, label: v === 1 ? 'ふつう' : `${v}倍` }))}
          />
        </Field>
        <Field label="声" hint={voices.length ? undefined : '日本語の声が見つかりません（端末の設定で日本語の音声データを入れてください）'}>
          <div className="row" style={{ gap: 6 }}>
            <select className="input" style={{ flex: 1 }} value={s.voiceURI} aria-label="声" onChange={(e) => update({ voiceURI: e.target.value })}>
              <option value="">自動（Google の日本語を優先）</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm" onClick={() => speak('この かたちを つかって、じゆうに えを かいてください。', { times: 1 })}>
              <Icon name="speaker" size={16} />
              試す
            </button>
          </div>
        </Field>
      </Group>

      <SectionTitle>ことば（2・3文字）</SectionTitle>
      <Group>
        <Field label="小さい「ゃゅょ」" hint="まとめる：きゅうり＝3文字（初期値）">
          <Seg
            label="拗音の数え方"
            value={s.moraRules.youon}
            onChange={(v) => update({ moraRules: { ...s.moraRules, youon: v } })}
            options={[
              { v: 'merge' as const, label: '前の字とまとめて1文字' },
              { v: 'separate' as const, label: '別に数える' }
            ]}
          />
        </Field>
        <Field label="小さい「っ」" hint="数える：らっぱ＝3文字（初期値）">
          <Seg
            label="促音の数え方"
            value={s.moraRules.sokuon}
            onChange={(v) => update({ moraRules: { ...s.moraRules, sokuon: v } })}
            options={[
              { v: 'count' as const, label: '数える' },
              { v: 'skip' as const, label: '数えない' }
            ]}
          />
        </Field>
        <Field label="のばす音「ー」" hint="数える：ボール＝3文字（初期値）">
          <Seg
            label="長音の数え方"
            value={s.moraRules.chouon}
            onChange={(v) => update({ moraRules: { ...s.moraRules, chouon: v } })}
            options={[
              { v: 'count' as const, label: '数える' },
              { v: 'skip' as const, label: '数えない' }
            ]}
          />
        </Field>
        <Field label="濁音で始まる答えも○にする" hint="オフ：「か」の問題に「がっこう」は×" inline>
          <Switch label="濁音で始まる答えも○" on={s.allowDakuonVariant} onChange={(v) => update({ allowDakuonVariant: v })} />
        </Field>
        <Field label="濁音・半濁音の問題も出す" hint="「が」「ぱ」などで始まる問題" inline>
          <Switch label="濁音・半濁音の問題も出す" on={s.includeDakuon} onChange={(v) => update({ includeDakuon: v })} />
        </Field>
        <Field label="3文字の問題の割合">
          <ChipButtons
            label="3文字の割合"
            value={s.kotobaRatio3}
            onChange={(v) => update({ kotobaRatio3: v })}
            options={[0, 0.3, 0.5, 0.7, 1].map((v) => ({ v, label: `${Math.round(v * 100)}%` }))}
          />
        </Field>
        <Field label="質疑応答にも混ぜる" hint="本番では質疑応答の中で聞かれました" inline>
          <Switch label="質疑応答にも混ぜる" on={s.mixKotobaInShitsugi} onChange={(v) => update({ mixKotobaInShitsugi: v })} />
        </Field>
      </Group>

      <SectionTitle>絵の書き足し</SectionTitle>
      <Group>
        <Field label="制限時間" hint="昨年の本番は制限時間なし">
          <ChipButtons
            label="書き足しの制限時間"
            value={s.kakitashiTimeLimitSec}
            onChange={(v) => update({ kakitashiTimeLimitSec: v })}
            options={[
              { v: 0, label: 'なし' },
              { v: 60, label: '1分' },
              { v: 120, label: '2分' },
              { v: 180, label: '3分' }
            ]}
          />
        </Field>
        <Field label="「かたちの そとにも かこう」を出す" inline>
          <Switch label="ガイドを出す" on={s.kakitashiGuide} onChange={(v) => update({ kakitashiGuide: v })} />
        </Field>
      </Group>

      <SectionTitle>音声認識</SectionTitle>
      <Group>
        <Field label="声で答える問題に音声認識を使う" hint="オフにすると、保護者が○×で判定します" inline>
          <Switch label="音声認識を使う" on={s.voiceEnabled} onChange={(v) => update({ voiceEnabled: v })} />
        </Field>
        <Field label="いまの状態">
          <div className="between">
            <span className={`chip ${voice.available ? 'chip-good' : 'chip-warn'}`}>{voice.available ? '使えます' : voiceReasonText(voice.reason)}</span>
            {!voice.available && voice.reason !== 'disabled' && voice.reason !== 'unsupported' && (
              <button className="btn btn-ghost btn-sm" onClick={() => resetVoiceFailure()}>
                もう一度試す
              </button>
            )}
          </div>
        </Field>
        <Field label="音声テスト・マイクの許可" hint="音声は Google のサーバーで文字に変換されます。録音は保存しません。">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/onboarding')}>
            <Icon name="mic" size={16} />
            はじめての設定をもう一度
          </button>
        </Field>
      </Group>

      <SectionTitle>性質の答えの候補</SectionTitle>
      <Group>
        <PropertyEditor s={s} update={update} />
      </Group>

      <SectionTitle>データ</SectionTitle>
      <Group>
        <Field label="書き出し（機種変更・バックアップ用）" hint="記録・絵・設定をすべて1つの JSON ファイルにします">
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const n = await exportAll();
              showToast(`${n}件を書き出しました`);
            }}
          >
            <Icon name="download" size={16} />
            JSON で書き出す
          </button>
        </Field>
        <Field label="読み込み" hint="いまのデータは、ファイルの中身に置きかわります">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} />
            ファイルを選ぶ
          </button>
        </Field>
        <Field label="全部削除" hint="記録・絵・設定をすべて消します。元に戻せません">
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={16} />
            全部削除する
          </button>
        </Field>
      </Group>

      <Modal open={!!pending} onClose={() => setPending(null)} title="データを読み込みますか">
        {pending && (
          <div className="stack" style={{ gap: 10 }}>
            <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>
              {new Date(pending.exportedAt).toLocaleString('ja-JP')} に書き出したファイルです。いまのデータは、このファイルの中身に置きかわります。
            </p>
            <div className="small muted">
              {TABLE_NAMES.filter((t) => Array.isArray(pending.tables[t]))
                .map((t) => `${t} ${pending.tables[t].length}`)
                .join('・')}
            </div>
            <button
              className="btn btn-parent"
              onClick={async () => {
                await importAll(pending);
                setPending(null);
                window.location.reload();
              }}
            >
              読み込む
            </button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              やめる
            </button>
          </div>
        )}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="全部削除しますか">
        <div className="stack" style={{ gap: 10 }}>
          <p className="small" style={{ margin: 0, lineHeight: 1.6, color: 'var(--bad)' }}>
            記録・絵・練習ログ・マイセット・設定をすべて削除します。元に戻せません。先に「JSON で書き出す」でバックアップを取っておくと安心です。
          </p>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await deleteAll();
              setConfirmDelete(false);
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            削除する
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
            やめる
          </button>
        </div>
      </Modal>
      {toast}
    </ParentScreen>
  );
}
