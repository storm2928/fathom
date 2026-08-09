import { useEffect, useRef, useState } from 'react';
import { BreathConductor } from '../session/conductor';
import { SessionMachine } from '../session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '../session/sessionMachine';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { DiveScene } from './diveScene';
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

    const scene = new DiveScene(canvas);
    teardownRef.current = scene.attach(engine, conductor);
    engine.on('rr-update', ({ breathsPerMin }) => setRate(breathsPerMin));

    const machine = new SessionMachine(engine, conductor, {
      plan,
      timeScale,
      onState: setState,
      onResult: (finished) => {
        // Sampling stops with `running`, so take a last reading here or the
        // readout freezes mid-glide while the canvas carries on easing down.
        setDepth(scene.depth);
        setResult(finished);
        setRunning(false);
      },
    });

    sceneRef.current = scene;
    engineRef.current = engine;
    conductorRef.current = conductor;
    machineRef.current = machine;

    scene.start();
    await engine.start();
    conductor.start();
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
        <canvas ref={canvasRef} />
        <span className="dive-state">{stateLabel(state)}</span>
      </div>

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
