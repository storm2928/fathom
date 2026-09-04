/**
 * The world palette: how each zone's water, motes and silhouettes are coloured,
 * and the colours the diver keeps across all three.
 *
 * Every renderer reads these. The four hsl strings are the original zone look
 * (kept verbatim so nothing else moves); the hex numbers are for Pixi tints
 * and tint interpolation, which want integers rather than strings.
 */

export interface ZoneLook {
  top: string;
  bottom: string;
  mote: string;
  light: string;
  /** rocks, kelp roots, fish, ridges, whales */
  silhouette: number;
  /** what the fog sprite is tinted with (the zone's bottom colour) */
  fog: number;
  fogAlpha: number;
  vignetteAlpha: number;
  /** multiplier on mote alpha */
  moteAlpha: number;
  /** how many motes are visible in this zone */
  moteCount: number;
  /** zone specials: ray tint, jelly rim, lure */
  accent: number;
  /** the four strings above as integers, computed once */
  topHex: number;
  bottomHex: number;
  moteHex: number;
  lightHex: number;
}

/** Parse `hsl(h s% l%)` into a 0xRRGGBB integer. Runs at module load only. */
export function hslToHex(value: string): number {
  const parts = value.match(/-?[\d.]+/g);
  if (!parts || parts.length < 3) return 0;
  const h = ((Number(parts[0]) % 360) + 360) % 360;
  const s = Number(parts[1]) / 100;
  const l = Number(parts[2]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

/** `#rrggbb` for the 2D canvas. Build once, never per frame. */
export function hexCss(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** `rgba(r,g,b,a)` for the 2D canvas. Build once, never per frame. */
export function hexRgba(value: number, alpha: number): string {
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

type LookSource = Omit<ZoneLook, 'topHex' | 'bottomHex' | 'moteHex' | 'lightHex'>;

function finish(look: LookSource): ZoneLook {
  return {
    ...look,
    topHex: hslToHex(look.top),
    bottomHex: hslToHex(look.bottom),
    moteHex: hslToHex(look.mote),
    lightHex: hslToHex(look.light),
  };
}

/**
 * Progressively deeper, darker and colder, with the bioluminescence getting
 * sparser and more startling as the light thins out. Index 0 is used before a
 * dive begins as well as during zone 1.
 */
export const ZONE_LOOKS: ZoneLook[] = [
  finish({
    top: 'hsl(196 74% 11%)',
    bottom: 'hsl(206 80% 5%)',
    mote: 'hsl(176 90% 66%)',
    light: 'hsl(184 96% 72%)',
    silhouette: 0x0a1b26,
    fog: hslToHex('hsl(206 80% 5%)'),
    fogAlpha: 0.25,
    vignetteAlpha: 0.35,
    moteAlpha: 1.0,
    moteCount: 420,
    accent: 0x5ce3cf,
  }),
  finish({
    top: 'hsl(212 76% 7%)',
    bottom: 'hsl(226 74% 3.5%)',
    mote: 'hsl(196 92% 68%)',
    light: 'hsl(196 96% 70%)',
    silhouette: 0x05101c,
    fog: hslToHex('hsl(226 74% 3.5%)'),
    fogAlpha: 0.4,
    vignetteAlpha: 0.42,
    moteAlpha: 0.9,
    moteCount: 300,
    accent: 0x7fb6ff,
  }),
  finish({
    top: 'hsl(234 68% 4.5%)',
    bottom: 'hsl(250 62% 2%)',
    mote: 'hsl(268 88% 76%)',
    light: 'hsl(214 94% 72%)',
    silhouette: 0x04070f,
    fog: hslToHex('hsl(250 62% 2%)'),
    fogAlpha: 0.55,
    vignetteAlpha: 0.5,
    moteAlpha: 0.7,
    moteCount: 160,
    accent: 0xc9b6ff,
  }),
];

export const lookForZone = (zone: number): ZoneLook =>
  ZONE_LOOKS[Math.min(ZONE_LOOKS.length - 1, Math.max(0, zone))];

/** The diver does not change colour between zones. */
export const DIVER = {
  suit: 0x1b2a3a,
  rim: 0x9fd7e6,
  tank: 0x26384a,
  fins: 0x14202c,
  visor: 0x5ce3cf,
  lamp: 0xeaf3f7,
  bubble: 0xdceff5,
} as const;

/** Silhouettes brighten toward this when the dive light reaches them. */
export const SILHOUETTE_LIT = 0x35586b;

export const KELP = 0x0e3b3a;
export const RIDGE = 0x04070f;
export const MOUND = 0x070a14;
export const PLUME = 0x3a2f55;
export const VENT_GLOW = 0x6e4fbf;
export const SNOW = 0xffffff;
