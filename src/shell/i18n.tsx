import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DICTIONARIES } from './strings';
import type { Language, Strings } from './strings';
import { readLanguage, sessionLanguageStore, writeLanguage } from './languageStore';
import type { LanguageStore } from './languageStore';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Strings;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * `store` is where the choice is remembered: the browser session on the
 * website, the app's saved settings in the iOS app (which must survive the app
 * being closed).
 */
export function LanguageProvider({
  children,
  store = sessionLanguageStore,
}: {
  children: ReactNode;
  store?: () => LanguageStore | null;
}) {
  const [language, setLanguageState] = useState<Language>(() =>
    readLanguage(store(), navigator.language),
  );

  const setLanguage = useCallback(
    (next: Language) => {
      writeLanguage(store(), next);
      setLanguageState(next);
    },
    [store],
  );

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
