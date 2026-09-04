import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { mulberry32 } from '../renderer';
import type { Frame } from './layers';
import { DIVER } from './palette';

/**
 * A faint wake behind the diver while the descent is under way: a few short
 * vertical streaks of water slipping past, sitting up and to the left where
 * the fins trail. They hold their place relative to the diver and only fade
 * with the descent surge - nothing slides, nothing oscillates. Every sprite
 * exists from construction.
 */

const STREAKS = 5;
const WIDTH_PX = 2.2;

interface Streak {
  sprite: Sprite;
  /** offsets and length in body lengths, so the wake scales with the diver */
  ox: number;
  oy: number;
  length: number;
  alpha: number;
}

export class DiverWake {
  readonly container = new Container();
  private readonly streaks: Streak[] = [];
  private shown = false;

  constructor(texture: Texture) {
    const random = mulberry32(0x5ea1);
    for (let i = 0; i < STREAKS; i += 1) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = DIVER.bubble;
      sprite.visible = false;
      this.container.addChild(sprite);
      this.streaks.push({
        sprite,
        ox: -0.55 + random() * 0.65,
        oy: -(0.55 + random() * 1.05),
        length: 0.25 + random() * 0.25,
        alpha: 0.12 + random() * 0.1,
      });
    }
  }

  /** `strength` is the eased 0-1 surge; 0 hides the wake outright. */
  update(f: Frame, strength: number): void {
    if (strength <= 0.001) {
      if (this.shown) {
        for (let i = 0; i < STREAKS; i += 1) this.streaks[i].sprite.visible = false;
        this.shown = false;
      }
      return;
    }
    this.shown = true;
    const L = Math.min(84, Math.max(44, f.h * 0.11));
    for (let i = 0; i < STREAKS; i += 1) {
      const s = this.streaks[i];
      const sprite = s.sprite;
      sprite.visible = true;
      sprite.x = f.dx + s.ox * L;
      sprite.y = f.dy + s.oy * L;
      sprite.width = WIDTH_PX;
      sprite.height = s.length * L;
      sprite.alpha = s.alpha * strength;
    }
  }
}
