import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The app shares the website's engine, scene and strings rather than copying
 * them: `@fathom/*` is `fathom/src/*`. The website's `public/` (the breath
 * worklet and the fonts) is served as this app's public dir too, because the
 * worklet is loaded by a relative URL at runtime and must sit at the web root.
 */
const shared = fileURLToPath(new URL('../src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  resolve: {
    alias: { '@fathom': shared },
    // One React and one Pixi, whichever folder a module was imported from.
    dedupe: ['react', 'react-dom', 'pixi.js'],
  },
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', target: 'es2022' },
});
