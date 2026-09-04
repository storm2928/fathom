/**
 * The surface (results) screen. The three verdicts share one visual weight;
 * a null result and a faster-than-start result are stated as plainly as a
 * slowed one.
 */
const en = {
  title: 'What changed',
  stoppedChip: 'Left early',
  before: 'Before',
  after: 'After',
  unit: 'breaths/min',
  deltaSlower: '{delta} {unit} slower',
  deltaFaster: '{delta} {unit} faster',
  deltaNone: 'no meaningful change',
  slowed: 'Your breathing slowed by **{delta}** breaths per minute over this session.',
  halfway: 'Half of that change had happened {time} in.',
  unchanged:
    'Your breathing finished about where it started. That happens, and it is worth seeing rather than being told otherwise — some days the body does not downshift, and a session that reported one anyway would not be measuring anything.',
  sped: 'Your breathing was **{delta}** breaths per minute faster at the end than at the start. Reporting it the other way round would be flattering and false.',
  stopped: 'You left before the end, so this is what had been measured by then.',
  downshift: 'Downshift',
  downshiftHint: 'time to half the change',
  breaths: 'Breaths measured',
  duration: 'Time in the water',
  input: 'Input',
  signal: 'Signal',
  note: 'This is a measurement of how fast you were breathing, before and after. It trains arousal regulation and shows you the result live — it does not treat, diagnose or cure anything, and one session is not evidence about your health. Your exhales were measured; the inhales were prompted by the rhythm rather than sensed.',
  /** Leading space intentional — appended to `note`. */
  noteFallback:
    ' This session was driven by {input} rather than the microphone, so the timing is what was reported rather than what was heard.',
  exit: 'That is the whole session. Go and do the thing you came here to do.',
  leave: 'Leave',
  save: 'Save dive log',
  saveNote:
    'Downloads a small file to this device. Nothing is uploaded, and nothing is kept here once you leave.',
  lostTitle: 'The dive ended early',
  lostBody:
    'The signal stopped being readable, so there is nothing measured well enough to show you. A number here would be invented, and an invented number is worse than none.',
  lostFix: 'A quieter room, or the spacebar instead of the microphone, will usually fix it.',
  close: 'Close',
  /** The live-region result: two measurements, never a verdict. */
  announce: '{title}: {before} → {after} {unit}',
};

const fr: typeof en = {
  title: 'Ce qui a changé',
  stoppedChip: 'Quitté avant la fin',
  before: 'Avant',
  after: 'Après',
  unit: 'respirations/min',
  deltaSlower: '{delta} {unit} plus lent',
  deltaFaster: '{delta} {unit} plus rapide',
  deltaNone: 'pas de changement notable',
  slowed: 'Votre respiration a ralenti de **{delta}** respirations par minute au cours de cette séance.',
  halfway: 'La moitié de ce changement était atteinte après {time}.',
  unchanged:
    "Votre respiration a fini à peu près là où elle avait commencé. Cela arrive, et il vaut mieux le voir que s'entendre dire le contraire — certains jours le corps ne ralentit pas, et une séance qui prétendrait le contraire ne mesurerait rien du tout.",
  sped: "Votre respiration était **{delta}** respirations par minute plus rapide à la fin qu'au début. L'annoncer dans l'autre sens serait flatteur et faux.",
  stopped: "Vous avez quitté avant la fin : voici ce qui avait été mesuré jusque-là.",
  downshift: 'Ralentissement',
  downshiftHint: "temps jusqu'à la moitié du changement",
  breaths: 'Respirations mesurées',
  duration: "Temps sous l'eau",
  input: 'Entrée',
  signal: 'Signal',
  note: "Ceci est une mesure de votre rythme respiratoire, avant et après. L'application entraîne la régulation de l'éveil et vous en montre le résultat en direct — elle ne traite, ne diagnostique ni ne guérit rien, et une séance ne constitue pas une preuve concernant votre santé. Vos expirations ont été mesurées ; les inspirations ont été rythmées, non détectées.",
  noteFallback:
    " Cette séance a été pilotée par {input} plutôt que par le microphone : les durées sont donc celles qui ont été signalées, et non celles qui ont été entendues.",
  exit: "C'est toute la séance. Allez faire ce pour quoi vous êtes venu.",
  leave: 'Quitter',
  save: 'Enregistrer le journal',
  saveNote:
    "Télécharge un petit fichier sur cet appareil. Rien n'est téléversé, et rien n'est conservé ici après votre départ.",
  lostTitle: "La plongée s'est arrêtée tôt",
  lostBody:
    "Le signal est devenu illisible : rien n'a été mesuré assez bien pour vous être montré. Un chiffre ici serait inventé, et un chiffre inventé vaut moins que pas de chiffre du tout.",
  lostFix: "Une pièce plus calme, ou la barre d'espace plutôt que le microphone, règle généralement le problème.",
  close: 'Fermer',
  announce: '{title} : {before} → {after} {unit}',
};

export const surface = { en, fr };
