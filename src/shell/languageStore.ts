import type { Language } from './strings';

/**
 * Where the chosen language is remembered for the session. Read during the
 * very first render, so every access is guarded: a browser or web view with
 * storage blocked throws on access, and an unguarded throw here blanks the
 * whole app — the safety screen included.
 */

export type LanguageStore = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'fathom.language';

export function sessionLanguageStore(): LanguageStore | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readLanguage(store: LanguageStore | null, browserLanguage: string | undefined): Language {
  try {
    const stored = store?.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    // Blocked storage: fall through to the browser's language.
  }
  // Follow the browser rather than assuming English. A francophone user should
  // not have to find a toggle before reading the safety screen.
  return browserLanguage?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function writeLanguage(store: LanguageStore | null, language: Language): void {
  try {
    store?.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered; the choice still applies for this page's life.
  }
}
