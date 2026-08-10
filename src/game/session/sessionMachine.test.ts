import { test, assert, equal } from '../testing/harness.ts';
import { BreathConductor } from './conductor.ts';
import { SessionMachine } from './sessionMachine.ts';
import type { SessionResult, SessionState } from './sessionMachine.ts';
import type {
  BreathEngine,
  BreathEventMap,
  CalibrationResult,
} from '../../breath/types.ts';

/**
 * The arc, driven end to end against a stand-in engine.
 *
 * These are the wiring bugs that unit tests of the parts cannot catch. #29 was
 * exactly that shape: every piece behaved correctly on its own, and the defect
 * was that the prompt had already started gating by the time calibration ran.
 * The first test here fails on that bug.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

/** Fast enough that a ninety-second dive finishes inside a test. */
const FAST = 500;

type Handler = (payload: never) => void;

/** A BreathEngine that does what the test tells it to and records the gate. */
class StubEngine implements BreathEngine {
  readonly usingFallbackInput = true;
  readonly gateCalls: { expected: boolean; duringCalibration: boolean }[] = [];

  private handlers = new Map<keyof BreathEventMap, Set<Handler>>();
  private calibrating = false;
  private readonly calibration: CalibrationResult;

  constructor(calibration: CalibrationResult) {
    this.calibration = calibration;
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {}

  calibrate(): Promise<CalibrationResult> {
    this.calibrating = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.calibrating = false;
        resolve(this.calibration);
      }, 20);
    });
  }

  on<K extends keyof BreathEventMap>(
    event: K,
    handler: (payload: BreathEventMap[K]) => void,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
    return () => {
      set.delete(handler as Handler);
    };
  }

  setExhaleExpected(expected: boolean): void {
    this.gateCalls.push({ expected, duringCalibration: this.calibrating });
  }

  emit<K extends keyof BreathEventMap>(event: K, payload: BreathEventMap[K]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      (handler as (p: BreathEventMap[K]) => void)(payload);
    }
  }
}

const ok: CalibrationResult = { baselineRR: 15, noiseFloor: 0.004, ok: true };

function run(
  engine: StubEngine,
  options: { plan?: 'full' | 'quick' } = {},
): Promise<{ result: SessionResult; states: SessionState[]; conductor: BreathConductor }> {
  const conductor = new BreathConductor({ targetRR: 15, timeScale: FAST });
  conductor.attach(engine);
  const states: SessionState[] = [];

  return new Promise((resolve) => {
    const machine = new SessionMachine(engine, conductor, {
      plan: options.plan ?? 'quick',
      timeScale: FAST,
      onState: (state) => states.push(state),
      onResult: (result) => resolve({ result, states, conductor }),
    });
    void machine.start();
  });
}

test('#29: the gate is never closed while calibration is running', async () => {
  const engine = new StubEngine(ok);
  await run(engine);

  const closedDuringCalibration = engine.gateCalls.filter(
    (call) => call.duringCalibration && call.expected === false,
  );
  assert(
    closedDuringCalibration.length === 0,
    'the prompt was gating during the baseline read — the very breaths the ' +
      'baseline is made of would be refused',
  );
});

test('the arc runs calibrate, one zone, surfacing, ended on a quick dive', async () => {
  const { states } = await run(new StubEngine(ok));
  equal(states.join(' > '), 'calibrating > zone-1 > surfacing > ended');
});

test('the full arc runs three zones', async () => {
  const { states } = await run(new StubEngine(ok), { plan: 'full' });
  equal(states.join(' > '), 'calibrating > zone-1 > zone-2 > zone-3 > surfacing > ended');
});

test('the session ends itself without anyone asking it to', async () => {
  const { result } = await run(new StubEngine(ok));
  equal(result.ending, 'completed');
});

test('the prompt is slower at the end than the measured baseline', async () => {
  const { conductor } = await run(new StubEngine(ok));
  assert(
    conductor.targetRR < ok.baselineRR,
    `target finished at ${conductor.targetRR}, not slower than the ${ok.baselineRR} baseline`,
  );
});

test('a calibration that could not read the room ends the session', async () => {
  const failed: CalibrationResult = { baselineRR: 15, noiseFloor: 0.05, ok: false };
  const { result, states } = await run(new StubEngine(failed));
  equal(result.ending, 'signal-lost');
  assert(!states.includes('zone-1'), 'the dive started despite an unusable baseline');
});

test('losing the signal mid-dive surfaces early rather than carrying on', async () => {
  const engine = new StubEngine(ok);
  const pending = run(engine);
  // Let calibration finish and the first zone begin, then pull the signal.
  await new Promise((r) => setTimeout(r, 60));
  engine.emit('signal-quality', { level: 'unusable' });
  const { result } = await pending;
  equal(result.ending, 'signal-lost');
});

test('the reported delta is the measured difference, in the right direction', async () => {
  const engine = new StubEngine(ok);
  const pending = run(engine);
  await new Promise((r) => setTimeout(r, 60));
  // Breathing settles to 9/min over the final zone.
  for (let i = 0; i < 4; i += 1) {
    engine.emit('rr-update', { breathsPerMin: 9, confidence: 0.9 });
    await new Promise((r) => setTimeout(r, 10));
  }
  const { result } = await pending;

  equal(result.baselineRR, 15);
  assert(result.finalRR < 15, `final rate was ${result.finalRR}, not below baseline`);
  assert(
    Math.abs(result.deltaRR - (result.baselineRR - result.finalRR)) < 0.001,
    'delta did not equal baseline minus final',
  );
  assert(result.deltaRR > 0, 'a slowdown was not reported as positive');
});

test('the plan travels into the result so an exported log says what was run', async () => {
  const quick = await run(new StubEngine(ok), { plan: 'quick' });
  equal(quick.result.plan, 'quick');
  const full = await run(new StubEngine(ok), { plan: 'full' });
  equal(full.result.plan, 'full');
});
