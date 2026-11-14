import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './appUpdate';
import { describeSyncError } from './sync/remote';

describe('新しい版への入れかわり', () => {
  it('部品を読めなかったエラーを見分ける（Chrome・Safari・Firefox）', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/firestoreRemote-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('permission-denied'))).toBe(false);
  });

  it('共有のエラー表示では、開き直しを案内する', () => {
    expect(describeSyncError(new TypeError('Failed to fetch dynamically imported module: https://example.com/a.js'))).toContain('新しい版');
  });
});
