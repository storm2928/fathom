import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import '@fathom/index.css';
import '@fathom/shell/ui/ui.css';
import './styles/app.css';
import App from './App';
// Last, so the desktop layer sits over every screen's own styles.
import './styles/desktop.css';
import { Preferences } from '@capacitor/preferences';
import { hydrate } from './app/persistentStore';
import { LEGACY_KEYS, setAppStore } from './app/storage';
import { followTypeScale } from './app/typeScale';

// The ocean is the whole screen. On the web (vite dev) there is no status bar
// plugin, and that is fine.
if (Capacitor.isNativePlatform()) void StatusBar.hide().catch(() => {});

function legacyStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function boot() {
  // Saved state comes from iOS Preferences in the app. Loaded before the first
  // render so the safety gate, settings and journal read it synchronously.
  if (Capacitor.isNativePlatform()) {
    setAppStore(await hydrate(Preferences, legacyStorage(), LEGACY_KEYS));
  }
  followTypeScale();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
