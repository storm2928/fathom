import type { Container } from 'pixi.js';
import type { ZoneLook } from './palette';

/**
 * Parallax and the reveal rule, shared by every drawable in the scene.
 *
 * The diver is fixed on screen and the world scrolls past. Each world-anchored
 * element keeps a normalised slot `u` in a wrap span and an accumulated drift
 * in metres; its screen position is resolved from the current depth each
 * frame, so nothing is ever re-seeded and nothing allocates.
 */

/** Pixels per metre per layer: 0 far, 1 mid, 2 base, 3 near. */
export const LAYER_PPM = [2.0, 3.5, 5.0, 7.5] as const;
/** Far things sink into the water colour. */
export const LAYER_FOG = [0.7, 0.85, 1.0, 1.0] as const;
/** Far things are drawn smaller. */
export const LAYER_SCALE = [0.6, 0.85, 1.0, 1.0] as const;

export const FAR = 0;
export const MID = 1;
export const BASE = 2;
export const NEAR = 3;

const TWO_PI = Math.PI * 2;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Metres of world a layer needs to cover the viewport plus a margin. */
export function spanMetres(h: number, ppm: number, padPx = 60): number {
  return (h + 2 * padPx) / ppm;
}

/** Positive modulo. */
export function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

/**
 * Screen y of a world-anchored slot. Depth increasing scrolls the element up;
 * drift increasing moves it down (so risers subtract from drift).
 */
export function slotY(
  u: number,
  drift: number,
  depth: number,
  span: number,
  ppm: number,
  h: number,
): number {
  return h / 2 + (mod(u * span + drift - depth, span) - span / 2) * ppm;
}

/** Per-channel integer tint interpolation. No allocation. */
export function lerpTint(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = (ar + (br - ar) * k) | 0;
  const g = (ag + (bg - ag) * k) | 0;
  const bl = (ab + (bb - ab) * k) | 0;
  return (r << 16) | (g << 8) | bl;
}

/**
 * Everything a drawable needs to place and light itself this frame. One
 * instance, mutated by the renderer, read by every layer.
 */
export interface Frame {
  w: number;
  h: number;
  /** the diver's fixed point D */
  dx: number;
  dy: number;
  /** drawn scroll depth, metres */
  depth: number;
  /** seconds since the scene started */
  t: number;
  dt: number;
  /** smoothed dive light, 0-1 */
  light: number;
  /** lamp position on screen */
  lampX: number;
  lampY: number;
  /** unit direction of the beam */
  beamX: number;
  beamY: number;
  exhaling: boolean;
  reduced: boolean;
  /** wrap spans per layer, metres */
  spans: number[];
  look: ZoneLook;
}

export function createFrame(look: ZoneLook): Frame {
  return {
    w: 0,
    h: 0,
    dx: 0,
    dy: 0,
    depth: 0,
    t: 0,
    dt: 0,
    light: 0,
    lampX: 0,
    lampY: 0,
    beamX: 0,
    beamY: 1,
    exhaling: false,
    reduced: false,
    spans: [0, 0, 0, 0],
    look,
  };
}

/** How much the light reaches a point, ignoring the beam: 0-1. */
export function lit(f: Frame, x: number, y: number): number {
  const ddx = x - f.dx;
  const ddy = y - f.dy;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  return clamp01(1 - dist / (0.45 * f.h)) * f.light;
}

/**
 * The reveal rule: elements in front of the lamp get the most of the light.
 * Returns `lit * (0.4 + 0.6 * coneFactor)`, 0-1.
 */
export function reveal(f: Frame, x: number, y: number): number {
  const base = lit(f, x, y);
  if (base <= 0) return 0;
  const ex = x - f.lampX;
  const ey = y - f.lampY;
  const len = Math.sqrt(ex * ex + ey * ey);
  if (len < 1) return base;
  const cos = (ex * f.beamX + ey * f.beamY) / len;
  const angle = Math.acos(cos > 1 ? 1 : cos < -1 ? -1 : cos);
  const cone = clamp01(1 - angle / 0.55);
  return base * (0.4 + 0.6 * cone);
}

/** A slow sine that never oscillates faster than a breath. */
export function slow(t: number, periodSeconds: number, phase: number): number {
  return Math.sin((TWO_PI * t) / periodSeconds + phase);
}

/** What the renderer asks of a zone. Each zone owns four layer containers. */
export interface ZoneArt {
  readonly far: Container;
  readonly mid: Container;
  readonly near: Container;
  readonly base: Container;
  /** rebuild size-dependent geometry; never called per frame */
  layout(w: number, h: number): void;
  /** the zone has become current at this depth */
  enter(depth: number): void;
  update(f: Frame): void;
}

export function setZoneAlpha(zone: ZoneArt, alpha: number): void {
  zone.far.alpha = alpha;
  zone.mid.alpha = alpha;
  zone.near.alpha = alpha;
  zone.base.alpha = alpha;
}

export function setZoneVisible(zone: ZoneArt, visible: boolean): void {
  zone.far.visible = visible;
  zone.mid.visible = visible;
  zone.near.visible = visible;
  zone.base.visible = visible;
}
