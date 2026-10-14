import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { hydrate } from './persistentStore.ts';
import type { PreferencesLike } from './persistentStore.ts';
import type { KeyValueStore } from './storage.ts';

/**
 * Saved state lives in iOS Preferences, which the system does not purge the
 * way it can purge a web view's storage. Loaded once at launch so every reader
 * stays synchronous; every write goes straight through.
 */

function fakePreferences(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const sets: string[] = [];
  const prefs: PreferencesLike = {
    keys: () => Promise.resolve({ keys: [...map.keys()] }),
    get: ({ key }) => Promise.resolve({ value: map.get(key) ?? null }),
    set: ({ key, value }) => {
      map.set(key, value);
      sets.push(key);
      return Promise.resolve();
    },
  };
  return { prefs, map, sets };
}

function legacy(values: Record<string, string>): KeyValueStore {
  const map = new Map(Object.entries(values));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

test('what Preferences holds is readable straight away', async () => {
  const { prefs } = fakePreferences({ 'fathom.app.volume': '0.4' });
  const store = await hydrate(prefs, null, ['fathom.app.volume']);
  equal(store.getItem('fathom.app.volume'), '0.4');
});

test('writes go through to Preferences', async () => {
  const { prefs, map } = fakePreferences();
  const store = await hydrate(prefs, null, []);
  store.setItem('fathom.app.haptics', 'off');
  equal(store.getItem('fathom.app.haptics'), 'off');
  await Promise.resolve();
  equal(map.get('fathom.app.haptics'), 'off', 'the write never reached Preferences');
});

test('old web-storage choices move across once, without overwriting newer ones', async () => {
  const { prefs, map } = fakePreferences({ 'fathom.app.volume': '0.9' });
  const old = legacy({ 'fathom.app.choices': '{"acknowledged":true,"input":"touch"}', 'fathom.app.volume': '0.1' });
  const store = await hydrate(prefs, old, ['fathom.app.choices', 'fathom.app.volume']);
  equal(store.getItem('fathom.app.choices'), '{"acknowledged":true,"input":"touch"}');
  equal(store.getItem('fathom.app.volume'), '0.9', 'an old value replaced a newer one');
  await Promise.resolve();
  equal(map.get('fathom.app.choices'), '{"acknowledged":true,"input":"touch"}');
});

test('Preferences failing to load still gives a working store', async () => {
  const broken: PreferencesLike = {
    keys: () => Promise.reject(new Error('unavailable')),
    get: () => Promise.reject(new Error('unavailable')),
    set: () => Promise.reject(new Error('unavailable')),
  };
  const store = await hydrate(broken, null, ['fathom.app.volume']);
  store.setItem('fathom.app.volume', '0.3');
  equal(store.getItem('fathom.app.volume'), '0.3');
  assert(true);
});

test('a key that fails to load is never overwritten on the strength of a blank read', async () => {
  const stored = new Map([
    ['fathom.journal.found', '{"moon-jelly":{"date":"2026-10-13T09:00:00.000Z","depth":8}}'],
    ['fathom.app.volume', '0.4'],
  ]);
  const writes: string[] = [];
  const flaky: PreferencesLike = {
    keys: () => Promise.resolve({ keys: [...stored.keys()] }),
    get: ({ key }) =>
      key === 'fathom.journal.found'
        ? Promise.reject(new Error('read failed'))
        : Promise.resolve({ value: stored.get(key) ?? null }),
    set: ({ key, value }) => {
      writes.push(key);
      stored.set(key, value);
      return Promise.resolve();
    },
  };
  const store = await hydrate(flaky, null, []);
  equal(store.getItem('fathom.app.volume'), '0.4', 'one failed key stopped the rest loading');
  store.setItem('fathom.journal.found', '{}');
  await Promise.resolve();
  assert(!writes.includes('fathom.journal.found'), 'a journal that failed to load was overwritten');
  equal(stored.get('fathom.journal.found')?.includes('moon-jelly'), true);
});
