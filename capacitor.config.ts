import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The installed apps load the same `dist/` the website deploys, bundled inside
 * the app, so they work offline and fetch nothing from a server.
 * The app ID is a placeholder until the first store submission.
 */
const config: CapacitorConfig = {
  appId: 'dev.fathom.placeholder',
  appName: 'Fathom',
  webDir: 'dist',
};

export default config;
