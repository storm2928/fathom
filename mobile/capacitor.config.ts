import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.colejasink.fathom',
  appName: 'Fathom',
  webDir: 'dist',
  backgroundColor: '#030811',
  ios: {
    // The page is a fixed game surface; the web view must not scroll or bounce.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#030811',
    preferredContentMode: 'mobile',
  },
};

export default config;
