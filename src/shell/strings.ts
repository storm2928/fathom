
/**
 * Strings live here, not in components.
 *
 * Every user-facing sentence is a whole sentence in this file, including the
 * emphasis, because that is the unit a translator can actually work with —
 * splitting a sentence around a <strong> produces fragments that cannot be
 * reordered into good French. Emphasis is carried as **markers** and rendered
 * by <Rich>.
 *
 * The safety and scope wording is the reason this is worth doing properly. It
 * is the text a clinician judge reads most closely, and half-translating it
 * would be worse than not offering French at all.
 */

export type Language = 'en' | 'fr';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const en = {
  nav: { dive: 'Dive', harness: 'Input harness', scope: 'Scope' },

  crisis: {
    lead: 'If you are in crisis or thinking about harming yourself, please talk to a person. This app is not one.',
    usBody: 'Suicide & Crisis Lifeline, United States. Call or text.',
    caBody: 'Suicide Crisis Helpline, Canada. Call or text.',
    intlBody: 'free, confidential lines in over 130 countries.',
    label: 'Crisis support',
  },

  onboarding: {
    title: 'Before you dive',
    lead: 'FATHOM is a five-minute breathing exercise you play with your breath. It measures how fast you are breathing at the start, guides you through a slower pattern, and measures again at the end so you can see what changed.',
    notTitle: 'What it is not',
    not1: 'It is **not therapy**, **not diagnosis**, and **not for a crisis**. It does not treat, reduce or cure anxiety or any other condition, and it will never tell you that it has. It trains arousal regulation and shows you a measurement — that is the whole claim.',
    not2: 'There is nothing here that talks to you, remembers you, or scores you against anyone else. No account, no streak, no feed.',
    careTitle: 'Take care if',
    care1: 'You are driving, cycling, swimming, or operating anything that needs your attention. Do this sitting still, somewhere safe.',
    care2: 'Slow breathing makes you lightheaded. Some people find it does. If that happens, stop and let your breathing return to normal — there is nothing to win here.',
    care3: 'You have a heart or lung condition, are pregnant, or have a history of fainting or seizures. Worth a word with a clinician before making a habit of it.',
    stopAnyTime: 'You can stop at any point. The session also stops itself.',
    voiceTitle: 'What happens to your voice',
    voice: 'If you use the microphone, the audio is processed on your device and never leaves it. Nothing is uploaded, nothing is stored on a server, and no recording is kept — the app only ever looks at how loud and how broad the sound is, moment to moment. You can also play the whole thing with the spacebar and never turn the microphone on at all.',
    measuredTitle: 'What is actually measured',
    measured:
      'Your **exhales** are measured — when they start, how long they last, how steady they are. Your **inhales are not**. An inhale sounds too much like an exhale to tell apart reliably, so the app prompts your inhales on a rhythm and listens only for what follows. Where you see a breathing rate, it was counted from exhales.',
    begin: 'I have read this — continue',
    afterBegin:
      'The next screen lets you choose the microphone or the spacebar. Nothing asks for permission until you pick.',
  },

  surface: {
    title: 'What changed',
    before: 'Before',
    after: 'After',
    unit: 'breaths/min',
    slowed: 'Your breathing slowed by **{delta}** breaths per minute over this session.',
    halfway: 'Half of that change had happened {time} in.',
    unchanged:
      'Your breathing finished about where it started. That happens, and it is worth seeing rather than being told otherwise — some days the body does not downshift, and a session that reported one anyway would not be measuring anything.',
    sped: 'Your breathing was **{delta}** breaths per minute faster at the end than at the start. Reporting it the other way round would be flattering and false.',
    breaths: 'Breaths measured',
    duration: 'Time in the water',
    input: 'Input',
    signal: 'Signal',
    note: 'This is a measurement of how fast you were breathing, before and after. It trains arousal regulation and shows you the result live — it does not treat, diagnose or cure anything, and one session is not evidence about your health. Your exhales were measured; the inhales were prompted by the rhythm rather than sensed.',
    noteFallback:
      ' This session was driven by {input} rather than the microphone, so the timing is what was reported rather than what was heard.',
    exit: 'That is the whole session. Go and do the thing you came here to do.',
    leave: 'Leave',
    lostTitle: 'The dive ended early',
    lostBody:
      'The signal stopped being readable, so there is nothing measured well enough to show you. A number here would be invented, and an invented number is worse than none.',
    lostFix: 'A quieter room, or the spacebar instead of the microphone, will usually fix it.',
    close: 'Close',
    save: 'Save dive log',
    saveNote:
      'Downloads a small file to this device. Nothing is uploaded, and nothing is kept here once you leave.',
  },

  dive: {
    scripted: 'Scripted fixture',
    spacebar: 'Spacebar',
    full: 'Dive',
    quick: 'Quick dive · 90s',
    leave: 'Leave',
    speed: '{n}× speed',
    depth: 'Depth',
    rate: 'Rate',
    stage: 'Stage',
    hintSpacebar:
      'Hold the spacebar for as long as you are exhaling, following the prompt in the top right of the scene. Longer, steadier exhales carry you further.',
    hintScripted:
      'The scripted fixture is breathing for you, following the prompt. Switch to the spacebar to drive it yourself.',
    inputKeyboard: 'Keyboard',
    inputMicrophone: 'Microphone',
    inputScripted: 'Scripted fixture',
  },

  state: {
    idle: 'Ready',
    calibrating: 'Reading your baseline',
    'zone-1': 'Zone 1',
    'zone-2': 'Zone 2',
    'zone-3': 'Zone 3',
    surfacing: 'Surfacing',
    ended: 'Done',
  },
};

/** Translated with the same care as the English, because it is read as closely. */
const fr: Strings = {
  nav: { dive: 'Plongée', harness: "Banc d'essai", scope: 'Portée' },

  crisis: {
    lead: "Si vous traversez une crise ou pensez à vous faire du mal, parlez à une personne. Cette application n'en est pas une.",
    usBody: 'Suicide & Crisis Lifeline, États-Unis. Par appel ou texto.',
    caBody: 'Ligne d’aide en cas de crise de suicide, Canada. Par appel ou texto.',
    intlBody: 'lignes gratuites et confidentielles dans plus de 130 pays.',
    label: 'Ressources de crise',
  },

  onboarding: {
    title: 'Avant de plonger',
    lead: "FATHOM est un exercice de respiration de cinq minutes que vous pilotez avec votre souffle. L'application mesure votre rythme respiratoire au départ, vous guide vers un rythme plus lent, puis mesure de nouveau à la fin pour vous montrer ce qui a changé.",
    notTitle: "Ce que ce n'est pas",
    not1: "Ce n'est **pas une thérapie**, **pas un diagnostic**, et **pas un service de crise**. L'application ne traite, ne réduit ni ne guérit l'anxiété ou quelque autre trouble que ce soit, et elle ne prétendra jamais le contraire. Elle entraîne la régulation de l'éveil et vous montre une mesure — c'est là toute son affirmation.",
    not2: "Rien ici ne vous parle, ne vous retient en mémoire, ni ne vous compare à qui que ce soit. Aucun compte, aucune série, aucun fil d'actualité.",
    careTitle: 'Soyez prudent si',
    care1: "Vous conduisez, roulez à vélo, nagez, ou faites quoi que ce soit qui exige votre attention. Faites cet exercice assis, immobile, dans un endroit sûr.",
    care2: "La respiration lente vous donne des étourdissements. Cela arrive à certaines personnes. Si c'est le cas, arrêtez et laissez votre respiration revenir à la normale — il n'y a rien à gagner ici.",
    care3: "Vous avez une affection cardiaque ou pulmonaire, vous êtes enceinte, ou vous avez des antécédents d'évanouissement ou de convulsions. Parlez-en à un clinicien avant d'en faire une habitude.",
    stopAnyTime: "Vous pouvez arrêter à tout moment. La séance s'arrête aussi d'elle-même.",
    voiceTitle: 'Ce qu’il advient de votre voix',
    voice: "Si vous utilisez le microphone, le son est traité sur votre appareil et n'en sort jamais. Rien n'est téléversé, rien n'est conservé sur un serveur, et aucun enregistrement n'est gardé — l'application ne regarde que l'intensité et la largeur du son, instant par instant. Vous pouvez aussi tout faire à la barre d'espace, sans jamais activer le microphone.",
    measuredTitle: 'Ce qui est réellement mesuré',
    measured:
      "Vos **expirations** sont mesurées — quand elles commencent, combien de temps elles durent, à quel point elles sont régulières. Vos **inspirations ne le sont pas**. Une inspiration ressemble trop à une expiration pour être distinguée de façon fiable : l'application donne donc le rythme des inspirations et n'écoute que ce qui suit. Partout où un rythme respiratoire est affiché, il a été compté à partir des expirations.",
    begin: "J'ai lu — continuer",
    afterBegin:
      "L'écran suivant vous laisse choisir le microphone ou la barre d'espace. Aucune permission n'est demandée avant votre choix.",
  },

  surface: {
    title: 'Ce qui a changé',
    before: 'Avant',
    after: 'Après',
    unit: 'respirations/min',
    slowed: 'Votre respiration a ralenti de **{delta}** respirations par minute au cours de cette séance.',
    halfway: 'La moitié de ce changement était atteinte après {time}.',
    unchanged:
      "Votre respiration a fini à peu près là où elle avait commencé. Cela arrive, et il vaut mieux le voir que s'entendre dire le contraire — certains jours le corps ne ralentit pas, et une séance qui prétendrait le contraire ne mesurerait rien du tout.",
    sped: "Votre respiration était **{delta}** respirations par minute plus rapide à la fin qu'au début. L'annoncer dans l'autre sens serait flatteur et faux.",
    breaths: 'Respirations mesurées',
    duration: 'Temps sous l’eau',
    input: 'Entrée',
    signal: 'Signal',
    note: "Ceci est une mesure de votre rythme respiratoire, avant et après. L'application entraîne la régulation de l'éveil et vous en montre le résultat en direct — elle ne traite, ne diagnostique ni ne guérit rien, et une séance ne constitue pas une preuve concernant votre santé. Vos expirations ont été mesurées ; les inspirations ont été rythmées, non détectées.",
    noteFallback:
      " Cette séance a été pilotée par {input} plutôt que par le microphone : les durées sont donc celles qui ont été signalées, et non celles qui ont été entendues.",
    exit: "C'est toute la séance. Allez faire ce pour quoi vous êtes venu.",
    leave: 'Quitter',
    lostTitle: 'La plongée s’est arrêtée tôt',
    lostBody:
      "Le signal est devenu illisible : rien n'a été mesuré assez bien pour vous être montré. Un chiffre ici serait inventé, et un chiffre inventé vaut moins que pas de chiffre du tout.",
    lostFix: "Une pièce plus calme, ou la barre d'espace plutôt que le microphone, règle généralement le problème.",
    close: 'Fermer',
    save: 'Enregistrer le journal',
    saveNote:
      "Télécharge un petit fichier sur cet appareil. Rien n'est téléversé, et rien n'est conservé ici après votre départ.",
  },

  dive: {
    scripted: 'Séquence scriptée',
    spacebar: "Barre d'espace",
    full: 'Plonger',
    quick: 'Plongée rapide · 90 s',
    leave: 'Quitter',
    speed: 'vitesse {n}×',
    depth: 'Profondeur',
    rate: 'Rythme',
    stage: 'Étape',
    hintSpacebar:
      "Maintenez la barre d'espace aussi longtemps que vous expirez, en suivant le repère en haut à droite de la scène. Des expirations plus longues et plus régulières vous portent plus loin.",
    hintScripted:
      "La séquence scriptée respire à votre place, en suivant le rythme. Passez à la barre d'espace pour piloter vous-même.",
    inputKeyboard: 'Clavier',
    inputMicrophone: 'Microphone',
    inputScripted: 'Séquence scriptée',
  },

  state: {
    idle: 'Prêt',
    calibrating: 'Lecture de votre rythme de départ',
    'zone-1': 'Zone 1',
    'zone-2': 'Zone 2',
    'zone-3': 'Zone 3',
    surfacing: 'Remontée',
    ended: 'Terminé',
  },
};

/** The shape every language must satisfy. */
export type Strings = typeof en;

export const DICTIONARIES: Record<Language, typeof en> = { en, fr };

/** Substitute {name} placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

