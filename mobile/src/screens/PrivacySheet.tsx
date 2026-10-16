import { useLanguage } from '@fathom/shell/i18n';
import { POLICY } from '../privacy/policy';
import { useAppStrings } from '../strings';

/** The privacy policy, from Settings. The same words as the public page. */
export function PrivacySheet({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage();
  const a = useAppStrings();
  const policy = POLICY[language === 'fr' ? 'fr' : 'en'];
  return (
    <div className="safe settings fade-in" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet privacy" role="dialog" aria-labelledby="privacy-title">
        <h1 id="privacy-title">{policy.title}</h1>
        <p className="privacy__updated">{policy.updated}</p>
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={onClose}>
            {a.close}
          </button>
        </div>
      </div>
    </div>
  );
}
