import { Container, Graphics } from 'pixi.js';
import type { Frame } from './layers';
import { lerpTint, slow } from './layers';
import { rayStrength, surfaceY } from './depthLight';

/**
 * The world above you, receding. A dawn sky above a glowing waterline at the
 * start of every dive, and a fan of god rays that thins out as you sink and is
 * gone by the time the zone lights are the only light left.
 *
 * Sky and sea must read as one scene seen from just under the surface, not two
 * pictures butted together. So the colour is continuous across the line: the
 * underside of the surface glows in the sky's horizon colour and fades down
 * into the water, and the line itself is a soft, slowly moving swell rather
 * than a ruled edge.
 *
 * Three layers, because they sit at different depths in the stage: the rays
 * and the under-surface glow shine from behind the world art, while the sky
 * and waterline cover whatever world art is above the surface — fish do not
 * swim in the air.
 *
 * Built once per layout; per frame only positions and alphas change, plus the
 * swell line, which is a few dozen points redrawn while the surface is on screen.
 */

const SKY_TOP = 0x1d4a63;
const SKY_HORIZON = 0x9fd6d3;
/** The bright underside of the surface, seen from below. Starts at the horizon colour. */
const UNDERSIDE = SKY_HORIZON;
const WATERLINE = 0xe2fbf9;
const RAY = 0x9fe7e6;
const RAY_COUNT = 7;
const SKY_BANDS = 72;
const GLOW_BANDS = 72;
/** How far below the surface its glow reaches, as a share of the screen height. */
const GLOW_DEPTH = 0.32;
/** Swell height in pixels, and how many points draw it. */
const SWELL_PX = 3.5;
const SWELL_POINTS = 48;

export class SurfaceLight {
  /** God rays. Goes behind the world layers. */
  readonly rays = new Container();
  /** The underside glow. Goes behind the world layers, just above the water. */
  readonly under = new Container();
  /** Sky and waterline. Goes in front of the world layers, behind the diver. */
  readonly above = new Container();
  private readonly sky = new Graphics();
  private readonly swell = new Graphics();
  private readonly glow = new Graphics();
  private readonly rayShapes: Graphics[] = [];
  private width = 0;

  constructor() {
    for (let i = 0; i < RAY_COUNT; i += 1) {
      const ray = new Graphics();
      ray.blendMode = 'add';
      this.rayShapes.push(ray);
      this.rays.addChild(ray);
    }
    this.under.addChild(this.glow);
    this.above.addChild(this.sky, this.swell);
  }

  layout(w: number, h: number): void {
    this.width = w;
    // The sky is painted in local space from -h to 0, so placing the container
    // at the waterline puts the horizon exactly on it.
    this.sky.clear();
    for (let i = 0; i < SKY_BANDS; i += 1) {
      const t = i / (SKY_BANDS - 1);
      this.sky
        .rect(0, -h + (h * i) / SKY_BANDS, w, h / SKY_BANDS + 1)
        .fill(lerpTint(SKY_TOP, SKY_HORIZON, t * t));
    }

    // The underside: horizon colour at the line, eased out to nothing below.
    const reach = h * GLOW_DEPTH;
    this.glow.clear();
    for (let i = 0; i < GLOW_BANDS; i += 1) {
      const t = i / GLOW_BANDS;
      const fade = (1 - t) * (1 - t);
      // Translucent bands must tile exactly: an overlap doubles the alpha and
      // draws a visible line.
      const top = Math.round((reach * i) / GLOW_BANDS);
      const bottom = Math.round((reach * (i + 1)) / GLOW_BANDS);
      if (bottom <= top) continue;
      this.glow.rect(0, top, w, bottom - top).fill({ color: UNDERSIDE, alpha: 0.9 * fade });
    }

    // Rays hang down from the waterline, fanned slightly toward the diver.
    for (let i = 0; i < RAY_COUNT; i += 1) {
      const x = ((i + 0.5) / RAY_COUNT) * w;
      const spread = (x - w / 2) * 0.35;
      const top = w * (0.03 + 0.02 * (i % 3));
      const bottom = top * 4;
      const ray = this.rayShapes[i];
      ray.clear();
      ray
        .poly([x - top, 0, x + top, 0, x + spread + bottom, h * 1.2, x + spread - bottom, h * 1.2])
        .fill({ color: RAY, alpha: 1 });
    }
  }

  update(f: Frame): void {
    const y = surfaceY(f.depth, f.dy);
    const strength = rayStrength(f.depth);
    this.above.y = y;
    this.under.y = y;
    // Above the screen top the sky and line are off-canvas; skip drawing them.
    const onScreen = y > -SWELL_PX * 2;
    this.above.visible = onScreen;
    // The underside glow trails a little below the line, so it fades with the
    // rays rather than vanishing the moment the line leaves the screen.
    this.under.visible = strength > 0.001 && y > -f.h * GLOW_DEPTH;
    this.under.alpha = strength;
    if (onScreen) this.drawSwell(f);

    this.rays.visible = strength > 0.001;
    if (!this.rays.visible) return;
    // Rays start at the waterline; once it has left the top of the screen they
    // come from just above the screen rather than from far off it.
    this.rays.y = Math.max(y, 0);
    for (let i = 0; i < this.rayShapes.length; i += 1) {
      // slow() is a sine in -1..1, so the shimmer swings between 0.5 and 1.
      const shimmer = f.reduced ? 1 : 0.75 + 0.25 * slow(f.t, 7 + i * 1.3, i * 0.9);
      this.rayShapes[i].alpha = 0.07 * strength * shimmer;
    }
  }

  /**
   * The waterline as a slow swell: two long sines drifting past each other.
   * The sky's lower edge follows it, so the colour meets the glow below along
   * a moving line, never a ruled one. Still under reduced motion.
   */
  private drawSwell(f: Frame): void {
    const w = this.width;
    const t = f.reduced ? 0 : f.t;
    const points: number[] = [];
    for (let i = 0; i <= SWELL_POINTS; i += 1) {
      const x = (i / SWELL_POINTS) * w;
      const u = x / Math.max(1, w);
      const dy =
        SWELL_PX * (0.6 * Math.sin(u * 7.1 + t * 0.9) + 0.4 * Math.sin(u * 15.3 - t * 1.4));
      points.push(x, dy);
    }
    const g = this.swell;
    g.clear();
    // Sky colour down to the swell, covering the band's straight bottom edge.
    g.poly([0, -SWELL_PX * 2, ...points, w, -SWELL_PX * 2]).fill(SKY_HORIZON);
    // The bright line where light meets water.
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    g.stroke({ width: 1.5, color: WATERLINE, alpha: 0.55 });
  }
}
