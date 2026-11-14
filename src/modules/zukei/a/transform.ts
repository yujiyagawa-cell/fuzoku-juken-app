// 2×2 の整数行列で、回転（90°ごと）と裏返しをあらわす。画面座標（y は下向き）。
// [p, q, s, t] : x' = p*x + q*y,  y' = s*x + t*y （中心を原点にした座標）

export type Mat = [number, number, number, number];

export const I: Mat = [1, 0, 0, 1];
/** 時計回りに 90°（右に1回） */
export const CW: Mat = [0, -1, 1, 0];
/** 左右の裏返し */
export const MIRROR: Mat = [-1, 0, 0, 1];

/** a・b（b を先に、そのあと a） */
export function mul(a: Mat, b: Mat): Mat {
  return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
}

export function rotN(k: number): Mat {
  let m = I;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = mul(CW, m);
  return m;
}

/** 裏返し（m）→ 時計回りに r 回 */
export function element(m: number, r: number): Mat {
  return mul(rotN(r), m ? MIRROR : I);
}

export function matKey(a: Mat): string {
  return a.map((x) => (x === 0 ? 0 : x)).join(',');
}

/** 一辺 size の正方形の中心で変換する SVG の matrix() */
export function svgMatrix(a: Mat, size = 100): string {
  const c = size / 2;
  const [p, q, s, t] = a;
  const e = c - c * p - c * q;
  const f = c - c * s - c * t;
  return `matrix(${p} ${s} ${q} ${t} ${e} ${f})`;
}

/** マス目（n×n）の座標 (row, col) を変換 */
export function applyCell(a: Mat, row: number, col: number, n: number): [number, number] {
  const h = (n - 1) / 2;
  const x = col - h;
  const y = row - h;
  const x2 = a[0] * x + a[1] * y;
  const y2 = a[2] * x + a[3] * y;
  return [Math.round(y2 + h), Math.round(x2 + h)];
}
