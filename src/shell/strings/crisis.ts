/**
 * The crisis rail. The numbers themselves (988, 9-8-8, findahelpline.com) are
 * literal in CrisisRail.tsx and never translated — a mistranslated helpline
 * number would be the worst bug this layer could have.
 */
const en = {
  label: 'Crisis support',
  heading: 'Talk to a person',
  lead: 'If you are in crisis or thinking about harming yourself, please talk to a person. This app is not one.',
  usBody: 'Suicide & Crisis Lifeline, United States. Call or text.',
  caBody: 'Suicide Crisis Helpline, Canada. Call or text.',
  intlBody: 'free, confidential lines in over 130 countries.',
};

const fr: typeof en = {
  label: 'Ressources de crise',
  heading: 'Parlez à une personne',
  lead: "Si vous traversez une crise ou pensez à vous faire du mal, parlez à une personne. Cette application n'en est pas une.",
  usBody: 'Suicide & Crisis Lifeline, États-Unis. Par appel ou texto.',
  caBody: "Ligne d'aide en cas de crise de suicide, Canada. Par appel ou texto.",
  intlBody: 'lignes gratuites et confidentielles dans plus de 130 pays.',
};

export const crisis = { en, fr };
