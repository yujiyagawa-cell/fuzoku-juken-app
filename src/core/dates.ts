// 日付まわり（端末の時刻＝日本時間を想定）

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysUntil(dateStr: string, from: Date = new Date()): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

const WEEK = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];
const WEEK_KANJI = ['日', '月', '火', '水', '木', '金', '土'];

const DAY_READ: Record<number, string> = {
  1: 'ついたち',
  2: 'ふつか',
  3: 'みっか',
  4: 'よっか',
  5: 'いつか',
  6: 'むいか',
  7: 'なのか',
  8: 'ようか',
  9: 'ここのか',
  10: 'とおか',
  14: 'じゅうよっか',
  20: 'はつか',
  24: 'にじゅうよっか'
};

export function examDateLabel(dateStr: string): { kana: string; kanji: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const w = dt.getDay();
  const dayKana = DAY_READ[d] ?? `${d}にち`;
  return {
    kana: `${m}がつ ${dayKana}（${WEEK[w]}）`,
    kanji: `${y}年${m}月${d}日（${WEEK_KANJI[w]}）`
  };
}

export function mdLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 分の読み（5ふん、10ぷん など） */
export function funLabel(n: number): string {
  return `${n}${[2, 5, 7, 9].includes(n % 10) ? 'ふん' : 'ぷん'}`;
}
