import { test, equal } from '@fathom/game/testing/harness.ts';
import { DEFAULT_VOLUME, loadChoices, loadVolume, saveChoices, saveVolume } from './storage.ts';
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

test('choices round-trip', () => {
  const store = memory();
  saveChoices({ acknowledged: true, input: 'touch' }, store);
  const loaded = loadChoices(store);
  equal(loaded?.input, 'touch');
  equal(loaded?.acknowledged, true);
});

test('nothing saved means first launch', () => {
  equal(loadChoices(memory()), null);
});

test('corrupt values mean first launch, not a crash', () => {
  const store = memory();
  store.setItem('fathom.app.choices', '{not json');
  equal(loadChoices(store), null);
  store.setItem('fathom.app.choices', JSON.stringify({ acknowledged: true, input: 'nose' }));
  equal(loadChoices(store), null);
});

test('a storage that throws is survivable', () => {
  equal(loadChoices(broken), null);
  saveChoices({ acknowledged: true, input: 'mic' }, broken);
});

test('volume defaults when nothing is saved, and round-trips', () => {
  const store = memory();
  equal(loadVolume(store), DEFAULT_VOLUME);
  saveVolume(0.35, store);
  equal(loadVolume(store), 0.35);
});

test('volume is kept between silent and full', () => {
  const store = memory();
  saveVolume(1.7, store);
  equal(loadVolume(store), 1);
  saveVolume(-2, store);
  equal(loadVolume(store), 0);
  store.setItem('fathom.app.volume', 'loud');
  equal(loadVolume(store), DEFAULT_VOLUME);
});

test('volume survives a storage that throws', () => {
  equal(loadVolume(broken), DEFAULT_VOLUME);
  saveVolume(0.5, broken);
});
