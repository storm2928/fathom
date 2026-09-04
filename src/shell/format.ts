import { fill } from './strings';
import type { Language, Strings } from './strings';

/**
 * Number and duration formatting for the UI. The exported dive log keeps raw
 * numbers; only what a person reads on screen goes through here.
 */

/** One decimal, locale-aware — FR shows `14,2`. Non-finite input renders the dash. */
export function formatDecimal(value: number, language: Language, t?: Strings): string {
  if (!Number.isFinite(value)) return t?.common.dash ?? '—';
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** `45s` / `4m 07s` (EN) or `45 s` / `4 min 07 s` (FR); seconds zero-padded past a minute. */
export function formatDuration(ms: number, t: Strings): string {
  if (!Number.isFinite(ms)) return t.common.dash;
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return fill(t.common.durationSec, { s: seconds });
  return fill(t.common.durationMinSec, { m: minutes, s: String(seconds).padStart(2, '0') });
}

/** `42.6 m` / `42,6 m`. */
export function formatMetres(value: number, t: Strings, language: Language): string {
  if (!Number.isFinite(value)) return t.common.dash;
  return fill(t.common.metres, { n: formatDecimal(value, language, t) });
}

/** `64%` / `64 %`. */
export function formatPercent(value: number, t: Strings): string {
  if (!Number.isFinite(value)) return t.common.dash;
  return fill(t.common.percent, { n: Math.round(value) });
}
