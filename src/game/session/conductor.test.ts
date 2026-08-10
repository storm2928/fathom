import { test, assert, equal } from '../testing/harness.ts';
import { BreathConductor, isExhaleGate } from './conductor.ts';
import { PLANS } from './sessionMachine.ts';
import { cycleDuration, cycleForPeriod, periodForRate } from './cycleShape.ts';

/**
 * The one-way rule, pinned.
 *
 * "The adaptive difficulty may only ever SLOW breathing targets" is in the team
 * guide, in the README, and is the first thing a clinician judge is likely to
 * probe. It is enforced in the conductor rather than trusted to callers, so this
 * is where it has to be proved.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

test('the target can be slowed', () => {
  const conductor = new BreathConductor({ targetRR: 12 });
  equal(conductor.slowTo(10), true);
  equal(conductor.targetRR, 10);
});

test('the target cannot be sped up', () => {
  const conductor = new BreathConductor({ targetRR: 12 });
  equal(conductor.slowTo(14), false, 'speeding up was accepted');
  equal(conductor.targetRR, 12, 'the target moved despite being refused');
});

test('the same target is not a change', () => {
  const conductor = new BreathConductor({ targetRR: 12 });
  equal(conductor.slowTo(12), false);
  equal(conductor.targetRR, 12);
});

test('no sequence of calls can end faster than it started', () => {
  const conductor = new BreathConductor({ targetRR: 15 });
  const attempts = [12, 18, 9, 30, 11, 6, 20, 7, 100];
  let previous = conductor.targetRR;
  for (const rate of attempts) {
    conductor.slowTo(rate);
    assert(
      conductor.targetRR <= previous,
      `target rose to ${conductor.targetRR} after asking for ${rate}`,
    );
    previous = conductor.targetRR;
  }
  assert(conductor.targetRR <= 15, 'ended faster than it began');
});

test('slowing the target lengthens the prompted exhale', () => {
  const conductor = new BreathConductor({ targetRR: 15 });
  const before = conductor.currentCycle().exhaleMs;
  conductor.slowTo(9);
  assert(conductor.currentCycle().exhaleMs > before);
});

test('scoring is open before the prompt has started', () => {
  // Calibration and any other free-breathing mode must accept everything
  // without opting in. This is the default that #29 found was not applying.
  const conductor = new BreathConductor({ targetRR: 12 });
  equal(conductor.exhaleExpected, true);
});

test('a gate is recognised by shape, and a non-gate is not', () => {
  equal(isExhaleGate({ setExhaleExpected: () => {} }), true);
  equal(isExhaleGate({}), false);
  equal(isExhaleGate(null), false);
  equal(isExhaleGate('nope'), false);
});

test('attaching a gate hands it the current state immediately', () => {
  const seen: boolean[] = [];
  const conductor = new BreathConductor({ targetRR: 12 });
  equal(conductor.gated, false);
  conductor.attach({ setExhaleExpected: (v: boolean) => seen.push(v) });
  equal(conductor.gated, true);
  equal(seen[0], true, 'a freshly attached gate was not told scoring is open');
});

test('stopping reopens the gate rather than leaving the engine deaf', () => {
  const seen: boolean[] = [];
  const conductor = new BreathConductor({ targetRR: 12 });
  conductor.attach({ setExhaleExpected: (v: boolean) => seen.push(v) });
  conductor.start();
  conductor.stop();
  equal(seen[seen.length - 1], true);
});

test('the advertised session lengths are what the plans actually add up to', () => {
  const CALIBRATION_MS = 10_000;
  const lengthOf = (plan: 'full' | 'quick') => {
    const { factors, zoneMs, surfacingMs } = PLANS[plan];
    return CALIBRATION_MS + factors.length * zoneMs + surfacingMs;
  };

  // "A 90-second Quick Dive" — the label says 90s, so it had better be.
  const quick = lengthOf('quick');
  assert(Math.abs(quick - 90_000) < 5_000, `quick dive is ${quick / 1000}s, not ~90s`);

  // "Five minutes", "~5-7 min" in the team guide.
  const full = lengthOf('full');
  assert(full >= 300_000 && full <= 420_000, `full dive is ${full / 1000}s, outside 5-7 min`);
});

test('every zone in every plan asks for something slower than the last', () => {
  for (const [name, plan] of Object.entries(PLANS)) {
    for (let i = 1; i < plan.factors.length; i += 1) {
      assert(
        plan.factors[i] < plan.factors[i - 1],
        `${name} zone ${i + 1} did not ask for a slower rate than zone ${i}`,
      );
    }
    for (const factor of plan.factors) {
      assert(factor <= 1, `${name} has a factor above 1, which would speed breathing up`);
    }
  }
});

test('a plan target always produces a workable cycle', () => {
  const BASELINE = 15;
  for (const plan of Object.values(PLANS)) {
    for (const factor of plan.factors) {
      const shape = cycleForPeriod(periodForRate(BASELINE * factor));
      assert(shape.exhaleMs > 0 && cycleDuration(shape) > 0);
    }
  }
});
