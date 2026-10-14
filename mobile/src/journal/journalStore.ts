import { defaultStore } from '../app/storage';
import type { KeyValueStore } from '../app/storage';

/**
 * The field journal and the dive logbook, kept on the device. What was found
 * (first finding only — when and how deep) and a short history of dives.
 * There is no total, rank or streak here, and nothing derived from one.
 */

export interface FoundRecord {
  /** ISO 8601 */
  date: string;
  /** metres, where it was first found */
  depth: number;
}

export interface LogEntry {
  /** ISO 8601 */
  date: string;
  plan: 'full' | 'quick';
  durationMs: number;
  baselineRR: number;
  finalRR: number;
  depth: number;
  ending: 'completed' | 'signal-lost' | 'stopped';
  calibrated: boolean;
  /** ids found on this dive */
  found: string[];
}

export interface Journal {
  found: Record<string, FoundRecord>;
  log: LogEntry[];
}

/** Enough history to look back over months without growing forever. */
export const LOG_LIMIT = 200;
const FOUND_KEY = 'fathom.journal.found';
const LOG_KEY = 'fathom.journal.log';

function read<T>(store: KeyValueStore | null, key: string, valid: (v: unknown) => v is T, empty: T): T {
  if (!store) return empty;
  try {
    const raw = store.getItem(key);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : empty;
  } catch {
    return empty;
  }
}

function write(store: KeyValueStore | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved this time.
  }
}

const isRecord = (v: unknown): v is Record<string, FoundRecord> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isLog = (v: unknown): v is LogEntry[] => Array.isArray(v);

export function loadJournal(store: KeyValueStore | null = defaultStore()): Journal {
  return { found: read(store, FOUND_KEY, isRecord, {}), log: read(store, LOG_KEY, isLog, []) };
}

/** Records a finding. True when it is new to the journal. */
export function recordFound(
  store: KeyValueStore | null,
  id: string,
  depth: number,
  now: Date,
): boolean {
  const found = read(store, FOUND_KEY, isRecord, {});
  if (found[id]) return false;
  found[id] = { date: now.toISOString(), depth: Math.round(depth) };
  write(store, FOUND_KEY, found);
  return true;
}

export function recordDive(store: KeyValueStore | null, entry: LogEntry): void {
  const log = read(store, LOG_KEY, isLog, []);
  log.unshift(entry);
  write(store, LOG_KEY, log.slice(0, LOG_LIMIT));
}
