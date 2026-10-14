import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS 12 es ESM puro; Vitest lo soporta nativamente. SWC se usa para emitir
// metadatos de decoradores (necesarios para la inyección de dependencias de Nest).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: { include: ['src/**/*.ts'], exclude: ['src/scripts/**', 'src/main.ts'] },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
