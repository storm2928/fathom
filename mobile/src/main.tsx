import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import '@fathom/index.css';
import '@fathom/shell/ui/ui.css';
import './styles/app.css';
import App from './App';

// The ocean is the whole screen. On the web (vite dev) there is no status bar
// plugin, and that is fine.
if (Capacitor.isNativePlatform()) void StatusBar.hide().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
