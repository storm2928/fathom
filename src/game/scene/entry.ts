/**
 * Going in: the diver sits on the side of the boat, back to the water, tips
 * backwards and rolls head-first through the waterline into the dive — the
 * backward roll every scuba diver learns from a small boat.
 *
 * Pure: where the diver is at a given point of the roll, as offsets from the
 * diver's fixed point on screen. The renderer draws it; DiveScene times it.
 * Positions are in pixels, from the body length L and how far above the fixed
 * point the waterline sits at the surface. Angles use the diver rig's frame:
 * 0 is upright, and rolling backwards turns the angle down.
 */

/** Seconds the roll takes, from the tap to the diver settled in the water. */
export const ENTRY_SECONDS = 3.2;

/** How far into the roll the diver goes through the waterline. */
export const SPLASH_AT = 0.42;

/**
 * Head down and to the right, the rig's descending angle, reached by rolling
 * backwards — one full turn below the rig's own value, so the renderer adds
 * 2π back once the roll is over.
 */
export const ENTRY_DESCENDING_THETA = 2.79 - Math.PI * 2;

/** Where the diver sits, across from the fixed point, in body lengths. */
export const SEAT_X = -1.2;
/** The boat's tube, from the waterline up, in body lengths. */
export const TUBE_HEIGHT = 0.3;
/** The rig's hip sits this far below its origin, in body lengths. */
const HIP = 0.36;
/** Seated down inside the tube, so it hides the legs folded into the boat. */
const SIT_IN = 0.12;

const LEAN_END = 0.15;
const PLUNGE_END = 0.62;
const LEAN_THETA = -0.4;
const SPLASH_THETA = -2.6;
const FALL_X = -1.9;
const PLUNGE_X = -1.6;
const PLUNGE_Y = 0.6;

export interface EntryPose {
  /** px from the fixed point */
  x: number;
  y: number;
  /** rig rotation, radians; 0 upright */
  theta: number;
  /** 1 legs folded forward into the boat, 0 straight */
  legFold: number;
  /** 0-1; only reduced motion fades */
  alpha: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const span = (u: number, from: number, to: number) => clamp01((u - from) / (to - from));

/** The seated diver's offset below the fixed point (negative: above it). */
export function seatY(L: number, surfaceAbove: number): number {
  return -surfaceAbove - TUBE_HEIGHT * L - HIP * L + SIT_IN * L;
}

export function entryPose(
  progress: number,
  L: number,
  surfaceAbove: number,
  reduced: boolean,
): EntryPose {
  const u = clamp01(progress);
  const seat = { x: SEAT_X * L, y: seatY(L, surfaceAbove) };

  if (reduced) {
    // No roll: gone from the boat, then there in the water.
    if (u < 0.5) {
      return { ...seat, theta: 0, legFold: 1, alpha: 1 - smooth(span(u, 0.3, 0.5)) };
    }
    return { x: 0, y: 0, theta: ENTRY_DESCENDING_THETA, legFold: 0, alpha: smooth(span(u, 0.5, 0.7)) };
  }

  if (u <= LEAN_END) {
    // Leaning back, still seated.
    return { ...seat, theta: lerp(0, LEAN_THETA, smooth(u / LEAN_END)), legFold: 1, alpha: 1 };
  }

  const waterline = -surfaceAbove;
  if (u <= SPLASH_AT) {
    // Falling backwards off the tube, gathering speed, rolling over.
    const s = span(u, LEAN_END, SPLASH_AT);
    return {
      x: lerp(seat.x, FALL_X * L, easeOut(s)),
      y: lerp(seat.y, waterline, s * s),
      theta: lerp(LEAN_THETA, SPLASH_THETA, smooth(s)),
      legFold: lerp(1, 0.3, s),
      alpha: 1,
    };
  }

  if (u <= PLUNGE_END) {
    // Through the surface, slowing as the water takes them.
    const s = span(u, SPLASH_AT, PLUNGE_END);
    return {
      x: lerp(FALL_X * L, PLUNGE_X * L, smooth(s)),
      y: lerp(waterline, PLUNGE_Y * L, easeOut(s)),
      theta: lerp(SPLASH_THETA, ENTRY_DESCENDING_THETA, smooth(s)),
      legFold: lerp(0.3, 0, s),
      alpha: 1,
    };
  }

  // Settling into place under the boat, ready to breathe.
  const s = smooth(span(u, PLUNGE_END, 1));
  return {
    x: lerp(PLUNGE_X * L, 0, s),
    y: lerp(PLUNGE_Y * L, 0, s),
    theta: ENTRY_DESCENDING_THETA,
    legFold: 0,
    alpha: 1,
  };
}
