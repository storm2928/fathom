import { useEffect, useRef, useState } from 'react';
import { BreathConductor } from '../session/conductor';
import { SessionMachine } from '../session/sessionMachine';
import type { SessionResult, SessionState } from '../session/sessionMachine';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { DiveScene } from './diveScene';
import './DiveView.css';

/**
 * Mounts a full session against whichever input source is selected. This is a
 * development shell — the scope screen, onboarding and crisis rail land in #17
 * and #18, and the surface screen proper is #16.
 */

type Source = 'scripted' | 'spacebar';

const STATE_LABEL: Record<SessionState, string> = {
  idle: 'Ready',
  calibrating: 'Reading your baseline',
  'zone-1': 'Zone 1',
  'zone-2': 'Zone 2',
  'zone-3': 'Zone 3',
  surfacing: 'Surfacing',
  ended: 'Done',
};

export function DiveView() {
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

  const handleStart = async () => {
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
      timeScale,
      onState: setState,
      onResult: (finished) => {
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
        <span className="dive-state">{STATE_LABEL[state]}</span>
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
              {option === 'scripted' ? 'Scripted fixture' : 'Spacebar'}
            </button>
          ))}
          {source === 'scripted' && (
            <button type="button" disabled={running} onClick={() => setSpeed(speed === 1 ? 10 : 1)}>
              {speed}× speed
            </button>
          )}
          <button type="button" onClick={running ? handleStop : handleStart}>
            {running ? 'Leave' : 'Dive'}
          </button>
        </div>

        <dl>
          <div>
            <dt>Depth</dt>
            <dd>{depth.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{rate === null ? '—' : `${rate.toFixed(1)}/min`}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{STATE_LABEL[state]}</dd>
          </div>
        </dl>

        {result && (
          <div className="dive-result">
            <h2>What changed</h2>
            {result.ending === 'signal-lost' ? (
              <p>
                The dive ended early because the signal stopped being readable. Nothing was
                measured well enough to report, which is worth knowing rather than guessing at.
              </p>
            ) : (
              <>
                <p>
                  Your breathing went from{' '}
                  <strong>{result.baselineRR.toFixed(1)}</strong> to{' '}
                  <strong>{result.finalRR.toFixed(1)}</strong> breaths per minute
                  {result.deltaRR > 0.2
                    ? `, a drop of ${result.deltaRR.toFixed(1)}.`
                    : '. That is roughly where you started.'}
                </p>
                <p className="muted">
                  {result.downshiftMs === null
                    ? 'Not enough change to time a downshift this session.'
                    : `Half of that change had happened ${(result.downshiftMs / 1000).toFixed(0)}s in.`}{' '}
                  {result.scoredBreaths} breaths measured over{' '}
                  {(result.durationMs / 1000 / 60).toFixed(1)} minutes
                  {result.usedFallbackInput ? ', without the microphone' : ''}.
                </p>
              </>
            )}
            <p className="muted">
              This measures how your breathing changed during one session. It is not therapy,
              not diagnosis, and not for a crisis.
            </p>
          </div>
        )}

        <p className="hint">
          {source === 'spacebar'
            ? 'Hold the spacebar for as long as you are exhaling, following the prompt in the top right of the scene. Longer, steadier exhales carry you further.'
            : 'The scripted fixture is breathing for you, following the prompt. Switch to the spacebar to drive it yourself.'}
        </p>
      </div>
    </div>
  );
}
