import './CrisisRail.css';

/**
 * Crisis resources, present without being asked for.
 *
 * This is deliberately not conditional on anything. It does not appear because
 * a score was low or because someone typed something worrying — there is
 * nothing here that reads what anyone types, and inferring distress from a
 * breathing measurement would be exactly the kind of overreach this project is
 * built to avoid. It is simply always on the screen where a session ends.
 *
 * The wording routes to a person. Nothing here should suggest this app is one,
 * or that finishing a dive is a substitute for calling someone.
 */
export function CrisisRail() {
  return (
    <aside className="crisis" aria-label="Crisis support">
      <p className="crisis-lead">
        If you are in crisis or thinking about harming yourself, please talk to a person.
        This app is not one.
      </p>
      <ul>
        <li>
          <a href="tel:988">988</a> — Suicide &amp; Crisis Lifeline, United States. Call or text.
        </li>
        <li>
          <a href="tel:988">9-8-8</a> — Suicide Crisis Helpline, Canada. Call or text.
        </li>
        <li>
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>{' '}
          — free, confidential lines in over 130 countries.
        </li>
      </ul>
    </aside>
  );
}
