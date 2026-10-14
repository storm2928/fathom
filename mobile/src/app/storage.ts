import type { InputChoice } from './flow';

/**
 * What the app remembers between launches in Plan 1: that the scope was read,
 * and which input was chosen. Plan 4 moves this to Capacitor Preferences.
 *
 * Every access is guarded. A web view with storage blocked must still open on
 * the safety screen rather than on a white one.
 */

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export interface SavedChoices {
  acknowledged: true;
  input: InputChoice;
}

const KEY = 'fathom.app.choices';

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadChoices(store: KeyValueStore | null = defaultStore()): SavedChoices | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedChoices>;
    if (parsed.acknowledged !== true) return null;
    if (parsed.input !== 'mic' && parsed.input !== 'touch') return null;
    return { acknowledged: true, input: parsed.input };
  } catch {
    return null;
  }
}

export function saveChoices(
  choices: SavedChoices,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(choices));
  } catch {
    // Not remembered this time; the player sees the scope again next launch.
  }
}

/** Soundscape volume, 0–1. Read by the sound layer; saved from settings. */
export const DEFAULT_VOLUME = 0.8;
const VOLUME_KEY = 'fathom.app.volume';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function loadVolume(store: KeyValueStore | null = defaultStore()): number {
  if (!store) return DEFAULT_VOLUME;
  try {
    const raw = store.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const value = Number(raw);
    return Number.isFinite(value) ? clamp01(value) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveVolume(volume: number, store: KeyValueStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(VOLUME_KEY, String(clamp01(volume)));
  } catch {
    // Not remembered; the slider still applies until the app closes.
  }
}
