import { test, equal } from '../testing/harness.ts';
import { MEANINGFUL_DELTA_RR, verdictFor } from './verdict.ts';

/** One rule for every screen that states the result: inside the noise is "no change". */

test('a change inside the noise is no change, in both directions', () => {
  equal(verdictFor(0), 'unchanged');
  equal(verdictFor(MEANINGFUL_DELTA_RR - 0.01), 'unchanged');
  equal(verdictFor(-(MEANINGFUL_DELTA_RR - 0.01)), 'unchanged');
});

test('slowing and speeding up are reported as what they are', () => {
  equal(verdictFor(MEANINGFUL_DELTA_RR), 'slowed');
  equal(verdictFor(-MEANINGFUL_DELTA_RR), 'sped');
});
