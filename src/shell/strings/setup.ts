/** Development-only keys are folded out of the production build. */
const DEV = import.meta.env.DEV;

/** The pre-dive setup panel: input choice, length choice, one Start. */
const en = {
  title: 'Set up your dive',
  howLine: 'A double breath in charges your light; a long, slow breath out takes you down.',
  howLink: 'How it works',
  inputLegend: 'Input',
  micTitle: 'Microphone',
  micDesc: 'Breathe out audibly. Processed on your device; nothing leaves it.',
  spacebarTitle: 'Spacebar',
  spacebarDesc: 'Hold the key for as long as you breathe out. No microphone at all.',
  /** Development only. */
  scriptedTitle: DEV ? 'Scripted fixture' : '',
  /** Development only. */
  scriptedDesc: DEV ? 'Breathes for you, following the prompt.' : '',
  /** Development only. */
  speed: DEV ? '{n}× speed' : '',
  lengthLegend: 'Length',
  fullTitle: 'Dive',
  fullDesc: 'About 5 minutes · three zones',
  quickTitle: 'Quick dive',
  quickDesc: '90 seconds · one zone, for right before',
  start: 'Start the dive',
  permissionNote: 'Nothing asks for the microphone until you press Start.',
  micFidelity:
    'The inhale is prompted on a rhythm rather than listened for, and the audio never leaves your device.',
  spacebarNote: 'The microphone stays off for the whole dive.',
  startError: 'The dive could not start: {reason}',
  micRefused:
    'The microphone was not available, so the spacebar is driving this dive instead — hold it for as long as you are exhaling. ({reason})',
  inputMicrophone: 'Microphone',
  inputKeyboard: 'Keyboard',
  inputScripted: DEV ? 'Scripted fixture' : '',
};

const fr: typeof en = {
  title: 'Préparez votre plongée',
  howLine: 'Deux inspirations chargent votre lampe ; une longue expiration lente vous fait descendre.',
  howLink: 'Comment ça marche',
  inputLegend: 'Entrée',
  micTitle: 'Microphone',
  micDesc: "Expirez de façon audible. Traité sur votre appareil ; rien n'en sort.",
  spacebarTitle: "Barre d'espace",
  spacebarDesc: 'Maintenez la touche aussi longtemps que vous expirez. Aucun microphone.',
  scriptedTitle: DEV ? 'Séquence scriptée' : '',
  scriptedDesc: DEV ? 'Respire à votre place, en suivant le rythme.' : '',
  speed: DEV ? 'vitesse {n}×' : '',
  lengthLegend: 'Durée',
  fullTitle: 'Plongée',
  fullDesc: 'Environ 5 minutes · trois zones',
  quickTitle: 'Plongée rapide',
  quickDesc: '90 secondes · une zone, juste avant',
  start: 'Commencer la plongée',
  permissionNote: 'Rien ne demande le microphone avant que vous appuyiez sur Commencer.',
  micFidelity:
    "L'inspiration est guidée par le rythme plutôt qu'écoutée, et l'audio ne quitte jamais votre appareil.",
  spacebarNote: 'Le microphone reste éteint pendant toute la plongée.',
  startError: "La plongée n'a pas pu démarrer : {reason}",
  micRefused:
    "Le microphone n'était pas disponible : c'est donc la barre d'espace qui pilote cette plongée — maintenez-la aussi longtemps que vous expirez. ({reason})",
  inputMicrophone: 'Microphone',
  inputKeyboard: 'Clavier',
  inputScripted: DEV ? 'Séquence scriptée' : '',
};

export const setup = { en, fr };
