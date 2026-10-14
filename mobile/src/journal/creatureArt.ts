import type { CreatureId } from './catalogue';

/**
 * One drawing per entry, in the dive's own style: a dark silhouette and the
 * few points of light that give it away. Shared by the dive scene (Pixi draws
 * the same path data) and the journal (inline SVG), so what you meet is what
 * you keep. All in a 100 × 100 box.
 */

export interface CreatureArt {
  /** silhouette path data */
  body: string[];
  /** points of light: [cx, cy, r] */
  lights: [number, number, number][];
  /** how big it is drawn in the water, relative to the diver (1 = about the diver) */
  scale: number;
}

/** A small fish facing right, at (x, y), length L. */
function fish(x: number, y: number, l: number): string {
  const h = l * 0.32;
  return (
    `M${x} ${y} Q${x + l * 0.35} ${y - h} ${x + l * 0.78} ${y - h * 0.25} ` +
    `L${x + l} ${y - h * 0.7} L${x + l * 0.94} ${y} L${x + l} ${y + h * 0.7} ` +
    `L${x + l * 0.78} ${y + h * 0.25} Q${x + l * 0.35} ${y + h} ${x} ${y}Z`
  );
}

/** A ring of `n` beads along a gentle curve — siphonophore stems, comb rows. */
function beads(n: number, x0: number, y0: number, dx: number, amp: number, r: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = x0 + dx * i;
    const y = y0 + Math.sin(i * 0.7) * amp;
    out.push(`M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
  }
  return out;
}

export const CREATURE_ART: Record<CreatureId, CreatureArt> = {
  lanternfish: {
    body: [fish(14, 40, 30), fish(46, 30, 26), fish(40, 62, 34)],
    lights: [
      [24, 44, 1.6], [32, 45, 1.6], [54, 33, 1.4], [61, 34, 1.4], [52, 66, 1.7], [62, 67, 1.7],
    ],
    scale: 0.9,
  },
  'moon-jelly': {
    body: [
      'M22 46 Q50 8 78 46 Q70 52 62 48 Q56 54 50 49 Q44 54 38 48 Q30 52 22 46Z',
      'M34 50 Q31 66 36 84 L38 84 Q34 66 37 50Z',
      'M48 51 Q46 70 50 90 L52 90 Q49 70 51 51Z',
      'M62 50 Q66 66 61 84 L63 84 Q69 66 65 50Z',
    ],
    lights: [[40, 34, 3.2], [50, 30, 3.2], [60, 34, 3.2], [50, 40, 3.2]],
    scale: 1.1,
  },
  hatchetfish: {
    body: ['M26 40 L60 32 L70 42 L80 34 L82 52 L72 50 L60 68 L34 64 Q24 54 26 40Z'],
    lights: [[38, 62, 1.6], [45, 64, 1.6], [52, 64, 1.6], [58, 63, 1.6], [36, 44, 2.6]],
    scale: 0.7,
  },
  'glass-squid': {
    body: [
      'M38 18 Q50 8 62 18 L64 58 Q50 70 36 58Z',
      'M42 62 L36 88 L40 88 L46 64Z',
      'M50 66 L50 92 L53 92 L53 66Z',
      'M58 62 L64 88 L60 88 L54 64Z',
    ],
    lights: [[44, 58, 2.6], [56, 58, 2.6]],
    scale: 0.9,
  },
  'manta-ray': {
    body: [
      'M50 36 Q70 26 96 48 Q74 52 62 58 L56 74 L51 96 L49 96 L44 74 L38 58 Q26 52 4 48 Q30 26 50 36Z',
      'M44 34 L41 26 L46 32Z',
      'M56 34 L59 26 L54 32Z',
    ],
    lights: [],
    scale: 2.4,
  },
  siphonophore: {
    body: [...beads(12, 8, 50, 7.6, 7, 3.2), 'M6 50 Q50 34 96 50 L96 52 Q50 36 6 52Z'],
    lights: [[16, 52, 1.5], [31, 47, 1.5], [46, 55, 1.5], [62, 46, 1.5], [77, 54, 1.5], [92, 48, 1.5]],
    scale: 2.6,
  },
  'firefly-squid': {
    body: [
      'M30 50 Q44 38 66 44 L82 50 L66 56 Q44 62 30 50Z',
      'M30 48 L12 40 L14 44 L28 50 L14 56 L12 60 L30 52Z',
    ],
    lights: [
      [40, 48, 1.3], [48, 46, 1.3], [56, 47, 1.3], [64, 49, 1.3], [44, 54, 1.3], [54, 55, 1.3],
      [62, 53, 1.3], [12, 40, 2], [12, 60, 2], [72, 50, 1.3],
    ],
    scale: 0.6,
  },
  'comb-jelly': {
    body: ['M50 12 Q74 30 70 58 Q66 84 50 90 Q34 84 30 58 Q26 30 50 12Z'],
    lights: [
      [38, 34, 1.4], [36, 46, 1.4], [36, 58, 1.4], [38, 70, 1.4],
      [62, 34, 1.4], [64, 46, 1.4], [64, 58, 1.4], [62, 70, 1.4],
      [50, 24, 1.4], [50, 80, 1.4],
    ],
    scale: 0.8,
  },
  barreleye: {
    body: [
      'M18 56 Q30 46 56 50 L72 46 L84 40 L80 54 L84 66 L72 60 L56 62 Q30 66 18 56Z',
      'M22 52 Q24 30 44 32 Q56 36 52 50 Z',
    ],
    lights: [[34, 40, 3], [42, 42, 3]],
    scale: 0.8,
  },
  'vampire-squid': {
    body: [
      'M50 14 Q66 18 64 40 L86 70 Q70 66 62 78 Q56 66 50 84 Q44 66 38 78 Q30 66 14 70 L36 40 Q34 18 50 14Z',
      'M36 24 L28 16 L34 28Z',
      'M64 24 L72 16 L66 28Z',
    ],
    lights: [[44, 34, 3.4], [56, 34, 3.4], [38, 20, 1.6], [62, 20, 1.6]],
    scale: 1.0,
  },
  'giant-isopod': {
    body: [
      'M50 12 Q70 14 72 30 L74 74 Q70 90 50 90 Q30 90 26 74 L28 30 Q30 14 50 12Z',
      'M30 36 L20 34 L20 37 L30 39Z', 'M30 48 L18 48 L18 51 L30 51Z', 'M30 60 L18 62 L18 65 L30 63Z',
      'M70 36 L80 34 L80 37 L70 39Z', 'M70 48 L82 48 L82 51 L70 51Z', 'M70 60 L82 62 L82 65 L70 63Z',
    ],
    lights: [[42, 20, 2.2], [58, 20, 2.2]],
    scale: 0.9,
  },
  'sperm-whale': {
    body: [
      'M4 44 L44 40 Q60 40 74 48 L88 46 L98 36 L96 52 L98 66 L86 56 L72 58 Q56 66 40 64 L8 62 Q2 54 4 44Z',
    ],
    lights: [[16, 50, 1.6]],
    scale: 3.4,
  },
  'sea-pig': {
    body: [
      'M18 60 Q24 40 50 40 Q76 40 82 60 Q76 70 50 70 Q24 70 18 60Z',
      'M30 68 L28 80 L32 80 L34 68Z', 'M44 70 L43 82 L47 82 L48 70Z',
      'M58 70 L58 82 L62 82 L62 70Z', 'M70 68 L72 80 L76 80 L74 68Z',
      'M30 44 L24 28 L28 28 L34 42Z', 'M40 41 L38 24 L42 24 L44 40Z',
    ],
    lights: [[24, 28, 2], [38, 24, 2]],
    scale: 0.8,
  },
  'tripod-fish': {
    body: [
      'M20 40 Q36 30 66 36 L82 30 L80 42 L84 52 L66 46 Q40 50 20 40Z',
      'M30 44 L22 86 L25 86 L34 46Z',
      'M62 44 L72 86 L75 86 L64 44Z',
      'M74 44 L86 86 L89 86 L76 44Z',
    ],
    lights: [[28, 38, 2]],
    scale: 1.0,
  },
  anglerfish: {
    body: [
      'M20 58 Q22 34 48 32 Q72 32 76 50 L92 40 L90 58 L94 74 L76 64 Q66 82 42 80 Q20 78 20 58Z',
      'M30 38 Q28 16 46 12 L47 15 Q32 18 33 38Z',
    ],
    lights: [[46, 12, 4], [34, 50, 2.2]],
    scale: 1.0,
  },
  'dumbo-octopus': {
    body: [
      'M50 18 Q72 18 72 42 Q72 56 62 62 L72 84 L60 72 L54 88 L50 74 L46 88 L40 72 L28 84 L38 62 Q28 56 28 42 Q28 18 50 18Z',
      'M30 30 Q14 22 12 36 Q20 40 30 38Z',
      'M70 30 Q86 22 88 36 Q80 40 70 38Z',
    ],
    lights: [[42, 40, 2.6], [58, 40, 2.6]],
    scale: 0.9,
  },
  'hydrothermal-vent': {
    body: [
      'M30 96 L34 52 Q36 44 40 52 L44 96Z',
      'M48 96 L52 30 Q55 22 58 30 L62 96Z',
      'M66 96 L68 62 Q71 56 74 62 L76 96Z',
      'M52 30 Q44 16 54 4 Q62 16 58 30Z',
    ],
    lights: [[55, 30, 3.5], [37, 52, 2.4], [71, 62, 2.2]],
    scale: 2.2,
  },
  'whale-fall': {
    body: [
      'M6 70 Q50 56 94 68 L94 72 Q50 60 6 74Z',
      ...[16, 26, 36, 46, 56, 66, 76].map(
        (x, i) => `M${x} ${68 - i * 0.6} Q${x + 4} ${46 - (i % 2) * 4} ${x + 9} ${64 - i * 0.6} L${x + 7} ${64 - i * 0.6} Q${x + 3} ${50} ${x + 2} ${68 - i * 0.6}Z`,
      ),
      'M80 66 Q90 52 98 60 L96 66Z',
    ],
    lights: [[30, 74, 1.4], [52, 70, 1.4], [70, 72, 1.4]],
    scale: 2.6,
  },
};
