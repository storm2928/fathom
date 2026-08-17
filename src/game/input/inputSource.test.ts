import { test, assert, equal } from '../testing/harness.ts';
import { startInput } from './inputSource.ts';
import type { BreathEngine, BreathEventMap, CalibrationResult } from '../../breath/types.ts';

/**
 * Starting an input, and what happens when the microphone says no.
 *
 * This is the decision `DiveView` cannot make for itself and cannot be tested
 * through: a refused microphone has to be *replaced*, not carried. The engine
 * that failed to start reports `usingFallbackInput` and emits `unusable`, and
 * the session machine ends a dive on either of those — so continuing with it
 * would surface the diver two seconds after they pressed Dive. See #35.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

interface FakeEngine extends BreathEngine {
  readonly started: number;
  readonly stopped: number;
}

/** A stand-in engine. `failStart` makes it refuse the way the microphone does. */
function fakeEngine(failStart: Error | null = null): FakeEngine {
  let started = 0;
  let stopped = 0;
  return {
    start() {
      started += 1;
      return failStart ? Promise.reject(failStart) : Promise.resolve();
    },
    stop() {
      stopped += 1;
    },
    calibrate(): Promise<CalibrationResult> {
      return Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true });
    },
    on<K extends keyof BreathEventMap>(_event: K, _handler: (p: BreathEventMap[K]) => void) {
      return () => {};
    },
    setExhaleExpected() {},
    usingFallbackInput: false,
    get started() {
      return started;
    },
    get stopped() {
      return stopped;
    },
  };
}

test('a microphone that starts is the engine that runs', async () => {
  const mic = fakeEngine();
  const started = await startInput({
    primary: mic,
    code: 'microphone',
    fallback: () => fakeEngine(),
  });

  equal(started.engine, mic, 'a working microphone was swapped out anyway');
  equal(started.code, 'microphone');
  equal(started.fellBack, false);
  equal(mic.started, 1, 'the engine was not started');
});

test('a microphone that is refused hands the dive to the spacebar', async () => {
  const spacebar = fakeEngine();
  const started = await startInput({
    primary: fakeEngine(new Error('Microphone unavailable: NotAllowedError')),
    code: 'microphone',
    fallback: () => spacebar,
  });

  equal(started.engine, spacebar, 'the dive was not handed to the fallback');
  // The dive log records what actually drove the session. A session that says
  // 'microphone' when a keyboard produced every breath is the #32 defect again.
  equal(started.code, 'keyboard', 'the fallback session still claimed the microphone');
  equal(started.fellBack, true);
  equal(spacebar.started, 1, 'the fallback engine was never started');
});

test('the refused microphone is stopped rather than left holding the device', async () => {
  const mic = fakeEngine(new Error('Microphone unavailable: NotAllowedError'));
  await startInput({ primary: mic, code: 'microphone', fallback: () => fakeEngine() });

  equal(mic.stopped, 1, 'the failed engine was left running');
});

test('the reason the microphone was refused survives for the player to read', async () => {
  const started = await startInput({
    primary: fakeEngine(new Error('Microphone unavailable: NotAllowedError')),
    code: 'microphone',
    fallback: () => fakeEngine(),
  });

  assert(
    started.reason !== null && started.reason.includes('NotAllowedError'),
    `the refusal was swallowed: ${String(started.reason)}`,
  );
});

test('an input with no fallback reports its failure rather than swallowing it', async () => {
  // Only the microphone has a fallback. A spacebar or fixture that will not
  // start is a bug, and hiding it behind a silent substitution would mean a
  // broken input looked exactly like a working one.
  let threw = false;
  try {
    await startInput({ primary: fakeEngine(new Error('boom')), code: 'keyboard' });
  } catch {
    threw = true;
  }
  equal(threw, true, 'a failing input with no fallback resolved as though it had started');
});

test('a fallback that also fails to start is not reported as a working dive', async () => {
  let threw = false;
  try {
    await startInput({
      primary: fakeEngine(new Error('Microphone unavailable')),
      code: 'microphone',
      fallback: () => fakeEngine(new Error('the keyboard is on fire')),
    });
  } catch {
    threw = true;
  }
  equal(threw, true, 'a dive with no working input reported success');
});
