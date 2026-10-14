// Genera un bundle CommonJS mínimo para consumidores CJS (la API NestJS compila a CJS).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = readdirSync(dist).filter((f) => f.endsWith('.js') && f !== 'index.js');
let out = '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n';
for (const file of files) {
  const src = readFileSync(join(dist, file), 'utf8')
    .replace(/^export const (\w+)/gm, 'const $1')
    .replace(/^export function (\w+)/gm, 'function $1')
    .replace(/^export \{[^}]*\};?$/gm, '')
    .replace(/^export type .*$/gm, '')
    .replace(/^import .*$/gm, '');
  out += `\n// ---- ${file}\n${src}\n`;
  for (const m of src.matchAll(/^(?:const|function) (\w+)/gm)) out += `exports.${m[1]} = ${m[1]};\n`;
}
writeFileSync(join(dist, 'index.cjs'), out);
