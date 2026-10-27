/**
 * Strings live here, not in components.
 *
 * Every user-facing sentence is a whole sentence in these modules, including
 * the emphasis, because that is the unit a translator can actually work with —
 * splitting a sentence around a <strong> produces fragments that cannot be
 * reordered into good French. Emphasis is carried as **markers** and rendered
 * by <Rich>.
 *
 * One module per namespace; each exports `{ en, fr }` with `fr: typeof en`, so
 * a key added in English without its French twin fails the type check.
 */
import { common } from './common';
import { crisis } from './crisis';
import { safety } from './safety';
import { setup } from './setup';
import { dive } from './dive';
import { surface } from './surface';

export type Language = 'en' | 'fr';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

const en = {
  common: common.en,
  crisis: crisis.en,
  safety: safety.en,
  setup: setup.en,
  dive: dive.en.dive,
  state: dive.en.state,
  signal: dive.en.signal,
  surface: surface.en,
};

const fr: typeof en = {
  common: common.fr,
  crisis: crisis.fr,
  safety: safety.fr,
  setup: setup.fr,
  dive: dive.fr.dive,
  state: dive.fr.state,
  signal: dive.fr.signal,
  surface: surface.fr,
};

/** The shape every language must satisfy. */
export type Strings = typeof en;

export const DICTIONARIES: Record<Language, Strings> = { en, fr };

/** Substitute {name} placeholders. Unknown keys are left as written. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}
