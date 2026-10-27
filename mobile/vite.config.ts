import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The app shares the website's engine, scene and strings rather than copying
 * them: `@fathom/*` is `fathom/src/*`. The website's `public/` (the breath
 * worklet and the fonts) is served as this app's public dir too, because the
 * worklet is loaded by a relative URL at runtime and must sit at the web root.
 */
const shared = fileURLToPath(new URL('../src', import.meta.url));

/**
 * Autoplay acknowledges the safety scope by itself and dives on the scripted
 * fixture. It must never reach a release, so it is refused outright unless the
 * build is the dedicated simulator mode (`npm run ios:autoplay`).
 */
function refuseAutoplayOutsideSimulator(mode: string): void {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (env.VITE_FATHOM_AUTOPLAY && mode !== 'simulator') {
    throw new Error(
      `VITE_FATHOM_AUTOPLAY is set for a "${mode}" build. It skips the safety screen and ` +
        'must only be used with --mode simulator (npm run ios:autoplay).',
    );
  }
}

export default defineConfig(({ mode }) => {
  refuseAutoplayOutsideSimulator(mode);
  return config;
});

const config = {
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
  // The soundscape worklet is loaded with audioWorklet.addModule, which wants an ES module.
  worker: { format: 'es' as const },
};
