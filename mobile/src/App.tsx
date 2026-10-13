import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageProvider, useLanguage } from '@fathom/shell/i18n';
import { fill } from '@fathom/shell/strings';
import type { SessionResult, SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { InputCode } from '@fathom/game/surface/diveLog';
import type { Strings } from '@fathom/shell/strings';
import { initialFlow, nextFlow } from './app/flow';
import type { FlowEvent, FlowState } from './app/flow';
import { loadChoices, saveChoices } from './app/storage';
import { DiveController, ZONE_FOR_STATE } from './dive/diveController';
import type { DiveInput } from './dive/diveController';
import { productionInputs } from './dive/inputs';
import { DiveHud } from './dive/DiveHud';
import type { RingView } from './dive/DiveHud';
import { OceanStage, useOcean } from './world/OceanStage';
import { SafetyGate } from './screens/SafetyGate';
import { TitleScreen } from './screens/TitleScreen';
import { PreDive } from './screens/PreDive';
import { ResultsCard } from './screens/ResultsCard';
import { useAppStrings } from './strings';
import './styles/screens.css';

/** Dev builds can drive a whole dive with the scripted fixture: add ?scripted to the URL. */
const SCRIPTED = import.meta.env.DEV && new URLSearchParams(location.search).has('scripted');
const CALIBRATION_MS = 10_000;

/** What actually drove the dive, in the words the results card uses. */
const INPUT_LABEL: Record<InputCode, (t: Strings) => string> = {
  microphone: (t) => t.setup.inputMicrophone,
  keyboard: (t) => t.setup.inputKeyboard,
  touch: (t) => t.setup.inputTouch,
  scripted: (t) => t.setup.inputScripted,
};

function Game() {
  const { t } = useLanguage();
  const a = useAppStrings();
  const scene = useOcean();
  const [flow, setFlow] = useState<FlowState>(() => initialFlow(loadChoices()));
  const send = (event: FlowEvent) => setFlow((state) => nextFlow(state, event));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>('idle');
  const [zone, setZone] = useState<number | null>(null);
  const [depth, setDepth] = useState(0);
  const [ring, setRing] = useState<RingView>({ step: null, sweepMs: 0, seq: 0 });
  const [touch, setTouch] = useState<SpacebarBreathEngine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [inputCode, setInputCode] = useState<InputCode>('microphone');
  const timeScale = SCRIPTED ? 10 : 1;

  const controller = useMemo(
    () =>
      scene
        ? new DiveController(
            scene,
            {
              onState: (next) => {
                setState(next);
                const z = ZONE_FOR_STATE[next];
                if (next !== 'calibrating' && z !== undefined) setZone(z);
                if (next === 'calibrating') {
                  setRing((r) => ({ step: 'calibrating', sweepMs: CALIBRATION_MS / timeScale, seq: r.seq + 1 }));
                }
              },
              onPrompt: (window, sweepMs) =>
                setRing((r) => ({ step: window.step, sweepMs, seq: r.seq + 1 })),
              onResult: (finished, code) => {
                setResult(finished);
                setInputCode(code);
                setTouch(null);
                send({ type: 'surfaced' });
              },
            },
            productionInputs,
          )
        : null,
    [scene, timeScale],
  );

  // Depth is sampled, not pushed: a 60 Hz scene must not render React 60 times a second.
  const sampling = useRef<number | null>(null);
  useEffect(() => {
    if (flow.screen !== 'dive' || !scene) return;
    sampling.current = window.setInterval(() => setDepth(scene.depth), 100);
    return () => {
      if (sampling.current !== null) clearInterval(sampling.current);
    };
  }, [flow.screen, scene]);

  const begin = async () => {
    if (!controller) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setZone(null);
    setDepth(0);
    setRing({ step: null, sweepMs: 0, seq: 0 });
    const input: DiveInput = SCRIPTED ? 'scripted' : flow.input;
    try {
      // Called directly from the tap so the microphone opens inside the gesture.
      const started = await controller.start({ plan: flow.plan, input, timeScale });
      if (!started) return;
      setTouch(controller.touch);
      if (started.fellBack) setNotice(a.micFellBack);
      send({ type: 'begin' });
    } catch (e) {
      setError(fill(t.setup.startError, { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    setResult(null);
    scene?.reset();
    // The scene stops itself after settling; the title wants the water moving.
    scene?.start();
    send({ type: 'done' });
  };

  switch (flow.screen) {
    case 'safety':
      return (
        <SafetyGate
          onAcknowledge={(input) => {
            saveChoices({ acknowledged: true, input });
            send({ type: 'acknowledge', input });
          }}
        />
      );
    case 'title':
      return <TitleScreen onChoose={(plan) => send({ type: 'choose-dive', plan })} />;
    case 'predive':
      return (
        <PreDive
          plan={flow.plan}
          busy={busy || !controller}
          error={error}
          onBegin={() => void begin()}
          onBack={() => send({ type: 'back' })}
        />
      );
    case 'dive':
      return (
        <DiveHud
          state={state}
          zone={zone}
          depth={depth}
          ring={ring}
          touch={touch}
          notice={notice}
          onLeave={() => controller?.stop()}
        />
      );
    case 'results':
      return result ? <ResultsCard result={result} inputLabel={INPUT_LABEL[inputCode](t)} onDone={done} /> : null;
  }
}

export default function App() {
  return (
    <LanguageProvider>
      <OceanStage>
        <Game />
      </OceanStage>
    </LanguageProvider>
  );
}
