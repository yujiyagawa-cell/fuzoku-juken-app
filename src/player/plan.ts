import type { MySetItem } from '../core/types';
import { navigate } from '../ui/router';

// これから練習する内容（モジュールと出題数の並び）。画面をまたいで渡す。

export interface Plan {
  items: MySetItem[];
  mySetId?: string;
  label?: string; // 例：「おまかせ」「朝10分セット」
}

const KEY = 'fuzoku-plan';
let memo: Plan | null = null;

export function savePlan(p: Plan) {
  memo = p;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

export function loadPlan(): Plan | null {
  if (memo) return memo;
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Plan) : null;
  } catch {
    return null;
  }
}

/** 計画を保存してプレイヤーへ */
export function startPlan(p: Plan) {
  savePlan(p);
  navigate('/play');
}
