/** The "How it works" page: four steps, the device banner, rewards and limits. */
const en = {
  eyebrow: 'On your device',
  title: 'How it works',
  intro: 'Four steps, all on your device. Nothing is sent anywhere because there is nowhere to send it.',
  step1Title: 'You breathe',
  step1Body:
    'Choose the microphone or the spacebar. Two prompted breaths in charge your dive light; one long, slow breath out takes you down.',
  step2Title: 'The sound becomes a few numbers',
  step2Body:
    'On the audio thread, each moment of sound is reduced to how loud and how broad it is. No recording is made and nothing is sent anywhere — there is no server to send it to.',
  step3Title: 'Exhales are measured; inhales are prompted',
  step3Body:
    'An exhale has a shape the app can detect: when it starts, how long it lasts, how steady it is. An inhale sounds too much like one, so the rhythm prompts your inhales instead of listening for them.',
  step4Title: 'Before and after',
  step4Body:
    'Ten seconds of ordinary breathing sets your starting rate. The final zone sets the finishing rate. You see both, and the difference — a live measurement, not a score and not a verdict on your health.',
  deviceBanner: 'Nothing leaves your device. No account, no upload, no server.',
  rulesTitle: 'What the game rewards',
  rule1: 'Longer exhales always go further than shorter ones.',
  rule2: 'Slower breathing beats faster breathing over the same time.',
  rule3: 'Holding your breath earns nothing.',
  rule4: 'The prompted pace only ever slows down, and never below six breaths a minute.',
  limitsTitle: 'What it cannot see',
  limit1: 'With the spacebar, only the length of each exhale can be judged — a key is down or it is not.',
  limit2: 'The breathing rate is counted from exhale onsets, not from a chest strap or a capnograph.',
  limit3: 'One session is not evidence about your health.',
  cta: 'Start a dive',
  toResearch: 'See the research',
};

const fr: typeof en = {
  eyebrow: 'Sur votre appareil',
  title: 'Comment ça marche',
  intro: "Quatre étapes, toutes sur votre appareil. Rien n'est envoyé nulle part, parce qu'il n'y a nulle part où l'envoyer.",
  step1Title: 'Vous respirez',
  step1Body:
    "Choisissez le microphone ou la barre d'espace. Deux inspirations guidées chargent votre lampe ; une longue expiration lente vous fait descendre.",
  step2Title: 'Le son devient quelques chiffres',
  step2Body:
    "Sur le fil audio, chaque instant de son est réduit à son intensité et à sa largeur. Aucun enregistrement n'est fait et rien n'est envoyé nulle part — il n'y a pas de serveur à qui l'envoyer.",
  step3Title: 'Les expirations sont mesurées ; les inspirations sont guidées',
  step3Body:
    "Une expiration a une forme que l'application peut détecter : quand elle commence, combien de temps elle dure, à quel point elle est régulière. Une inspiration y ressemble trop ; le rythme guide donc vos inspirations au lieu de les écouter.",
  step4Title: 'Avant et après',
  step4Body:
    "Dix secondes de respiration ordinaire fixent votre rythme de départ. La dernière zone fixe le rythme d'arrivée. Vous voyez les deux, et la différence — une mesure en direct, ni un score ni un verdict sur votre santé.",
  deviceBanner: 'Rien ne quitte votre appareil. Aucun compte, aucun téléversement, aucun serveur.',
  rulesTitle: 'Ce que le jeu récompense',
  rule1: "Une expiration plus longue va toujours plus loin qu'une plus courte.",
  rule2: "Respirer plus lentement l'emporte sur respirer plus vite sur le même temps.",
  rule3: 'Retenir son souffle ne rapporte rien.',
  rule4: 'Le rythme guidé ne fait que ralentir, et jamais sous six respirations par minute.',
  limitsTitle: "Ce qu'il ne peut pas voir",
  limit1: "À la barre d'espace, seule la durée de chaque expiration peut être évaluée — une touche est enfoncée ou ne l'est pas.",
  limit2: "Le rythme respiratoire est compté à partir du début des expirations, non d'une ceinture thoracique ou d'un capnographe.",
  limit3: 'Une séance ne constitue pas une preuve concernant votre santé.',
  cta: 'Commencer une plongée',
  toResearch: 'Voir la recherche',
};

export const how = { en, fr };
