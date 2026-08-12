/**
 * #27 through the real engine: detector, gate and rate estimator wired together,
 * driven by synthesised frames instead of a microphone.
 *
 * The unit tests either side of this one can both pass while the wiring between
 * them is wrong — that is exactly the shape #29 turned out to have, where every
 * part behaved correctly alone. So this drives the assembled engine and asserts
 * on the two things a clinician judge would actually check: which breaths were
 * scored, and what respiratory rate came out.
 *
 * The session simulated below is a breather whose inhale is audible, which is
 * the case the gate exists for. Their true rate is 12/min.
 */

import { test, equal } from '../game/testing/harness.ts';
import type {
  AppliedSettings,
  CaptureFrame,
  CaptureFrameListener,
  MicCapture,
} from './capture.ts';
import { createBreathEngine } from './engine.ts';

const SETTINGS: AppliedSettings = {
  sampleRate: 48000,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  deviceLabel: 'fake',
  processingVerdict: 'clean',
};

interface FakeCapture extends MicCapture {
  emit(frame: CaptureFrame): void;
}

function createFakeCapture(): FakeCapture {
  const listeners = new Set<CaptureFrameListener>();
  return {
    start: () => Promise.resolve(SETTINGS),
    stop: () => Promise.resolve(),
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get running() {
      return true;
    },
    get settings() {
      return SETTINGS;
    },
    emit(frame) {
      for (const listener of listeners) listener(frame);
    },
  };
}

const FRAME_MS = 20;
const QUIET = 1e-4;
/** ~15dB over the floor: clear of the 9dB open threshold without clipping. */
const LOUD = QUIET * 5.62;

function frameAt(t: number, breathing: boolean): CaptureFrame {
  const level = breathing ? LOUD : QUIET;
  return {
    t,
    peak: breathing ? 0.1 : 0.001,
    level,
    // Breath is broadband: high well above voice, clearing minBandRatio of 0.6.
    voice: level * 0.25,
    high: level * 0.75,
    zcr: 0.2,
  };
}

/** A window of audible breath, in ms on the audio clock. */
interface Sound {
  from: number;
  to: number;
}

/**
 * Plays a timeline of sounds through the engine, calling `onTick` before each
 * frame so a test can move the prompt window mid-session.
 */
function play(
  capture: FakeCapture,
  sounds: Sound[],
  untilMs: number,
  onTick: (t: number) => void,
): void {
  for (let t = 0; t <= untilMs; t += FRAME_MS) {
    onTick(t);
    const breathing = sounds.some((s) => t >= s.from && t < s.to);
    capture.emit(frameAt(t, breathing));
  }
}

/**
 * A breather at 12/min whose inhale is audible enough to detect. Exhales open at
 * 1000, 6000 and 11000 — 5s apart — and each is followed by an audible inhale
 * that the prompt window will be closed over.
 */
const EXHALES: Sound[] = [
  { from: 1000, to: 3500 },
  { from: 6000, to: 8500 },
  { from: 11000, to: 13500 },
];
const INHALES: Sound[] = [
  { from: 4000, to: 5000 },
  { from: 9000, to: 10000 },
];

/** Closed across each audible inhale, open everywhere else. */
function windowAt(t: number): boolean {
  return !INHALES.some((s) => t >= s.from - 200 && t < s.to + 200);
}

async function runSession(gated: boolean): Promise<{
  scored: number[];
  rates: number[];
  phases: string[];
}> {
  const capture = createFakeCapture();
  const engine = createBreathEngine({ capture });

  const scored: number[] = [];
  const rates: number[] = [];
  const phases: string[] = [];

  engine.on('exhale-end', ({ durationMs }) => scored.push(durationMs));
  engine.on('rr-update', ({ breathsPerMin }) => rates.push(breathsPerMin));
  engine.on('phase-change', ({ phase }) => phases.push(phase));

  await engine.start();
  play(capture, [...EXHALES, ...INHALES], 14000, (t) => {
    if (gated) engine.setExhaleExpected(windowAt(t));
  });
  engine.stop();

  return { scored, rates, phases };
}

test('the gate scores the prompted exhales and refuses the audible inhales', async () => {
  const { scored } = await runSession(true);

  equal(scored.length, 3, 'three prompted exhales should be scored');
  for (const durationMs of scored) {
    equal(durationMs > 2000, true, `a scored breath ran ${durationMs}ms, expected ~2500`);
  }
});

test('the audible inhale is detected without the gate, which is why #27 exists', async () => {
  // Guards the test above from passing because the fixture is too quiet to
  // detect. If the inhales stop being heard at all, this fails and says so.
  const { scored } = await runSession(false);

  equal(scored.length, 5, 'ungated, both inhales should also be scored');
});

test('#27: a suppressed inhale does not inflate the reported rate', async () => {
  const { rates } = await runSession(true);
  const final = rates.at(-1);

  // Onsets 1000, 6000, 11000 — 5s apart — is 12/min, the truth.
  equal(final !== undefined, true, 'a rate should be reported');
  equal(final?.toFixed(1), '12.0');
});

test('#27: without the gate the same session reports roughly double', async () => {
  // The bug as measured on the first real session: counting the inhale as a
  // breath overstated the rate. This is what the gate is buying.
  const { rates } = await runSession(false);
  const final = rates.at(-1);

  equal(final !== undefined && final > 20, true, `ungated rate was ${final}, expected >20`);
});

test('#27: a suppressed breath does not halve the rate either', async () => {
  // The other way to get this wrong. Treating the refused inhale as a real
  // breath that merely went uncounted would break the interval chain on every
  // cycle, and the estimate would report nothing at all for this breather —
  // losing the objective number for exactly the people the gate is for.
  const { rates } = await runSession(true);

  equal(rates.length > 0, true, 'the gate must not silence the rate estimate');
  equal(
    rates.every((rate) => rate > 8 && rate < 16),
    true,
    `rates should sit near 12/min, got ${rates.join(', ')}`,
  );
});

test('a refused breath still moves the phase, because that is observation', async () => {
  // The scene keeps responding to what the microphone hears. The gate governs
  // measurement, not what the diver is allowed to see.
  const { phases } = await runSession(true);
  const exhales = phases.filter((phase) => phase === 'exhale').length;

  equal(exhales, 5, 'all five sounds should show as phase changes');
});

test('an engine that is never told about the window scores everything', async () => {
  // Calibration is a free-breathing read. It must not have to opt in.
  const { scored } = await runSession(false);

  equal(scored.length, 5);
});

/* ------------------------------------------------------------------ #15 ---- */

/** A breather at 8/min: onsets 7.5s apart, three of them. */
const SLOW_EXHALES: Sound[] = [
  { from: 1000, to: 4000 },
  { from: 8500, to: 11500 },
  { from: 16000, to: 19000 },
];

test('calibration sets the exhale target from the measured baseline', async () => {
  const capture = createFakeCapture();
  const engine = createBreathEngine({ capture });

  await engine.start();
  const pending = engine.calibrate();
  play(capture, SLOW_EXHALES, 20000, () => {});
  const result = await pending;

  equal(result.ok, true, 'the fixture should produce a readable baseline');
  equal(Math.round(result.baselineRR), 8, `baseline read as ${result.baselineRR}`);
  // 8/min is a 7.5s cycle, and the starting yardstick is half of it.
  equal(engine.exhaleTargetMs, 3750);
});

test('the same breath scores lower against a longer target', async () => {
  // What #15 is actually for. With the target hardcoded this number could not
  // move, so a slow breather got full marks for doing nothing.
  async function qualityWithTarget(targetMs: number): Promise<number> {
    const capture = createFakeCapture();
    const engine = createBreathEngine({ capture });
    const scores: number[] = [];
    engine.on('exhale-end', ({ quality }) => scores.push(quality));

    await engine.start();
    engine.setExhaleTarget(targetMs);
    play(capture, [{ from: 1000, to: 3500 }], 5000, () => {});
    engine.stop();

    return scores[0];
  }

  const easy = await qualityWithTarget(3000);
  const hard = await qualityWithTarget(9000);

  equal(easy > hard, true, `expected ${easy} > ${hard}`);
});

test('#15: the engine refuses to have its target shortened', async () => {
  const capture = createFakeCapture();
  const engine = createBreathEngine({ capture });
  await engine.start();

  engine.setExhaleTarget(9000);
  engine.setExhaleTarget(4000);

  equal(engine.exhaleTargetMs, 9000, 'a shorter prompt must not speed the target up');
});

test('#15: a new session does not inherit the last one’s target', async () => {
  const capture = createFakeCapture();
  const engine = createBreathEngine({ capture });

  await engine.start();
  engine.setExhaleTarget(11000);
  engine.stop();

  await engine.start();

  equal(engine.exhaleTargetMs < 11000, true, 'the ratchet should not survive a session');
});
