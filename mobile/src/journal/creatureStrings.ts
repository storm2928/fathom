import { useLanguage } from '@fathom/shell/i18n';
import type { CreatureId } from './catalogue';

/** Names and one true thing about each entry, in English and French. */
export interface CreatureWords {
  name: string;
  fact: string;
}

const en: Record<CreatureId, CreatureWords> = {
  lanternfish: {
    name: 'Lanternfish',
    fact: 'Among the most numerous fish on Earth. Every night they rise hundreds of metres to feed, and sink again before dawn.',
  },
  'moon-jelly': {
    name: 'Moon jelly',
    fact: 'The four pale rings seen through its clear bell are its reproductive organs. It drifts with the current more than it swims.',
  },
  hatchetfish: {
    name: 'Hatchetfish',
    fact: 'Lights along its belly match the faint glow from above, so a hunter looking up sees no shadow.',
  },
  'glass-squid': {
    name: 'Glass squid',
    fact: 'Almost completely transparent: only its eyes and gut cast a shadow, and some kinds hide even those.',
  },
  'manta-ray': {
    name: 'Manta ray',
    fact: 'Giant mantas, up to seven metres across, have been tracked diving hundreds of metres down into the twilight zone.',
  },
  siphonophore: {
    name: 'Siphonophore',
    fact: 'Not one animal but a colony of specialised clones. One seen off Australia in 2020 was estimated at around 45 metres long.',
  },
  'firefly-squid': {
    name: 'Firefly squid',
    fact: 'Only about 7 cm long and covered in light organs. Each spring they gather in Japan’s Toyama Bay and light the water blue.',
  },
  'comb-jelly': {
    name: 'Comb jelly',
    fact: 'It swims by beating rows of tiny hair-like combs, which scatter light into moving rainbows.',
  },
  barreleye: {
    name: 'Barreleye',
    fact: 'Its head is a clear dome. The green, tube-shaped eyes inside can turn to look straight up.',
  },
  'vampire-squid': {
    name: 'Vampire squid',
    fact: 'Neither vampire nor squid. It feeds on drifting “marine snow” and pulls its webbed cloak over itself when threatened.',
  },
  'giant-isopod': {
    name: 'Giant isopod',
    fact: 'A relative of the woodlouse that can grow to half a metre, and go years between meals on the sea floor.',
  },
  'sperm-whale': {
    name: 'Sperm whale',
    fact: 'It hunts squid more than a kilometre down — on a single breath held for an hour or more.',
  },
  'sea-pig': {
    name: 'Sea pig',
    fact: 'A sea cucumber that walks on tube feet across the abyssal plain, eating the mud for the food in it.',
  },
  'tripod-fish': {
    name: 'Tripod fish',
    fact: 'It stands on three long fin rays above the soft sea floor, facing the current, waiting for food to drift into reach.',
  },
  anglerfish: {
    name: 'Anglerfish',
    fact: 'The glowing lure on its head is lit by bacteria living inside it. Prey swims toward the only light it can see.',
  },
  'dumbo-octopus': {
    name: 'Dumbo octopus',
    fact: 'It hovers by flapping ear-like fins. Some have been seen nearly seven kilometres down, deeper than any other octopus.',
  },
  'hydrothermal-vent': {
    name: 'Hydrothermal vent',
    fact: 'Water hotter than boiling pours from these chimneys. Life here runs on chemicals from the Earth, not on sunlight.',
  },
  'whale-fall': {
    name: 'Whale fall',
    fact: 'When a whale dies and sinks, its body can feed a whole community of deep-sea life for decades.',
  },
};

const fr: Record<CreatureId, CreatureWords> = {
  lanternfish: {
    name: 'Poisson-lanterne',
    fact: 'Parmi les poissons les plus nombreux sur Terre. Chaque nuit, ils remontent de centaines de mètres pour se nourrir, puis redescendent avant l’aube.',
  },
  'moon-jelly': {
    name: 'Méduse aurélie',
    fact: 'Les quatre anneaux pâles visibles à travers son ombrelle sont ses organes reproducteurs. Elle dérive avec le courant plus qu’elle ne nage.',
  },
  hatchetfish: {
    name: 'Poisson-hachette',
    fact: 'Les lumières de son ventre imitent la faible lueur venue d’en haut : un prédateur qui regarde vers le haut ne voit aucune ombre.',
  },
  'glass-squid': {
    name: 'Calmar de verre',
    fact: 'Presque entièrement transparent : seuls ses yeux et son intestin font une ombre, et certaines espèces cachent même ceux-là.',
  },
  'manta-ray': {
    name: 'Raie manta',
    fact: 'Les mantas géantes, jusqu’à sept mètres d’envergure, ont été suivies plongeant à des centaines de mètres dans la zone crépusculaire.',
  },
  siphonophore: {
    name: 'Siphonophore',
    fact: 'Non pas un animal mais une colonie de clones spécialisés. L’un d’eux, observé au large de l’Australie en 2020, mesurait environ 45 mètres.',
  },
  'firefly-squid': {
    name: 'Calmar luciole',
    fact: 'À peine 7 cm et couvert d’organes lumineux. Chaque printemps, ils se rassemblent dans la baie de Toyama, au Japon, et illuminent l’eau de bleu.',
  },
  'comb-jelly': {
    name: 'Cténophore',
    fact: 'Il nage en battant des rangées de minuscules peignes ciliés, qui décomposent la lumière en arcs-en-ciel mouvants.',
  },
  barreleye: {
    name: 'Revenant',
    fact: 'Sa tête est un dôme transparent. Ses yeux verts en forme de tube peuvent pivoter pour regarder droit vers le haut.',
  },
  'vampire-squid': {
    name: 'Calmar vampire',
    fact: 'Ni vampire ni calmar. Il se nourrit de « neige marine » et se couvre de sa cape palmée lorsqu’il est menacé.',
  },
  'giant-isopod': {
    name: 'Isopode géant',
    fact: 'Un cousin du cloporte qui peut atteindre un demi-mètre et passer des années sans manger sur le fond marin.',
  },
  'sperm-whale': {
    name: 'Cachalot',
    fact: 'Il chasse le calmar à plus d’un kilomètre de profondeur — en une seule respiration, retenue une heure ou plus.',
  },
  'sea-pig': {
    name: 'Cochon de mer',
    fact: 'Une holothurie qui marche sur ses podia à travers la plaine abyssale, en mangeant la vase pour la nourriture qu’elle contient.',
  },
  'tripod-fish': {
    name: 'Poisson-trépied',
    fact: 'Il se tient sur trois longs rayons de nageoires au-dessus du fond meuble, face au courant, en attendant que la nourriture dérive jusqu’à lui.',
  },
  anglerfish: {
    name: 'Baudroie abyssale',
    fact: 'Le leurre lumineux sur sa tête est éclairé par des bactéries qui y vivent. Ses proies nagent vers la seule lumière qu’elles voient.',
  },
  'dumbo-octopus': {
    name: 'Pieuvre dumbo',
    fact: 'Elle flotte en battant des nageoires en forme d’oreilles. Certaines ont été vues à près de sept kilomètres de profondeur, plus bas que toute autre pieuvre.',
  },
  'hydrothermal-vent': {
    name: 'Source hydrothermale',
    fact: 'De l’eau plus chaude que l’ébullition jaillit de ces cheminées. Ici, la vie se nourrit de la chimie de la Terre, pas du soleil.',
  },
  'whale-fall': {
    name: 'Carcasse de baleine',
    fact: 'Quand une baleine meurt et coule, son corps peut nourrir toute une communauté des grands fonds pendant des décennies.',
  },
};

export function useCreatureWords(): Record<CreatureId, CreatureWords> {
  const { language } = useLanguage();
  return language === 'fr' ? fr : en;
}
