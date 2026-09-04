import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { PIXELS_PER_METRE } from '../renderer';
import type { Frame } from './layers';
import { DIVER } from './palette';

/**
 * A pool of bubbles that stream from the visor while an exhale is running.
 * Emission stops the instant the exhale does; bubbles already loose finish
 * rising. Nothing fires at exhale end - a short breath earns a short trail
 * and no other cue.
 */

const POOL = 48;
const PER_SECOND = 6;
const LIFE_SECONDS = 2.6;
const RISE_METRES_PER_SECOND = 0.9;

interface Bubble {
  alive: boolean;
  age: number;
  /** screen x at emission, px */
  x: number;
  /** world depth, metres */
  z: number;
  phase: number;
}

export class BubbleTrail {
  readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly bubbles: Bubble[] = [];
  private accumulator = 0;
  private cursor = 0;

  constructor(texture: Texture) {
    for (let i = 0; i < POOL; i += 1) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.tint = DIVER.bubble;
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
      this.bubbles.push({ alive: false, age: 0, x: 0, z: 0, phase: i * 1.7 });
    }
  }

  update(f: Frame): void {
    if (f.reduced) return;

    if (f.exhaling) {
      this.accumulator += f.dt * PER_SECOND;
      while (this.accumulator >= 1) {
        this.accumulator -= 1;
        this.emit(f);
      }
    } else {
      this.accumulator = 0;
    }

    const dt = f.dt;
    for (let i = 0; i < POOL; i += 1) {
      const b = this.bubbles[i];
      if (!b.alive) continue;
      const sprite = this.sprites[i];
      b.age += dt;
      if (b.age >= LIFE_SECONDS) {
        b.alive = false;
        sprite.visible = false;
        continue;
      }
      b.z -= RISE_METRES_PER_SECOND * dt;
      const k = b.age / LIFE_SECONDS;
      sprite.x = b.x + 4 * Math.sin(3 * b.age + b.phase);
      sprite.y = f.h / 2 + (b.z - f.depth) * PIXELS_PER_METRE;
      const scale = 0.6 + 0.65 * k;
      sprite.scale.set(scale);
      sprite.alpha = 0.55 * (1 - k);
    }
  }

  private emit(f: Frame): void {
    for (let n = 0; n < POOL; n += 1) {
      const i = (this.cursor + n) % POOL;
      const b = this.bubbles[i];
      if (b.alive) continue;
      this.cursor = i + 1;
      b.alive = true;
      b.age = 0;
      b.x = f.lampX;
      b.z = f.depth + (f.lampY - f.h / 2) / PIXELS_PER_METRE;
      const sprite = this.sprites[i];
      sprite.visible = true;
      sprite.x = b.x;
      sprite.y = f.lampY;
      sprite.scale.set(0.6);
      sprite.alpha = 0.55;
      return;
    }
  }
}
