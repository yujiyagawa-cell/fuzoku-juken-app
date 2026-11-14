import { db, nowIso, uid } from '../core/db';
import type { Attempt } from '../core/types';
import type { SessionApi } from './types';

// 1回の練習（セッション）と、1問ごとの記録（attempt）

export async function createSession(moduleIds: string[], mySetId?: string): Promise<string> {
  const id = uid();
  await db.sessions.add({ id, startedAt: nowIso(), moduleIds, mySetId });
  return id;
}

export async function endSession(id: string): Promise<void> {
  await db.sessions.update(id, { endedAt: nowIso() });
}

export function makeSessionApi(sessionId: string): SessionApi {
  return {
    sessionId,
    async record(input) {
      const a: Attempt = {
        id: uid(),
        sessionId,
        ...input,
        finalJudge: input.parentJudge ?? input.autoJudge ?? 'unknown',
        createdAt: nowIso()
      };
      await db.attempts.add(a);
      return a;
    },
    async setParentJudge(attemptId, judge) {
      await db.attempts.update(attemptId, { parentJudge: judge, finalJudge: judge });
    },
    async setChecks(attemptId, checks) {
      const a = await db.attempts.get(attemptId);
      await db.attempts.update(attemptId, { parentChecks: { ...(a?.parentChecks || {}), ...checks } });
    }
  };
}

/** 結果画面などで、あとから判定を直す */
export async function overrideJudge(attemptId: string, judge: Attempt['finalJudge']) {
  await db.attempts.update(attemptId, { parentJudge: judge, finalJudge: judge });
}
