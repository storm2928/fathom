import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { Frame } from './layers';
import { surfaceY } from './depthLight';

/**
 * Where the diver goes through the waterline: a spray of droplets thrown up
 * and falling back, and a ring spreading along the surface. Once per dive,
 * soft and short — a splash, not a flash. Not shown under reduced motion.
 *
 * Positions are kept relative to the waterline, so the splash stays on the
 * surface if the water has already begun to move.
 */

const DROPS = 18;
const DROP_LIFE = 0.9;
const GRAVITY = 520;
const RING_LIFE = 1.3;
const SPRAY = 0xe2fbf9;

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export class Splash {
  readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly drops: Drop[] = [];
  private readonly ring = new Graphics();
  /** seconds since the splash; null when there is none */
  private age: number | null = null;
  private ringX = 0;
  private width = 60;

  constructor(texture: Texture) {
    for (let i = 0; i < DROPS; i += 1) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.tint = SPRAY;
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
      this.drops.push({ x: 0, y: 0, vx: 0, vy: 0, size: 0 });
    }
    this.container.addChild(this.ring);
  }

  /** Splash at screen x, on the waterline. `L` sizes it to the diver. */
  trigger(x: number, L: number): void {
    this.age = 0;
    this.ringX = x;
    this.width = 1.4 * L;
    for (let i = 0; i < DROPS; i += 1) {
      // Fanned evenly with a little jitter: a seeded look, never the same twice in a row.
      const spread = (i / (DROPS - 1)) * 2 - 1;
      const d = this.drops[i];
      d.x = x + spread * 0.25 * L;
      d.y = 0;
      d.vx = spread * (40 + 50 * Math.abs(Math.sin(i * 12.9898)));
      d.vy = -(150 + 120 * Math.abs(Math.sin(i * 78.233)));
      d.size = 3 + 4 * Math.abs(Math.sin(i * 3.7));
    }
  }

  /** Back to nothing: a new dive. */
  clear(): void {
    this.age = null;
    this.container.visible = false;
  }

  update(f: Frame): void {
    if (this.age === null) return;
    this.age += f.dt;
    const surface = surfaceY(f.depth, f.dy);
    this.container.visible = true;

    for (let i = 0; i < DROPS; i += 1) {
      const d = this.drops[i];
      const sprite = this.sprites[i];
      const k = this.age / DROP_LIFE;
      const y = d.y + d.vy * this.age + 0.5 * GRAVITY * this.age * this.age;
      // Gone once it falls back below the surface, or its time is up.
      if (k >= 1 || (this.age > 0.05 && y > 0)) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.x = d.x + d.vx * this.age;
      sprite.y = surface + y;
      sprite.width = d.size;
      sprite.height = d.size;
      sprite.alpha = 0.8 * (1 - k);
    }

    const r = this.age / RING_LIFE;
    this.ring.clear();
    if (r < 1) {
      const ease = 1 - (1 - r) * (1 - r);
      this.ring
        .ellipse(this.ringX, surface, this.width * (0.25 + ease), this.width * 0.08 * (0.5 + ease))
        .stroke({ width: 1.5, color: SPRAY, alpha: 0.6 * (1 - r) });
    }
    if (this.age > Math.max(DROP_LIFE, RING_LIFE)) this.clear();
  }
}
