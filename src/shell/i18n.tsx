import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DICTIONARIES } from './strings';
import type { Language, Strings } from './strings';
import { readLanguage, sessionLanguageStore, writeLanguage } from './languageStore';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Strings;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    readLanguage(sessionLanguageStore(), navigator.language),
  );

  const setLanguage = useCallback((next: Language) => {
    writeLanguage(sessionLanguageStore(), next);
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
