import { Container, Graphics } from 'pixi.js';
import type { Frame } from './layers';
import { DIVER } from './palette';
import { surfaceY } from './depthLight';

/**
 * The dive boat: a small inflatable riding the swell on the waterline, drawn
 * as a silhouette like the diver. The diver sits on its left tube before a
 * dive and rolls off backwards (entry.ts); once they are in, it stays on the
 * surface and goes up out of sight as they sink.
 *
 * Local frame: x across from the diver's fixed point, y = 0 on the waterline.
 * Sizes are in body lengths, so the boat scales with the diver. It sits in
 * front of the diver, so the tube hides legs folded into the boat.
 */

const TUBE = 0x22374a;
const HULL = 0x14202c;
const FLAG = 0xc0504a;
const FLAG_STRIPE = 0xeaf3f7;

/** The boat's tube runs across this span, in body lengths from the fixed point. */
export const BOAT_LEFT = -1.55;
export const BOAT_RIGHT = 1.85;

/** How the boat rides the swell: a slow lift and a slight rock. Still under reduced motion. */
export function boatBob(t: number, reduced: boolean): { y: number; rotation: number } {
  if (reduced) return { y: 0, rotation: 0 };
  return { y: 2.5 * Math.sin(0.9 * t), rotation: 0.02 * Math.sin(0.7 * t + 1) };
}

export class Boat {
  readonly container = new Container();
  private readonly hull = new Graphics();
  private readonly body = new Graphics();
  private readonly flag = new Graphics();

  constructor() {
    this.container.addChild(this.hull, this.body, this.flag);
    this.container.visible = false;
  }

  /** Rebuild for a body length. Never per frame. */
  layout(L: number): void {
    const left = BOAT_LEFT * L;
    const right = BOAT_RIGHT * L;
    const tubeH = 0.3 * L;

    // Below the waterline: the hull, dark against the lit water.
    this.hull
      .clear()
      .poly([left + 0.1 * L, 0, right - 0.1 * L, 0, right - 0.35 * L, 0.2 * L, left + 0.35 * L, 0.15 * L])
      .fill({ color: HULL, alpha: 0.85 });

    const g = this.body.clear();
    // Outboard motor at the stern, its leg reaching into the water.
    g.roundRect(right - 0.02 * L, -0.5 * L, 0.2 * L, 0.26 * L, 0.06 * L).fill(HULL);
    g.rect(right + 0.05 * L, -0.26 * L, 0.06 * L, 0.42 * L).fill(HULL);
    // Console and its windscreen.
    g.roundRect(0.45 * L, -0.78 * L, 0.42 * L, 0.5 * L, 0.05 * L).fill(DIVER.suit);
    g.moveTo(0.47 * L, -0.78 * L)
      .lineTo(0.6 * L, -0.95 * L)
      .lineTo(0.87 * L, -0.95 * L)
      .stroke({ width: 0.035 * L, color: DIVER.rim, alpha: 0.4, cap: 'round' });
    // The tube: one long rounded float, lit along its top.
    g.roundRect(left, -tubeH, right - left, tubeH, tubeH / 2).fill(TUBE);
    g.moveTo(left + tubeH / 2, -tubeH + 0.02 * L)
      .lineTo(right - tubeH / 2, -tubeH + 0.02 * L)
      .stroke({ width: 0.03 * L, color: DIVER.rim, alpha: 0.45, cap: 'round' });
    // A few rope loops along its side.
    for (let i = 0; i < 5; i += 1) {
      const x = left + (0.35 + i * 0.62) * L;
      g.moveTo(x, -0.17 * L)
        .quadraticCurveTo(x + 0.14 * L, -0.06 * L, x + 0.28 * L, -0.17 * L)
        .stroke({ width: 0.02 * L, color: DIVER.rim, alpha: 0.3 });
    }

    // The diver-down flag on a short mast above the console.
    const mastX = 0.66 * L;
    this.flag
      .clear()
      .moveTo(mastX, -0.78 * L)
      .lineTo(mastX, -1.22 * L)
      .stroke({ width: 0.03 * L, color: DIVER.suit })
      .rect(mastX, -1.22 * L, 0.36 * L, 0.24 * L)
      .fill(FLAG)
      .moveTo(mastX, -1.22 * L)
      .lineTo(mastX + 0.36 * L, -0.98 * L)
      .stroke({ width: 0.05 * L, color: FLAG_STRIPE });
  }

  /** `entry` is the scene's: null means there is no boat in this scene. */
  update(f: Frame, entry: number | null): void {
    const c = this.container;
    const y = surfaceY(f.depth, f.dy);
    // Off the top of the screen once the dive has gone deep enough.
    c.visible = entry !== null && y > -f.h * 0.25;
    if (!c.visible) return;
    const bob = boatBob(f.t, f.reduced);
    c.x = f.dx;
    c.y = y + bob.y;
    c.rotation = bob.rotation;
  }
}
