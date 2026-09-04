import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DICTIONARIES } from './strings';
import type { Language, Strings } from './strings';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Strings;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'fathom.language';

function initialLanguage(): Language {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'fr') return stored;
  // Follow the browser rather than assuming English. A francophone user should
  // not have to find a toggle before reading the safety screen.
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((next: Language) => {
    sessionStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  // The document language follows the resolved language from the first
  // render, so a French browser gets <html lang="fr"> before any toggle.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: DICTIONARIES[language] }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage needs a LanguageProvider above it');
  return value;
}

/**
 * Renders **bold** spans inside a translated string, so a sentence can stay one
 * translatable unit instead of being cut into fragments around markup.
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
