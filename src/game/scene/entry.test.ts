import { test, assert, equal } from '../testing/harness.ts';
import { ENTRY_END_THETA, ENTRY_SECONDS, SPLASH_AT, SWIM_FROM, entryPose, seatY } from './entry.ts';

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

test('the roll ends at the fixed point, swimming level, legs straight and still', () => {
  const p = at(1);
  equal(p.x, 0);
  equal(p.y, 0);
  equal(p.theta, ENTRY_END_THETA);
  equal(p.legFold, 0);
  equal(p.kick, 0);
});

test('after going in the diver swims: kicking, facing the way they move, curving under', () => {
  let deepest = 0;
  for (let i = 1; i < 100; i += 1) {
    const u = SWIM_FROM + ((1 - SWIM_FROM) * i) / 100;
    const a = at(u - 0.002);
    const b = at(u + 0.002);
    const p = at(u);
    deepest = Math.max(deepest, p.y);
    if (u < 0.9) assert(p.kick > 0.2, `not kicking at ${u}`);
    // Head direction in the rig's frame is (sin θ, -cos θ).
    const hx = Math.sin(p.theta);
    const hy = -Math.cos(p.theta);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const speed = Math.hypot(vx, vy);
    if (speed > 1e-3) {
      const facing = (hx * vx + hy * vy) / speed;
      assert(facing > 0.95, `swimming sideways or backwards at ${u} (${facing.toFixed(2)})`);
    }
  }
  assert(deepest > at(SWIM_FROM).y + 0.1 * L, 'the swim does not curve under before rising');
  equal(at(0).kick, 0);
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

test('the roll rolls backwards, the swim steers gently, and nothing jumps', () => {
  let prev = at(0);
  for (let i = 1; i <= 400; i += 1) {
    const u = i / 400;
    const p = at(u);
    assert(Math.abs(p.x - prev.x) < 0.1 * L, `x jumped at ${u}`);
    assert(Math.abs(p.y - prev.y) < 0.1 * L, `y jumped at ${u}`);
    if (u <= SWIM_FROM) assert(p.theta <= prev.theta + 1e-9, `the roll turned forwards at ${u}`);
    // At most about 2 rad/s anywhere, at the real entry length.
    const maxTurn = (2 * ENTRY_SECONDS) / 400;
    if (u > SWIM_FROM) assert(Math.abs(p.theta - prev.theta) < maxTurn, `the swim whipped round at ${u}`);
    else assert(prev.theta - p.theta < 0.1, `the roll snapped at ${u}`);
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
  equal(at(1, true).theta, ENTRY_END_THETA);
});
