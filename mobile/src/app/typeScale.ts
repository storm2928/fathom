/**
 * Follows the iPhone's text size (Dynamic Type). WebKit exposes it through the
 * `-apple-system-body` font, 17 px at the default size; the ratio becomes the
 * CSS variable `--ts`, which the reading text in the stylesheets multiplies
 * by. Display type (the wordmark, depth, zone names) keeps its drawn size.
 *
 * Never smaller than drawn: the screens are already sized for the default.
 * Capped, so the largest accessibility sizes still fit a phone in portrait.
 */

/** The body size iOS reports at its default text size. */
const DEFAULT_BODY_PX = 17;
export const MAX_TYPE_SCALE = 1.4;

export function typeScale(systemBodyPx: number): number {
  if (!Number.isFinite(systemBodyPx) || systemBodyPx <= DEFAULT_BODY_PX) return 1;
  return Math.min(MAX_TYPE_SCALE, systemBodyPx / DEFAULT_BODY_PX);
}

/** Reads the system body size and sets `--ts` on the page. */
export function applyTypeScale(doc: Document = document): void {
  const probe = doc.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body';
  doc.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  doc.documentElement.style.setProperty('--ts', String(typeScale(px)));
}

/** Applies now, and again whenever the app comes back (the size may have changed in Settings). */
export function followTypeScale(doc: Document = document): void {
  applyTypeScale(doc);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') applyTypeScale(doc);
  });
}
