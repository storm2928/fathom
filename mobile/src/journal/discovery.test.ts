import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { metresForExhale } from '@fathom/game/scene/descent.ts';
import { BANDS, CATALOGUE } from './catalogue.ts';
import { rollEncounters } from './encounters.ts';
import { DiscoveryTracker, LIGHT_TO_SEE } from './discovery.ts';
import type { Encounter } from './encounters.ts';

/**
 * What can be found, and what finding it takes. The journal must reward the
 * breathing the dive trains — long, slow breaths out — and nothing else.
 */

test('six entries per zone: two common, two uncommon, two rare', () => {
  for (const zone of [0, 1, 2]) {
    const entries = CATALOGUE.filter((e) => e.zone === zone);
    equal(entries.length, 6);
    for (const rarity of ['common', 'uncommon', 'rare'] as const) {
      equal(entries.filter((e) => e.rarity === rarity).length, 2, `${rarity} in zone ${zone}`);
    }
  }
  equal(new Set(CATALOGUE.map((e) => e.id)).size, 18, 'duplicate ids');
});

test('a dive’s encounters are fixed by its seed', () => {
  const a = rollEncounters({ seed: 42, zones: [0, 1, 2], found: new Set() });
  const b = rollEncounters({ seed: 42, zones: [0, 1, 2], found: new Set() });
  equal(JSON.stringify(a), JSON.stringify(b));
});

test('three per visited zone, no repeats, and a quick dive only meets zone 1', () => {
  const full = rollEncounters({ seed: 7, zones: [0, 1, 2], found: new Set() });
  equal(full.length, 9);
  equal(new Set(full.map((e) => e.id)).size, 9);
  for (const zone of [0, 1, 2]) equal(full.filter((e) => e.zone === zone).length, 3);
  const quick = rollEncounters({ seed: 7, zones: [0], found: new Set() });
  equal(quick.length, 3);
  assert(quick.every((e) => e.zone === 0));
});

test('encounters sit in their rarity’s band below the zone start', () => {
  for (const e of rollEncounters({ seed: 99, zones: [0, 1, 2], found: new Set() })) {
    const rarity = CATALOGUE.find((c) => c.id === e.id)!.rarity;
    const [lo, hi] = BANDS[rarity];
    assert(e.metresIntoZone >= lo && e.metresIntoZone <= hi, `${e.id} at ${e.metresIntoZone}m`);
  }
});

test('the roll leans toward what has not been found yet', () => {
  const twilight = CATALOGUE.filter((e) => e.zone === 0).map((e) => e.id);
  const unfound = twilight.slice(0, 2);
  const found = new Set(twilight.slice(2));
  for (let seed = 1; seed < 30; seed += 1) {
    const ids = rollEncounters({ seed, zones: [0], found }).map((e) => e.id);
    for (const id of unfound) assert(ids.includes(id), `seed ${seed} skipped unfound ${id}`);
  }
});

const one: Encounter = { id: 'moon-jelly', zone: 0, metresIntoZone: 10, x: 0.5 };

test('a breath-hold finds nothing: without breathing out, depth never reaches anything', () => {
  const tracker = new DiscoveryTracker([one]);
  tracker.enterZone(0, 0);
  for (let t = 0; t < 60_000; t += 100) {
    equal(tracker.update({ depth: 0, light: 1, exhaling: false, now: t }).length, 0);
  }
});

test('passing an encounter while breathing out with the light on finds it, once', () => {
  const tracker = new DiscoveryTracker([one]);
  tracker.enterZone(0, 0);
  equal(tracker.update({ depth: 5, light: 0.8, exhaling: true, now: 0 }).length, 0);
  const found = tracker.update({ depth: 11, light: 0.8, exhaling: true, now: 100 });
  equal(found.length, 1);
  equal(found[0].id, 'moon-jelly');
  equal(tracker.update({ depth: 12, light: 0.8, exhaling: true, now: 200 }).length, 0);
});

test('a breath that just ended still counts; one long gone does not', () => {
  const soon = new DiscoveryTracker([one]);
  soon.enterZone(0, 0);
  soon.update({ depth: 9, light: 0.8, exhaling: true, now: 0 });
  equal(soon.update({ depth: 10.5, light: 0.8, exhaling: false, now: 1_500 }).length, 1);

  const late = new DiscoveryTracker([one]);
  late.enterZone(0, 0);
  late.update({ depth: 9, light: 0.8, exhaling: true, now: 0 });
  equal(late.update({ depth: 10.5, light: 0.8, exhaling: false, now: 5_000 }).length, 0);
});

test('passing in the dark misses it for this dive', () => {
  const tracker = new DiscoveryTracker([one]);
  tracker.enterZone(0, 0);
  equal(tracker.update({ depth: 11, light: LIGHT_TO_SEE - 0.05, exhaling: true, now: 0 }).length, 0);
  equal(tracker.update({ depth: 12, light: 1, exhaling: true, now: 100 }).length, 0);
});

test('encounters are measured from where their zone began', () => {
  const deep: Encounter = { id: 'barreleye', zone: 1, metresIntoZone: 25, x: 0.5 };
  const tracker = new DiscoveryTracker([deep]);
  tracker.enterZone(0, 0);
  equal(tracker.update({ depth: 30, light: 1, exhaling: true, now: 0 }).length, 0, 'found before its zone');
  tracker.enterZone(1, 80);
  equal(tracker.update({ depth: 104, light: 1, exhaling: true, now: 100 }).length, 0);
  equal(tracker.update({ depth: 106, light: 1, exhaling: true, now: 200 }).length, 1);
});

test('only slow, long breaths reach the rare band in a zone', () => {
  // A zone lasts about 100 s. Quick shallow breathing: 1.2 s out every 4 s.
  const fast = (100 / 4) * metresForExhale(1_200, 1);
  // The protocol: a 6 s breath out every 10 s.
  const slow = (100 / 10) * metresForExhale(6_000, 1);
  assert(fast < BANDS.rare[0], `fast breathing reached ${fast.toFixed(1)}m into a zone`);
  assert(slow > BANDS.rare[1], `slow breathing only reached ${slow.toFixed(1)}m`);
});
