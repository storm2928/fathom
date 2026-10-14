import { Container, Graphics, GraphicsPath, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { SceneCreature } from '../renderer';
import { PIXELS_PER_METRE } from '../renderer';
import type { Frame } from './layers';
import { clamp01, lit } from './layers';

/**
 * Creatures in the water. Each sits at a fixed depth on the diver's own layer,
 * so it passes the diver exactly when the drawn depth reaches it. Out of the
 * dive light it is a faint silhouette; in it, its rim and its lights come up.
 */

/** Drawn size of a scale-1 creature, as a share of the screen height. */
const BASE_SIZE = 0.09;

interface Drawn {
  creature: SceneCreature;
  root: Container;
  body: Graphics;
  rim: Graphics;
  lights: Sprite[];
}

export class CreatureLayer {
  readonly container = new Container();
  private drawn: Drawn[] = [];
  private readonly dot: Texture;
  private silhouette = 0x0a1b26;

  constructor(dot: Texture) {
    this.dot = dot;
  }

  set(creatures: SceneCreature[]): void {
    for (const d of this.drawn) d.root.destroy({ children: true });
    this.drawn = creatures.map((creature) => this.build(creature));
  }

  update(f: Frame, silhouette: number): void {
    const size = f.h * BASE_SIZE;
    if (silhouette !== this.silhouette) {
      this.silhouette = silhouette;
      for (const d of this.drawn) d.body.tint = silhouette;
    }
    for (const d of this.drawn) {
      const c = d.creature;
      const px = size * c.scale;
      const x = c.x * f.w;
      const y = f.dy + (c.depth - f.depth) * PIXELS_PER_METRE;
      const visible = y > -px && y < f.h + px;
      d.root.visible = visible;
      if (!visible) continue;
      // Drift a little so nothing reads as a pasted sticker.
      const sway = f.reduced ? 0 : Math.sin(f.t * 0.4 + c.x * 9) * px * 0.04;
      d.root.position.set(x - px / 2 + sway, y - px / 2);
      d.root.scale.set(px / 100);
      const light = clamp01(lit(f, x, y) * 1.6);
      d.rim.alpha = 0.12 + 0.88 * light;
      for (const s of d.lights) s.alpha = 0.15 + 0.85 * light;
    }
  }

  private build(creature: SceneCreature): Drawn {
    const root = new Container();
    const body = new Graphics();
    const rim = new Graphics();
    for (const d of creature.body) {
      const path = new GraphicsPath(d);
      body.path(path).fill({ color: 0xffffff });
      rim.path(path).stroke({ width: 1.6, color: creature.colour, alpha: 0.9 });
    }
    body.tint = this.silhouette;
    rim.blendMode = 'add';
    root.addChild(body, rim);
    const lights = creature.lights.map(([cx, cy, r]) => {
      const s = new Sprite(this.dot);
      s.anchor.set(0.5);
      s.position.set(cx, cy);
      s.width = s.height = r * 7;
      s.tint = creature.colour;
      s.blendMode = 'add';
      root.addChild(s);
      return s;
    });
    this.container.addChild(root);
    return { creature, root, body, rim, lights };
  }
}
