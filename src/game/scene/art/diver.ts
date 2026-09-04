import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { SceneState } from '../renderer';
import type { Frame } from './layers';
import { DIVER } from './palette';

/**
 * The diver: a readable silhouette built once from Graphics, animated only by
 * transforms. Head, visor, torso, tank, arms, legs and fins, plus the lamp on
 * the forehead. The light cone and pool are positioned from here but live in
 * the world layer behind the diver.
 *
 * Local frame: +y runs along the body toward the fins; the head is at -y; the
 * belly (visor side) is +x. Poses are plain rotations of that frame, so the
 * change from level to head-down reads as the diver pitching forward.
 */

/** Level: body horizontal, head to the right, nose a little below horizontal. */
const LEVEL_THETA = 1.74;
/** Descending: head down and to the right, fins trailing up and to the left. */
const DESCENDING_THETA = 2.79;
/** The beam leaves the forehead a little toward the belly side of the head axis. */
const BEAM_TILT = 0.15;
const KICK_HZ = 0.55;
const TWO_PI = Math.PI * 2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class DiverRig {
  readonly container = new Container();
  /** Additive light cone, anchored at the lamp. Add to the world layer. */
  readonly cone: Sprite;
  /** Additive light pool centred on the diver. Add to the world layer. */
  readonly pool: Sprite;

  private readonly tank = new Graphics();
  /** Each leg is a container pivoting at the hip: the leg shape plus its fin. */
  private readonly legL = new Container();
  private readonly legR = new Container();
  private readonly legShapeL = new Graphics();
  private readonly legShapeR = new Graphics();
  private readonly finL = new Graphics();
  private readonly finR = new Graphics();
  private readonly torso = new Graphics();
  private readonly rim = new Graphics();
  private readonly armL = new Graphics();
  private readonly armR = new Graphics();
  private readonly head = new Graphics();
  private readonly visor = new Graphics();
  private readonly lamp = new Graphics();

  private bodyLength = 60;
  private theta = LEVEL_THETA;
  private kick = 0;

  constructor(textures: { cone: Texture; softDot: Texture }) {
    this.cone = new Sprite(textures.cone);
    this.cone.anchor.set(0.5, 0.03);
    this.cone.blendMode = 'add';
    this.pool = new Sprite(textures.softDot);
    this.pool.anchor.set(0.5);
    this.pool.blendMode = 'add';
    this.lamp.blendMode = 'add';

    this.legL.addChild(this.legShapeL, this.finL);
    this.legR.addChild(this.legShapeR, this.finR);
    this.container.addChild(
      this.tank,
      this.legL,
      this.legR,
      this.torso,
      this.rim,
      this.armL,
      this.armR,
      this.head,
      this.visor,
      this.lamp,
    );
  }

  /** Rebuild the parts for a viewport height. Never per frame. */
  layout(h: number): void {
    const L = Math.min(84, Math.max(44, h * 0.11));
    this.bodyLength = L;
    this.build(L);
  }

  private build(L: number): void {
    const suit = DIVER.suit;

    this.tank
      .clear()
      .roundRect(-0.21 * L, -0.19 * L, 0.14 * L, 0.42 * L, 0.07 * L)
      .fill(DIVER.tank)
      .stroke({ width: 1, color: DIVER.rim, alpha: 0.35 });

    this.torso.clear().ellipse(0, 0.05 * L, 0.19 * L, 0.34 * L).fill(suit);

    this.rim
      .clear()
      .ellipse(0, 0.05 * L, 0.19 * L, 0.34 * L)
      .stroke({ width: 0.035 * L, color: DIVER.rim })
      .circle(0, -0.4 * L, 0.16 * L)
      .stroke({ width: 0.035 * L, color: DIVER.rim });

    this.head.clear().circle(0, -0.4 * L, 0.16 * L).fill(suit);

    this.visor
      .clear()
      .roundRect(-0.07 * L, -0.48 * L, 0.2 * L, 0.12 * L, 0.05 * L)
      .fill(DIVER.visor);

    this.lamp.clear().circle(0.12 * L, -0.5 * L, 0.045 * L).fill(DIVER.lamp);

    const armStroke = { width: 0.06 * L, color: suit, cap: 'round' as const, join: 'round' as const };
    this.armL.position.set(-0.15 * L, -0.15 * L);
    this.armL
      .clear()
      .moveTo(0, 0)
      .lineTo(-0.11 * L, 0.17 * L)
      .lineTo(-0.07 * L, 0.37 * L)
      .stroke(armStroke);
    this.armR.position.set(0.15 * L, -0.15 * L);
    this.armR
      .clear()
      .moveTo(0, 0)
      .lineTo(0.11 * L, 0.17 * L)
      .lineTo(0.07 * L, 0.37 * L)
      .stroke(armStroke);

    // Legs pivot at the hip; fins are children of the legs and pivot at the knee.
    this.buildLeg(this.legL, this.legShapeL, this.finL, -1, L);
    this.buildLeg(this.legR, this.legShapeR, this.finR, 1, L);
  }

  private buildLeg(
    leg: Container,
    shape: Graphics,
    fin: Graphics,
    side: -1 | 1,
    L: number,
  ): void {
    leg.position.set(side * 0.08 * L, 0.36 * L);
    const kneeX = side * 0.02 * L;
    const kneeY = 0.26 * L;
    shape
      .clear()
      .poly([
        -0.05 * L, 0,
        0.05 * L, 0,
        kneeX + 0.035 * L, kneeY,
        kneeX - 0.035 * L, kneeY,
      ])
      .fill(DIVER.suit);

    fin.position.set(kneeX, kneeY);
    const wideY = 0.23 * L;
    const tipX = side * 0.02 * L;
    const tipY = 0.36 * L;
    fin
      .clear()
      .poly([
        -0.035 * L, 0,
        0.035 * L, 0,
        tipX * 0.6 + 0.08 * L, wideY,
        tipX, tipY,
        tipX * 0.6 - 0.08 * L, wideY,
      ])
      .fill(DIVER.fins);
  }

  /**
   * Place and animate the rig for this frame. Writes the lamp position and
   * beam direction into the frame for every other element's reveal.
   */
  update(f: Frame, state: SceneState, lightTint: number): void {
    const c = this.container;
    const dt = f.dt;
    const t = f.t;
    const reduced = f.reduced;

    const target = state.pose === 'descending' ? DESCENDING_THETA : LEVEL_THETA;
    this.theta += (target - this.theta) * (1 - Math.exp(-2 * dt));
    const rot = this.theta + (reduced ? 0 : 0.05 * Math.sin(0.5 * t));
    c.rotation = rot;
    c.x = f.dx;
    c.y = f.dy + (reduced ? 0 : 3 * Math.sin(0.4 * t));

    const kickTarget = state.exhaling && !reduced ? 1 : 0;
    this.kick += (kickTarget - this.kick) * (1 - Math.exp(-4 * dt));
    const phase = TWO_PI * KICK_HZ * t;
    const legSwing = this.kick * 0.22 * Math.sin(phase);
    this.legL.rotation = legSwing;
    this.legR.rotation = -legSwing;
    const finLag = this.kick * 0.12 * Math.sin(phase - 0.6);
    this.finL.rotation = finLag;
    this.finR.rotation = -finLag;

    const arm = reduced ? 0 : 0.06 * Math.sin(0.5 * t + 1);
    this.armL.rotation = arm;
    this.armR.rotation = -arm;

    const light = f.light;
    this.rim.alpha = 0.15 + 0.45 * light;
    this.visor.alpha = clamp01(0.25 + 0.65 * light + (reduced && state.exhaling ? 0.2 : 0));
    this.lamp.alpha = 0.3 + 0.7 * light;

    // Lamp on screen, then the beam it throws.
    const L = this.bodyLength;
    const lx = 0.12 * L;
    const ly = -0.5 * L;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    f.lampX = c.x + lx * cos - ly * sin;
    f.lampY = c.y + lx * sin + ly * cos;
    const beam = rot + Math.PI + BEAM_TILT;
    f.beamX = -Math.sin(beam);
    f.beamY = Math.cos(beam);

    const cone = this.cone;
    cone.x = f.lampX;
    cone.y = f.lampY;
    cone.rotation = beam;
    cone.tint = lightTint;
    cone.alpha = 0.55 * light;
    cone.scale.set((0.55 + 0.75 * light) * (f.h / 420));

    const pool = this.pool;
    pool.x = f.dx;
    pool.y = f.dy;
    pool.tint = lightTint;
    const size = f.h * (0.34 + 0.8 * light);
    pool.width = size;
    pool.height = size;
    pool.alpha = 0.22 * light;
  }
}
