import type { Language } from '@fathom/shell/strings';

/** Numbers for the end-of-dive tiles. A missing measurement is a dash, never a zero. */

const NONE = '—';

/** 324000 → "5:24". */
export function clock(ms: number | null): string {
  if (ms === null) return NONE;
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 9240 → "9.2 s" (or "9,2 s" in French). */
export function exhaleSeconds(ms: number, language: Language): string {
  if (ms <= 0) return NONE;
  const value = (ms / 1000).toFixed(1);
  return `${language === 'fr' ? value.replace('.', ',') : value} s`;
}

export function wholeMetres(depth: number): number {
  return Math.max(0, Math.round(depth));
}
