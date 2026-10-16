/**
 * Going in: the diver sits on the side of the boat, back to the water, tips
 * backwards and rolls head-first through the waterline, then swims round under
 * the boat into place — the backward roll every scuba diver learns from a
 * small boat.
 *
 * Pure: where the diver is at a given point of the entry, as offsets from the
 * diver's fixed point on screen. The renderer draws it; DiveScene times it.
 * Positions are in pixels, from the body length L and how far above the fixed
 * point the waterline sits at the surface. Angles use the diver rig's frame:
 * 0 is upright, the head points along (sin θ, -cos θ), and rolling backwards
 * turns the angle down.
 */

/** Seconds the entry takes, from the tap to the diver in place. */
export const ENTRY_SECONDS = 4;

/** How far into the entry the diver goes through the waterline. */
export const SPLASH_AT = 0.36;

/** From here the diver swims back round to the fixed point. */
export const SWIM_FROM = 0.55;

/**
 * Swimming level, head to the right — one full turn below the rig's own
 * angles, having rolled over backwards, so the renderer adds 2π back once
 * the entry is over.
 */
export const ENTRY_END_THETA = Math.PI / 2 - Math.PI * 2;

/** Where the diver sits, across from the fixed point, in body lengths. */
export const SEAT_X = -1.2;
/** The boat's tube, from the waterline up, in body lengths. */
export const TUBE_HEIGHT = 0.3;
/** The rig's hip sits this far below its origin, in body lengths. */
const HIP = 0.36;
/** Seated down inside the tube, so it hides the legs folded into the boat. */
const SIT_IN = 0.12;

const LEAN_END = 0.12;
const LEAN_THETA = -0.4;
/** Head first through the surface. */
const SPLASH_THETA = -2.6;
/** Out of the roll, heading down and away to the right, on the rolled-over turn. */
const SWIM_THETA = 2.1 - Math.PI * 2;
/** Where the fall meets the water, across from the fixed point, in body lengths. */
const FALL_X = -1.9;
/** Where the roll ends and the swim begins, in body lengths. */
const SWIM_START = { x: -1.6, y: 0 };
/** How far each curve carries on along its starting and ending directions. */
const PLUNGE_REACH = 0.5;
const SWIM_REACH = 0.9;
const SWIM_ARRIVE = 0.6;

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
  /** 0-1 how hard the fins are kicking */
  kick: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const span = (u: number, from: number, to: number) => clamp01((u - from) / (to - from));

/** A cubic Bézier, and its tangent, one axis at a time. */
const bezier = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};
const bezierSlope = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return 3 * m * m * (b - a) + 6 * m * t * (c - b) + 3 * t * t * (d - c);
};

/** The rig angle that points the head along (vx, vy), on the rolled-over turn. */
const heading = (vx: number, vy: number) => Math.atan2(vx, -vy) - Math.PI * 2;

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
  const inPlace = { x: 0, y: 0, theta: ENTRY_END_THETA, legFold: 0, alpha: 1, kick: 0 };

  if (reduced) {
    // No roll: gone from the boat, then there in the water.
    if (u < 0.5) {
      return { ...seat, theta: 0, legFold: 1, alpha: 1 - smooth(span(u, 0.3, 0.5)), kick: 0 };
    }
    return { ...inPlace, alpha: smooth(span(u, 0.5, 0.7)) };
  }

  if (u <= LEAN_END) {
    // Leaning back, still seated.
    return { ...seat, theta: lerp(0, LEAN_THETA, smooth(u / LEAN_END)), legFold: 1, alpha: 1, kick: 0 };
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
      kick: 0,
    };
  }

  // The swim's start, and the way it sets off: the roll hands over here.
  const ax = SWIM_START.x * L;
  const ay = SWIM_START.y * L;
  const dx = Math.sin(SWIM_THETA);
  const dy = -Math.cos(SWIM_THETA);

  if (u <= SWIM_FROM) {
    // Through the surface still falling, then curving round out of the roll
    // to set off the way the swim goes. The legs come straight and start to kick.
    const s = span(u, SPLASH_AT, SWIM_FROM);
    const fx = FALL_X * L;
    return {
      x: bezier(fx, fx, ax - PLUNGE_REACH * L * dx, ax, s),
      y: bezier(waterline, waterline + PLUNGE_REACH * L, ay - PLUNGE_REACH * L * dy, ay, s),
      theta: lerp(SPLASH_THETA, SWIM_THETA, smooth(s)),
      legFold: lerp(0.3, 0, s),
      alpha: 1,
      kick: 0.6 * smooth(s),
    };
  }

  // The swim: a long curve under the boat that levels out into place, always
  // facing the way it goes, kicking hard and easing off as they arrive.
  const s = span(u, SWIM_FROM, 1);
  if (s >= 1) return inPlace;
  const t = 1 - Math.pow(1 - s, 1.5);
  const bx = ax + SWIM_REACH * L * dx;
  const by = ay + SWIM_REACH * L * dy;
  const cx = -SWIM_ARRIVE * L;
  return {
    x: bezier(ax, bx, cx, 0, t),
    y: bezier(ay, by, 0, 0, t),
    theta: heading(bezierSlope(ax, bx, cx, 0, t), bezierSlope(ay, by, 0, 0, t)),
    legFold: 0,
    alpha: 1,
    kick: s < 0.15 ? lerp(0.6, 1, s / 0.15) : 1 - smooth(span(s, 0.55, 1)),
  };
}
