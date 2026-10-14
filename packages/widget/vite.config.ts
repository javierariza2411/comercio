import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// App del widget (se carga dentro del iframe). Salida: dist/widget.js + dist/widget.html
export default defineConfig({
  base: './',
  plugins: [preact()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    cssCodeSplit: false,
    rollupOptions: {
      input: 'widget.html',
      output: { entryFileNames: 'widget.js', assetFileNames: 'widget.[ext]' },
    },
  },
});
