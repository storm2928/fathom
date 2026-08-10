import { test, assert } from '../testing/harness.ts';
import { MIN_EXHALE_MS, cycleDuration, cycleForPeriod, periodForRate } from './cycleShape.ts';

/**
 * The prompt geometry. What matters here is not the exact numbers but the shape
 * of the relationship: as someone downshifts, the exhale should take a growing
 * share of the cycle. That widening ratio is the thing the protocol trains, so a
 * change that flattened it would quietly turn the prompt into ordinary slow
 * breathing while every number still looked fine.
 *
 * Run: node src/game/testing/run.ts
 */

const at = (breathsPerMin: number) => cycleForPeriod(periodForRate(breathsPerMin));

test('the cycle adds up to the period it was asked for', () => {
  for (const rate of [15, 12, 10, 8]) {
    const period = periodForRate(rate);
    assert(
      Math.abs(cycleDuration(cycleForPeriod(period)) - period) < 1,
      `cycle at ${rate}/min did not sum to its period`,
    );
  }
});

test('exhale dominance grows as the rate slows', () => {
  const ratio = (rate: number) => {
    const c = at(rate);
    return c.exhaleMs / (c.inhaleMs + c.topUpMs);
  };
  assert(ratio(8) > ratio(12), 'exhale share did not grow between 12 and 8');
  assert(ratio(12) > ratio(15), 'exhale share did not grow between 15 and 12');
  // At a settled pace the exhale should be clearly the dominant half.
  assert(ratio(8) > 1.8, `exhale was only ${ratio(8).toFixed(2)}x the inhale at 8/min`);
});

test('every part of the cycle is positive at any plausible rate', () => {
  for (let rate = 20; rate >= 5; rate -= 1) {
    const c = at(rate);
    for (const [name, value] of Object.entries(c)) {
      assert(value > 0, `${name} was ${value} at ${rate}/min`);
    }
  }
});

test('the exhale never drops below the floor, even at an absurd rate', () => {
  // 30/min leaves less room than the inhale side needs; the floor has to hold
  // rather than the exhale going negative.
  assert(at(30).exhaleMs >= MIN_EXHALE_MS);
  assert(at(60).exhaleMs >= MIN_EXHALE_MS);
});

test('slowing the target lengthens the exhale', () => {
  let previous = 0;
  for (let rate = 20; rate >= 6; rate -= 1) {
    const exhale = at(rate).exhaleMs;
    assert(exhale >= previous, `exhale shortened when slowing to ${rate}/min`);
    previous = exhale;
  }
});

test('jitter perturbs the shape without breaking it', () => {
  const jittered = cycleForPeriod(periodForRate(12), () => 1.1);
  for (const [name, value] of Object.entries(jittered)) {
    assert(value > 0, `${name} was ${value} under jitter`);
  }
  assert(jittered.exhaleMs >= MIN_EXHALE_MS);
});
