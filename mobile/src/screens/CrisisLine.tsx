import { useAppStrings } from '../strings';

/**
 * The crisis numbers, compact. Always on the safety screen and the end of a
 * dive; the full wording lives behind the info button on the results.
 *
 * The numbers are literal, never translated — a mistranslated helpline number
 * would be the worst bug this screen could have.
 */
export function CrisisLine() {
  const a = useAppStrings();
  return (
    <aside className="crisis-line" aria-label={a.needPerson}>
      <span>{a.needPerson}</span>
      <span className="crisis-line__links">
        <a href="tel:988">988</a>
        <a href="tel:988">9-8-8</a>
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
      </span>
    </aside>
  );
}
