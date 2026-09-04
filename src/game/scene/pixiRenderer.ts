import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BubbleTrail } from './art/bubbles';
import { ZoneCrossfade } from './art/crossfade';
import { DiverRig } from './art/diver';
import {
  LAYER_FOG,
  LAYER_PPM,
  LAYER_SCALE,
  clamp01,
  createFrame,
  lerpTint,
  lit,
  setZoneAlpha,
  setZoneVisible,
  slotY,
  spanMetres,
} from './art/layers';
import type { Frame, ZoneArt } from './art/layers';
import { ZONE_LOOKS, lookForZone } from './art/palette';
import type { ZoneLook } from './art/palette';
import { DescentSurge } from './art/surge';
import { buildTextures } from './art/textures';
import type { SceneTextures } from './art/textures';
import { AbyssZone } from './art/zones/abyss';
import { MidnightZone } from './art/zones/midnight';
import { TwilightZone } from './art/zones/twilight';
import { DiverWake } from './art/wake';
import { driftMotes, seedMotes } from './renderer';
import type { Mote, SceneRenderer, SceneState } from './renderer';

/**
 * The WebGL renderer.
 *
 * What Pixi buys here is additive blending. Bioluminescence is light being
 * *added* to dark water - motes, lures and the dive light that brighten where
 * they overlap. On the 2D canvas that is a per-pixel composite the CPU pays
 * for; on the GPU it is free.
 *
 * Everything here is drawing. The descent, the light charge and the camera all
 * live in DiveScene and are shared with the 2D fallback, so the two renderers
 * cannot disagree about what is happening - only about how it looks. Nothing
 * is allocated per frame: every sprite and Graphics exists from construction,
 * textures are drawn once, and the ticker stays stopped because the scene
 * drives the frames.
 */

const MOTE_COUNT = 600;
const REDUCED_MOTE_VISIBLE = 200;
const WATER_BANDS = 48;
const MAX_BACKING_PIXELS = 2.6e6;

export class PixiSceneRenderer implements SceneRenderer {
  private readonly app: Application;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private readonly textures: SceneTextures;

  private readonly motes: Mote[];
  private readonly moteSprites: Sprite[] = [];
  private readonly moteLayers = [new Container(), new Container(), new Container()];

  private readonly waterA = new Graphics();
  private readonly waterB = new Graphics();
  private readonly farLayer = new Container();
  private readonly midLayer = new Container();
  private readonly nearLayer = new Container();
  private readonly baseLayer = new Container();
  private readonly fog: Sprite;
  private readonly vignette: Sprite;

  private readonly rig: DiverRig;
  private readonly bubbles: BubbleTrail;
  private readonly wake: DiverWake;
  private readonly surge = new DescentSurge();
  private readonly zones: ZoneArt[];
  private readonly fade = new ZoneCrossfade();
  private readonly frame: Frame;

  private visualLight = 0;
  private scroll = 0;
  private lastDepth = 0;
  private moteTint = -1;
  private width = 0;
  private height = 0;

  private constructor(app: Application, canvas: HTMLCanvasElement, reducedMotion: boolean) {
    this.app = app;
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.textures = buildTextures();
    const tx = this.textures;

    this.motes = seedMotes(MOTE_COUNT);
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      const sprite = new Sprite(tx.dot);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      const size = mote.radius * 7 * LAYER_SCALE[mote.layer];
      sprite.width = size;
      sprite.height = size;
      this.moteSprites.push(sprite);
      this.moteLayers[mote.layer].addChild(sprite);
    }

    this.fog = new Sprite(tx.fog);
    this.vignette = new Sprite(tx.vignette);
    this.vignette.tint = 0x000000;

    this.rig = new DiverRig(tx);
    this.bubbles = new BubbleTrail(tx.bubble);
    this.wake = new DiverWake(tx.dot);
    this.zones = [
      new TwilightZone(ZONE_LOOKS[0], tx),
      new MidnightZone(ZONE_LOOKS[1], tx),
      new AbyssZone(ZONE_LOOKS[2], tx),
    ];

    this.farLayer.addChild(this.moteLayers[0]);
    this.midLayer.addChild(this.moteLayers[1]);
    for (let z = 0; z < this.zones.length; z += 1) {
      const zone = this.zones[z];
      this.farLayer.addChild(zone.far);
      this.midLayer.addChild(zone.mid);
      this.nearLayer.addChild(zone.near);
      this.baseLayer.addChild(zone.base);
      setZoneVisible(zone, z === 0);
      setZoneAlpha(zone, z === 0 ? 1 : 0);
    }
    this.baseLayer.addChild(
      this.moteLayers[2],
      this.rig.pool,
      this.rig.cone,
      this.bubbles.container,
      this.wake.container,
      this.rig.container,
    );
    this.waterB.visible = false;

    this.app.stage.addChild(
      this.waterA,
      this.waterB,
      this.farLayer,
      this.midLayer,
      this.fog,
      this.nearLayer,
      this.baseLayer,
      this.vignette,
    );

    this.frame = createFrame(ZONE_LOOKS[0]);
    this.frame.reduced = reducedMotion;
    this.zones[0].enter(0);

    // The scene drives its own frame loop, so Pixi must not also drive one.
    this.app.ticker.stop();
    this.layout(this.app.renderer.width, this.app.renderer.height);
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: { reducedMotion?: boolean } = {},
  ): Promise<PixiSceneRenderer> {
    const app = new Application();
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 500;
    await app.init({
      canvas,
      antialias: true,
      resolution: backingResolution(width, height),
      autoDensity: true,
      powerPreference: 'low-power',
      width,
      height,
    });
    return new PixiSceneRenderer(app, canvas, options.reducedMotion ?? false);
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.app.renderer.resize(clientWidth, clientHeight, backingResolution(clientWidth, clientHeight));
    this.layout(clientWidth, clientHeight);
  }

  render(state: SceneState, dtSeconds: number): void {
    const w = this.width;
    const h = this.height;
    if (!w || !h) return;
    const reduced = this.reducedMotion;
    const f = this.frame;

    // The light on screen trails the light in the simulation, so the spend at
    // exhale end reads as a dim rather than a flash.
    this.visualLight += (state.light - this.visualLight) * (1 - Math.exp(-6 * dtSeconds));
    // While the drawn depth is still catching up the water goes past a little
    // faster than the depth alone would carry it: one eased factor, shared by
    // the scroll and every layer's drift, so the parallax holds. Held at 1
    // under reduced motion.
    const surge = this.surge.step(state.descending, dtSeconds, reduced);
    // Under reduced motion the simulation snaps depth at exhale end; a short
    // display easing keeps that from lurching without touching the readout.
    if (reduced) this.scroll += (state.depth - this.scroll) * (1 - Math.exp(-3 * dtSeconds));
    else this.scroll += (state.depth - this.lastDepth) * surge;
    this.lastDepth = state.depth;

    // Zone changes are crossfades, never cuts.
    const zone = Math.min(this.zones.length - 1, Math.max(0, state.zone));
    if (zone !== this.fade.to) {
      const from = this.fade.to;
      // A change arriving mid-fade drops the zone that was already on its way out.
      if (this.fade.from >= 0 && this.fade.from !== zone) {
        setZoneVisible(this.zones[this.fade.from], false);
      }
      this.fade.begin(from, zone);
      paintWater(this.waterB, lookForZone(from), w, h);
      paintWater(this.waterA, lookForZone(zone), w, h);
      this.waterB.visible = true;
      this.zones[zone].enter(this.scroll);
      setZoneVisible(this.zones[zone], true);
    }
    const fromIndex = this.fade.from;
    const e = this.fade.step(dtSeconds, reduced);
    const toLook = lookForZone(zone);
    const fromLook = fromIndex >= 0 ? lookForZone(fromIndex) : toLook;
    const fading = fromIndex >= 0;

    if (fading) {
      this.waterB.alpha = 1 - e;
      setZoneAlpha(this.zones[fromIndex], 1 - e);
      setZoneAlpha(this.zones[zone], e);
      if (this.fade.done) {
        this.waterB.visible = false;
        setZoneVisible(this.zones[fromIndex], false);
        setZoneAlpha(this.zones[zone], 1);
      }
    }

    const moteTint = fading ? lerpTint(fromLook.moteHex, toLook.moteHex, e) : toLook.moteHex;
    const lightTint = fading ? lerpTint(fromLook.lightHex, toLook.lightHex, e) : toLook.lightHex;
    const moteAlpha = fromLook.moteAlpha + (toLook.moteAlpha - fromLook.moteAlpha) * e;
    this.fog.tint = fading ? lerpTint(fromLook.fog, toLook.fog, e) : toLook.fog;
    this.fog.alpha = fromLook.fogAlpha + (toLook.fogAlpha - fromLook.fogAlpha) * e;
    this.vignette.alpha =
      fromLook.vignetteAlpha + (toLook.vignetteAlpha - fromLook.vignetteAlpha) * e;

    f.w = w;
    f.h = h;
    f.dx = 0.5 * w;
    f.dy = 0.44 * h;
    f.depth = this.scroll;
    f.t = state.elapsedSeconds;
    f.dt = dtSeconds;
    f.light = this.visualLight;
    f.exhaling = state.exhaling;
    f.surge = surge;
    f.look = toLook;

    // The rig goes first: it writes the lamp position and beam direction that
    // every other element's reveal reads.
    this.rig.update(f, state, lightTint);

    if (!reduced) driftMotes(this.motes, dtSeconds * surge);
    const toCount = visibleMotes(toLook, reduced);
    const fromCount = visibleMotes(fromLook, reduced);
    const tintChanged = moteTint !== this.moteTint;
    this.moteTint = moteTint;
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      const sprite = this.moteSprites[i];
      // Tint every sprite, culled or not, so none surfaces later in the old colour.
      if (tintChanged) sprite.tint = moteTint;
      const countK = i < toCount ? 1 : i < fromCount ? 1 - e : 0;
      if (countK <= 0) {
        sprite.visible = false;
        continue;
      }
      const layer = mote.layer;
      const y = slotY(mote.u, mote.drift, this.scroll, f.spans[layer], LAYER_PPM[layer], h);
      if (y < -20 || y > h + 20) {
        sprite.visible = false;
        continue;
      }
      const x = mote.x * w;
      sprite.visible = true;
      sprite.x = x;
      sprite.y = y;
      // Motes near the diver catch the dive light; the rest only glimmer.
      const glow = lit(f, x, y);
      sprite.alpha =
        clamp01(mote.glow * (0.22 + glow * 1.1)) * moteAlpha * LAYER_FOG[layer] * countK;
    }

    this.bubbles.update(f);
    this.wake.update(f, this.surge.wake);
    this.zones[zone].update(f);
    if (fading && !this.fade.done) this.zones[fromIndex].update(f);

    this.app.renderer.render(this.app.stage);
  }

  destroy(): void {
    // Leaves the canvas element alone - it belongs to React, not to Pixi.
    this.app.destroy(false, { children: true, texture: false });
    const tx = this.textures as unknown as Record<string, Texture>;
    for (const key in tx) {
      const texture = tx[key];
      if (texture !== Texture.WHITE) texture.destroy(true);
    }
  }

  // ------------------------------------------------------------- internals

  private layout(w: number, h: number): void {
    this.width = w;
    this.height = h;
    const f = this.frame;
    for (let layer = 0; layer < LAYER_PPM.length; layer += 1) {
      f.spans[layer] = spanMetres(h, LAYER_PPM[layer], 60);
    }
    this.fog.width = w;
    this.fog.height = h;
    this.vignette.width = w;
    this.vignette.height = h;
    this.rig.layout(h);
    for (let z = 0; z < this.zones.length; z += 1) this.zones[z].layout(w, h);
    paintWater(this.waterA, lookForZone(this.fade.to), w, h);
    if (this.fade.from >= 0) paintWater(this.waterB, lookForZone(this.fade.from), w, h);
  }
}

/** Keep the backing store at or under 2.6 megapixels on any display. */
function backingResolution(w: number, h: number): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.min(dpr, 2, Math.sqrt(MAX_BACKING_PIXELS / (w * h))));
}

function visibleMotes(look: ZoneLook, reduced: boolean): number {
  return reduced ? Math.min(look.moteCount, REDUCED_MOTE_VISIBLE) : look.moteCount;
}

/**
 * A vertical gradient built from bands. Pixi's gradient fills vary across 8.x
 * point releases; a few dozen bands are indistinguishable on screen and cannot
 * break under a patch bump. Rebuilt only on zone change and resize.
 */
function paintWater(g: Graphics, look: ZoneLook, w: number, h: number): void {
  g.clear();
  for (let i = 0; i < WATER_BANDS; i += 1) {
    const t = i / (WATER_BANDS - 1);
    g.rect(0, (h * i) / WATER_BANDS, w, h / WATER_BANDS + 1).fill(
      lerpTint(look.topHex, look.bottomHex, t),
    );
  }
}
