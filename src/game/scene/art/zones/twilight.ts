import { Container, Graphics, Sprite } from 'pixi.js';
import { mulberry32 } from '../../renderer';
import {
  LAYER_FOG,
  LAYER_PPM,
  MID,
  NEAR,
  clamp01,
  lerpTint,
  mod,
  reveal,
  slotY,
  spanMetres,
} from '../layers';
import type { Frame, ZoneArt } from '../layers';
import { KELP, SILHOUETTE_LIT } from '../palette';
import type { ZoneLook } from '../palette';
import type { SceneTextures } from '../textures';

/**
 * Zone 0, the twilight reef: slanting rays from the surface, a rock wall on
 * either side with kelp swaying above it, and small schools of fish crossing
 * at mid distance. Teal.
 */

const TWO_PI = Math.PI * 2;
const RAY_COUNT = 5;
const ROCK_COUNT = 6;
const STRAND_COUNT = 10;
const LEAVES_PER_STRAND = 8;
const SCHOOL_COUNT = 3;
const FISH_PER_SCHOOL = 10;
const LEAF_STEP = 22;

interface Ray {
  g: Graphics;
  x0: number;
  width: number;
  alpha: number;
  period: number;
  phase: number;
}

interface Rock {
  g: Graphics;
  u: number;
  x: number;
}

interface Strand {
  x: number;
  u: number;
  phase: number;
  lean: number;
  leaves: Sprite[];
  scales: number[];
}

interface School {
  u: number;
  period: number;
  phase: number;
  fish: Sprite[];
  ox: number[];
  oy: number[];
  scale: number[];
}

function buildRock(g: Graphics, random: () => number, side: -1 | 1, rw: number, rh: number): void {
  const points: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TWO_PI;
    const jitter = 1 + (random() - 0.5) * 0.44;
    let x = (Math.cos(a) * rw * jitter) / 2;
    const y = (Math.sin(a) * rh * jitter) / 2;
    // Flatten the side that meets the wall.
    x = side < 0 ? Math.max(x, -0.3 * rw) : Math.min(x, 0.3 * rw);
    points.push(x, y);
  }
  g.clear().poly(points).fill(0xffffff);
}

export class TwilightZone implements ZoneArt {
  readonly far = new Container();
  readonly mid = new Container();
  readonly near = new Container();
  readonly base = new Container();

  private readonly look: ZoneLook;
  private readonly rays: Ray[] = [];
  private readonly rocks: Rock[] = [];
  private readonly strands: Strand[] = [];
  private readonly schools: School[] = [];
  private depthAtEntry = 0;
  private spanNear = 1;
  private spanMid = 1;

  constructor(look: ZoneLook, textures: SceneTextures) {
    this.look = look;
    const random = mulberry32(0x7a11);

    for (let i = 0; i < RAY_COUNT; i += 1) {
      const g = new Graphics();
      g.blendMode = 'add';
      g.tint = look.accent;
      this.rays.push({
        g,
        x0: random(),
        width: 60 + random() * 80,
        alpha: 0.05 + random() * 0.04,
        period: 9 + random() * 4,
        phase: random() * TWO_PI,
      });
      this.far.addChild(g);
    }

    for (let i = 0; i < ROCK_COUNT; i += 1) {
      const side: -1 | 1 = i < 3 ? -1 : 1;
      const g = new Graphics();
      buildRock(g, random, side, 90 + random() * 90, 120 + random() * 140);
      g.alpha = 0.92;
      g.tint = look.silhouette;
      this.rocks.push({
        g,
        u: (i % 3) / 3 + random() * 0.3,
        x: side < 0 ? -0.05 + random() * 0.21 : 0.84 + random() * 0.21,
      });
      this.near.addChild(g);
    }

    for (let s = 0; s < STRAND_COUNT; s += 1) {
      const left = s < 5;
      const leaves: Sprite[] = [];
      const scales: number[] = [];
      for (let i = 0; i < LEAVES_PER_STRAND; i += 1) {
        const leaf = new Sprite(textures.leaf);
        leaf.anchor.set(0.5, 1);
        leaf.tint = KELP;
        leaf.alpha = 0.85;
        const scale = 1 - 0.4 * (i / (LEAVES_PER_STRAND - 1));
        leaf.scale.set(scale);
        leaves.push(leaf);
        scales.push(scale);
        this.mid.addChild(leaf);
      }
      this.strands.push({
        x: left ? 0.02 + random() * 0.12 : 0.86 + random() * 0.12,
        u: random(),
        phase: random() * TWO_PI,
        lean: (random() - 0.5) * 0.3,
        leaves,
        scales,
      });
    }

    for (let k = 0; k < SCHOOL_COUNT; k += 1) {
      const fish: Sprite[] = [];
      const ox: number[] = [];
      const oy: number[] = [];
      const scale: number[] = [];
      for (let i = 0; i < FISH_PER_SCHOOL; i += 1) {
        const sprite = new Sprite(textures.fish);
        sprite.anchor.set(0.5);
        sprite.tint = look.silhouette;
        sprite.alpha = 0.75 * LAYER_FOG[MID];
        fish.push(sprite);
        ox.push((random() - 0.5) * 68);
        oy.push((random() - 0.5) * 68);
        scale.push(0.7 + random() * 0.3);
        this.mid.addChild(sprite);
      }
      this.schools.push({
        u: random(),
        period: 90 + random() * 40,
        phase: random() * TWO_PI,
        fish,
        ox,
        oy,
        scale,
      });
    }
  }

  layout(_w: number, h: number): void {
    for (let i = 0; i < this.rays.length; i += 1) {
      const ray = this.rays[i];
      ray.g.clear().rect(-ray.width / 2, 0, ray.width, 1.25 * h).fill(0xffffff);
    }
    this.spanNear = spanMetres(h, LAYER_PPM[NEAR], 160);
    this.spanMid = spanMetres(h, LAYER_PPM[MID], 200);
  }

  enter(depth: number): void {
    this.depthAtEntry = depth;
  }

  update(f: Frame): void {
    const { w, h, t, depth, reduced } = f;
    const look = this.look;

    // Rays from the surface, thinning out as the zone deepens.
    const rayFade = clamp01(1 - (depth - this.depthAtEntry) / 60);
    for (let i = 0; i < this.rays.length; i += 1) {
      const ray = this.rays[i];
      const g = ray.g;
      g.x = mod(ray.x0 * w - depth * 0.6, w + 200) - 100;
      g.y = -20;
      g.rotation = -0.21 + (reduced ? 0 : 0.026 * Math.sin((TWO_PI * t) / ray.period + ray.phase));
      g.alpha = ray.alpha * rayFade;
    }

    // The reef wall.
    for (let i = 0; i < this.rocks.length; i += 1) {
      const rock = this.rocks[i];
      const x = rock.x * w;
      const y = slotY(rock.u, 0, depth, this.spanNear, LAYER_PPM[NEAR], h);
      rock.g.x = x;
      rock.g.y = y;
      rock.g.tint = lerpTint(look.silhouette, SILHOUETTE_LIT, 0.5 * reveal(f, x, y));
    }

    // Kelp, rooted in the wall and swaying above it.
    for (let s = 0; s < this.strands.length; s += 1) {
      const strand = this.strands[s];
      let x = strand.x * w;
      let y = slotY(strand.u, 0, depth, this.spanMid, LAYER_PPM[MID], h);
      for (let i = 0; i < LEAVES_PER_STRAND; i += 1) {
        const leaf = strand.leaves[i];
        const angle =
          strand.lean + (reduced ? 0 : 0.12 * Math.sin(0.35 * t + 0.5 * i + strand.phase));
        leaf.x = x;
        leaf.y = y;
        leaf.rotation = angle;
        const step = LEAF_STEP * strand.scales[i];
        x += step * Math.sin(angle);
        y -= step * Math.cos(angle);
      }
    }

    // Fish schools crossing slowly at mid distance.
    for (let k = 0; k < this.schools.length; k += 1) {
      const school = this.schools[k];
      const arg = reduced ? school.phase : (TWO_PI * t) / school.period + school.phase;
      const cx = 0.5 * w + 0.36 * w * Math.sin(arg);
      const facing = Math.cos(arg) >= 0 ? -1 : 1;
      const bob = reduced ? 0 : 0.4 * Math.sin(0.8 * t + k);
      const cy = slotY(school.u, bob, depth, this.spanMid, LAYER_PPM[MID], h);
      for (let i = 0; i < FISH_PER_SCHOOL; i += 1) {
        const fish = school.fish[i];
        const wobble = reduced ? 0 : 2 * Math.sin(4 * t + i);
        const x = cx + school.ox[i] + wobble;
        const y = cy + school.oy[i];
        fish.x = x;
        fish.y = y;
        const s = school.scale[i];
        fish.scale.set(facing * s, s);
        fish.tint = lerpTint(look.silhouette, SILHOUETTE_LIT, 0.5 * reveal(f, x, y));
      }
    }
  }
}
