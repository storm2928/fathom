import type { Encounter } from './encounters';

/**
 * Whether the diver has found an encounter: passed its depth during a lit
 * breath out, or just after one. A breath out is lit when the dive light was
 * charged as it began — that is, after the double breath in. Depth moves only
 * on a breath out and the light is charged only by the breath-in prompt, so
 * finding things takes exactly the breathing the dive trains, and a held
 * breath finds nothing at all.
 *
 * The light is judged at the start of the breath, not as it passes: a long,
 * slow breath gains most of its depth late, after the lamp has faded, and must
 * not be the breath that sees the least.
 *
 * An encounter passed on an unlit breath is missed for this dive.
 */

/** Dive light needed to see something (0-1). */
export const LIGHT_TO_SEE = 0.25;
/** How long after a breath out ends it still counts. */
const AFTER_EXHALE_MS = 2_000;

export interface DiscoverySample {
  depth: number;
  /** the dive light now, 0-1; read at the start of each breath out */
  light: number;
  exhaling: boolean;
  now: number;
}

/** An encounter placed in the water: its absolute depth once its zone has begun. */
export interface PlacedEncounter extends Encounter {
  depth: number;
}

export class DiscoveryTracker {
  private readonly encounters: Encounter[];
  private readonly zoneStart = new Map<number, number>();
  private readonly settled = new Set<string>();
  private lastExhaleAt = -Infinity;
  private wasExhaling = false;
  /** Whether the current (or just-finished) breath out began lit. */
  private breathLit = false;

  constructor(encounters: Encounter[]) {
    this.encounters = encounters;
  }

  /** Told when the arc enters a zone, with the depth at that moment. */
  enterZone(zone: number, depth: number): void {
    if (!this.zoneStart.has(zone)) this.zoneStart.set(zone, depth);
  }

  /** Encounters whose zone has begun, at their absolute depth. */
  get placed(): PlacedEncounter[] {
    const out: PlacedEncounter[] = [];
    for (const e of this.encounters) {
      const start = this.zoneStart.get(e.zone);
      if (start !== undefined) out.push({ ...e, depth: start + e.metresIntoZone });
    }
    return out;
  }

  /** Returns the encounters found by this sample, each at most once per dive. */
  update(sample: DiscoverySample): Encounter[] {
    if (sample.exhaling && !this.wasExhaling) this.breathLit = sample.light >= LIGHT_TO_SEE;
    this.wasExhaling = sample.exhaling;
    if (sample.exhaling) this.lastExhaleAt = sample.now;
    const breathing = sample.exhaling || sample.now - this.lastExhaleAt < AFTER_EXHALE_MS;
    const found: Encounter[] = [];
    for (const e of this.placed) {
      if (this.settled.has(e.id) || sample.depth < e.depth) continue;
      // Passed: found if it could be seen, otherwise missed for this dive.
      this.settled.add(e.id);
      if (this.breathLit && breathing) found.push(e);
    }
    return found;
  }
}
