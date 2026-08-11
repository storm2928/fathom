import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { PIXELS_PER_METRE, driftMotes, lookForZone, seedMotes } from './renderer';
import type { Mote, SceneRenderer, SceneState, ZoneLook } from './renderer';

/**
 * The WebGL renderer.
 *
 * What Pixi actually buys here is additive blending. Bioluminescence is light
 * being *added* to dark water — motes that brighten where they overlap and
 * where the dive light reaches them. On the 2D canvas that is a per-pixel
 * composite the CPU pays for; on the GPU it is free, which is what lets the
 * mote count go up by an order of magnitude without dropping frames on
 * integrated graphics.
 *
 * Everything here is drawing. The descent, the light charge and the camera all
 * live in DiveScene and are shared with the 2D fallback, so the two renderers
 * cannot disagree about what is happening — only about how it looks.
 */

const MOTE_COUNT = 600;
const REDUCED_MOTE_COUNT = 40;

/** Soft radial dot, generated once and reused by every mote. */
function makeDotTexture(): Texture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class PixiSceneRenderer implements SceneRenderer {
  private readonly app: Application;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;

  private readonly motes: Mote[];
  private readonly moteSprites: Sprite[] = [];
  private readonly moteLayer = new Container();
  private readonly background = new Graphics();
  private readonly light: Sprite;
  private readonly diver = new Graphics();
  private readonly depthText: Text;
  private readonly promptText: Text;
  private readonly lightText: Text;

  private currentZone = -2;

  private constructor(
    app: Application,
    canvas: HTMLCanvasElement,
    reducedMotion: boolean,
  ) {
    this.app = app;
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.motes = seedMotes(reducedMotion ? REDUCED_MOTE_COUNT : MOTE_COUNT);

    const dot = makeDotTexture();

    for (const mote of this.motes) {
      const sprite = new Sprite(dot);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.width = mote.radius * 7;
      sprite.height = mote.radius * 7;
      this.moteSprites.push(sprite);
      this.moteLayer.addChild(sprite);
    }

    this.light = new Sprite(dot);
    this.light.anchor.set(0.5);
    this.light.blendMode = 'add';

    const label = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, fill: 0xbfe6ee };
    this.depthText = new Text({ text: '', style: label });
    this.promptText = new Text({ text: '', style: label });
    this.lightText = new Text({ text: '', style: label });
    this.promptText.anchor.set(1, 0);
    this.lightText.anchor.set(1, 0);

    this.app.stage.addChild(
      this.background,
      this.moteLayer,
      this.light,
      this.diver,
      this.depthText,
      this.promptText,
      this.lightText,
    );

    // The scene drives its own frame loop, so Pixi must not also drive one.
    this.app.ticker.stop();
    this.layout();
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: { reducedMotion?: boolean } = {},
  ): Promise<PixiSceneRenderer> {
    const app = new Application();
    await app.init({
      canvas,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      powerPreference: 'low-power',
      width: canvas.clientWidth || 800,
      height: canvas.clientHeight || 500,
    });
    return new PixiSceneRenderer(app, canvas, options.reducedMotion ?? false);
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.app.renderer.resize(clientWidth, clientHeight);
    this.layout();
    this.currentZone = -2; // force the background to be rebuilt at the new size
  }

  render(state: SceneState, dtSeconds: number): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    if (!w || !h) return;

    const look = lookForZone(state.zone);
    if (state.zone !== this.currentZone) {
      this.paintWater(look, w, h);
      this.currentZone = state.zone;
      for (const sprite of this.moteSprites) sprite.tint = look.mote;
      this.light.tint = look.light;
    }

    if (!this.reducedMotion) driftMotes(this.motes, dtSeconds, state.depth);

    const centre = h / 2;
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      const sprite = this.moteSprites[i];
      const y = centre + (mote.depth - state.depth) * PIXELS_PER_METRE;
      if (y < -20 || y > h + 20) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.x = mote.x * w;
      sprite.y = y;
      // Motes near the diver catch the dive light; the rest only glimmer.
      const lit = clamp01(1 - Math.abs(y - centre) / (h * 0.45)) * state.light;
      sprite.alpha = clamp01(mote.glow * (0.22 + lit * 1.1));
    }

    // Tight enough to read as a pool the diver carries rather than the room
    // lights coming on. A flooded scene stops feeling like depth.
    const reach = h * (0.34 + state.light * 0.8);
    this.light.width = reach;
    this.light.height = reach;
    this.light.x = w / 2;
    this.light.y = centre;
    this.light.alpha = 0.3 * state.light;

    this.diver.x = w / 2;
    this.diver.y = centre;
    this.diver.rotation = state.descending ? 0.12 : 0;

    this.depthText.text = `${state.depth.toFixed(1)} m`;
    this.promptText.text = state.promptStep;
    this.lightText.text = `light ${(state.light * 100).toFixed(0)}%`;
    this.promptText.x = w - 16;
    this.lightText.x = w - 16;

    this.app.renderer.render(this.app.stage);
  }

  destroy(): void {
    // Leaves the canvas element alone — it belongs to React, not to Pixi.
    this.app.destroy(false, { children: true, texture: false });
  }

  // ------------------------------------------------------------- internals

  private layout(): void {
    this.depthText.x = 16;
    this.depthText.y = 14;
    this.promptText.y = 14;
    this.lightText.y = 32;

    this.diver.clear();
    this.diver.ellipse(0, 0, 7, 15).fill(0xcfe9f2);
  }

  private paintWater(look: ZoneLook, w: number, h: number): void {
    // A vertical gradient built from bands. Pixi's gradient fills vary across
    // 8.x point releases; a few dozen bands are indistinguishable on screen and
    // cannot break under a patch bump.
    this.background.clear();
    const BANDS = 48;
    for (let i = 0; i < BANDS; i += 1) {
      const t = i / (BANDS - 1);
      this.background
        .rect(0, (h * i) / BANDS, w, h / BANDS + 1)
        .fill({ color: mixHsl(look.top, look.bottom, t) });
    }
  }
}

/** Blend two `hsl(h s% l%)` strings. Both renderers read the same palette. */
function mixHsl(from: string, to: string, t: number): string {
  const parse = (value: string) => {
    const parts = value.match(/-?[\d.]+/g);
    return parts ? parts.map(Number) : [0, 0, 0];
  };
  const a = parse(from);
  const b = parse(to);
  const at = (i: number) => a[i] + (b[i] - a[i]) * t;
  return `hsl(${at(0)} ${at(1)}% ${at(2)}%)`;
}
