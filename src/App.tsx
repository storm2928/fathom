import { ScriptedEnginePanel } from './game/input/dev/ScriptedEnginePanel';

/**
 * Placeholder entry point. The dive scene (issue #8) and the session state
 * machine (issue #9) replace this; for now it mounts the harness that proves
 * the scripted engine emits what the contract promises.
 */
function App() {
  return <ScriptedEnginePanel />;
}

export default App;
