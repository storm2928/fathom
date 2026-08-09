import { useLanguage } from './i18n';
import './CrisisRail.css';

/**
 * Crisis resources, present without being asked for.
 *
 * This is deliberately not conditional on anything. It does not appear because
 * a score was low or because someone typed something worrying — there is
 * nothing here that reads what anyone types, and inferring distress from a
 * breathing measurement would be exactly the kind of overreach this project is
 * built to avoid. It is simply always on the screens where someone might need
 * it: the scope screen at the start, and the surface screen at the end.
 *
 * The wording routes to a person. Nothing here should suggest this app is one,
 * or that finishing a dive is a substitute for calling someone.
 *
 * The numbers themselves are not translated — 988 is 988 in both languages, and
 * a mistranslated helpline number is the worst bug this file could have.
 */
export function CrisisRail() {
  const { t } = useLanguage();

  return (
    <aside className="crisis" aria-label={t.crisis.label}>
      <p className="crisis-lead">{t.crisis.lead}</p>
      <ul>
        <li>
          <a href="tel:988">988</a> — {t.crisis.usBody}
        </li>
        <li>
          <a href="tel:988">9-8-8</a> — {t.crisis.caBody}
        </li>
        <li>
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>{' '}
          — {t.crisis.intlBody}
        </li>
      </ul>
    </aside>
  );
}
