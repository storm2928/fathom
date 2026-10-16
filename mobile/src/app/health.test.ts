import { test, equal } from '@fathom/game/testing/harness.ts';
import { MIN_MINDFUL_MS, mindfulSession } from './health.ts';
import { loadHealth, saveHealth } from './storage.ts';
import type { KeyValueStore } from './storage.ts';

function memory(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const broken: KeyValueStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('a dive becomes a mindful session that ends when the dive did', () => {
  const end = new Date('2026-10-16T09:00:00Z');
  const session = mindfulSession({ durationMs: 90_000 }, end);
  equal(session?.end.getTime(), end.getTime());
  equal(session?.start.getTime(), end.getTime() - 90_000);
});

test('a dive shorter than thirty seconds is not written', () => {
  const end = new Date();
  equal(mindfulSession({ durationMs: 20_000 }, end), null);
  equal(mindfulSession({ durationMs: MIN_MINDFUL_MS - 1 }, end), null);
  equal(mindfulSession({ durationMs: MIN_MINDFUL_MS }, end) !== null, true);
  equal(mindfulSession({ durationMs: Number.NaN }, end), null);
});

test('Apple Health is off until it is turned on, and remembered', () => {
  const store = memory();
  equal(loadHealth(store), false);
  saveHealth(true, store);
  equal(loadHealth(store), true);
  saveHealth(false, store);
  equal(loadHealth(store), false);
});

test('a broken store leaves Apple Health off', () => {
  equal(loadHealth(broken), false);
  equal(loadHealth(null), false);
  saveHealth(true, broken);
});
