import { defineConfig } from 'vite';

// Loader que el comercio pega en su web: dist/embed.js (IIFE, sin dependencias, ~2 KB)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2017',
    lib: { entry: 'src/loader/embed.ts', name: 'SmartCommerceWidget', formats: ['iife'], fileName: () => 'embed.js' },
    minify: 'esbuild',
  },
});
