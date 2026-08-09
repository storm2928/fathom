import { useEffect, useRef, useState } from 'react';
import { BreathConductor } from '../session/conductor';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { DiveScene } from './diveScene';
import './DiveView.css';

/**
 * Mounts the graybox dive against whichever input source is selected. This is a
 * development shell, not the product entry point — onboarding, the scope screen
 * and the session arc land in #9 and #17.
 */

type Source = 'scripted' | 'spacebar';

export function DiveView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DiveScene | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const engineRef = useRef<ScriptedBreathEngine | SpacebarBreathEngine | null>(null);
  const conductorRef = useRef<BreathConductor | null>(null);

  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<Source>('scripted');
  const [depth, setDepth] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [lastExhale, setLastExhale] = useState<number | null>(null);

  const stopAll = () => {
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

  // The readout is sampled rather than driven by events, so a 60Hz scene does
  // not push 60 React renders a second at it.
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
    setLastExhale(null);

    const conductor = new BreathConductor({ targetRR: 12 });
    const engine: ScriptedBreathEngine | SpacebarBreathEngine =
      source === 'spacebar'
        ? new SpacebarBreathEngine()
        : new ScriptedBreathEngine({ follow: conductor });
    conductor.attach(engine);

    const scene = new DiveScene(canvas);
    teardownRef.current = scene.attach(engine, conductor);

    engine.on('rr-update', ({ breathsPerMin }) => setRate(breathsPerMin));
    engine.on('exhale-end', ({ durationMs }) => setLastExhale(durationMs));

    sceneRef.current = scene;
    engineRef.current = engine;
    conductorRef.current = conductor;

    scene.start();
    await engine.start();
    conductor.start();
    setRunning(true);
  };

  const handleStop = () => {
    stopAll();
    setRunning(false);
  };

  return (
    <div className="dive">
      <div className="dive-stage">
        <canvas ref={canvasRef} />
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
          <button type="button" onClick={running ? handleStop : handleStart}>
            {running ? 'Stop' : 'Dive'}
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
            <dt>Last exhale</dt>
            <dd>{lastExhale === null ? '—' : `${(lastExhale / 1000).toFixed(2)} s`}</dd>
          </div>
        </dl>

        <p className="hint">
          {source === 'spacebar'
            ? 'Hold the spacebar for as long as you are exhaling, following the prompt in the top right. Longer, steadier exhales carry you further.'
            : 'The scripted fixture is breathing for you, following the prompt. Switch to the spacebar to drive it yourself.'}
        </p>
      </div>
    </div>
  );
}
