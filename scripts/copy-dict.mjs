// kuromoji の辞書を public/dict/ に写す（GitHub Pages などでそのまま配信するため）
import { mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'kuromoji', 'dict');
const dest = join(root, 'public', 'dict');
mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (!f.endsWith('.dat.gz')) continue;
  copyFileSync(join(src, f), join(dest, f));
  n++;
}
console.log(`copied ${n} files to public/dict`);
