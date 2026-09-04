/**
 * The in-dive HUD, plus the `state` namespace (keyed by SessionState) and the
 * `signal` namespace (keyed by SignalQuality). The state and signal keys are
 * the machine's own names and must not change.
 */
const en = {
  dive: {
    depth: 'Depth',
    /** Beside the depth while the diver is sinking. A state, never a score. */
    descending: 'descending',
    light: 'Light',
    stage: 'Stage',
    leave: 'Leave',
    started: 'Dive started. Press Enter on Leave to stop.',
    sceneDescription:
      'A diver descends a dark ocean. The dive light brightens while you breathe in and the diver sinks while you breathe out. Depth, the current breath step and the light level are shown as text.',
    /** The ring caption on the second inhale: what comes next, before it does. */
    nextOut: 'Breathe out next',
    prompt: {
      calibrating: 'Breathe normally',
      calibratingCaption: 'Reading your starting rate',
      inhale: 'Breathe in',
      topUp: 'A little more',
      exhale: 'Breathe out',
      rest: 'Rest',
      exhaleMic: 'Slowly, through your mouth',
      exhaleKey: 'Hold the spacebar',
      surfacing: 'Keep the rhythm — the dive is ending',
    },
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

  /** The value, not just the label. See #32. */
  signal: { good: 'good', degraded: 'degraded', unusable: 'unusable' },
};

const fr: typeof en = {
  dive: {
    depth: 'Profondeur',
    descending: 'en descente',
    light: 'Lampe',
    stage: 'Étape',
    leave: 'Quitter',
    started: 'Plongée commencée. Appuyez sur Entrée sur Quitter pour arrêter.',
    sceneDescription:
      "Un plongeur descend dans un océan sombre. La lampe s'allume pendant que vous inspirez et le plongeur s'enfonce pendant que vous expirez. La profondeur, l'étape de respiration en cours et le niveau de la lampe sont affichés en texte.",
    nextOut: 'Expirez ensuite',
    prompt: {
      calibrating: 'Respirez normalement',
      calibratingCaption: 'Lecture de votre rythme de départ',
      inhale: 'Inspirez',
      topUp: 'Encore un peu',
      exhale: 'Expirez',
      rest: 'Repos',
      exhaleMic: 'Lentement, par la bouche',
      exhaleKey: "Maintenez la barre d'espace",
      surfacing: 'Gardez le rythme — la plongée se termine',
    },
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

  signal: { good: 'bon', degraded: 'dégradé', unusable: 'inutilisable' },
};

export const dive = { en, fr };
