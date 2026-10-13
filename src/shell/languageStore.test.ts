import { test, equal } from '../game/testing/harness.ts';
import { readLanguage, writeLanguage } from './languageStore.ts';

/**
 * The language is read before anything else renders, so a storage that throws
 * here would blank the whole app — including the safety screen.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

const blocked = {
  getItem(): string | null {
    throw new Error('SecurityError: storage is blocked');
  },
  setItem(): void {
    throw new Error('SecurityError: storage is blocked');
  },
};

test('a blocked storage falls back to the browser language instead of throwing', () => {
  equal(readLanguage(blocked, 'fr-CA'), 'fr');
  equal(readLanguage(blocked, 'en-US'), 'en');
  equal(readLanguage(null, undefined), 'en');
});

test('a stored choice wins over the browser language', () => {
  const store = { getItem: () => 'fr', setItem() {} };
  equal(readLanguage(store, 'en-US'), 'fr');
});

test('writing to a blocked storage is survivable', () => {
  writeLanguage(blocked, 'fr');
});
