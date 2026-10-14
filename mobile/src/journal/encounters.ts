import { mulberry32 } from '@fathom/game/scene/renderer';
import { BANDS, CATALOGUE } from './catalogue';
import type { CreatureId } from './catalogue';

/**
 * What a dive can meet, rolled once when it starts and never added to. Three
 * per zone the dive visits, preferring entries not yet in the journal (up to
 * two), so a few good dives fill it — but a dive never offers more because it
 * is longer, or because there have been more of them.
 */

export interface Encounter {
  id: CreatureId;
  zone: number;
  /** metres below the depth at which its zone began */
  metresIntoZone: number;
  /** 0-1 across the screen */
  x: number;
}

const PER_ZONE = 3;
const PREFER_UNFOUND = 2;

export function rollEncounters(options: {
  seed: number;
  zones: number[];
  found: ReadonlySet<string>;
}): Encounter[] {
  const random = mulberry32(options.seed);
  const shuffle = <T>(items: T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const encounters: Encounter[] = [];
  for (const zone of options.zones) {
    const entries = CATALOGUE.filter((e) => e.zone === zone);
    const unfound = shuffle(entries.filter((e) => !options.found.has(e.id)));
    const picked = unfound.slice(0, PREFER_UNFOUND);
    for (const entry of shuffle(entries)) {
      if (picked.length >= PER_ZONE) break;
      if (!picked.includes(entry)) picked.push(entry);
    }
    for (const entry of picked) {
      const [lo, hi] = BANDS[entry.rarity];
      encounters.push({
        id: entry.id,
        zone,
        metresIntoZone: lo + random() * (hi - lo),
        x: 0.18 + random() * 0.64,
      });
    }
  }
  return encounters;
}
