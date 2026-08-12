/**
 * #15, the one-way rule, from the signal side.
 *
 * "The adaptive difficulty may only ever SLOW breathing targets" is in the team
 * guide and in the README, and it is the first thing a clinician judge is likely
 * to probe. A system that shortened the exhale target under a good score would
 * be training the opposite of what the protocol is for. So it is enforced here
 * rather than intended, and the test that matters is the one that tries to break
 * it with an adversarial sequence rather than a happy path.
 */

import { test, equal } from '../game/testing/harness.ts';
import {
  MAX_TARGET_MS,
  MIN_TARGET_MS,
  createExhaleTarget,
} from './exhaleTarget.ts';
import { DEFAULT_DETECTOR_OPTIONS } from './detector.ts';

test('the starting target comes from the measured baseline, not a constant', () => {
  const slow = createExhaleTarget();
  slow.seed(8); // 7.5s cycle

  const fast = createExhaleTarget();
  fast.seed(20); // 3s cycle

  equal(slow.ms > fast.ms, true, 'a slower breather should start on a longer target');
  equal(slow.ms !== DEFAULT_DETECTOR_OPTIONS.targetExhaleMs, true, 'not the hardcoded default');
});

test('a request lengthens the target', () => {
  const target = createExhaleTarget();
  target.seed(12);
  const started = target.ms;

  target.request(started + 2000);

  equal(target.ms, started + 2000);
});

test('a shorter request does not shorten the target', () => {
  const target = createExhaleTarget();
  target.seed(12);
  target.request(8000);

  target.request(4000);

  equal(target.ms, 8000, 'the target must not follow a request downward');
});

test('no sequence of calls can leave the target shorter than it started', () => {
  // The checkbox from #15 that exists to fail if a future change ever lets a
  // target speed up. Deliberately adversarial rather than a happy path.
  const target = createExhaleTarget();
  target.seed(12);
  const started = target.ms;

  const hostile = [9000, 1000, 7000, 0, -5000, 500, 6000, 2000, Number.NaN, 100];
  let previous = started;
  for (const ms of hostile) {
    target.request(ms);
    equal(target.ms >= previous, true, `request(${ms}) shortened the target`);
    equal(target.ms >= started, true, `request(${ms}) went below the start`);
    previous = target.ms;
  }
});

test('a seed is ignored once the session has started adapting', () => {
  // Otherwise a late calibration read would be a way to shorten the target
  // without any request ever doing so, which is the same rule broken sideways.
  const target = createExhaleTarget();
  target.seed(12);
  target.request(9000);

  target.seed(30); // a very fast baseline, arriving late

  equal(target.ms, 9000);
});

test('the target stops rising however well someone performs', () => {
  // The floor from #15: there is a point past which we do not ask for more,
  // however good the diver is. Breath work is not a breath-hold contest.
  const target = createExhaleTarget();
  target.seed(12);

  target.request(60_000);

  equal(target.ms, MAX_TARGET_MS);
});

test('the ceiling stays inside what the detector will score as a breath', () => {
  // A target the detector would reject as too long would ask the diver for a
  // breath that scores zero for being exactly what was asked. The two bounds
  // have to stay consistent, and nothing else checks that they do.
  equal(
    MAX_TARGET_MS < DEFAULT_DETECTOR_OPTIONS.maxExhaleMs,
    true,
    `ceiling ${MAX_TARGET_MS} must sit below maxExhaleMs ${DEFAULT_DETECTOR_OPTIONS.maxExhaleMs}`,
  );
});

test('an unreadable baseline does not produce an absurd target', () => {
  const zero = createExhaleTarget();
  zero.seed(0);
  equal(zero.ms >= MIN_TARGET_MS && zero.ms <= MAX_TARGET_MS, true, `got ${zero.ms}`);

  const nonsense = createExhaleTarget();
  nonsense.seed(Number.NaN);
  equal(
    nonsense.ms >= MIN_TARGET_MS && nonsense.ms <= MAX_TARGET_MS,
    true,
    `got ${nonsense.ms}`,
  );
});

test('a new session starts over rather than inheriting the last one', () => {
  // Session two must not open on the slowest target session one reached. That
  // would be adaptive difficulty that ratchets across sessions, which is a
  // harder ask every time someone comes back.
  const target = createExhaleTarget();
  target.seed(12);
  target.request(MAX_TARGET_MS);

  target.reset();
  target.seed(12);

  equal(target.ms < MAX_TARGET_MS, true, 'the ratchet should not survive a reset');
});
