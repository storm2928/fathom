/**
 * The research page. Bibliographic fields (title, authors, venue, year, DOI,
 * URL) live in `src/shell/studies.ts`; only the translatable sentences are
 * here. No study may be added to this list that the verification stage did
 * not confirm.
 */
export type ResearchCategory = 'protocol' | 'physiology' | 'biofeedback' | 'clinical' | 'access';

export type StudyId =
  | 'balban2023'
  | 'zaccaro2018'
  | 'van-diest-2014'
  | 'grassmann-2016'
  | 'russo-2017'
  | 'lehrer2014'
  | 'linehan2015'
  | 'asca2026'
  | 'eisenberg-2007';

interface CategoryText {
  title: string;
  intro: string;
}

interface StudyText {
  finding: string;
  shapes: string;
}

const en = {
  eyebrow: 'Sources',
  title: 'The research behind it',
  intro:
    'FATHOM is built on published work about slow breathing, the cyclic-sighing protocol and why a practice tool has to be free and self-contained. Every claim in the app traces back to one of these sources. None of them is a claim that the app treats anything.',
  filterLabel: 'Filter by theme',
  all: 'All',
  finding: 'Finding',
  shapes: 'How this shapes FATHOM',
  source: 'Read the source',
  doi: 'DOI',
  handouts: 'Handouts (PDF, Guilford)',
  limitsTitle: 'Where the evidence stops',
  limit1: 'Cyclic sighing is evidenced as a practice; the game built around it has not been trialled.',
  limit2:
    'The breathing rate is inferred from exhale onsets, not from a chest strap or a capnograph, and smoothness scoring is a heuristic, not a validated metric.',
  limit3: 'One session is not evidence about your health.',
  readme: "The same list, with the app's own limitations, is in the project README.",

  categories: {
    protocol: {
      title: 'The protocol',
      intro: 'The breathing pattern the game is built on, and the trial that tested it.',
    },
    physiology: {
      title: 'Slow breathing physiology',
      intro: 'What slow, exhale-weighted breathing does to the body, and why breathing rate is worth measuring.',
    },
    biofeedback: {
      title: 'Biofeedback',
      intro: 'Where the live-signal loop comes from.',
    },
    clinical: {
      title: 'Clinical practice',
      intro: 'How paced breathing is already taught as a skill.',
    },
    access: {
      title: 'Access and need',
      intro: 'Why a practice tool has to be free, immediate and self-contained.',
    },
  } satisfies Record<ResearchCategory, CategoryText>,

  studies: {
    balban2023: {
      finding:
        'In a one-month remote randomized controlled study (114 enrolled, 108 randomized), five minutes a day of cyclic sighing produced a larger rise in positive affect and a larger drop in resting respiratory rate than an equal period of mindfulness meditation.',
      shapes:
        'Defines the core input pattern: double inhale then a long slow exhale, five minutes per session, with respiratory rate as the before-and-after measurement shown on the surface screen.',
    },
    zaccaro2018: {
      finding:
        'A systematic review of 15 studies in healthy adults found that breathing slower than 10 breaths per minute was linked with higher heart rate variability, more EEG alpha power, and self-reports of greater comfort and relaxation and lower anxiety and arousal.',
      shapes:
        'Justifies why the game only ever slows the breathing target: the adaptive exhale target lengthens and never shortens, and the depth reward is super-linear in exhale length so slower cycles are the winning strategy.',
    },
    'van-diest-2014': {
      finding:
        'In 30 participants breathing at 6 or 12 breaths per minute, a longer exhale than inhale raised self-reported relaxation, and at six breaths per minute it also increased high-frequency heart-rate variability more than the slow rate on its own did.',
      shapes:
        'Shapes the reward loop: depth per breath grows with exhale length, and the prompt pairs a short double inhale with a long exhale, so the pattern the game rewards is the low inhale-to-exhale ratio this study tested.',
    },
    'grassmann-2016': {
      finding:
        'A systematic review of laboratory studies found that demanding mental tasks make people breathe faster and move more air per minute while breath depth stays about the same, so respiratory rate tracks cognitive load.',
      shapes:
        'Justifies the measurement: the ten-second calibration counts a baseline respiratory rate and the surface screen reports the before-to-after change as a live marker of arousal, not a mood score and not a diagnosis.',
    },
    'russo-2017': {
      finding:
        'This review of studies in healthy adults defines slow breathing as 4 to 10 breaths per minute and summarises evidence that it raises heart-rate variability and shifts autonomic balance toward the parasympathetic side, most markedly near six breaths per minute.',
      shapes:
        'Frames the five-minute session: every prompted rate sits inside the 4-to-10 range this review covers, and the app describes the effect only as training arousal regulation in healthy people, measured live.',
    },
    lehrer2014: {
      finding:
        'This review describes heart rate variability biofeedback, in which people breathe at their resonance frequency of about six breaths per minute while watching a live physiological readout, and proposes strengthened baroreflex function as the most supported mechanism.',
      shapes:
        'FATHOM borrows the biofeedback loop shape: a live signal (exhale detection, respiratory rate) fed back as an immediate visible consequence (descent, dive light), rather than a static instruction to breathe slowly.',
    },
    linehan2015: {
      finding:
        "In the manual's distress tolerance module, paced breathing is one of the TIP skills (often written TIPP), a set of body-chemistry techniques taught for bringing down very high emotional arousal quickly.",
      shapes:
        'Frames the 90-second Quick Dive: a short, physiological, in-the-moment skill for the minutes before an exam or race, positioned as practice of a skill clinicians already teach and never as treatment.',
    },
    asca2026: {
      finding:
        'ASCA reports a national average of 372 students per school counselor for the 2024–2025 school year, against its recommended ratio of 250 to 1, with only four states within the recommendation.',
      shapes:
        'Motivates the access framing: a self-contained exercise that needs no supervising professional, no appointment and no account, for the minutes before an exam.',
    },
    'eisenberg-2007': {
      finding:
        'In a random sample of 2,785 students at a large public university, between 37% and 84% of those who screened positive for depression or anxiety received no services in the past year, even with free campus care, with lack of perceived need and not knowing about services among the main barriers.',
      shapes:
        'Explains why FATHOM is free, needs no account, runs entirely on the device and says plainly that it is not therapy: a low-barrier practice tool sits beside professional care and points to a person through the crisis rail rather than replacing one.',
    },
  } satisfies Record<StudyId, StudyText>,
};

const fr: typeof en = {
  eyebrow: 'Sources',
  title: "La recherche derrière l'application",
  intro:
    "FATHOM repose sur des travaux publiés sur la respiration lente, le protocole du soupir cyclique et les raisons pour lesquelles un outil de pratique doit être gratuit et autonome. Chaque affirmation de l'application renvoie à l'une de ces sources. Aucune n'affirme que l'application traite quoi que ce soit.",
  filterLabel: 'Filtrer par thème',
  all: 'Tout',
  finding: 'Résultat',
  shapes: 'Ce que cela change dans FATHOM',
  source: 'Lire la source',
  doi: 'DOI',
  handouts: 'Documents (PDF, Guilford)',
  limitsTitle: "Où s'arrête la preuve",
  limit1: "Le soupir cyclique est étayé en tant que pratique ; le jeu construit autour n'a pas été évalué.",
  limit2:
    "Le rythme respiratoire est déduit du début des expirations, non d'une ceinture thoracique ou d'un capnographe, et le score de régularité est une heuristique, non une mesure validée.",
  limit3: 'Une séance ne constitue pas une preuve concernant votre santé.',
  readme: "La même liste, avec les limites propres à l'application, figure dans le README du projet.",

  categories: {
    protocol: {
      title: 'Le protocole',
      intro: "Le schéma respiratoire sur lequel repose le jeu, et l'essai qui l'a testé.",
    },
    physiology: {
      title: 'Physiologie de la respiration lente',
      intro:
        "Ce que la respiration lente, centrée sur l'expiration, fait au corps, et pourquoi le rythme respiratoire vaut la peine d'être mesuré.",
    },
    biofeedback: {
      title: 'Biofeedback',
      intro: "D'où vient la boucle du signal en direct.",
    },
    clinical: {
      title: 'Pratique clinique',
      intro: 'Comment la respiration rythmée est déjà enseignée comme une compétence.',
    },
    access: {
      title: 'Accès et besoin',
      intro: 'Pourquoi un outil de pratique doit être gratuit, immédiat et autonome.',
    },
  },

  studies: {
    balban2023: {
      finding:
        "Dans une étude contrôlée randomisée à distance d'un mois (114 personnes inscrites, 108 randomisées), cinq minutes par jour de soupir cyclique ont produit une hausse plus marquée de l'affect positif et une baisse plus marquée du rythme respiratoire au repos qu'une durée égale de méditation de pleine conscience.",
      shapes:
        "Définit le schéma d'entrée central : double inspiration puis longue expiration lente, cinq minutes par séance, avec le rythme respiratoire comme mesure avant-après affichée à l'écran de surface.",
    },
    zaccaro2018: {
      finding:
        "Une revue systématique de 15 études chez des adultes en bonne santé a associé une respiration plus lente que 10 respirations par minute à une variabilité de la fréquence cardiaque plus élevée, à davantage de puissance alpha à l'EEG, et à des auto-évaluations de confort et de détente accrus, d'anxiété et d'éveil réduits.",
      shapes:
        "Justifie que le jeu ne fasse jamais que ralentir la cible respiratoire : la cible d'expiration adaptative s'allonge et ne raccourcit jamais, et la profondeur gagnée croît plus vite que la durée d'expiration, de sorte que les cycles plus lents sont la stratégie gagnante.",
    },
    'van-diest-2014': {
      finding:
        "Chez 30 participants respirant à 6 ou 12 respirations par minute, une expiration plus longue que l'inspiration a augmenté la détente auto-rapportée et, à six respirations par minute, a aussi accru la variabilité de la fréquence cardiaque en haute fréquence davantage que le rythme lent seul.",
      shapes:
        "Façonne la boucle de récompense : la profondeur gagnée par respiration croît avec la durée de l'expiration, et le rythme associe une double inspiration courte à une longue expiration, de sorte que le schéma récompensé est le faible ratio inspiration/expiration testé dans cette étude.",
    },
    'grassmann-2016': {
      finding:
        "Une revue systématique d'études en laboratoire a montré que les tâches mentales exigeantes font respirer plus vite et déplacer plus d'air par minute alors que l'amplitude des respirations reste à peu près la même : le rythme respiratoire suit donc la charge cognitive.",
      shapes:
        "Justifie la mesure : les dix secondes de calibration comptent un rythme respiratoire de départ, et l'écran de surface rapporte l'écart entre avant et après comme un marqueur d'activation mesuré en direct, ni un score d'humeur ni un diagnostic.",
    },
    'russo-2017': {
      finding:
        "Cette revue d'études chez des adultes en bonne santé définit la respiration lente comme 4 à 10 respirations par minute et résume les données montrant qu'elle augmente la variabilité de la fréquence cardiaque et déplace l'équilibre autonome vers le versant parasympathique, surtout autour de six respirations par minute.",
      shapes:
        "Cadre la séance de cinq minutes : chaque rythme guidé se situe dans la plage de 4 à 10 couverte par cette revue, et l'application ne décrit l'effet que comme l'entraînement de la régulation de l'éveil chez des personnes en bonne santé, mesuré en direct.",
    },
    lehrer2014: {
      finding:
        "Cette revue décrit le biofeedback de variabilité de la fréquence cardiaque, où l'on respire à sa fréquence de résonance, environ six respirations par minute, en regardant une lecture physiologique en direct, et propose le renforcement du baroréflexe comme mécanisme le mieux étayé.",
      shapes:
        "FATHOM emprunte la forme de la boucle de biofeedback : un signal en direct (détection des expirations, rythme respiratoire) renvoyé comme conséquence immédiate et visible (descente, lampe de plongée), plutôt qu'une consigne statique de respirer lentement.",
    },
    linehan2015: {
      finding:
        "Dans le module de tolérance à la détresse du manuel, la respiration rythmée fait partie des compétences TIP (souvent écrites TIPP), un ensemble de techniques agissant sur la chimie du corps, enseignées pour faire redescendre rapidement une activation émotionnelle très élevée.",
      shapes:
        "Cadre la plongée rapide de 90 secondes : une compétence courte, physiologique, à utiliser sur le moment, dans les minutes qui précèdent un examen ou une course, présentée comme la pratique d'une compétence que les cliniciens enseignent déjà, jamais comme un traitement.",
    },
    asca2026: {
      finding:
        "L'ASCA rapporte une moyenne nationale de 372 élèves par conseiller scolaire pour l'année 2024-2025, contre un ratio recommandé de 250 pour 1, seuls quatre États respectant la recommandation.",
      shapes:
        "Motive le cadrage sur l'accès : un exercice autonome qui n'exige ni professionnel superviseur, ni rendez-vous, ni compte, pour les minutes qui précèdent un examen.",
    },
    'eisenberg-2007': {
      finding:
        "Dans un échantillon aléatoire de 2 785 étudiants d'une grande université publique, entre 37 % et 84 % de ceux dont le dépistage était positif pour la dépression ou l'anxiété n'avaient reçu aucun service au cours de l'année écoulée, malgré des soins gratuits sur le campus, l'absence de besoin perçu et la méconnaissance des services figurant parmi les principaux obstacles.",
      shapes:
        "Explique pourquoi FATHOM est gratuit, sans compte, entièrement sur l'appareil, et dit clairement qu'il ne s'agit pas d'une thérapie : un outil de pratique à faible barrière se place à côté des soins professionnels et oriente vers une personne par le rail de crise, sans jamais la remplacer.",
    },
  },
};

export const research = { en, fr };
