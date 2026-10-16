import type { InputChoice } from './flow';

/**
 * What the app remembers between launches: that the scope was read, which
 * input was chosen, volume and haptics. Backed by Capacitor Preferences once
 * main.tsx has hydrated it; localStorage only before that, and in a browser.
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

/** The Preferences-backed store, set once at launch (see main.tsx). */
let appStore: KeyValueStore | null = null;

export function setAppStore(store: KeyValueStore): void {
  appStore = store;
}

/** Keys saved before Preferences existed, moved across on first launch. */
export const LEGACY_KEYS = ['fathom.app.choices', 'fathom.app.volume', 'fathom.app.haptics'];

export function defaultStore(): KeyValueStore | null {
  if (appStore) return appStore;
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

/**
 * Soundscape volume, 0–1. Read by the sound layer; saved from settings.
 * Half by default: the app's audio session ignores the silent switch (it has
 * to, to keep the microphone and the soundscape on one session), so the first
 * launch should not be loud in a quiet room.
 */
export const DEFAULT_VOLUME = 0.5;
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

/** Haptics on or off. On unless the player turned them off. */
const HAPTICS_KEY = 'fathom.app.haptics';

export function loadHaptics(store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return true;
  try {
    return store.getItem(HAPTICS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveHaptics(on: boolean, store: KeyValueStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(HAPTICS_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered; the toggle still applies until the app closes.
  }
}

/** Writing dives to Apple Health. Off unless the player turned it on. */
const HEALTH_KEY = 'fathom.app.health';

export function loadHealth(store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    return store.getItem(HEALTH_KEY) === 'on';
  } catch {
    return false;
  }
}

export function saveHealth(on: boolean, store: KeyValueStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(HEALTH_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered; the switch still applies until the app closes.
  }
}
