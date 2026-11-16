import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { buildEnvSnapshot, decodeEnv, encodeEnv, type EnvSnapshot } from './envLink';
import { DEFAULT_SETTINGS } from './settings';

// 設定つきURL：文字列にして、もとに戻せる（日本語・記号もそのまま）

const snap: EnvSnapshot = {
  v: 1,
  s: { ...DEFAULT_SETTINGS, childName: 'はなこ', childNameKanji: '花子', age: 6, birthday: { month: 5, day: 3 }, handedness: 'right' },
  r: [
    ['zukei-kisetsu', 'good'],
    ['zukei-ferris', 'off', '理由を聞くのが長い']
  ],
  m: [{ id: 'a', name: '朝10分セット', items: [{ moduleId: 'taiki', count: 5 }, { moduleId: 'kotoba', count: 5 }], createdAt: '2026-11-14T00:00:00.000Z' }],
  l: [['zousan', 'https://www.youtube.com/watch?v=xxxx']],
  k: [['ぬ', 3]]
};

describe('設定つきURL', () => {
  it('文字列にしてもとに戻せる', async () => {
    const code = await encodeEnv(snap);
    expect(code).toMatch(/^[zj][A-Za-z0-9_-]+$/); // URL にそのまま入る文字だけ
    expect(await decodeEnv(code)).toEqual(snap);
  });

  it('短くなる（設定ぜんぶで 1500 文字くらいまで）', async () => {
    const code = await encodeEnv(snap);
    expect(code.length).toBeLessThan(1500);
  });

  it('こわれた文字列はエラー', async () => {
    await expect(decodeEnv('zAAAA')).rejects.toThrow();
    await expect(decodeEnv('x123')).rejects.toThrow();
  });

  it('見る専用URLは、共有しているときだけ作れる（共有先と見る専用のしるしが入る）', async () => {
    await db.syncMeta.clear();
    expect((await buildEnvSnapshot({ viewOnly: true })).ro).toBeUndefined();
    await db.syncMeta.put({ key: 'config', value: { fb: { apiKey: 'k', projectId: 'p' }, deviceId: 'd', since: '' } });
    const view = await buildEnvSnapshot({ viewOnly: true });
    expect(view.ro).toBe(1);
    expect(view.y).toEqual({ a: 'k', p: 'p' });
    expect(await decodeEnv(await encodeEnv(view))).toEqual(view);
    expect((await buildEnvSnapshot()).ro).toBeUndefined();
    await db.syncMeta.clear();
  });
});
