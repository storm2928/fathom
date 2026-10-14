import { useLanguage } from '@fathom/shell/i18n';

/**
 * Text that exists only in the app. Every claim, safety and result sentence
 * comes from the website's strings instead — those have already been read by
 * the people who check them.
 */
const en = {
  tagline: 'A dive you take with your breath.',
  scopeLine: 'Not therapy, not diagnosis, not for a crisis.',
  dive: 'Dive',
  diveLength: 'About five minutes',
  quick: 'Quick dive',
  quickLength: 'Ninety seconds',
  chooseInput: 'How will you breathe?',
  useMic: 'Use the microphone',
  useMicHint: 'Breathe out through your mouth. Nothing is recorded.',
  useTouch: 'Touch and hold',
  useTouchHint: 'Hold a finger on the screen for as long as you breathe out.',
  headphones: 'Headphones on for the full sound. Sit somewhere still.',
  begin: 'Begin',
  back: 'Back',
  holdHint: 'Hold anywhere while you breathe out',
  zones: ['Twilight', 'Midnight', 'Abyss'],
  zoneLabel: 'Zone',
  done: 'Done',
  micFellBack: 'The microphone was unavailable, so this dive is on touch and hold.',
  leftEarly: 'Left early',
  leftBeforeBaseline:
    'You left before your starting rate had been read, so there is nothing to compare this time.',
  lostFixMic: 'A quieter room usually fixes it — or choose touch and hold instead of the microphone.',
  lostFixTouch:
    'No holds were felt while your starting rate was being read. Hold a finger on the screen for each breath out, from the very first one.',
  diveComplete: 'Dive complete',
  deepestZone: 'Deepest zone: {zone}',
  metresUnit: 'm',
  breathing: 'Breathing',
  inWater: 'In the water',
  breaths: 'Breaths',
  longestExhale: 'Longest breath out',
  caveat: 'Measured from your breaths out. Not a health test.',
  aboutNumbers: 'About these numbers',
  needPerson: 'Need to talk to someone?',
  close: 'Close',
  settings: 'Settings',
  volume: 'Volume',
  breathingMode: 'Breathing mode',
  modeNextDive: 'This dive keeps its current mode. The change applies from your next dive.',
};

const fr: typeof en = {
  tagline: 'Une plongée que vous menez avec votre souffle.',
  scopeLine: 'Ni une thérapie, ni un diagnostic, ni pour une crise.',
  dive: 'Plonger',
  diveLength: 'Environ cinq minutes',
  quick: 'Plongée rapide',
  quickLength: 'Quatre-vingt-dix secondes',
  chooseInput: 'Comment allez-vous respirer ?',
  useMic: 'Utiliser le microphone',
  useMicHint: 'Expirez par la bouche. Rien n’est enregistré.',
  useTouch: 'Appui maintenu',
  useTouchHint: 'Gardez un doigt sur l’écran pendant toute l’expiration.',
  headphones: 'Mettez des écouteurs pour le son complet. Installez-vous au calme.',
  begin: 'Commencer',
  back: 'Retour',
  holdHint: 'Maintenez n’importe où pendant l’expiration',
  zones: ['Crépuscule', 'Minuit', 'Abysses'],
  zoneLabel: 'Zone',
  done: 'Terminé',
  micFellBack: 'Le microphone était indisponible : cette plongée se fait par appui maintenu.',
  leftEarly: 'Sortie anticipée',
  leftBeforeBaseline:
    'La plongée s’est arrêtée avant la lecture de votre rythme de départ : il n’y a donc rien à comparer cette fois.',
  lostFixMic:
    'Un endroit plus calme règle généralement le problème — ou choisissez l’appui maintenu plutôt que le microphone.',
  lostFixTouch:
    'Aucun appui n’a été senti pendant la lecture de votre rythme de départ. Gardez un doigt sur l’écran à chaque expiration, dès la première.',
  diveComplete: 'Plongée terminée',
  deepestZone: 'Zone la plus profonde : {zone}',
  metresUnit: 'm',
  breathing: 'Respiration',
  inWater: 'Dans l’eau',
  breaths: 'Respirations',
  longestExhale: 'Plus longue expiration',
  caveat: 'Mesuré à partir de vos expirations. Pas un test de santé.',
  aboutNumbers: 'À propos de ces chiffres',
  needPerson: 'Besoin de parler à quelqu’un ?',
  close: 'Fermer',
  settings: 'Réglages',
  volume: 'Volume',
  breathingMode: 'Mode de respiration',
  modeNextDive: 'Cette plongée garde son mode actuel. Le changement s’applique à la prochaine plongée.',
};

export type AppStrings = typeof en;

export function useAppStrings(): AppStrings {
  const { language } = useLanguage();
  return language === 'fr' ? fr : en;
}
