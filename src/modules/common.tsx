import { genreOf } from '../core/genres';
import type { GenreId } from '../core/types';
import type { ModuleColor, RunnerProps } from '../player/types';

// モジュール共通の小物

function darken(hex: string, f = 0.12): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - f)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - f)));
  const b = Math.max(0, Math.round((n & 255) * (1 - f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function moduleColor(g: GenreId): ModuleColor {
  const x = genreOf(g);
  return { bg: x.bg, ink: x.ink, icon: x.icon_color, shadow: darken(x.bg) };
}

/** まだ作っていないモジュール用 */
export function StubRunner({ onDone }: RunnerProps) {
  return (
    <div className="stage">
      <span className="stage-text">じゅんびちゅう です</span>
      <button className="btn btn-primary" onClick={onDone}>
        つぎへ
      </button>
    </div>
  );
}
