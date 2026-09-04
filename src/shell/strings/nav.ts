/** Development-only keys are folded out of the production build. */
const DEV = import.meta.env.DEV;

const en = {
  label: 'Main',
  dive: 'Dive',
  how: 'How it works',
  research: 'Research',
  safety: 'Safety',
  /** Development only. */
  harness: DEV ? 'Input harness' : '',
};

const fr: typeof en = {
  label: 'Principale',
  dive: 'Plongée',
  how: 'Comment ça marche',
  research: 'Recherche',
  safety: 'Sécurité',
  harness: DEV ? "Banc d'essai" : '',
};

export const nav = { en, fr };
