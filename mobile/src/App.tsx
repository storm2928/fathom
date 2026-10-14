import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageProvider, useLanguage } from '@fathom/shell/i18n';
import { fill } from '@fathom/shell/strings';
import type { SessionResult, SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { InputCode } from '@fathom/game/surface/diveLog';
import { initialFlow, nextFlow } from './app/flow';
import type { FlowEvent, FlowState } from './app/flow';
import {
  loadChoices,
  loadHaptics,
  loadVolume,
  saveChoices,
  saveHaptics,
  saveVolume,
} from './app/storage';
import type { InputChoice } from './app/flow';
import { DiveController, ZONE_FOR_STATE } from './dive/diveController';
import type { DiveInput, DiveStats } from './dive/diveController';
import { productionInputs } from './dive/inputs';
import { DiveHud } from './dive/DiveHud';
import type { RingView } from './dive/DiveHud';
import { OceanStage, useOcean } from './world/OceanStage';
import { Onboarding } from './screens/Onboarding';
import { TitleScreen } from './screens/TitleScreen';
import { PreDive } from './screens/PreDive';
import { ResultsCard } from './screens/ResultsCard';
import { SettingsSheet } from './screens/SettingsSheet';
import { useAppStrings } from './strings';
import { playInhale, playPing, useSoundscape } from './sound/useSoundscape';
import { useHaptics } from './haptics/useHaptics';
import { JournalScreen } from './journal/JournalScreen';
import { rollEncounters } from './journal/encounters';
import { loadJournal, recordDive, recordFound } from './journal/journalStore';
import { CREATURE_ART } from './journal/creatureArt';
import type { CreatureId } from './journal/catalogue';
import { ZONE_HEX } from './journal/zoneColours';
import { defaultStore } from './app/storage';
import { haptics } from './native/fathomHaptics';
import './styles/screens.css';

/**
 * Development only: VITE_FATHOM_AUTOPLAY=1 walks the whole flow by itself on the
 * scripted fixture — two dives, the second left early — so a simulator build
 * can be checked where touch input cannot be injected.
 */
// Its own switch rather than DEV: a simulator build is a `vite build`, where DEV
// is false. Never set for a release, so the constant folds to false there.
const AUTOPLAY = import.meta.env.VITE_FATHOM_AUTOPLAY === '1';
/** Dev builds can drive a whole dive with the scripted fixture: add ?scripted to the URL. */
const AUTOPLAY_MIC = AUTOPLAY && import.meta.env.VITE_FATHOM_AUTOPLAY_INPUT === 'mic';
const SCRIPTED =
  (AUTOPLAY && !AUTOPLAY_MIC) || (import.meta.env.DEV && new URLSearchParams(location.search).has('scripted'));
const CALIBRATION_MS = 10_000;

function Game() {
  const { t } = useLanguage();
  const a = useAppStrings();
  const scene = useOcean();
  const [flow, setFlow] = useState<FlowState>(() => initialFlow(loadChoices()));
  const send = (event: FlowEvent) => setFlow((state) => nextFlow(state, event));

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rereading, setRereading] = useState(false);
  // Read by the soundscape (Plan 2); saved as soon as it changes.
  const [volume, setVolume] = useState(loadVolume);
  const [hapticsOn, setHapticsOn] = useState(loadHaptics);
  // Read inside controller callbacks, which are built once.
  const hapticsRef = useRef(hapticsOn);
  hapticsRef.current = hapticsOn;
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
  const [stats, setStats] = useState<DiveStats>({ depth: 0, zone: 0, longestExhaleMs: 0, found: [] });
  const [newlyFound, setNewlyFound] = useState<string[]>([]);
  const newlyFoundRef = useRef<string[]>([]);
  const [discovery, setDiscovery] = useState<{ id: CreatureId; zone: number; key: number } | null>(null);
  const planRef = useRef(flow.plan);
  planRef.current = flow.plan;
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
                if ((next === 'zone-2' || next === 'zone-3') && hapticsRef.current) haptics.tap('zone');
                if (next !== 'calibrating' && z !== undefined) setZone(z);
                if (next === 'calibrating') {
                  setRing((r) => ({ step: 'calibrating', sweepMs: CALIBRATION_MS / timeScale, seq: r.seq + 1 }));
                }
              },
              onPrompt: (window, sweepMs) => {
                setRing((r) => ({ step: window.step, sweepMs, seq: r.seq + 1 }));
                if (window.step === 'inhale' || window.step === 'top-up') {
                  playInhale();
                  if (hapticsRef.current) haptics.tap('inhale');
                }
              },
              onPlaced: (placed) =>
                scene.setCreatures(
                  placed.map((p) => ({
                    key: p.id,
                    depth: p.depth,
                    x: p.x,
                    ...CREATURE_ART[p.id],
                    colour: ZONE_HEX[p.zone],
                  })),
                ),
              onFound: (encounter, depth) => {
                const isNew = recordFound(defaultStore(), encounter.id, depth, new Date());
                if (isNew) newlyFoundRef.current = [...newlyFoundRef.current, encounter.id];
                setDiscovery({ id: encounter.id, zone: encounter.zone, key: Date.now() });
                playPing();
                if (hapticsRef.current) haptics.tap('discovery');
              },
              onResult: (finished, code, diveStats) => {
                recordDive(defaultStore(), {
                  date: new Date().toISOString(),
                  plan: planRef.current,
                  durationMs: finished.durationMs,
                  baselineRR: finished.baselineRR,
                  finalRR: finished.finalRR,
                  depth: diveStats.depth,
                  ending: finished.ending,
                  calibrated: finished.calibrated,
                  found: diveStats.found,
                });
                setNewlyFound(newlyFoundRef.current);
                // Rise back to the light behind the results.
                scene.ascend(4);
                setResult(finished);
                setInputCode(code);
                setStats(diveStats);
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

  useHaptics({
    enabled: hapticsOn,
    diving: flow.screen === 'dive',
    input: inputCode === 'microphone' ? 'mic' : inputCode === 'scripted' ? 'scripted' : 'touch',
    exhaling: () => controller?.exhaling ?? false,
  });

  useSoundscape({
    screen: flow.screen,
    depth: () => (flow.screen === 'dive' || flow.screen === 'results' ? (scene?.depth ?? 0) : 0),
    zone: flow.screen === 'dive' ? (zone ?? 0) : flow.screen === 'results' ? stats.zone : 0,
    exhaling: () => controller?.exhaling ?? false,
    exhaleWindow: () => controller?.exhaleWindow ?? false,
    volume,
  });

  const begin = async () => {
    if (!controller) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setZone(null);
    setDepth(0);
    setRing({ step: null, sweepMs: 0, seq: 0 });
    newlyFoundRef.current = [];
    setDiscovery(null);
    // What this dive can meet: fixed now, never added to while it runs.
    const encounters = rollEncounters({
      seed: Date.now() >>> 0,
      zones: flow.plan === 'full' ? [0, 1, 2] : [0],
      found: new Set(Object.keys(loadJournal().found)),
    });
    const input: DiveInput = SCRIPTED ? 'scripted' : AUTOPLAY_MIC ? 'mic' : flow.input;
    try {
      // Called directly from the tap so the microphone opens inside the gesture.
      const started = await controller.start({ plan: flow.plan, input, timeScale, encounters });
      if (!started) return;
      setTouch(controller.touch);
      setInputCode(started.code);
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

  const autoplayDives = useRef(0);
  useEffect(() => {
    if (!AUTOPLAY) return;
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    };
    switch (flow.screen) {
      case 'safety':
        return after(4000, () => send({ type: 'acknowledge', input: 'touch' }));
      case 'title':
        return after(4000, () => send({ type: 'choose-dive', plan: 'quick' }));
      case 'predive':
        return controller ? after(3000, () => void begin()) : undefined;
      case 'dive':
        autoplayDives.current += 1;
        return autoplayDives.current === 2 ? after(6000, () => controller?.stop()) : undefined;
      case 'results':
        return after(6000, done);
    }
    // Keyed on the screen: each screen schedules its one step when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.screen, controller]);

  const changeVolume = (next: number) => {
    setVolume(next);
    saveVolume(next);
  };
  const changeInput = (input: InputChoice) => {
    saveChoices({ acknowledged: true, input });
    send({ type: 'set-input', input });
  };
  const settings = settingsOpen ? (
    <SettingsSheet
      volume={volume}
      input={flow.input}
      diving={flow.screen === 'dive'}
      haptics={hapticsOn}
      onHaptics={(on) => {
        setHapticsOn(on);
        saveHaptics(on);
      }}
      onVolume={changeVolume}
      onReread={() => {
        setSettingsOpen(false);
        setRereading(true);
      }}
      onInput={changeInput}
      onClose={() => setSettingsOpen(false)}
    />
  ) : rereading ? (
    <Onboarding review initialInput={flow.input} onDone={() => setRereading(false)} />
  ) : null;

  switch (flow.screen) {
    case 'safety':
      return (
        <Onboarding
          initialInput={flow.input}
          onDone={(input) => {
            saveChoices({ acknowledged: true, input });
            send({ type: 'acknowledge', input });
          }}
        />
      );
    case 'title':
      return (
        <>
          <TitleScreen
            onChoose={(plan) => send({ type: 'choose-dive', plan })}
            onSettings={() => setSettingsOpen(true)}
            onJournal={() => send({ type: 'open-journal' })}
          />
          {settings}
        </>
      );
    case 'journal':
      return <JournalScreen onBack={() => send({ type: 'back' })} />;
    case 'predive':
      return (
        <PreDive
          plan={flow.plan}
          busy={busy || !controller}
          error={error}
          onBegin={() => void begin()}
          onBack={() => {
            // Cancels a dive whose input is still starting, so the microphone is
            // not left open behind the title.
            controller?.stop();
            send({ type: 'back' });
          }}
        />
      );
    case 'dive':
      return (
        <>
        <DiveHud
          state={state}
          zone={zone}
          depth={depth}
          ring={ring}
          touch={touch}
          notice={notice}
          onLeave={() => controller?.stop()}
          onSettings={() => setSettingsOpen(true)}
          discovery={discovery}
        />
        {settings}
        </>
      );
    case 'results':
      return result ? <ResultsCard
          result={result}
          plan={flow.plan}
          input={inputCode}
          stats={stats}
          newlyFound={newlyFound}
          onDone={done}
        /> : null;
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
