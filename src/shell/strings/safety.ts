/**
 * The scope and safety screen. Every sentence here is one a clinician reads
 * closely; the required statements (not1, care1–3, voiceShort, measuredShort)
 * must stay visible without a click.
 */
const en = {
  eyebrow: 'Scope and safety',
  title: 'Before you dive',
  lead: 'FATHOM is a five-minute breathing exercise you play with your breath. It measures how fast you are breathing at the start, guides you through a slower pattern, and measures again at the end so you can see what changed.',
  notTitle: 'What it is not',
  not1: 'It is **not therapy**, **not diagnosis**, and **not for a crisis**. It does not treat, reduce or cure anxiety or any other condition, and it will never tell you that it has. It trains arousal regulation and shows you a measurement — that is the whole claim.',
  not2: 'There is nothing here that talks to you, remembers you, or scores you against anyone else. No account, no streak, no feed.',
  careTitle: 'Take care',
  care1: 'Not while driving, cycling, swimming or doing anything that needs your attention. Sit still, somewhere safe.',
  care2: 'If slow breathing makes you lightheaded, stop and let your breathing return to normal. There is nothing to win here.',
  care3: 'If you have a heart or lung condition, are pregnant, or have a history of fainting or seizures, check with a clinician before making a habit of it.',
  stopAnyTime: 'You can stop at any point. The session also stops itself.',
  voiceTitle: 'Your voice stays on your device',
  voiceShort:
    'If you use the microphone, the audio is processed on your device and never leaves it. Nothing is uploaded, nothing is stored on a server, and no recording is kept.',
  voiceMore:
    'The app only ever looks at how loud and how broad the sound is, moment to moment — a handful of numbers, not a recording. You can also play the whole thing with the spacebar and never turn the microphone on at all.',
  measuredTitle: 'What is actually measured',
  measuredShort:
    'Your **exhales** are measured — when they start, how long they last, how steady they are. Your **inhales are not**: they are prompted on a rhythm, not sensed. Where you see a breathing rate, it was counted from exhales.',
  measuredMore:
    'An inhale sounds too much like an exhale to tell apart reliably, so the app prompts your inhales on a rhythm and listens only for what follows.',
  begin: 'I have read this — continue',
  backToDive: 'Back to the dive',
  afterBegin:
    'The next screen lets you choose the microphone or the spacebar. Nothing asks for permission until you pick.',
};

const fr: typeof en = {
  eyebrow: 'Portée et sécurité',
  title: 'Avant de plonger',
  lead: "FATHOM est un exercice de respiration de cinq minutes que vous pilotez avec votre souffle. L'application mesure votre rythme respiratoire au départ, vous guide vers un rythme plus lent, puis mesure de nouveau à la fin pour vous montrer ce qui a changé.",
  notTitle: "Ce que ce n'est pas",
  not1: "Ce n'est **pas une thérapie**, **pas un diagnostic**, et **pas un service de crise**. L'application ne traite, ne réduit ni ne guérit l'anxiété ou quelque autre trouble que ce soit, et elle ne prétendra jamais le contraire. Elle entraîne la régulation de l'éveil et vous montre une mesure — c'est là toute son affirmation.",
  not2: "Rien ici ne vous parle, ne vous retient en mémoire, ni ne vous compare à qui que ce soit. Aucun compte, aucune série, aucun fil d'actualité.",
  careTitle: 'Précautions',
  care1: "Jamais en conduisant, à vélo, en nageant ou en faisant quoi que ce soit qui exige votre attention. Asseyez-vous, immobile, dans un endroit sûr.",
  care2: "Si la respiration lente vous donne des étourdissements, arrêtez et laissez votre respiration revenir à la normale. Il n'y a rien à gagner ici.",
  care3: "Si vous avez une affection cardiaque ou pulmonaire, si vous êtes enceinte, ou si vous avez des antécédents d'évanouissement ou de convulsions, parlez-en à un clinicien avant d'en faire une habitude.",
  stopAnyTime: "Vous pouvez arrêter à tout moment. La séance s'arrête aussi d'elle-même.",
  voiceTitle: 'Votre voix reste sur votre appareil',
  voiceShort:
    "Si vous utilisez le microphone, le son est traité sur votre appareil et n'en sort jamais. Rien n'est téléversé, rien n'est conservé sur un serveur, et aucun enregistrement n'est gardé.",
  voiceMore:
    "L'application ne regarde que l'intensité et la largeur du son, instant par instant — une poignée de chiffres, pas un enregistrement. Vous pouvez aussi tout faire à la barre d'espace, sans jamais activer le microphone.",
  measuredTitle: 'Ce qui est réellement mesuré',
  measuredShort:
    'Vos **expirations** sont mesurées — quand elles commencent, combien de temps elles durent, à quel point elles sont régulières. Vos **inspirations ne le sont pas** : elles sont guidées par un rythme, non détectées. Partout où un rythme respiratoire est affiché, il a été compté à partir des expirations.',
  measuredMore:
    "Une inspiration ressemble trop à une expiration pour être distinguée de façon fiable : l'application donne donc le rythme des inspirations et n'écoute que ce qui suit.",
  begin: "J'ai lu — continuer",
  backToDive: 'Retour à la plongée',
  afterBegin:
    "L'écran suivant vous laisse choisir le microphone ou la barre d'espace. Aucune permission n'est demandée avant votre choix.",
};

export const safety = { en, fr };
