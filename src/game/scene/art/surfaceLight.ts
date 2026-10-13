import { Container, Graphics } from 'pixi.js';
import type { Frame } from './layers';
import { lerpTint, slow } from './layers';
import { rayStrength, surfaceY } from './depthLight';

/**
 * The world above you, receding. A dawn sky above a bright waterline at the
 * start of every dive, and a fan of god rays that thins out as you sink and is
 * gone by the time the zone lights are the only light left.
 *
 * Two layers, because they sit at different depths in the stage: the rays
 * shine from behind everything, while the sky and waterline cover whatever
 * world art is above the surface — fish do not swim in the air.
 *
 * Built once per layout; per frame only positions and alphas change.
 */

const SKY_TOP = 0x1d4a63;
const SKY_HORIZON = 0x9fd6d3;
const WATERLINE = 0xbfeff0;
const RAY = 0x9fe7e6;
const RAY_COUNT = 7;
const SKY_BANDS = 24;

export class SurfaceLight {
  /** God rays. Goes behind the world layers. */
  readonly rays = new Container();
  /** Sky and waterline. Goes in front of the world layers, behind the diver. */
  readonly above = new Container();
  private readonly sky = new Graphics();
  private readonly line = new Graphics();
  private readonly rayShapes: Graphics[] = [];

  constructor() {
    for (let i = 0; i < RAY_COUNT; i += 1) {
      const ray = new Graphics();
      ray.blendMode = 'add';
      this.rayShapes.push(ray);
      this.rays.addChild(ray);
    }
    this.above.addChild(this.sky, this.line);
  }

  layout(w: number, h: number): void {
    // The sky is painted in local space from -h to 0, so placing the container
    // at the waterline puts the horizon exactly on it.
    this.sky.clear();
    for (let i = 0; i < SKY_BANDS; i += 1) {
      const t = i / (SKY_BANDS - 1);
      this.sky
        .rect(0, -h + (h * i) / SKY_BANDS, w, h / SKY_BANDS + 1)
        .fill(lerpTint(SKY_TOP, SKY_HORIZON, t));
    }
    this.line.clear();
    this.line.rect(0, -1.5, w, 3).fill({ color: WATERLINE, alpha: 0.85 });

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
    // Above the screen top the sky and line are off-canvas; skip drawing them.
    this.above.visible = y > -2;
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
}
