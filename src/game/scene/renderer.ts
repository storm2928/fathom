/**
 * The seam between the dive simulation and whatever draws it.
 *
 * `DiveScene` owns the descent, the light and the camera; a renderer owns
 * pixels and nothing else. Keeping that line sharp is what let the art pass
 * happen without touching the breath wiring, and it is what lets a machine
 * where WebGL refuses to start still show a dive instead of a blank rectangle.
 */

export type { ZoneLook } from './art/palette';
export { ZONE_LOOKS, lookForZone } from './art/palette';

export type PromptBeat = 'inhale' | 'top-up' | 'exhale' | 'rest' | 'none';
export type DiverPose = 'level' | 'descending';

export interface SceneState {
  /** metres, as drawn - the eased value, not the earned one */
  depth: number;
  /** 0-1 dive light charge */
  light: number;
  /** true while the drawn depth is still catching up */
  descending: boolean;
  /**
   * Zone index from the session arc, 0-based; 0 before a dive.
   *
   * Told, not inferred. Depth bands used to be read as zones and contradicted
   * the arc (#30); the arc owns progression, so making zones look different
   * means the arc has to say which one is current.
   */
  zone: number;
  /** current prompt beat; 'none' before the conductor starts */
  promptStep: PromptBeat;
  /** an exhale is in progress (engine phase 'exhale') */
  exhaling: boolean;
  /** wall-clock seconds since that exhale began; 0 when not exhaling */
  exhaleSeconds: number;
  /** inhale or top-up prompt active (light rising) */
  charging: boolean;
  /** 0-1 elapsed fraction of the current prompt step; 0 when none */
  promptProgress: number;
  /** wall-clock length of the current step (protocol ms / timeScale); 0 when none */
  promptDurationMs: number;
  /** told by the view; 'level' by default */
  pose: DiverPose;
  /** wall-clock seconds since the scene started; drives ambient motion */
  elapsedSeconds: number;
}

export interface SceneRenderer {
  render(state: SceneState, dtSeconds: number): void;
  resize(): void;
  destroy(): void;
}

/** Pixels drawn per metre of depth on the diver's own layer. */
export const PIXELS_PER_METRE = 5;

/** Motes live on one of three parallax layers: 0 far, 1 mid, 2 base. */
export type MoteLayer = 0 | 1 | 2;

export interface Mote {
  /** 0-1 across the canvas */
  x: number;
  /** normalised slot within the layer's wrap span, 0-1 */
  u: number;
  /** accumulated drift along the span, metres */
  drift: number;
  layer: MoteLayer;
  radius: number;
  glow: number;
}

/** Seeded so the field is identical every run without being regular. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Deterministic placement, so a screenshot of the scene looks the same twice
 * and a visual change is attributable rather than noise.
 *
 * Seeded noise rather than modular arithmetic: spacing motes by (i * k) % n is
 * reproducible but lands them on a lattice, which is invisible at seventy motes
 * and an obvious grid at six hundred.
 *
 * Layers are dealt 25% far, 50% mid, 25% base.
 */
export function seedMotes(count: number): Mote[] {
  const random = mulberry32(0x0fa7);
  return Array.from({ length: count }, () => {
    const roll = random();
    const layer: MoteLayer = roll < 0.25 ? 0 : roll < 0.75 ? 1 : 2;
    return {
      x: random(),
      u: random(),
      drift: 0,
      layer,
      radius: 0.5 + random() * 1.8,
      glow: 0.2 + random() * 0.75,
    };
  });
}

/**
 * Motes hold still in the world and the diver moves past them - that is what
 * reads as descent. The slow independent rise only keeps the water alive.
 * Wrapping happens when the slot is resolved to a screen position, so this
 * never allocates and never needs to know the viewport.
 */
export function driftMotes(motes: Mote[], dtSeconds: number): void {
  const step = dtSeconds * 0.6;
  for (let i = 0; i < motes.length; i += 1) motes[i].drift -= step;
}
