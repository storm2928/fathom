import { useEffect, useRef, useState } from 'react';
import type { BreathPhase, CalibrationResult, SignalQuality } from '../../../breath/types';
import { ScriptedBreathEngine } from '../scriptedEngine';
import './ScriptedEnginePanel.css';

/**
 * Development harness for the scripted engine. Not product surface — this is
 * how we watch the event stream and exercise the states that are awkward to
 * produce deliberately (a bad signal, someone breathing too fast).
 */

interface LogLine {
  id: number;
  at: number;
  kind: string;
  detail: string;
}

const LOG_LIMIT = 40;
const SIGNAL_LEVELS: SignalQuality[] = ['good', 'degraded', 'unusable'];

export function ScriptedEnginePanel() {
  const engineRef = useRef<ScriptedBreathEngine | null>(null);
  const lineId = useRef(0);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [rr, setRr] = useState<number | null>(null);
  const [lastExhale, setLastExhale] = useState<{ durationMs: number; quality: number } | null>(
    null,
  );
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  const [seed, setSeed] = useState(1);
  const [timeScale, setTimeScale] = useState(4);
  const [quality, setQuality] = useState(0.7);
  const [exhaleScale, setExhaleScale] = useState(1);
  const [signal, setSignal] = useState<SignalQuality>('good');

  const push = (kind: string, detail: string) => {
    lineId.current += 1;
    const line = { id: lineId.current, at: performance.now(), kind, detail };
    setLog((prev) => [line, ...prev].slice(0, LOG_LIMIT));
  };

  const teardown = () => {
    engineRef.current?.stop();
    engineRef.current = null;
  };

  useEffect(() => teardown, []);

  // Live knobs — these reach the running engine without restarting the session.
  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    engineRef.current?.setExhaleScale(exhaleScale);
  }, [exhaleScale]);
  useEffect(() => {
    engineRef.current?.setSignalQuality(signal);
  }, [signal]);

  const handleStart = async () => {
    teardown();
    setLog([]);
    setRr(null);
    setLastExhale(null);
    setCalibration(null);

    const engine = new ScriptedBreathEngine({ seed, timeScale, quality, signalQuality: signal });
    engineRef.current = engine;

    engine.on('phase-change', ({ phase: next, at }) => {
      setPhase(next);
      push('phase', `${next} @ ${(at / 1000).toFixed(1)}s`);
    });
    engine.on('exhale-end', ({ durationMs, quality: q }) => {
      setLastExhale({ durationMs, quality: q });
      push('exhale-end', `${(durationMs / 1000).toFixed(2)}s · quality ${q.toFixed(2)}`);
    });
    engine.on('rr-update', ({ breathsPerMin, confidence }) => {
      setRr(breathsPerMin);
      push('rr-update', `${breathsPerMin.toFixed(1)}/min · confidence ${confidence.toFixed(2)}`);
    });
    engine.on('signal-quality', ({ level }) => {
      push('signal-quality', level);
    });

    await engine.start();
    setRunning(true);
    setExhaleScale(1);
  };

  const handleStop = () => {
    teardown();
    setRunning(false);
    setPhase('idle');
  };

  const handleCalibrate = async () => {
    const engine = engineRef.current;
    if (!engine || calibrating) return;
    setCalibrating(true);
    push('calibrate', 'started');
    const result = await engine.calibrate();
    setCalibration(result);
    setCalibrating(false);
    push(
      'calibrate',
      result.ok
        ? `baseline ${result.baselineRR.toFixed(1)}/min · floor ${result.noiseFloor}`
        : 'failed — signal unusable',
    );
  };

  return (
    <div className="panel">
      <header>
        <h1>Scripted breath engine</h1>
        <p>
          Development harness. No microphone is involved and breathing at this page does
          nothing — it replays a generated cyclic-sighing pattern so the dive can be built
          before the signal engine lands.
        </p>
      </header>

      <section className="controls">
        <div className="row">
          <button type="button" onClick={running ? handleStop : handleStart}>
            {running ? 'Stop' : 'Start'}
          </button>
          <button type="button" onClick={handleCalibrate} disabled={!running || calibrating}>
            {calibrating ? 'Calibrating…' : 'Calibrate'}
          </button>
        </div>

        <label>
          Seed <span className="val">{seed}</span>
          <input
            type="number"
            value={seed}
            min={1}
            disabled={running}
            onChange={(e) => setSeed(Number(e.target.value) || 1)}
          />
          <small>Same seed replays the same session.</small>
        </label>

        <label>
          Time scale <span className="val">{timeScale}×</span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={timeScale}
            disabled={running}
            onChange={(e) => setTimeScale(Number(e.target.value))}
          />
          <small>Runs the arc faster so a five-minute session is watchable.</small>
        </label>

        <label>
          Exhale quality <span className="val">{quality.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </label>

        <label>
          Exhale length <span className="val">{exhaleScale.toFixed(2)}×</span>
          <input
            type="range"
            min={0.3}
            max={1.6}
            step={0.05}
            value={exhaleScale}
            onChange={(e) => setExhaleScale(Number(e.target.value))}
          />
          <small>Below 1× is someone breathing faster than the protocol asks for.</small>
        </label>

        <div className="row signal">
          {SIGNAL_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className={level === signal ? 'active' : ''}
              onClick={() => setSignal(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="readout">
        <div>
          <span className="label">Phase</span>
          <strong data-phase={phase}>{phase}</strong>
        </div>
        <div>
          <span className="label">Rate</span>
          <strong>{rr === null ? '—' : `${rr.toFixed(1)}/min`}</strong>
        </div>
        <div>
          <span className="label">Last exhale</span>
          <strong>
            {lastExhale === null ? '—' : `${(lastExhale.durationMs / 1000).toFixed(2)}s`}
          </strong>
        </div>
        <div>
          <span className="label">Baseline</span>
          <strong>
            {calibration === null ? '—' : `${calibration.baselineRR.toFixed(1)}/min`}
          </strong>
        </div>
      </section>

      <section className="log">
        {log.length === 0 ? (
          <p className="empty">No events yet. Press Start.</p>
        ) : (
          <ol>
            {log.map((line) => (
              <li key={line.id}>
                <code className={`kind kind-${line.kind}`}>{line.kind}</code>
                <span>{line.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
