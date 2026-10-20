/**
 * Fathom's privacy policy, as shown in Settings. The public copy the App Store
 * links to is public/privacy.html; policy.test.ts keeps the two in step.
 *
 * It says what the code does and nothing more: no data leaves the phone, the
 * microphone is measured and thrown away, saved state lives in the app's own
 * storage, and Apple Health is written only when the player turns it on.
 */

export interface PolicySection {
  heading: string;
  body: string[];
}

export interface Policy {
  title: string;
  updated: string;
  sections: PolicySection[];
}

/** Where privacy questions go. Shown in the policy and on the support page. */
export const CONTACT_EMAIL = 'support@jasindev.com';

const en: Policy = {
  title: 'Privacy policy',
  updated: 'Last updated 20 October 2026',
  sections: [
    {
      heading: 'The short version',
      body: [
        'Fathom collects nothing. There is no account, no server, no analytics, no advertising and no tracking. Everything the app knows stays on your iPhone.',
      ],
    },
    {
      heading: 'The microphone',
      body: [
        'If you choose the microphone, Fathom listens to the sound of your breath out while a dive is running. The sound is turned into a few numbers about fifty times a second, on your iPhone, and thrown away straight after. Nothing is recorded, stored or sent anywhere.',
        'The microphone is off outside a dive. You can dive without it: Settings → Breathing mode → Touch and hold.',
      ],
    },
    {
      heading: 'What is saved on your iPhone',
      body: [
        'Your settings (language, volume, haptics, breathing mode), your field journal (which creatures you have found, how deep and when) and your logbook (the date and length of each dive and your breathing rate at the start and the end).',
        'These are kept in the app’s own storage on your iPhone and are never sent anywhere. Deleting the app deletes them.',
      ],
    },
    {
      heading: 'Apple Health',
      body: [
        'Off unless you turn it on in Settings. When it is on, Fathom writes each dive of thirty seconds or more to Apple Health as mindful minutes: when it started and when it ended, nothing else. Fathom never reads anything from Health.',
        'You can stop it at any time in Fathom’s settings, or in the Health app, or in iOS Settings → Privacy & Security → Health → Fathom. What is in Health is kept by Apple under Apple’s own privacy terms.',
      ],
    },
    {
      heading: 'Sharing a dive',
      body: [
        'When you share your dive log, the iOS share sheet sends it where you choose. Nothing leaves your iPhone until you pick a destination.',
      ],
    },
    {
      heading: 'Children',
      body: ['Fathom collects no information from anyone, including children under 13.'],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes, the new version will be posted in the app and on this page with a new date.',
      ],
    },
    {
      heading: 'Contact',
      body: ['Questions about privacy: support@jasindev.com'],
    },
  ],
};

const fr: Policy = {
  title: 'Politique de confidentialité',
  updated: 'Dernière mise à jour : 20 octobre 2026',
  sections: [
    {
      heading: 'En bref',
      body: [
        'Fathom ne collecte rien. Pas de compte, pas de serveur, pas de statistiques, pas de publicité, pas de pistage. Tout ce que l’app sait reste sur votre iPhone.',
      ],
    },
    {
      heading: 'Le microphone',
      body: [
        'Si vous choisissez le microphone, Fathom écoute le son de votre expiration pendant une plongée. Le son est transformé en quelques nombres environ cinquante fois par seconde, sur votre iPhone, puis effacé aussitôt. Rien n’est enregistré, conservé ni envoyé.',
        'Le microphone est éteint en dehors d’une plongée. Vous pouvez plonger sans lui : Réglages → Mode de respiration → Appui maintenu.',
      ],
    },
    {
      heading: 'Ce qui est conservé sur votre iPhone',
      body: [
        'Vos réglages (langue, volume, retours haptiques, mode de respiration), votre carnet de plongée (les créatures trouvées, à quelle profondeur et quand) et votre historique (la date et la durée de chaque plongée, et votre rythme respiratoire au début et à la fin).',
        'Ils sont conservés dans le stockage propre à l’app sur votre iPhone et ne sont jamais envoyés. Supprimer l’app les supprime.',
      ],
    },
    {
      heading: 'Apple Santé',
      body: [
        'Désactivé, sauf si vous l’activez dans les réglages. Une fois activé, Fathom enregistre chaque plongée de trente secondes ou plus dans Apple Santé comme minutes de pleine conscience : l’heure de début et l’heure de fin, rien d’autre. Fathom ne lit jamais rien dans Santé.',
        'Vous pouvez l’arrêter à tout moment dans les réglages de Fathom, dans l’app Santé, ou dans Réglages → Confidentialité et sécurité → Santé → Fathom. Les données de Santé sont conservées par Apple selon ses propres conditions de confidentialité.',
      ],
    },
    {
      heading: 'Partager une plongée',
      body: [
        'Quand vous partagez votre journal de plongée, la feuille de partage d’iOS l’envoie là où vous le choisissez. Rien ne quitte votre iPhone avant que vous ayez choisi une destination.',
      ],
    },
    {
      heading: 'Enfants',
      body: ['Fathom ne collecte aucune information, auprès de personne, y compris les enfants de moins de 13 ans.'],
    },
    {
      heading: 'Modifications',
      body: [
        'Si cette politique change, la nouvelle version sera publiée dans l’app et sur cette page avec une nouvelle date.',
      ],
    },
    {
      heading: 'Contact',
      body: ['Questions sur la confidentialité : support@jasindev.com'],
    },
  ],
};

export const POLICY: Record<'en' | 'fr', Policy> = { en, fr };
