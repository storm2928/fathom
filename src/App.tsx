import { useState } from 'react';
import { DiveView } from './game/scene/DiveView';
import { ScriptedEnginePanel } from './game/input/dev/ScriptedEnginePanel';
import './App.css';

/**
 * Development entry point. The real one — scope screen, onboarding, session arc,
 * crisis rail — arrives with #9 and #17; until then this just picks which of the
 * two surfaces to look at.
 */
type View = 'dive' | 'harness';

function App() {
  const [view, setView] = useState<View>('dive');

  return (
    <div className="app">
      <nav className="app-nav">
        <button
          type="button"
          className={view === 'dive' ? 'active' : ''}
          onClick={() => setView('dive')}
        >
          Dive
        </button>
        <button
          type="button"
          className={view === 'harness' ? 'active' : ''}
          onClick={() => setView('harness')}
        >
          Input harness
        </button>
      </nav>
      {view === 'dive' ? <DiveView /> : <ScriptedEnginePanel />}
    </div>
  );
}

export default App;
