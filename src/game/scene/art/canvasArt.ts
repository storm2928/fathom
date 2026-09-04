import { mulberry32 } from '../renderer';
import { LAYER_PPM, MID, NEAR, FAR, clamp01, mod, slotY, spanMetres } from './layers';
import type { Frame } from './layers';
import { DIVER, KELP, MOUND, PLUME, RIDGE, VENT_GLOW, ZONE_LOOKS, hexCss, hexRgba } from './palette';
import { paintCanvas, paintFog, paintVignette } from './textures';

/**
 * The 2D fallback's art: a simpler but recognisable version of every zone and
 * the diver, drawn with paths. Gradients that would otherwise be built per
 * frame are cached as small strips at construction and stretched with
 * drawImage.
 */

const TWO_PI = Math.PI * 2;

/** Level: body horizontal, head to the right. Shared with the WebGL rig. */
export const LEVEL_THETA = 1.74;
/** Descending: head down and to the right. Shared with the WebGL rig. */
export const DESCENDING_THETA = 2.79;
export const BEAM_TILT = 0.15;

interface ZoneCache {
  water: HTMLCanvasElement | null;
  fog: HTMLCanvasElement | null;
  mote: string;
  light: string;
  silhouette: string;
  accent: string;
}

interface Rock {
  points: number[];
  x: number;
  u: number;
}

interface Strand {
  x: number;
  u: number;
  phase: number;
  lean: number;
}

interface Flake {
  x: number;
  u: number;
  drift: number;
  phase: number;
}

interface Jelly {
  x: number;
  u: number;
  drift: number;
  phase: number;
  scale: number;
}

interface Lure {
  x: number;
  u: number;
  period: number;
  phase: number;
}

function jaggedPolygon(random: () => number, side: -1 | 1, rw: number, rh: number, n: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TWO_PI;
    const jitter = 1 + (random() - 0.5) * 0.44;
    let x = (Math.cos(a) * rw * jitter) / 2;
    const y = (Math.sin(a) * rh * jitter) / 2;
    x = side < 0 ? Math.max(x, -0.3 * rw) : Math.min(x, 0.3 * rw);
    points.push(x, y);
  }
  return points;
}

/** roundRect is recent; an older 2D context gets a plain rectangle. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: number[], x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + points[0], y + points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(x + points[i], y + points[i + 1]);
  ctx.closePath();
}

export class CanvasArt {
  private readonly zones: ZoneCache[] = [];
  private readonly vignette: HTMLCanvasElement | null;

  private readonly rays: { x0: number; period: number; phase: number }[] = [];
  private readonly rocks: Rock[] = [];
  private readonly strands: Strand[] = [];
  private readonly fishOffsets: number[] = [];
  private readonly schoolPhase: number;
  private readonly flakes: Flake[] = [];
  private readonly jellies: Jelly[] = [];
  private readonly ridges: Rock[] = [];
  private readonly lures: Lure[] = [];
  private readonly plumePhases: number[] = [];
  private readonly ventX = 0.85;
  private readonly ventU: number;
  private readonly kelpCss = hexCss(KELP);
  private readonly ridgeCss = hexCss(RIDGE);
  private readonly moundCss = hexCss(MOUND);
  private readonly plumeCss = hexCss(PLUME);
  private readonly ventGlowCss = hexRgba(VENT_GLOW, 0.5);

  constructor() {
    for (let z = 0; z < ZONE_LOOKS.length; z += 1) {
      const look = ZONE_LOOKS[z];
      const water = paintCanvas(1, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, look.top);
        g.addColorStop(1, look.bottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
      const fog = paintCanvas(1, 256, (ctx, w, h) => {
        paintFog(ctx, w, h);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = hexCss(look.fog);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      });
      this.zones.push({
        water,
        fog,
        mote: look.mote,
        light: look.light,
        silhouette: hexCss(look.silhouette),
        accent: hexCss(look.accent),
      });
    }
    this.vignette = paintCanvas(256, 256, paintVignette);

    const random = mulberry32(0xc2d1);
    for (let i = 0; i < 2; i += 1) {
      this.rays.push({ x0: random(), period: 9 + random() * 4, phase: random() * TWO_PI });
    }
    for (let i = 0; i < 4; i += 1) {
      const side: -1 | 1 = i < 2 ? -1 : 1;
      this.rocks.push({
        points: jaggedPolygon(random, side, 90 + random() * 90, 120 + random() * 140, 9),
        x: side < 0 ? -0.05 + random() * 0.21 : 0.84 + random() * 0.21,
        u: (i % 2) / 2 + random() * 0.4,
      });
    }
    for (let i = 0; i < 4; i += 1) {
      this.strands.push({
        x: i < 2 ? 0.03 + random() * 0.1 : 0.87 + random() * 0.1,
        u: random(),
        phase: random() * TWO_PI,
        lean: (random() - 0.5) * 0.3,
      });
    }
    for (let i = 0; i < 8; i += 1) {
      this.fishOffsets.push((random() - 0.5) * 60, (random() - 0.5) * 50);
    }
    this.schoolPhase = random() * TWO_PI;
    for (let i = 0; i < 60; i += 1) {
      this.flakes.push({ x: random(), u: random(), drift: 0, phase: random() * TWO_PI });
    }
    for (let i = 0; i < 3; i += 1) {
      this.jellies.push({
        x: 0.15 + random() * 0.7,
        u: random(),
        drift: 0,
        phase: random() * TWO_PI,
        scale: 0.6 + random() * 0.5,
      });
    }
    for (let i = 0; i < 2; i += 1) {
      const side: -1 | 1 = i === 0 ? -1 : 1;
      this.ridges.push({
        points: jaggedPolygon(random, side, 140 + random() * 120, 200 + random() * 200, 11),
        x: side < 0 ? 0.02 + random() * 0.15 : 0.83 + random() * 0.15,
        u: random(),
      });
    }
    for (let i = 0; i < 6; i += 1) {
      this.lures.push({
        x: 0.1 + random() * 0.8,
        u: random(),
        period: 5 + random() * 3,
        phase: random() * TWO_PI,
      });
    }
    for (let i = 0; i < 8; i += 1) this.plumePhases.push(random());
    this.ventU = random();
  }

  moteColour(zone: number): string {
    return this.zones[zone].mote;
  }

  lightColour(zone: number): string {
    return this.zones[zone].light;
  }

  drawWater(ctx: CanvasRenderingContext2D, zone: number, w: number, h: number, alpha: number): void {
    const strip = this.zones[zone].water;
    ctx.globalAlpha = alpha;
    if (strip) ctx.drawImage(strip, 0, 0, w, h);
    else {
      ctx.fillStyle = ZONE_LOOKS[zone].bottom;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }

  drawFog(ctx: CanvasRenderingContext2D, zone: number, w: number, h: number, alpha: number): void {
    const strip = this.zones[zone].fog;
    if (!strip || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(strip, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
    if (!this.vignette || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.vignette, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  /** The zone's own inhabitants and structure, at `alpha` (for crossfades). */
  drawZone(ctx: CanvasRenderingContext2D, zone: number, f: Frame, alpha: number): void {
    if (zone === 0) this.drawTwilight(ctx, f, alpha);
    else if (zone === 1) this.drawMidnight(ctx, f, alpha);
    else this.drawAbyss(ctx, f, alpha);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTwilight(ctx: CanvasRenderingContext2D, f: Frame, alpha: number): void {
    const { w, h, t, depth, reduced } = f;
    const cache = this.zones[0];

    // Rays.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = cache.accent;
    const rayFade = clamp01(1 - depth / 60);
    for (let i = 0; i < this.rays.length; i += 1) {
      const ray = this.rays[i];
      const x = mod(ray.x0 * w - depth * 0.6, w + 200) - 100;
      const angle = -0.21 + (reduced ? 0 : 0.026 * Math.sin((TWO_PI * t) / ray.period + ray.phase));
      ctx.globalAlpha = 0.06 * rayFade * alpha;
      ctx.save();
      ctx.translate(x, -20);
      ctx.rotate(angle);
      ctx.fillRect(-45, 0, 90, 1.25 * h);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Rocks.
    const spanNear = spanMetres(h, LAYER_PPM[NEAR], 160);
    ctx.fillStyle = cache.silhouette;
    ctx.globalAlpha = 0.92 * alpha;
    for (let i = 0; i < this.rocks.length; i += 1) {
      const rock = this.rocks[i];
      tracePolygon(ctx, rock.points, rock.x * w, slotY(rock.u, 0, depth, spanNear, LAYER_PPM[NEAR], h));
      ctx.fill();
    }

    // Kelp: quadratic curves through five points, thinning toward the tip.
    const spanMid = spanMetres(h, LAYER_PPM[MID], 200);
    ctx.strokeStyle = this.kelpCss;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85 * alpha;
    for (let s = 0; s < this.strands.length; s += 1) {
      const strand = this.strands[s];
      let x = strand.x * w;
      let y = slotY(strand.u, 0, depth, spanMid, LAYER_PPM[MID], h);
      for (let i = 0; i < 4; i += 1) {
        const angle = strand.lean + (reduced ? 0 : 0.12 * Math.sin(0.35 * t + 0.5 * i + strand.phase));
        const nx = x + 40 * Math.sin(angle);
        const ny = y - 40 * Math.cos(angle);
        const cx = x + 20 * Math.sin(angle + 0.3);
        const cy = y - 20 * Math.cos(angle + 0.3);
        ctx.lineWidth = 5 - i;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(cx, cy, nx, ny);
        ctx.stroke();
        x = nx;
        y = ny;
      }
    }

    // One school of fish.
    const arg = reduced ? this.schoolPhase : (TWO_PI * t) / 110 + this.schoolPhase;
    const cx = 0.5 * w + 0.36 * w * Math.sin(arg);
    const facing = Math.cos(arg) >= 0 ? 1 : -1;
    const cy = slotY(0.5, 0, depth, spanMid, LAYER_PPM[MID], h);
    ctx.fillStyle = cache.silhouette;
    ctx.globalAlpha = 0.7 * alpha;
    for (let i = 0; i < 8; i += 1) {
      const x = cx + this.fishOffsets[i * 2];
      const y = cy + this.fishOffsets[i * 2 + 1];
      ctx.beginPath();
      ctx.moveTo(x + 8 * facing, y);
      ctx.lineTo(x - 8 * facing, y - 4);
      ctx.lineTo(x - 8 * facing, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawMidnight(ctx: CanvasRenderingContext2D, f: Frame, alpha: number): void {
    const { w, h, t, dt, depth, reduced } = f;
    const cache = this.zones[1];

    // Marine snow.
    const spanFar = spanMetres(h, LAYER_PPM[FAR], 60);
    const fall = reduced ? 0 : 0.25 * dt;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35 * alpha;
    for (let i = 0; i < this.flakes.length; i += 1) {
      const flake = this.flakes[i];
      flake.drift += fall;
      const y = slotY(flake.u, flake.drift, depth, spanFar, LAYER_PPM[FAR], h);
      if (y < -5 || y > h + 5) continue;
      const x = flake.x * w + (reduced ? 0 : 2 * Math.sin(0.3 * t + flake.phase));
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, TWO_PI);
      ctx.fill();
    }

    // Jellyfish.
    const spanMid = spanMetres(h, LAYER_PPM[MID], 100);
    const rise = reduced ? 0 : 0.15 * dt;
    ctx.strokeStyle = cache.mote;
    ctx.fillStyle = cache.mote;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.jellies.length; i += 1) {
      const jelly = this.jellies[i];
      jelly.drift -= rise;
      const x = jelly.x * w + (reduced ? 0 : 8 * Math.sin(0.12 * t + jelly.phase));
      const y = slotY(jelly.u, jelly.drift, depth, spanMid, LAYER_PPM[MID], h);
      const pulse = reduced ? 0 : Math.sin(TWO_PI * 0.22 * t + jelly.phase);
      const rx = 30 * jelly.scale * (1 - 0.03 * pulse);
      const ry = 26 * jelly.scale * (1 + 0.06 * pulse);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, TWO_PI);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.8 * alpha;
      ctx.stroke();
      ctx.globalAlpha = 0.4 * alpha;
      for (let k = 0; k < 4; k += 1) {
        const sway = reduced ? 0 : 0.12 * Math.sin(0.3 * t + 0.8 * k + jelly.phase);
        const tx = x + (k - 1.5) * 10 * jelly.scale;
        const len = 50 * jelly.scale;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx + len * Math.sin(sway), y + len * Math.cos(sway));
        ctx.stroke();
      }
    }
  }

  private drawAbyss(ctx: CanvasRenderingContext2D, f: Frame, alpha: number): void {
    const { w, h, t, depth, reduced } = f;
    const cache = this.zones[2];

    // Ridges.
    const spanFar = spanMetres(h, LAYER_PPM[FAR], 220);
    ctx.fillStyle = this.ridgeCss;
    ctx.globalAlpha = 0.9 * alpha;
    for (let i = 0; i < this.ridges.length; i += 1) {
      const ridge = this.ridges[i];
      tracePolygon(ctx, ridge.points, ridge.x * w, slotY(ridge.u, 0, depth, spanFar, LAYER_PPM[FAR], h));
      ctx.fill();
    }

    // Lures.
    const spanMid = spanMetres(h, LAYER_PPM[MID], 60);
    for (let i = 0; i < this.lures.length; i += 1) {
      const lure = this.lures[i];
      const x = lure.x * w + (reduced ? 0 : 15 * Math.sin(0.1 * t + lure.phase));
      const y = slotY(lure.u, 0, depth, spanMid, LAYER_PPM[MID], h);
      const breath = reduced
        ? 0.5
        : 0.15 + 0.6 * (0.5 + 0.5 * Math.sin((TWO_PI * t) / lure.period + lure.phase));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = cache.accent;
      ctx.globalAlpha = 0.3 * breath * alpha;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, TWO_PI);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = breath * alpha;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TWO_PI);
      ctx.fill();
    }

    // One vent with its plume.
    const spanNear = spanMetres(h, LAYER_PPM[NEAR], 120);
    const vx = this.ventX * w;
    const vy = slotY(this.ventU, 0, depth, spanNear, LAYER_PPM[NEAR], h);
    ctx.fillStyle = this.plumeCss;
    for (let p = 0; p < this.plumePhases.length; p += 1) {
      const k = reduced ? (p + 0.5) / 8 : mod(t * 0.25 + this.plumePhases[p], 1);
      const spread = (6 + 40 * k) * Math.sin(this.plumePhases[p] * TWO_PI + (reduced ? 0 : 1.3 * k * 4));
      ctx.globalAlpha = 0.16 * (1 - k) * alpha;
      ctx.beginPath();
      ctx.arc(vx + spread * 0.6, vy - 36 - k * 90, 8 + 8 * k, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.ventGlowCss;
    ctx.globalAlpha = 0.3 * alpha;
    ctx.beginPath();
    ctx.arc(vx, vy - 36, 18, 0, TWO_PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.moundCss;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(vx, vy, 40, 36, 0, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * The diver, the same silhouette as the WebGL rig: tank, legs and fins,
   * torso with a lit rim, arms, head, visor and lamp, plus the light cone.
   */
  drawDiver(
    ctx: CanvasRenderingContext2D,
    f: Frame,
    rotation: number,
    kick: number,
    bob: number,
    lightCss: string,
  ): void {
    const L = Math.min(84, Math.max(44, f.h * 0.11));
    const light = f.light;

    // The cone first, behind the body.
    if (light > 0.01) {
      const beam = rotation + Math.PI + BEAM_TILT;
      ctx.save();
      ctx.translate(f.lampX, f.lampY);
      ctx.rotate(beam);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * light;
      ctx.fillStyle = lightCss;
      const reach = (0.55 + 0.75 * light) * (f.h / 420) * 256;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-0.34 * reach, reach);
      ctx.lineTo(0.34 * reach, reach);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.dx, f.dy + bob);
    ctx.rotate(rotation);
    const suit = hexCss(DIVER.suit);

    ctx.fillStyle = hexCss(DIVER.tank);
    ctx.beginPath();
    roundedRect(ctx, -0.21 * L, -0.19 * L, 0.14 * L, 0.42 * L, 0.07 * L);
    ctx.fill();

    const phase = TWO_PI * 0.55 * f.t;
    const legSwing = kick * 0.22 * Math.sin(phase);
    const finLag = kick * 0.12 * Math.sin(phase - 0.6);
    this.drawLeg(ctx, L, -1, legSwing, finLag, suit);
    this.drawLeg(ctx, L, 1, -legSwing, -finLag, suit);

    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.ellipse(0, 0.05 * L, 0.19 * L, 0.34 * L, 0, 0, TWO_PI);
    ctx.fill();

    ctx.strokeStyle = hexCss(DIVER.rim);
    ctx.lineWidth = 0.035 * L;
    ctx.globalAlpha = 0.15 + 0.45 * light;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -0.4 * L, 0.16 * L, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const arm = f.reduced ? 0 : 0.06 * Math.sin(0.5 * f.t + 1);
    ctx.strokeStyle = suit;
    ctx.lineWidth = 0.06 * L;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawArm(ctx, L, -1, arm);
    this.drawArm(ctx, L, 1, -arm);

    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.arc(0, -0.4 * L, 0.16 * L, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = hexCss(DIVER.visor);
    ctx.globalAlpha = clamp01(0.25 + 0.65 * light + (f.reduced && f.exhaling ? 0.2 : 0));
    ctx.beginPath();
    roundedRect(ctx, -0.07 * L, -0.48 * L, 0.2 * L, 0.12 * L, 0.05 * L);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexCss(DIVER.lamp);
    ctx.globalAlpha = 0.3 + 0.7 * light;
    ctx.beginPath();
    ctx.arc(0.12 * L, -0.5 * L, 0.045 * L, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLeg(
    ctx: CanvasRenderingContext2D,
    L: number,
    side: -1 | 1,
    swing: number,
    lag: number,
    suit: string,
  ): void {
    ctx.save();
    ctx.translate(side * 0.08 * L, 0.36 * L);
    ctx.rotate(swing);
    const kneeX = side * 0.02 * L;
    const kneeY = 0.26 * L;
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.moveTo(-0.05 * L, 0);
    ctx.lineTo(0.05 * L, 0);
    ctx.lineTo(kneeX + 0.035 * L, kneeY);
    ctx.lineTo(kneeX - 0.035 * L, kneeY);
    ctx.closePath();
    ctx.fill();

    ctx.translate(kneeX, kneeY);
    ctx.rotate(lag);
    const tipX = side * 0.02 * L;
    ctx.fillStyle = hexCss(DIVER.fins);
    ctx.beginPath();
    ctx.moveTo(-0.035 * L, 0);
    ctx.lineTo(0.035 * L, 0);
    ctx.lineTo(tipX * 0.6 + 0.08 * L, 0.23 * L);
    ctx.lineTo(tipX, 0.36 * L);
    ctx.lineTo(tipX * 0.6 - 0.08 * L, 0.23 * L);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawArm(ctx: CanvasRenderingContext2D, L: number, side: -1 | 1, rotation: number): void {
    ctx.save();
    ctx.translate(side * 0.15 * L, -0.15 * L);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side * 0.11 * L, 0.17 * L);
    ctx.lineTo(side * 0.07 * L, 0.37 * L);
    ctx.stroke();
    ctx.restore();
  }
}
