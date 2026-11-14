// PWA のアイコンを作る（外部の画像やライブラリは使わず、Node だけで PNG を書き出す）
// オレンジの角丸の上に、白い ○ △ □ ◇
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0xcc, 0x46, 0x20];
const FG = [0xff, 0xff, 0xff];

// ---- PNG ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- 形 ----
function layout(maskable) {
  const [a, b] = maskable ? [0.25, 0.75] : [0.19, 0.81];
  const c = (b - a) / 2;
  const s = c * 0.74;
  const centers = [
    [a + c / 2, a + c / 2],
    [a + c * 1.5, a + c / 2],
    [a + c / 2, a + c * 1.5],
    [a + c * 1.5, a + c * 1.5]
  ];
  return { s, centers };
}

function insideBg(x, y, maskable) {
  if (maskable) return true;
  const r = 0.22;
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function insideFg(x, y, L) {
  const { s, centers } = L;
  const h = s / 2;
  // ○
  {
    const [cx, cy] = centers[0];
    if ((x - cx) ** 2 + (y - cy) ** 2 <= h * h) return true;
  }
  // △（上向き）
  {
    const [cx, cy] = centers[1];
    const top = cy - h;
    const bottom = cy + h * 0.86;
    if (y >= top && y <= bottom) {
      const t = (y - top) / (bottom - top);
      if (Math.abs(x - cx) <= t * h * 1.08) return true;
    }
  }
  // □
  {
    const [cx, cy] = centers[2];
    if (Math.abs(x - cx) <= h * 0.86 && Math.abs(y - cy) <= h * 0.86) return true;
  }
  // ◇
  {
    const [cx, cy] = centers[3];
    if (Math.abs(x - cx) + Math.abs(y - cy) * 0.82 <= h * 1.02) return true;
  }
  return false;
}

function render(size, maskable) {
  const L = layout(maskable);
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (insideBg(x, y, maskable)) {
            bg++;
            if (insideFg(x, y, L)) fg++;
          }
        }
      }
      const n = SS * SS;
      const a = bg / n;
      const f = bg ? fg / bg : 0;
      const i = (py * size + px) * 4;
      for (let k = 0; k < 3; k++) buf[i + k] = Math.round(BG[k] * (1 - f) + FG[k] * f);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, buf);
}

writeFileSync(join(outDir, 'pwa-192.png'), render(192, false));
writeFileSync(join(outDir, 'pwa-512.png'), render(512, false));
writeFileSync(join(outDir, 'maskable-512.png'), render(512, true));
writeFileSync(join(outDir, 'apple-touch-icon.png'), render(180, true));

// SVG（タブのアイコン）
const L = layout(false);
const p = (v) => (v * 100).toFixed(2);
const [c0, c1, c2, c3] = L.centers;
const h = L.s / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#CC4620"/>
<g fill="#fff">
<circle cx="${p(c0[0])}" cy="${p(c0[1])}" r="${p(h)}"/>
<polygon points="${p(c1[0])},${p(c1[1] - h)} ${p(c1[0] - h * 1.08)},${p(c1[1] + h * 0.86)} ${p(c1[0] + h * 1.08)},${p(c1[1] + h * 0.86)}"/>
<rect x="${p(c2[0] - h * 0.86)}" y="${p(c2[1] - h * 0.86)}" width="${p(h * 1.72)}" height="${p(h * 1.72)}"/>
<polygon points="${p(c3[0])},${p(c3[1] - h * 1.02 / 0.82)} ${p(c3[0] + h * 1.02)},${p(c3[1])} ${p(c3[0])},${p(c3[1] + h * 1.02 / 0.82)} ${p(c3[0] - h * 1.02)},${p(c3[1])}"/>
</g>
</svg>
`;
writeFileSync(join(outDir, 'icon.svg'), svg);
console.log('icons written to', outDir);
