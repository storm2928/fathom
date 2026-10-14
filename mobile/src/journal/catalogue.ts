/**
 * Everything that can be found: six per zone, two each of common, uncommon and
 * rare. Rarity only sets how far below the start of its zone an entry lives,
 * and depth comes only from long, slow breaths out (descent.ts) — so the rare
 * ones are reached by breathing the way the dive asks, not by diving more.
 */

export type Rarity = 'common' | 'uncommon' | 'rare';

export type CreatureId =
  | 'lanternfish'
  | 'moon-jelly'
  | 'hatchetfish'
  | 'glass-squid'
  | 'manta-ray'
  | 'siphonophore'
  | 'firefly-squid'
  | 'comb-jelly'
  | 'barreleye'
  | 'vampire-squid'
  | 'giant-isopod'
  | 'sperm-whale'
  | 'sea-pig'
  | 'tripod-fish'
  | 'anglerfish'
  | 'dumbo-octopus'
  | 'hydrothermal-vent'
  | 'whale-fall';

export interface CatalogueEntry {
  id: CreatureId;
  zone: 0 | 1 | 2;
  rarity: Rarity;
}

export const CATALOGUE: CatalogueEntry[] = [
  { id: 'lanternfish', zone: 0, rarity: 'common' },
  { id: 'moon-jelly', zone: 0, rarity: 'common' },
  { id: 'hatchetfish', zone: 0, rarity: 'uncommon' },
  { id: 'glass-squid', zone: 0, rarity: 'uncommon' },
  { id: 'manta-ray', zone: 0, rarity: 'rare' },
  { id: 'siphonophore', zone: 0, rarity: 'rare' },
  { id: 'firefly-squid', zone: 1, rarity: 'common' },
  { id: 'comb-jelly', zone: 1, rarity: 'common' },
  { id: 'barreleye', zone: 1, rarity: 'uncommon' },
  { id: 'vampire-squid', zone: 1, rarity: 'uncommon' },
  { id: 'giant-isopod', zone: 1, rarity: 'rare' },
  { id: 'sperm-whale', zone: 1, rarity: 'rare' },
  { id: 'sea-pig', zone: 2, rarity: 'common' },
  { id: 'tripod-fish', zone: 2, rarity: 'common' },
  { id: 'anglerfish', zone: 2, rarity: 'uncommon' },
  { id: 'dumbo-octopus', zone: 2, rarity: 'uncommon' },
  { id: 'hydrothermal-vent', zone: 2, rarity: 'rare' },
  { id: 'whale-fall', zone: 2, rarity: 'rare' },
];

/** Metres below the depth at which the zone began. */
export const BANDS: Record<Rarity, [number, number]> = {
  common: [4, 20],
  uncommon: [20, 45],
  rare: [45, 75],
};

export function entryFor(id: CreatureId): CatalogueEntry {
  const entry = CATALOGUE.find((e) => e.id === id);
  if (!entry) throw new Error(`unknown creature ${id}`);
  return entry;
}
