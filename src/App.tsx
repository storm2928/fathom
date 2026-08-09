import { useState } from 'react';
import { DiveView } from './game/scene/DiveView';
import { ScriptedEnginePanel } from './game/input/dev/ScriptedEnginePanel';
import { Onboarding } from './shell/Onboarding';
import { LanguageToggle } from './shell/LanguageToggle';
import { LanguageProvider, useLanguage } from './shell/i18n';
import './App.css';

/**
 * Development entry point. The scope screen gates the dive, so nothing reaches
 * an input choice — and therefore nothing can ask for a microphone — before it
 * has been read.
 */
type View = 'dive' | 'harness';

/**
 * Per browser session rather than remembered forever. Re-reading a short safety
 * screen costs a few seconds; a stored flag that quietly suppresses it for good
 * is how people end up never having seen it.
 */
const ACK_KEY = 'fathom.scope-acknowledged';

function Shell() {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('dive');
  const [acknowledged, setAcknowledged] = useState(
    () => sessionStorage.getItem(ACK_KEY) === 'yes',
  );

  const handleBegin = () => {
    sessionStorage.setItem(ACK_KEY, 'yes');
    setAcknowledged(true);
  };

  if (!acknowledged) return <Onboarding onBegin={handleBegin} />;

  return (
    <div className="app">
      <nav className="app-nav">
        <button
          type="button"
          className={view === 'dive' ? 'active' : ''}
          onClick={() => setView('dive')}
        >
          {t.nav.dive}
        </button>
        <button
          type="button"
          className={view === 'harness' ? 'active' : ''}
          onClick={() => setView('harness')}
        >
          {t.nav.harness}
        </button>
        <button type="button" onClick={() => setAcknowledged(false)}>
          {t.nav.scope}
        </button>
        <span className="app-nav-spacer" />
        <LanguageToggle />
      </nav>
      {view === 'dive' ? <DiveView /> : <ScriptedEnginePanel />}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  );
}

export default App;
