import { test, equal } from '@fathom/game/testing/harness.ts';
import { LOG_LIMIT, loadJournal, recordDive, recordFound } from './journalStore.ts';
import type { LogEntry } from './journalStore.ts';
import type { KeyValueStore } from '../app/storage.ts';

function memory(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}
const broken: KeyValueStore = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

const dive = (date: string): LogEntry => ({
  date,
  plan: 'full',
  durationMs: 330_000,
  baselineRR: 14,
  finalRR: 9.5,
  depth: 210,
  ending: 'completed',
  calibrated: true,
  found: [],
});

test('an empty journal to start with', () => {
  const journal = loadJournal(memory());
  equal(Object.keys(journal.found).length, 0);
  equal(journal.log.length, 0);
});

test('the first finding is the one kept', () => {
  const store = memory();
  equal(recordFound(store, 'moon-jelly', 12, new Date('2026-10-13T09:00:00Z')), true);
  equal(recordFound(store, 'moon-jelly', 40, new Date('2026-10-20T09:00:00Z')), false);
  const found = loadJournal(store).found['moon-jelly'];
  equal(found?.depth, 12);
  equal(found?.date, '2026-10-13T09:00:00.000Z');
});

test('the logbook lists newest first and keeps a bounded history', () => {
  const store = memory();
  for (let i = 0; i < LOG_LIMIT + 5; i += 1) recordDive(store, dive(`2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z#${i}`));
  const log = loadJournal(store).log;
  equal(log.length, LOG_LIMIT);
  equal(log[0].date.endsWith(`#${LOG_LIMIT + 4}`), true, 'newest was not first');
});

test('a corrupt journal reads as empty, not as a crash', () => {
  const store = memory();
  store.setItem('fathom.journal.found', '{nope');
  store.setItem('fathom.journal.log', '"not a list"');
  const journal = loadJournal(store);
  equal(Object.keys(journal.found).length, 0);
  equal(journal.log.length, 0);
});

test('a storage that throws is survivable', () => {
  equal(loadJournal(broken).log.length, 0);
  equal(recordFound(broken, 'moon-jelly', 10, new Date()), true);
  recordDive(broken, dive('2026-10-13T09:00:00Z'));
});
