import type { DeviceKind } from './app/platform.ts';

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
  onboardBreatheTitle: 'Breathe to dive',
  onboardBreathe:
    'Two breaths in through your nose — a full one, then a little more. Then one long, slow breath out through your mouth. Every breath out takes you deeper; the longer and slower, the further you go.',
  orbIn: 'Breathe in',
  orbMore: 'A little more',
  orbOut: 'Slowly out',
  onboardInputTitle: 'How will you breathe?',
  otherAudio: 'Other audio is playing. Pause it, or put on headphones, so the microphone hears only your breath.',
  micDeclined: 'Microphone access was declined, so touch and hold is selected. You can change this in Settings.',
  next: 'Next',
  reread: 'How to breathe and stay safe',
  language: 'Language',
  journal: 'Journal',
  fieldJournal: 'Field journal',
  logbook: 'Logbook',
  notFoundYet: 'Not found yet',
  firstFound: 'First found {depth} m down, {date}',
  found: 'Found',
  foundThisDive: 'Found this dive',
  newFind: 'New',
  logEmpty: 'Your dives will appear here.',
  logLeftEarly: 'left early',
  haptics: 'Haptics',
  hapticsHint: 'Feel the rhythm and each breath out',
  on: 'On',
  off: 'Off',
  modeNextDive: 'This dive keeps its current mode. The change applies from your next dive.',
  privacyPolicy: 'Privacy policy',
  appleHealth: 'Apple Health',
  appleHealthHint: 'Save each dive as mindful minutes',
  healthDeclined: 'Fathom may not write to Health. Allow it in Settings → Privacy & Security → Health → Fathom.',
  micUnheard: 'Not hearing your breath out. Bring the phone a little closer and breathe out through your mouth.',
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
  onboardBreatheTitle: 'Respirer pour plonger',
  onboardBreathe:
    'Deux inspirations par le nez — une pleine, puis encore un peu. Ensuite, une longue expiration lente par la bouche. Chaque expiration vous fait descendre ; plus elle est longue et lente, plus vous allez loin.',
  orbIn: 'Inspirez',
  orbMore: 'Encore un peu',
  orbOut: 'Expirez lentement',
  onboardInputTitle: 'Comment allez-vous respirer ?',
  otherAudio: 'Un autre son est en cours de lecture. Mettez-le en pause, ou mettez des écouteurs, pour que le microphone n’entende que votre souffle.',
  micDeclined: 'L’accès au microphone a été refusé : l’appui maintenu est sélectionné. Vous pouvez changer cela dans les réglages.',
  next: 'Suivant',
  reread: 'Respirer et rester en sécurité',
  language: 'Langue',
  journal: 'Journal',
  fieldJournal: 'Carnet de plongée',
  logbook: 'Historique',
  notFoundYet: 'Pas encore trouvé',
  firstFound: 'Trouvé pour la première fois à {depth} m, le {date}',
  found: 'Trouvé',
  foundThisDive: 'Trouvés pendant cette plongée',
  newFind: 'Nouveau',
  logEmpty: 'Vos plongées apparaîtront ici.',
  logLeftEarly: 'sortie anticipée',
  haptics: 'Retours haptiques',
  hapticsHint: 'Sentez le rythme et chaque expiration',
  on: 'Activés',
  off: 'Désactivés',
  modeNextDive: 'Cette plongée garde son mode actuel. Le changement s’applique à la prochaine plongée.',
  privacyPolicy: 'Politique de confidentialité',
  appleHealth: 'Apple Santé',
  appleHealthHint: 'Enregistrer chaque plongée en minutes de pleine conscience',
  healthDeclined: 'Fathom n’a pas le droit d’écrire dans Santé. Autorisez-le dans Réglages → Confidentialité et sécurité → Santé → Fathom.',
  micUnheard: 'Votre expiration ne s’entend pas. Rapprochez un peu le téléphone et expirez par la bouche.',
};


export type AppStrings = typeof en;
export type Language = 'en' | 'fr';

export const APP_STRINGS: Record<Language, AppStrings> = { en, fr };

/**
 * A browser has no phone to bring closer. Shared by every browser, touch or not.
 */
const webEn: Partial<AppStrings> = {
  micUnheard: 'Not hearing your breath out. Move a little closer to the microphone and breathe out through your mouth.',
};
const webFr: Partial<AppStrings> = {
  micUnheard: 'Votre expiration ne s’entend pas. Rapprochez-vous un peu du microphone et expirez par la bouche.',
};

/** On a desk the hold is Space or the mouse button, never a finger on the screen. */
const desktopEn: Partial<AppStrings> = {
  ...webEn,
  useTouch: 'Hold to breathe out',
  useTouchHint: 'Hold Space, or hold the mouse button, for as long as you breathe out.',
  holdHint: 'Hold Space or the mouse button while you breathe out',
  micFellBack: 'The microphone was unavailable, so this dive is on Space or the mouse button: hold it while you breathe out.',
  lostFixMic: 'A quieter room usually fixes it — or choose hold to breathe out instead of the microphone.',
  lostFixTouch:
    'No holds were felt while your starting rate was being read. Hold Space or the mouse button for each breath out, from the very first one.',
  micDeclined: 'Microphone access was declined, so hold to breathe out is selected. You can change this in Settings.',
};
const desktopFr: Partial<AppStrings> = {
  ...webFr,
  useTouch: 'Maintenir pour expirer',
  useTouchHint: 'Maintenez la barre d’espace, ou le bouton de la souris, pendant toute l’expiration.',
  holdHint: 'Maintenez Espace ou le bouton de la souris pendant l’expiration',
  micFellBack:
    'Le microphone était indisponible : cette plongée se fait avec Espace ou le bouton de la souris, maintenus pendant l’expiration.',
  lostFixMic:
    'Un endroit plus calme règle généralement le problème — ou choisissez « Maintenir pour expirer » plutôt que le microphone.',
  lostFixTouch:
    'Rien n’a été maintenu pendant la lecture de votre rythme de départ. Maintenez Espace ou le bouton de la souris à chaque expiration, dès la première.',
  micDeclined:
    'L’accès au microphone a été refusé : « Maintenir pour expirer » est sélectionné. Vous pouvez changer cela dans les réglages.',
};

const OVERRIDES: Record<DeviceKind, Record<Language, Partial<AppStrings>>> = {
  native: { en: {}, fr: {} },
  desktop: { en: desktopEn, fr: desktopFr },
  'touch-web': { en: webEn, fr: webFr },
};

/** The app's text for this language on this kind of device. */
export function stringsFor(language: Language, device: DeviceKind): AppStrings {
  return { ...APP_STRINGS[language], ...OVERRIDES[device][language] };
}
