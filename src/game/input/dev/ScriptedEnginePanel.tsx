import { useEffect, useRef, useState } from 'react';
import type { BreathPhase, CalibrationResult, SignalQuality } from '../../../breath/types';
import { BreathConductor } from '../../session/conductor';
import type { PromptStep } from '../../session/conductor';
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
  const conductorRef = useRef<BreathConductor | null>(null);
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

  const [followPrompt, setFollowPrompt] = useState(true);
  const [step, setStep] = useState<PromptStep>('inhale');
  const [expected, setExpected] = useState(true);
  const [targetRR, setTargetRR] = useState(12);

  const push = (kind: string, detail: string) => {
    lineId.current += 1;
    const line = { id: lineId.current, at: performance.now(), kind, detail };
    setLog((prev) => [line, ...prev].slice(0, LOG_LIMIT));
  };

  const teardown = () => {
    conductorRef.current?.stop();
    conductorRef.current = null;
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

    // The conductor is built first because the engine may follow it, then the
    // gate is attached back the other way — see BreathConductor.attach.
    const conductor = new BreathConductor({ targetRR, timeScale });
    const engine = new ScriptedBreathEngine({
      seed,
      timeScale,
      quality,
      signalQuality: signal,
      follow: followPrompt ? conductor : undefined,
    });
    conductor.attach(engine);
    conductorRef.current = conductor;
    engineRef.current = engine;

    conductor.on((window) => {
      setStep(window.step);
      setExpected(window.exhaleExpected);
      if (window.step === 'inhale' || window.step === 'exhale') {
        push('prompt', `${window.step} · scoring ${window.exhaleExpected ? 'open' : 'closed'}`);
      }
    });

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
    conductor.start();
    setRunning(true);
    setExhaleScale(1);
  };

  const handleRetarget = (breathsPerMin: number) => {
    const conductor = conductorRef.current;
    if (!conductor) return;
    const accepted = conductor.slowTo(breathsPerMin);
    setTargetRR(conductor.targetRR);
    push(
      'target',
      accepted
        ? `slowed to ${conductor.targetRR.toFixed(0)}/min`
        : `refused ${breathsPerMin.toFixed(0)}/min — the target may only ever slow`,
    );
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

        <div className="row">
          <button
            type="button"
            className={followPrompt ? 'active' : ''}
            disabled={running}
            onClick={() => setFollowPrompt((v) => !v)}
          >
            {followPrompt ? 'Following the prompt' : 'Free-running'}
          </button>
          <button type="button" disabled={!running} onClick={() => handleRetarget(targetRR - 1)}>
            Slow to {targetRR - 1}/min
          </button>
          <button type="button" disabled={!running} onClick={() => handleRetarget(targetRR + 1)}>
            Try to speed up
          </button>
        </div>
        <small className="note">
          Free-running lets the fixture drift against the prompt, so exhales landing in the
          inhale window get refused rather than scored — that is the gate from #27 doing its
          job. Speeding the target up is refused by design.
        </small>
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
        <div>
          <span className="label">Prompt</span>
          <strong data-phase={step === 'exhale' ? 'exhale' : undefined}>{step}</strong>
        </div>
        <div>
          <span className="label">Scoring</span>
          <strong data-gate={expected ? 'open' : 'closed'}>{expected ? 'open' : 'closed'}</strong>
        </div>
        <div>
          <span className="label">Target</span>
          <strong>{targetRR.toFixed(0)}/min</strong>
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
