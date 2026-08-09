import { useLanguage } from './i18n';
import { LANGUAGES } from './strings';
import './LanguageToggle.css';

/**
 * Visible without hunting, on every surface that carries product copy. The
 * francophone half of the audience should not have to complete a session in a
 * second language to find out the toggle existed.
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="lang" role="group" aria-label="Language">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={code === language ? 'active' : ''}
          aria-pressed={code === language}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
