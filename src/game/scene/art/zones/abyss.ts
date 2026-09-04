import { Container, Graphics, Sprite } from 'pixi.js';
import { mulberry32 } from '../../renderer';
import {
  FAR,
  LAYER_FOG,
  LAYER_PPM,
  MID,
  NEAR,
  lerpTint,
  reveal,
  slotY,
  spanMetres,
} from '../layers';
import type { Frame, ZoneArt } from '../layers';
import { MOUND, PLUME, RIDGE, SILHOUETTE_LIT, VENT_GLOW } from '../palette';
import type { ZoneLook } from '../palette';
import type { SceneTextures } from '../textures';

/**
 * Zone 2, the abyss: near-black water, ridges far off at the edges, a few
 * lure lights breathing slowly with anglers hanging beneath them, and vents
 * on the near wall breathing plumes. Violet.
 */

const TWO_PI = Math.PI * 2;
const LURE_COUNT = 10;
const ANGLER_COUNT = 4;
const RIDGE_COUNT = 4;
const VENT_COUNT = 3;
const PLUMES_PER_VENT = 12;
const PLUME_LIFE = 4;
const PLUME_PER_SECOND = 3;
const PLUME_RISE = 0.4;
const STATIC_PLUMES = 6;

interface Lure {
  sprite: Sprite;
  x: number;
  u: number;
  period: number;
  phase: number;
}

interface Angler {
  sprite: Sprite;
  lure: number;
}

interface Ridge {
  g: Graphics;
  x: number;
  u: number;
}

interface Plume {
  sprite: Sprite;
  alive: boolean;
  age: number;
  phase: number;
  alpha: number;
  size: number;
}

interface Vent {
  mound: Graphics;
  glow: Sprite;
  x: number;
  u: number;
  top: number;
  plumes: Plume[];
  accumulator: number;
  cursor: number;
}

function buildRidge(g: Graphics, random: () => number, side: -1 | 1, rw: number, rh: number): void {
  const points: number[] = [];
  for (let i = 0; i < 11; i += 1) {
    const a = (i / 11) * TWO_PI;
    const jitter = 1 + (random() - 0.5) * 0.5;
    let x = (Math.cos(a) * rw * jitter) / 2;
    const y = (Math.sin(a) * rh * jitter) / 2;
    x = side < 0 ? Math.max(x, -0.25 * rw) : Math.min(x, 0.25 * rw);
    points.push(x, y);
  }
  g.clear().poly(points).fill(0xffffff);
}

function buildMound(g: Graphics, rw: number, rh: number): void {
  const points: number[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI + (i / 12) * Math.PI;
    points.push(Math.cos(a) * rw, Math.sin(a) * rh);
  }
  g.clear().poly(points).fill(MOUND);
}

export class AbyssZone implements ZoneArt {
  readonly far = new Container();
  readonly mid = new Container();
  readonly near = new Container();
  readonly base = new Container();

  private readonly look: ZoneLook;
  private readonly lures: Lure[] = [];
  private readonly anglers: Angler[] = [];
  private readonly ridges: Ridge[] = [];
  private readonly vents: Vent[] = [];
  private spanFar = 1;
  private spanMid = 1;
  private spanNear = 1;

  constructor(look: ZoneLook, textures: SceneTextures) {
    this.look = look;
    const random = mulberry32(0xab55);

    for (let i = 0; i < RIDGE_COUNT; i += 1) {
      const side: -1 | 1 = i < 2 ? -1 : 1;
      const g = new Graphics();
      buildRidge(g, random, side, 140 + random() * 120, 200 + random() * 200);
      g.tint = RIDGE;
      g.alpha = 0.95 * LAYER_FOG[FAR];
      this.far.addChild(g);
      this.ridges.push({
        g,
        x: side < 0 ? -0.05 + random() * 0.27 : 0.78 + random() * 0.27,
        u: (i % 2) / 2 + random() * 0.4,
      });
    }

    for (let i = 0; i < LURE_COUNT; i += 1) {
      const sprite = new Sprite(textures.softDot);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = look.accent;
      const size = 6 + random() * 4;
      sprite.width = size * 2.5;
      sprite.height = size * 2.5;
      this.mid.addChild(sprite);
      this.lures.push({
        sprite,
        x: 0.1 + random() * 0.8,
        u: random(),
        period: 5 + random() * 3,
        phase: random() * TWO_PI,
      });
    }

    for (let i = 0; i < ANGLER_COUNT; i += 1) {
      const sprite = new Sprite(textures.angler);
      sprite.anchor.set(0.5);
      sprite.tint = look.silhouette;
      sprite.alpha = 0.85 * LAYER_FOG[MID];
      const scale = 0.8 + random() * 0.3;
      // The jaw is on the texture's left; flip so it faces its lure.
      sprite.scale.set(-scale, scale);
      this.mid.addChild(sprite);
      this.anglers.push({ sprite, lure: i });
    }
    // Anglers go under their lures in draw order.
    for (let i = 0; i < LURE_COUNT; i += 1) this.mid.addChild(this.lures[i].sprite);

    const ventX = [0.12, 0.8, 0.92];
    for (let i = 0; i < VENT_COUNT; i += 1) {
      const rw = 30 + random() * 15;
      const rh = 30 + random() * 15;
      const mound = new Graphics();
      buildMound(mound, rw, rh);
      const glow = new Sprite(textures.softDot);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = VENT_GLOW;
      glow.alpha = 0.15;
      glow.width = 40;
      glow.height = 40;
      const plumes: Plume[] = [];
      for (let p = 0; p < PLUMES_PER_VENT; p += 1) {
        const sprite = new Sprite(textures.softDot);
        sprite.anchor.set(0.5);
        sprite.tint = PLUME;
        sprite.visible = false;
        this.near.addChild(sprite);
        plumes.push({
          sprite,
          alive: false,
          age: 0,
          phase: random() * TWO_PI,
          alpha: 0.1 + random() * 0.08,
          size: 8 + random() * 10,
        });
      }
      this.near.addChild(glow, mound);
      this.vents.push({
        mound,
        glow,
        x: ventX[i],
        u: random(),
        top: rh,
        plumes,
        accumulator: 0,
        cursor: 0,
      });
    }
  }

  layout(_w: number, h: number): void {
    this.spanFar = spanMetres(h, LAYER_PPM[FAR], 220);
    this.spanMid = spanMetres(h, LAYER_PPM[MID], 60);
    this.spanNear = spanMetres(h, LAYER_PPM[NEAR], 120);
  }

  enter(): void {
    // Nothing depends on the entry depth here.
  }

  update(f: Frame): void {
    const { w, h, t, dt, depth, reduced } = f;
    const look = this.look;

    for (let i = 0; i < this.ridges.length; i += 1) {
      const ridge = this.ridges[i];
      ridge.g.x = ridge.x * w;
      ridge.g.y = slotY(ridge.u, 0, depth, this.spanFar, LAYER_PPM[FAR], h);
    }

    // Lure lights breathe slowly; never a strobe.
    for (let i = 0; i < this.lures.length; i += 1) {
      const lure = this.lures[i];
      const sprite = lure.sprite;
      sprite.x = lure.x * w + (reduced ? 0 : 15 * Math.sin(0.1 * t + lure.phase));
      sprite.y = slotY(lure.u, 0, depth, this.spanMid, LAYER_PPM[MID], h);
      sprite.alpha = reduced
        ? 0.5
        : 0.15 + 0.6 * (0.5 + 0.5 * Math.sin((TWO_PI * t) / lure.period + lure.phase));
    }

    for (let i = 0; i < this.anglers.length; i += 1) {
      const angler = this.anglers[i];
      const lure = this.lures[angler.lure].sprite;
      const x = lure.x - 18;
      const y = lure.y + 14;
      angler.sprite.x = x;
      angler.sprite.y = y;
      angler.sprite.tint = lerpTint(look.silhouette, SILHOUETTE_LIT, 0.5 * reveal(f, x, y));
    }

    // Vents on the near wall.
    for (let i = 0; i < this.vents.length; i += 1) {
      const vent = this.vents[i];
      const x = vent.x * w;
      const y = slotY(vent.u, 0, depth, this.spanNear, LAYER_PPM[NEAR], h);
      vent.mound.x = x;
      vent.mound.y = y;
      const topY = y - vent.top;
      vent.glow.x = x;
      vent.glow.y = topY;

      if (reduced) {
        // A still plume: a few sprites at fixed heights and alphas.
        for (let p = 0; p < PLUMES_PER_VENT; p += 1) {
          const plume = vent.plumes[p];
          const sprite = plume.sprite;
          if (p >= STATIC_PLUMES) {
            sprite.visible = false;
            continue;
          }
          const k = (p + 0.5) / STATIC_PLUMES;
          sprite.visible = true;
          sprite.x = x + (6 + 10 * k * PLUME_LIFE) * Math.sin(plume.phase) * 0.5;
          sprite.y = topY - k * PLUME_LIFE * PLUME_RISE * LAYER_PPM[NEAR] * 3;
          const size = plume.size * (1 + 0.6 * k);
          sprite.width = size;
          sprite.height = size;
          sprite.alpha = plume.alpha * (1 - k);
        }
        continue;
      }

      vent.accumulator += dt * PLUME_PER_SECOND;
      while (vent.accumulator >= 1) {
        vent.accumulator -= 1;
        for (let n = 0; n < PLUMES_PER_VENT; n += 1) {
          const idx = (vent.cursor + n) % PLUMES_PER_VENT;
          const plume = vent.plumes[idx];
          if (plume.alive) continue;
          plume.alive = true;
          plume.age = 0;
          plume.sprite.visible = true;
          vent.cursor = idx + 1;
          break;
        }
      }
      for (let p = 0; p < PLUMES_PER_VENT; p += 1) {
        const plume = vent.plumes[p];
        if (!plume.alive) continue;
        plume.age += dt;
        const sprite = plume.sprite;
        if (plume.age >= PLUME_LIFE) {
          plume.alive = false;
          sprite.visible = false;
          continue;
        }
        const k = plume.age / PLUME_LIFE;
        sprite.x = x + (6 + 10 * plume.age) * Math.sin(1.3 * plume.age + plume.phase) * 0.6;
        sprite.y = topY - plume.age * PLUME_RISE * LAYER_PPM[NEAR] * 3;
        const size = plume.size * (1 + 0.6 * k);
        sprite.width = size;
        sprite.height = size;
        sprite.alpha = plume.alpha * (1 - k);
      }
    }
  }
}
