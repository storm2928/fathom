import { Container, Sprite } from 'pixi.js';
import { mulberry32 } from '../../renderer';
import { BASE, FAR, LAYER_FOG, LAYER_PPM, MID, NEAR, mod, slotY, spanMetres } from '../layers';
import type { Frame, ZoneArt } from '../layers';
import { SNOW } from '../palette';
import type { ZoneLook } from '../palette';
import type { SceneTextures } from '../textures';

/**
 * Zone 1, midnight: marine snow sinking past, jellyfish pulsing at three
 * distances, and now and then a large shape crossing far off. Blue.
 */

const TWO_PI = Math.PI * 2;
const SNOW_FAR = 120;
const SNOW_BASE = 80;
const WHALE_PPM = 1.5;
const TENTACLES = 5;

interface Flake {
  sprite: Sprite;
  x: number;
  u: number;
  drift: number;
  layer: 0 | 2;
  phase: number;
}

interface Jelly {
  rig: Container;
  bell: Sprite;
  strips: Sprite[];
  layer: 0 | 1 | 3;
  scale: number;
  x: number;
  u: number;
  drift: number;
  phase: number;
}

interface Whale {
  sprite: Sprite;
  u: number;
  x0: number;
}

const JELLY_LAYERS: (0 | 1 | 3)[] = [FAR, FAR, MID, MID, MID, NEAR];
const JELLY_SCALE = { [FAR]: 0.45, [MID]: 0.7, [NEAR]: 1.0 } as const;
const JELLY_ALPHA = { [FAR]: 0.35, [MID]: 0.55, [NEAR]: 0.8 } as const;

export class MidnightZone implements ZoneArt {
  readonly far = new Container();
  readonly mid = new Container();
  readonly near = new Container();
  readonly base = new Container();

  private readonly flakes: Flake[] = [];
  private readonly jellies: Jelly[] = [];
  private readonly whales: Whale[] = [];
  private readonly spans = [1, 1, 1, 1];
  private spanWhale = 1;

  constructor(look: ZoneLook, textures: SceneTextures) {
    const random = mulberry32(0x3b1d);

    for (let i = 0; i < SNOW_FAR + SNOW_BASE; i += 1) {
      const layer: 0 | 2 = i < SNOW_FAR ? FAR : BASE;
      const sprite = new Sprite(textures.snow);
      sprite.anchor.set(0.5);
      sprite.tint = SNOW;
      const size = 2 + random() * 2;
      sprite.width = size;
      sprite.height = size;
      sprite.alpha = (0.25 + random() * 0.25) * (layer === FAR ? 0.7 : 1);
      (layer === FAR ? this.far : this.base).addChild(sprite);
      this.flakes.push({ sprite, x: random(), u: random(), drift: 0, layer, phase: random() * TWO_PI });
    }

    for (let i = 0; i < JELLY_LAYERS.length; i += 1) {
      const layer = JELLY_LAYERS[i];
      const scale = JELLY_SCALE[layer];
      const rig = new Container();
      const bell = new Sprite(textures.bell);
      bell.anchor.set(0.5, 0.9);
      bell.tint = look.moteHex;
      bell.alpha = JELLY_ALPHA[layer];
      const strips: Sprite[] = [];
      for (let k = 0; k < TENTACLES; k += 1) {
        const strip = new Sprite(textures.strip);
        strip.anchor.set(0.5, 0);
        strip.tint = look.moteHex;
        strip.alpha = 0.5 * (JELLY_ALPHA[layer] / 0.8);
        strip.x = (k - 2) * 12 * scale;
        strip.y = 4 * scale;
        strip.scale.set(scale, ((48 + random() * 16) / 64) * scale);
        strips.push(strip);
        rig.addChild(strip);
      }
      rig.addChild(bell);
      const container = layer === FAR ? this.far : layer === MID ? this.mid : this.near;
      container.addChild(rig);
      this.jellies.push({
        rig,
        bell,
        strips,
        layer,
        scale,
        x: 0.1 + random() * 0.8,
        u: random(),
        drift: 0,
        phase: random() * TWO_PI,
      });
    }

    for (let i = 0; i < 2; i += 1) {
      const sprite = new Sprite(textures.whale);
      sprite.anchor.set(0.5);
      sprite.tint = look.silhouette;
      sprite.alpha = 0.22;
      sprite.scale.set(1 + random() * 0.3);
      this.far.addChild(sprite);
      this.whales.push({ sprite, u: i === 0 ? 0.3 : 0.8, x0: random() * 1200 });
    }
  }

  layout(_w: number, h: number): void {
    this.spans[FAR] = spanMetres(h, LAYER_PPM[FAR], 100);
    this.spans[MID] = spanMetres(h, LAYER_PPM[MID], 100);
    this.spans[BASE] = spanMetres(h, LAYER_PPM[BASE], 60);
    this.spans[NEAR] = spanMetres(h, LAYER_PPM[NEAR], 100);
    this.spanWhale = spanMetres(h, WHALE_PPM, 80);
  }

  enter(): void {
    // Nothing depends on the entry depth here.
  }

  update(f: Frame): void {
    const { w, h, t, dt, depth, reduced } = f;

    // Marine snow sinks; the world scrolls up past it.
    const fall = reduced ? 0 : 0.25 * dt;
    for (let i = 0; i < this.flakes.length; i += 1) {
      const flake = this.flakes[i];
      flake.drift += fall;
      const span = this.spans[flake.layer];
      const y = slotY(flake.u, flake.drift, depth, span, LAYER_PPM[flake.layer], h);
      const sprite = flake.sprite;
      if (y < -10 || y > h + 10) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.y = y;
      sprite.x = flake.x * w + (reduced ? 0 : 2 * Math.sin(0.3 * t + flake.phase));
    }

    // Jellyfish: pulse, rise, drift.
    const rise = reduced ? 0 : 0.15 * dt;
    for (let i = 0; i < this.jellies.length; i += 1) {
      const jelly = this.jellies[i];
      jelly.drift -= rise;
      const span = this.spans[jelly.layer];
      const y = slotY(jelly.u, jelly.drift, depth, span, LAYER_PPM[jelly.layer], h);
      const rig = jelly.rig;
      rig.y = y;
      rig.x = jelly.x * w + (reduced ? 0 : 8 * Math.sin(0.12 * t + jelly.phase));
      const pulse = reduced ? 0 : Math.sin(TWO_PI * 0.22 * t + jelly.phase);
      jelly.bell.scale.set(jelly.scale * (1 - 0.03 * pulse), jelly.scale * (1 + 0.06 * pulse));
      for (let k = 0; k < TENTACLES; k += 1) {
        jelly.strips[k].rotation = reduced ? 0 : 0.12 * Math.sin(0.3 * t + 0.8 * k + jelly.phase);
      }
    }

    // A distant shape, at most one on screen at a time.
    for (let i = 0; i < this.whales.length; i += 1) {
      const whale = this.whales[i];
      const sprite = whale.sprite;
      const y = slotY(whale.u, 0, depth, this.spanWhale, WHALE_PPM, h);
      sprite.y = y;
      sprite.x = reduced
        ? mod(whale.x0, w + 400) - 200
        : w + 200 - mod(3 * t + whale.x0, w + 400);
      sprite.alpha = 0.22 * LAYER_FOG[FAR];
    }
  }
}
