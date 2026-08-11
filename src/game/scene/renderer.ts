/**
 * The seam between the dive simulation and whatever draws it.
 *
 * `DiveScene` owns the descent, the light and the camera; a renderer owns
 * pixels and nothing else. Keeping that line sharp is what let the art pass
 * happen without touching the breath wiring, and it is what lets a machine
 * where WebGL refuses to start still show a dive instead of a blank rectangle.
 */

export interface SceneState {
  /** metres, as drawn — the eased value, not the earned one */
  depth: number;
  /** 0–1 dive light charge */
  light: number;
  /** true while the diver is actually moving down */
  descending: boolean;
  /**
   * Zone index from the session arc, 0-based. -1 before the dive starts.
   *
   * Told, not inferred. Depth bands used to be read as zones and contradicted
   * the arc (#30); the arc owns progression, so making zones look different
   * means the arc has to say which one is current.
   */
  zone: number;
  /** current prompt beat, for the corner readout */
  promptStep: string;
}

export interface SceneRenderer {
  render(state: SceneState, dtSeconds: number): void;
  resize(): void;
  destroy(): void;
}

/**
 * How each zone looks. Progressively deeper, darker and colder, with the
 * bioluminescence getting sparser and more startling as the light thins out.
 *
 * Index 0 is used before a dive begins as well as during zone 1.
 */
export interface ZoneLook {
  top: string;
  bottom: string;
  mote: string;
  light: string;
}

export const ZONE_LOOKS: ZoneLook[] = [
  {
    top: 'hsl(196 74% 11%)',
    bottom: 'hsl(206 80% 5%)',
    mote: 'hsl(176 90% 66%)',
    light: 'hsl(184 96% 72%)',
  },
  {
    top: 'hsl(212 76% 7%)',
    bottom: 'hsl(226 74% 3.5%)',
    mote: 'hsl(196 92% 68%)',
    light: 'hsl(196 96% 70%)',
  },
  {
    top: 'hsl(234 68% 4.5%)',
    bottom: 'hsl(250 62% 2%)',
    mote: 'hsl(268 88% 76%)',
    light: 'hsl(214 94% 72%)',
  },
];

export const lookForZone = (zone: number): ZoneLook =>
  ZONE_LOOKS[Math.min(ZONE_LOOKS.length - 1, Math.max(0, zone))];

/** Pixels drawn per metre of depth. Shared so both renderers agree on scale. */
export const PIXELS_PER_METRE = 5;

/** Metres of world kept populated above and below the diver. */
export const MOTE_SPAN = 90;

export interface Mote {
  /** 0–1 across the canvas */
  x: number;
  /** world depth in metres */
  depth: number;
  radius: number;
  glow: number;
}

/** Seeded so the field is identical every run without being regular. */
function mulberry32(seed: number): () => number {
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
 */
export function seedMotes(count: number): Mote[] {
  const random = mulberry32(0x0fa7);
  return Array.from({ length: count }, () => ({
    x: random(),
    depth: random() * MOTE_SPAN - MOTE_SPAN / 2,
    radius: 0.5 + random() * 1.8,
    glow: 0.2 + random() * 0.75,
  }));
}

/**
 * Motes hold still in the world and the diver moves past them — that is what
 * reads as descent. The slow independent drift only keeps the water alive.
 */
export function driftMotes(motes: Mote[], dtSeconds: number, depth: number): void {
  const top = depth - MOTE_SPAN / 2;
  const bottom = depth + MOTE_SPAN / 2;
  for (const mote of motes) {
    mote.depth -= dtSeconds * 0.6;
    if (mote.depth < top) mote.depth += MOTE_SPAN;
    else if (mote.depth > bottom) mote.depth -= MOTE_SPAN;
  }
}
