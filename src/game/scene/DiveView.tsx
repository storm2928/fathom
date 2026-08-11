import { useEffect, useRef, useState } from 'react';
import { BreathConductor } from '../session/conductor';
import { SessionMachine } from '../session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '../session/sessionMachine';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { DiveScene, createDiveRenderer } from './diveScene';
import { SurfaceScreen } from '../surface/SurfaceScreen';
import { useLanguage } from '../../shell/i18n';
import { fill } from '../../shell/strings';
import './DiveView.css';

/**
 * Mounts a full session against whichever input source is selected. This is
 * still a development shell: it exposes the scripted fixture and a speed
 * control that no player should ever see.
 */

type Source = 'scripted' | 'spacebar';

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
  const engineRef = useRef<ScriptedBreathEngine | SpacebarBreathEngine | null>(null);
  const conductorRef = useRef<BreathConductor | null>(null);
  const machineRef = useRef<SessionMachine | null>(null);

  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<Source>('scripted');
  const [speed, setSpeed] = useState(10);
  const [state, setState] = useState<SessionState>('idle');
  const [depth, setDepth] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [announcement, setAnnouncement] = useState('');

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

    // A person cannot be fast-forwarded, so the spacebar always runs real time.
    const timeScale = source === 'spacebar' ? 1 : speed;
    const conductor = new BreathConductor({ targetRR: 15, timeScale });
    const engine: ScriptedBreathEngine | SpacebarBreathEngine =
      source === 'spacebar'
        ? new SpacebarBreathEngine({ calibrationMs: 10_000 })
        : new ScriptedBreathEngine({ follow: conductor, timeScale });
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
    engineRef.current = engine;
    conductorRef.current = conductor;
    machineRef.current = machine;

    scene.start();
    await engine.start();
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
          {(['scripted', 'spacebar'] as Source[]).map((option) => (
            <button
              key={option}
              type="button"
              className={option === source ? 'active' : ''}
              disabled={running}
              onClick={() => setSource(option)}
            >
              {option === 'scripted' ? t.dive.scripted : t.dive.spacebar}
            </button>
          ))}
          {source === 'scripted' && (
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
            inputLabel={source === 'spacebar' ? t.dive.inputKeyboard : t.dive.inputScripted}
            inputCode={source === 'spacebar' ? 'keyboard' : 'scripted'}
            onLeave={() => setResult(null)}
          />
        )}

        <p className="hint">
          {source === 'spacebar'
            ? t.dive.hintSpacebar
            : t.dive.hintScripted}
        </p>
      </div>
    </div>
  );
}
