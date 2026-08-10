import { test, equal } from '../testing/harness.ts';
import { RateEstimator } from './rateEstimator.ts';

/**
 * Regression cover for #29, where the reported respiratory rate came out at
 * exactly half the truth. That number is the before/after result the whole
 * product rests on, so it is the one thing in this lane worth pinning down with
 * assertions rather than a careful reading.
 *
 * Run: node src/game/testing/run.ts
 */

const FOUR_SECOND_CYCLE = [0, 4_000, 8_000, 12_000]; // 15 breaths/min

test('measures onset to onset', () => {
  const rate = new RateEstimator();
  FOUR_SECOND_CYCLE.forEach((at) => rate.mark(at));
  equal(rate.breathsPerMin()?.toFixed(1), '15.0');
});

test('reports nothing until there are two onsets to measure between', () => {
  const rate = new RateEstimator();
  equal(rate.breathsPerMin(), null);
  rate.mark(0);
  equal(rate.breathsPerMin(), null);
});

test('#29: a skipped breath does not halve the rate', () => {
  const rate = new RateEstimator();
  rate.mark(0);
  rate.mark(4_000);
  rate.skip(); // a real breath that is not being scored
  rate.mark(8_000);
  rate.mark(12_000);

  // The old behaviour measured 0 -> 8000 as one cycle and reported 7.5.
  equal(rate.breathsPerMin()?.toFixed(1), '15.0');
});

test('#29: alternating accept and refuse reports nothing, not half', () => {
  const rate = new RateEstimator();
  for (let i = 0; i < 8; i += 1) {
    rate.mark(i * 4_000);
    if (i % 2 === 1) rate.skip();
  }
  // Every surviving interval spans a breath the estimate cannot see, so there
  // is no honest number to give. Nothing beats a plausible wrong answer.
  equal(rate.breathsPerMin(), null);
});

test('a discarded tap leaves its neighbours adjacent', () => {
  const rate = new RateEstimator();
  rate.mark(0);
  rate.mark(1_500);
  rate.discard(); // too short to be a breath: nothing happened here
  rate.mark(4_000);
  rate.mark(8_000);
  equal(rate.breathsPerMin()?.toFixed(1), '15.0');
});

test('discard and skip are not interchangeable', () => {
  const build = (leave: (r: RateEstimator) => void) => {
    const rate = new RateEstimator();
    rate.mark(0);
    rate.mark(4_000);
    leave(rate);
    rate.mark(8_000);
    return rate.breathsPerMin();
  };
  // Discard: 0 and 8000 really are adjacent, so the span is one long cycle.
  equal(build((r) => r.discard())?.toFixed(1), '7.5');
  // Skip: a breath happened in between, so that span is not measurable at all.
  equal(build((r) => r.skip()), null);
});

test('the median ignores a single doubled interval', () => {
  const rate = new RateEstimator();
  // Four 4s cycles and one 8s stumble in the middle.
  [0, 4_000, 8_000, 16_000, 20_000, 24_000].forEach((at) => rate.mark(at));
  equal(rate.breathsPerMin()?.toFixed(1), '15.0');
});

test('reset clears the series and any pending break', () => {
  const rate = new RateEstimator();
  rate.mark(0);
  rate.mark(4_000);
  rate.skip();
  rate.reset();
  rate.mark(0);
  rate.mark(4_000);
  // The break from before the reset must not disqualify this interval.
  equal(rate.breathsPerMin()?.toFixed(1), '15.0');
});
