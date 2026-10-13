import { PIXELS_PER_METRE } from '../renderer';
import { DARKEST_AT_METRES } from '../descent';

/**
 * Where the surface is and how much daylight is left, as functions of drawn
 * depth. Lighting only: none of this feeds back into the descent or the score.
 */

/** At depth 0 the waterline sits this far above the diver's fixed point. */
export const SURFACE_ABOVE_DIVER_PX = 70;

/** Below this the god rays are gone; the water is lit only by what lives in it. */
export const RAYS_GONE_AT_METRES = 140;

/** How much darker the vignette gets at full pressure, added to the zone's own. */
export const PRESSURE_VIGNETTE = 0.35;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Screen y of the waterline. Moves with the base layer, so it rises as you sink. */
export function surfaceY(depth: number, diverY: number): number {
  return diverY - SURFACE_ABOVE_DIVER_PX - depth * PIXELS_PER_METRE;
}

/** 1 at the surface, 0 from RAYS_GONE_AT_METRES down; eased so it lingers then goes. */
export function rayStrength(depth: number): number {
  const k = 1 - clamp01(depth / RAYS_GONE_AT_METRES);
  return k * k;
}

/** 0 at the surface, 1 at DARKEST_AT_METRES and below. */
export function pressure(depth: number): number {
  return clamp01(depth / DARKEST_AT_METRES);
}
