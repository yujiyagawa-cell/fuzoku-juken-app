import type { Rng } from '../../core/rng';

// 手と足のまね：棒人間のポーズ（左右は「絵の むかって左・右」）

export type ArmPos = 'down' | 'side' | 'up' | 'diag' | 'hip' | 'head';
export type LegPos = 'stand' | 'side' | 'lift';

export interface Pose {
  la: ArmPos; // むかって左の手
  ra: ArmPos; // むかって右の手
  ll: LegPos;
  rl: LegPos;
}

export const ARMS: ArmPos[] = ['down', 'side', 'up', 'diag', 'hip', 'head'];

const ARM_LABEL: Record<ArmPos, string> = {
  down: 'したに おろす',
  side: 'よこに のばす',
  up: 'うえに あげる',
  diag: 'ななめうえに のばす',
  hip: 'こしに あてる',
  head: 'あたまに のせる'
};

export function makePose(rng: Rng): Pose {
  const la = rng.pick(ARMS);
  const ra = rng.chance(0.5) ? la : rng.pick(ARMS.filter((a) => a !== la));
  const leg = rng.pick(['stand', 'stand', 'side', 'lift'] as const);
  let ll: LegPos = 'stand';
  let rl: LegPos = 'stand';
  if (leg === 'side') {
    ll = 'side';
    rl = 'side';
  } else if (leg === 'lift') {
    if (rng.chance(0.5)) ll = 'lift';
    else rl = 'lift';
  }
  return { la, ra, ll, rl };
}

export function isNeutral(p: Pose): boolean {
  return p.la === 'down' && p.ra === 'down' && p.ll === 'stand' && p.rl === 'stand';
}

export function samePose(a: Pose, b: Pose): boolean {
  return a.la === b.la && a.ra === b.ra && a.ll === b.ll && a.rl === b.rl;
}

/** n個のポーズ（つづけて同じにしない・気をつけの姿勢は入れない） */
export function makePoseSequence(rng: Rng, n: number): Pose[] {
  const out: Pose[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 500) {
    const p = makePose(rng);
    if (isNeutral(p)) continue;
    if (out.length && samePose(p, out[out.length - 1])) continue;
    out.push(p);
  }
  return out;
}

/** 保護者向けの説明 */
export function poseLabel(p: Pose): string {
  const arms = p.la === p.ra ? `りょうてを ${ARM_LABEL[p.la]}` : `かたてを ${ARM_LABEL[p.la]}・もうかたほうを ${ARM_LABEL[p.ra]}`;
  let legs = 'まっすぐ たつ';
  if (p.ll === 'side' && p.rl === 'side') legs = 'あしを ひらく';
  else if (p.ll === 'lift' || p.rl === 'lift') legs = 'かたあしを あげる';
  return `${arms}／${legs}`;
}
