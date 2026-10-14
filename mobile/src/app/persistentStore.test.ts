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
