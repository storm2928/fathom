import { test, assert, equal } from '../testing/harness.ts';
import { ENTRY_DESCENDING_THETA, SPLASH_AT, entryPose, seatY } from './entry.ts';

/**
 * The backward roll off the boat. Positions are offsets from the diver's fixed
 * point, in pixels, for a body length L and a waterline S pixels above it.
 */

const L = 80;
const S = 70;
const waterline = -S;
const at = (u: number, reduced = false) => entryPose(u, L, S, reduced);

test('aboard, the diver sits upright above the waterline with legs folded into the boat', () => {
  const p = at(0);
  equal(p.theta, 0);
  equal(p.legFold, 1);
  equal(p.alpha, 1);
  equal(p.y, seatY(L, S));
  assert(p.y < waterline - 0.3 * L, 'the seated diver is not above the water');
});

test('the roll ends at the fixed point, head down, legs straight', () => {
  const p = at(1);
  equal(p.x, 0);
  equal(p.y, 0);
  equal(p.theta, ENTRY_DESCENDING_THETA);
  equal(p.legFold, 0);
});

test('the diver goes through the waterline once, exactly at the splash', () => {
  assert(Math.abs(at(SPLASH_AT).y - waterline) < 1e-6, 'the splash is not at the waterline');
  for (let i = 0; i <= 400; i += 1) {
    const u = i / 400;
    const y = at(u).y;
    if (u < SPLASH_AT - 1e-9) assert(y < waterline, `under the water before the splash, at ${u}`);
    if (u > SPLASH_AT + 1e-9) assert(y > waterline, `back above the water after the splash, at ${u}`);
  }
});

test('the roll rolls backwards and never jumps', () => {
  let prev = at(0);
  for (let i = 1; i <= 400; i += 1) {
    const p = at(i / 400);
    assert(Math.abs(p.x - prev.x) < 0.1 * L, `x jumped at ${i / 400}`);
    assert(Math.abs(p.y - prev.y) < 0.1 * L, `y jumped at ${i / 400}`);
    assert(p.theta <= prev.theta + 1e-9, `the roll turned forwards at ${i / 400}`);
    assert(prev.theta - p.theta < 0.1, `the roll snapped at ${i / 400}`);
    prev = p;
  }
});

test('progress outside 0..1 is held at the ends', () => {
  equal(at(-1).y, at(0).y);
  equal(at(2).y, at(1).y);
});

test('under reduced motion the diver fades out aboard and fades in below, never in between', () => {
  const aboard = at(0, true);
  const gone = at(0.5, true);
  equal(gone.alpha, 0);
  for (let i = 0; i <= 100; i += 1) {
    const p = at(i / 100, true);
    const isAboard = p.y === aboard.y && p.x === aboard.x;
    const isIn = p.y === 0 && p.x === 0;
    assert(isAboard || isIn, `the diver was drawn between the boat and the water at ${i / 100}`);
  }
  equal(at(1, true).alpha, 1);
  equal(at(1, true).theta, ENTRY_DESCENDING_THETA);
});
