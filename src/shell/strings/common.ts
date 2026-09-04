/** Development-only keys are folded out of the production build. */
const DEV = import.meta.env.DEV;

const en = {
  appName: 'FATHOM',
  tagline: 'A game you play with your breath.',
  docTitle: {
    dive: 'FATHOM — Dive',
    how: 'FATHOM — How it works',
    research: 'FATHOM — Research',
    safety: 'FATHOM — Before you dive',
    harness: DEV ? 'FATHOM — Input harness' : '',
  },
  brandHome: 'FATHOM home',
  skipToContent: 'Skip to content',
  languageLabel: 'Language',
  languageEnglish: 'English',
  languageFrench: 'Français',
  more: 'More',
  less: 'Less',
  close: 'Close',
  dismiss: 'Dismiss',
  newTab: '(opens in a new tab)',
  dash: '—',
  unitBpm: 'breaths/min',
  metres: '{n} m',
  percent: '{n}%',
  durationSec: '{s}s',
  durationMinSec: '{m}m {s}s',
};

const fr: typeof en = {
  appName: 'FATHOM',
  tagline: 'Un jeu que vous pilotez avec votre souffle.',
  docTitle: {
    dive: 'FATHOM — Plongée',
    how: 'FATHOM — Comment ça marche',
    research: 'FATHOM — Recherche',
    safety: 'FATHOM — Avant de plonger',
    harness: DEV ? "FATHOM — Banc d'essai" : '',
  },
  brandHome: 'Accueil FATHOM',
  skipToContent: 'Aller au contenu',
  languageLabel: 'Langue',
  languageEnglish: 'English',
  languageFrench: 'Français',
  more: 'En savoir plus',
  less: 'Réduire',
  close: 'Fermer',
  dismiss: 'Masquer',
  newTab: "(s'ouvre dans un nouvel onglet)",
  dash: '—',
  unitBpm: 'respirations/min',
  metres: '{n} m',
  percent: '{n} %',
  durationSec: '{s} s',
  durationMinSec: '{m} min {s} s',
};

export const common = { en, fr };
