import { useLanguage } from './i18n';
import { LANGUAGES } from './strings';
import type { Language } from './strings';
import './LanguageToggle.css';

/**
 * Visible without hunting, on every surface that carries product copy. The
 * francophone half of the audience should not have to complete a session in a
 * second language to find out the toggle existed.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const names: Record<Language, string> = {
    en: t.common.languageEnglish,
    fr: t.common.languageFrench,
  };

  return (
    <div className={className ? `lang ${className}` : 'lang'} role="group" aria-label={t.common.languageLabel}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={code === language ? 'lang__btn lang__btn--on' : 'lang__btn'}
          aria-pressed={code === language}
          aria-label={names[code]}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
