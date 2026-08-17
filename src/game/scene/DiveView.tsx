import { useEffect, useRef, useState } from 'react';
import { BreathConductor } from '../session/conductor';
import { SessionMachine } from '../session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '../session/sessionMachine';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { startInput } from '../input/inputSource';
import type { InputPlan, InputSource, StartedInput } from '../input/inputSource';
import { createBreathEngine } from '../../breath/engine';
import type { BreathEngine } from '../../breath/types';
import type { InputCode } from '../surface/diveLog';
import { DiveScene, createDiveRenderer } from './diveScene';
import { SurfaceScreen } from '../surface/SurfaceScreen';
import { useLanguage } from '../../shell/i18n';
import { fill } from '../../shell/strings';
import type { Strings } from '../../shell/strings';
import './DiveView.css';

/**
 * Mounts a full session against whichever input source is selected. This is
 * still a development shell: it exposes the scripted fixture and a speed
 * control that no player should ever see.
 */

type Source = InputSource;

/**
 * The scripted fixture and the speed control breathe for you, which is the
 * opposite of the product. They are compiled out of anything a visitor can
 * reach, so the deployed site offers the two real ways to play and nothing else.
 */
const DEV_TOOLS = import.meta.env.DEV;

const PLAYABLE_SOURCES: Source[] = ['mic', 'spacebar'];
const ALL_SOURCES: Source[] = ['mic', 'spacebar', 'scripted'];

/** How long the baseline read listens, for the inputs that measure one. */
const CALIBRATION_MS = 10_000;

/**
 * Labels for the input controls, and for the input that actually ran. Kept as
 * lookups rather than nested ternaries so adding a fourth source cannot quietly
 * leave one of the three places behind.
 */
const SOURCE_LABEL: Record<Source, (t: Strings) => string> = {
  mic: (t) => t.dive.inputMicrophone,
  spacebar: (t) => t.dive.spacebar,
  scripted: (t) => t.dive.scripted,
};

const CODE_LABEL: Record<InputCode, (t: Strings) => string> = {
  microphone: (t) => t.dive.inputMicrophone,
  keyboard: (t) => t.dive.inputKeyboard,
  scripted: (t) => t.dive.inputScripted,
};

const SOURCE_HINT: Record<Source, (t: Strings) => string> = {
  mic: (t) => t.dive.hintMic,
  spacebar: (t) => t.dive.hintSpacebar,
  scripted: (t) => t.dive.hintScripted,
};

/** Which visual zone each stage of the arc belongs to. */
const ZONE_INDEX: Partial<Record<SessionState, number>> = {
  calibrating: 0,
  'zone-1': 0,
  'zone-2': 1,
  'zone-3': 2,
  // Surfacing deliberately absent: it holds whatever zone the dive reached.
  // Mapping it to the deepest look turned a one-zone Quick Dive the colour of
  // zone three on its way out.
};

export function DiveView() {
  const { t } = useLanguage();
  const stateLabel = (state: SessionState) => t.state[state];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DiveScene | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const engineRef = useRef<BreathEngine | null>(null);
  const conductorRef = useRef<BreathConductor | null>(null);
  const machineRef = useRef<SessionMachine | null>(null);

  const [running, setRunning] = useState(false);
  // The microphone is the point of the thing, so it is what a visitor gets
  // first. The spacebar sits beside it as an equal choice rather than a
  // consolation: a loud room or a shared office is ordinary, not a failure.
  const [source, setSource] = useState<Source>('mic');
  const [speed, setSpeed] = useState(10);
  const [state, setState] = useState<SessionState>('idle');
  const [depth, setDepth] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // What actually drove the dive, which is not always what was selected, and
  // why — the surface screen and the exported log both read this rather than
  // the button that was pressed.
  const [inputCode, setInputCode] = useState<InputCode>('scripted');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const stopAll = () => {
    machineRef.current?.stop();
    machineRef.current = null;
    teardownRef.current?.();
    teardownRef.current = null;
    conductorRef.current?.stop();
    conductorRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    sceneRef.current?.destroy();
    sceneRef.current = null;
  };

  useEffect(() => stopAll, []);

  // Sampled rather than event-driven, so a 60Hz scene does not push 60 React
  // renders a second at the readout.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setDepth(sceneRef.current?.depth ?? 0), 100);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = async (plan: SessionPlan) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stopAll();
    setDepth(0);
    setRate(null);
    setResult(null);
    setFallbackReason(null);

    // Only the fixture can be fast-forwarded. A person breathing into a
    // microphone or holding a key runs in real time, whatever the dev control says.
    const timeScale = source === 'scripted' ? speed : 1;
    const conductor = new BreathConductor({ targetRR: 15, timeScale });

    // Built for the chosen source only. Constructing all three would spin up a
    // detector and an estimator nobody asked for on every dive.
    const planFor = (chosen: Source): InputPlan => {
      switch (chosen) {
        case 'mic':
          return {
            primary: createBreathEngine(),
            code: 'microphone',
            fallback: () => new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
          };
        case 'spacebar':
          return {
            primary: new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
            code: 'keyboard',
          };
        case 'scripted':
          return {
            primary: new ScriptedBreathEngine({ follow: conductor, timeScale }),
            code: 'scripted',
          };
      }
    };

    // Started here, before the renderer is awaited, and not at the end of this
    // function where it used to sit. `capture.ts` has to construct its
    // AudioContext inside the gesture that opened it, and an await on the
    // render path in between is enough to lose that — Safari most strictly.
    let started: StartedInput;
    try {
      started = await startInput(planFor(source));
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : String(error));
      return;
    }

    const engine = started.engine;
    // Held immediately so a failure further down this function still releases
    // the microphone rather than leaving it hot with no way to reach it.
    engineRef.current = engine;
    setInputCode(started.code);
    setFallbackReason(started.fellBack ? started.reason : null);
    conductor.attach(engine);

    const renderer = await createDiveRenderer(canvas);
    const scene = new DiveScene(renderer, canvas, { timeScale });
    teardownRef.current = scene.attach(engine, conductor);
    engine.on('rr-update', ({ breathsPerMin }) => setRate(breathsPerMin));

    const machine = new SessionMachine(engine, conductor, {
      plan,
      timeScale,
      onState: (next) => {
        setState(next);
        setAnnouncement(stateLabel(next));
        // The arc tells the scene which zone it is in; the scene does not guess
        // from depth, which is what contradicted it in #30.
        const zone = ZONE_INDEX[next];
        if (zone !== undefined) scene.setZone(zone);
      },
      onResult: (finished) => {
        // Sampling stops with `running`, so take a last reading here or the
        // readout freezes mid-glide while the canvas carries on easing down.
        setDepth(scene.depth);
        // Let the descent come to rest, then the scene stops itself rather than
        // animating underneath the surface screen for as long as it is open.
        scene.settle();
        setResult(finished);
        setRunning(false);
        // Stated as the two measurements rather than as a verdict, so the
        // announcement stays true whether breathing slowed, held steady or
        // sped up. The full wording is on the surface screen below it.
        setAnnouncement(
          `${t.surface.title}: ${finished.baselineRR.toFixed(1)} → ${finished.finalRR.toFixed(1)} ${t.surface.unit}`,
        );
      },
    });

    sceneRef.current = scene;
    conductorRef.current = conductor;
    machineRef.current = machine;

    // The engine is already running — it was started above, inside the gesture.
    scene.start();
    // The machine starts the conductor once calibration is done — see #29.
    setRunning(true);
    void machine.start();
  };

  const handleStop = () => {
    machineRef.current?.stop();
    stopAll();
    setRunning(false);
  };

  return (
    <div className="dive">
      <div className="dive-stage">
        {/* The scene is decorative: everything it shows is also available as
            text below and in the live region, so nothing is audio-only or
            canvas-only. */}
        <canvas ref={canvasRef} role="presentation" />
        <span className="dive-state">{stateLabel(state)}</span>
      </div>

      {/* Polite, not assertive: a stage change is worth hearing at the next
          pause, never worth interrupting someone mid-breath. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="dive-controls">
        <div className="row">
          {(DEV_TOOLS ? ALL_SOURCES : PLAYABLE_SOURCES).map((option) => (
            <button
              key={option}
              type="button"
              className={option === source ? 'active' : ''}
              disabled={running}
              onClick={() => setSource(option)}
            >
              {SOURCE_LABEL[option](t)}
            </button>
          ))}
          {DEV_TOOLS && source === 'scripted' && (
            <button type="button" disabled={running} onClick={() => setSpeed(speed === 1 ? 10 : 1)}>
              {fill(t.dive.speed, { n: speed })}
            </button>
          )}
          {running ? (
            <button type="button" onClick={handleStop}>
              {t.dive.leave}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => handleStart('full')}>
                {t.dive.full}
              </button>
              <button type="button" onClick={() => handleStart('quick')}>
                {t.dive.quick}
              </button>
            </>
          )}
        </div>

        <dl>
          <div>
            <dt>{t.dive.depth}</dt>
            <dd>{depth.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>{t.dive.rate}</dt>
            <dd>{rate === null ? '—' : `${rate.toFixed(1)}/min`}</dd>
          </div>
          <div>
            <dt>{t.dive.stage}</dt>
            <dd>{stateLabel(state)}</dd>
          </div>
        </dl>

        {result && (
          <SurfaceScreen
            result={result}
            // The input that ran, not the one that was selected. A dive that
            // fell back to the keyboard says keyboard, here and in the export.
            inputLabel={CODE_LABEL[inputCode](t)}
            inputCode={inputCode}
            onLeave={() => setResult(null)}
          />
        )}

        {/* Assertive, unlike the stage announcements: someone who asked for the
            microphone and got the keyboard needs to know before they breathe,
            not at the next pause. */}
        {fallbackReason !== null && (
          <p className="hint" role="alert">
            {fill(t.dive.micRefused, { reason: fallbackReason })}
          </p>
        )}

        <p className="hint">{SOURCE_HINT[source](t)}</p>
      </div>
    </div>
  );
}
