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
