import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
for (const file of ['dist/embed.js', 'dist/widget.js', 'dist/widget.css']) {
  try {
    const raw = statSync(file).size;
    const gz = gzipSync(readFileSync(file)).length;
    console.log(`${file.padEnd(18)} ${(raw / 1024).toFixed(1).padStart(6)} KB   gzip ${(gz / 1024).toFixed(1).padStart(6)} KB`);
  } catch { console.log(`${file} (no existe)`); }
}
