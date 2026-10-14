import type { Encounter } from './encounters';

/**
 * Whether the diver has found an encounter: passed its depth with the dive
 * light on, while breathing out or just after. Depth moves only on a breath
 * out, and the light is charged only by the breath-in prompt — so finding
 * things takes exactly the breathing the dive trains, and a held breath finds
 * nothing at all.
 *
 * An encounter passed in the dark is missed for this dive.
 */

/** Dive light needed to see something (0-1). */
export const LIGHT_TO_SEE = 0.25;
/** How long after a breath out ends it still counts. */
const AFTER_EXHALE_MS = 2_000;

export interface DiscoverySample {
  depth: number;
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
    if (sample.exhaling) this.lastExhaleAt = sample.now;
    const breathing = sample.exhaling || sample.now - this.lastExhaleAt < AFTER_EXHALE_MS;
    const found: Encounter[] = [];
    for (const e of this.placed) {
      if (this.settled.has(e.id) || sample.depth < e.depth) continue;
      // Passed: found if it could be seen, otherwise missed for this dive.
      this.settled.add(e.id);
      if (sample.light >= LIGHT_TO_SEE && breathing) found.push(e);
    }
    return found;
  }
}
