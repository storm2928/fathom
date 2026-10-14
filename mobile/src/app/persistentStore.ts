import type { KeyValueStore } from './storage';

/**
 * Saved state, kept in iOS Preferences. A web view's localStorage can be
 * cleared by the system under storage pressure; Preferences (UserDefaults) is
 * not. Everything is loaded once at launch so readers stay synchronous, and
 * every write goes straight through.
 */

export interface PreferencesLike {
  keys(): Promise<{ keys: string[] }>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
}

/**
 * Load Preferences into memory, move any listed keys still only in the old
 * web storage across (never over a value Preferences already has), and return
 * a store that reads from memory and writes through.
 */
export async function hydrate(
  preferences: PreferencesLike,
  legacy: KeyValueStore | null,
  legacyKeys: string[],
): Promise<KeyValueStore> {
  const values = new Map<string, string>();

  try {
    const { keys } = await preferences.keys();
    for (const key of keys) {
      const { value } = await preferences.get({ key });
      if (value !== null) values.set(key, value);
    }
  } catch {
    // Preferences unavailable: run from memory for this launch.
  }

  const write = (key: string, value: string) => {
    values.set(key, value);
    void preferences.set({ key, value }).catch(() => {});
  };

  if (legacy) {
    for (const key of legacyKeys) {
      if (values.has(key)) continue;
      try {
        const old = legacy.getItem(key);
        if (old !== null) write(key, old);
      } catch {
        // Old storage blocked; nothing to bring across.
      }
    }
  }

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => write(key, value),
  };
}
