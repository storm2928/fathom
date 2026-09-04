import { BEAM_TILT, CanvasArt, DESCENDING_THETA, LEVEL_THETA } from './art/canvasArt';
import { ZoneCrossfade } from './art/crossfade';
import { LAYER_PPM, clamp01, createFrame, lit, slotY, spanMetres } from './art/layers';
import type { Frame } from './art/layers';
import { ZONE_LOOKS, hexCss, DIVER } from './art/palette';
import { DescentSurge } from './art/surge';
import { PIXELS_PER_METRE, driftMotes, lookForZone, seedMotes } from './renderer';
import type { Mote, SceneRenderer, SceneState } from './renderer';

/**
 * The 2D fallback.
 *
 * Kept because WebGL is not guaranteed: a locked-down machine, a blocked
 * context, a browser with hardware acceleration off. A judge on a borrowed
 * laptop should see a dive rather than a blank rectangle, and this is cheap
 * insurance for that. It draws every zone and the diver, more simply, and it
 * never throws: a drawing error costs one frame, not the dive.
 */

const MOTE_COUNT = 60;
const BUBBLE_POOL = 12;
const BUBBLE_LIFE = 2.6;

interface Bubble {
  alive: boolean;
  age: number;
  x: number;
  z: number;
  phase: number;
}

export class CanvasSceneRenderer implements SceneRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly motes: Mote[];
  private readonly reducedMotion: boolean;
  private readonly art = new CanvasArt();
  private readonly fade = new ZoneCrossfade();
  private readonly surge = new DescentSurge();
  private readonly frame = createFrame(ZONE_LOOKS[0]);
  private readonly bubbles: Bubble[] = [];
  private readonly bubbleCss = hexCss(DIVER.bubble);

  private visualLight = 0;
  private scroll = 0;
  private lastDepth = 0;
  private theta = LEVEL_THETA;
  private kick = 0;
  private bubbleAccumulator = 0;

  constructor(canvas: HTMLCanvasElement, options: { reducedMotion?: boolean } = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.reducedMotion = options.reducedMotion ?? false;
    this.frame.reduced = this.reducedMotion;
    this.motes = seedMotes(MOTE_COUNT);
    for (let i = 0; i < BUBBLE_POOL; i += 1) {
      this.bubbles.push({ alive: false, age: 0, x: 0, z: 0, phase: i * 1.7 });
    }
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.canvas.width = Math.round(clientWidth * dpr);
    this.canvas.height = Math.round(clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let layer = 0; layer < LAYER_PPM.length; layer += 1) {
      this.frame.spans[layer] = spanMetres(clientHeight, LAYER_PPM[layer], 60);
    }
  }

  render(state: SceneState, dtSeconds: number): void {
    try {
      this.draw(state, dtSeconds);
    } catch {
      // A drawing error must never take the dive down with it.
    }
  }

  destroy(): void {
    // Nothing retained: the canvas belongs to the caller.
  }

  // ------------------------------------------------------------- internals

  private draw(state: SceneState, dt: number): void {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const reduced = this.reducedMotion;
    const f = this.frame;

    this.visualLight += (state.light - this.visualLight) * (1 - Math.exp(-6 * dt));
    // The descent surge, as in the WebGL renderer; this fallback takes the
    // speed factor and leaves out the wake.
    const surge = this.surge.step(state.descending, dt, reduced);
    if (reduced) this.scroll += (state.depth - this.scroll) * (1 - Math.exp(-3 * dt));
    else this.scroll += (state.depth - this.lastDepth) * surge;
    this.lastDepth = state.depth;

    const zone = Math.min(ZONE_LOOKS.length - 1, Math.max(0, state.zone));
    if (zone !== this.fade.to) this.fade.begin(this.fade.to, zone);
    const fromIndex = this.fade.from;
    const e = this.fade.step(dt, reduced);
    const fading = fromIndex >= 0;
    const toLook = lookForZone(zone);
    const fromLook = fading ? lookForZone(fromIndex) : toLook;

    f.w = w;
    f.h = h;
    f.dx = 0.5 * w;
    f.dy = 0.44 * h;
    f.depth = this.scroll;
    f.t = state.elapsedSeconds;
    f.dt = dt;
    f.light = this.visualLight;
    f.exhaling = state.exhaling;
    f.surge = surge;
    f.look = toLook;

    // Water, with the previous zone fading out over it.
    this.art.drawWater(ctx, zone, w, h, 1);
    if (fading) this.art.drawWater(ctx, fromIndex, w, h, 1 - e);

    // Diver pose and lamp, computed before anything that wants the light.
    const target = state.pose === 'descending' ? DESCENDING_THETA : LEVEL_THETA;
    this.theta += (target - this.theta) * (1 - Math.exp(-2 * dt));
    const rotation = this.theta + (reduced ? 0 : 0.05 * Math.sin(0.5 * f.t));
    const bob = reduced ? 0 : 3 * Math.sin(0.4 * f.t);
    const kickTarget = state.exhaling && !reduced ? 1 : 0;
    this.kick += (kickTarget - this.kick) * (1 - Math.exp(-4 * dt));
    const L = Math.min(84, Math.max(44, h * 0.11));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const lx = 0.12 * L;
    const ly = -0.5 * L;
    f.lampX = f.dx + lx * cos - ly * sin;
    f.lampY = f.dy + bob + lx * sin + ly * cos;
    const beam = rotation + Math.PI + BEAM_TILT;
    f.beamX = -Math.sin(beam);
    f.beamY = Math.cos(beam);

    // Zone specials.
    this.art.drawZone(ctx, zone, f, fading ? e : 1);
    if (fading) this.art.drawZone(ctx, fromIndex, f, 1 - e);

    // Motes.
    if (!reduced) driftMotes(this.motes, dt * surge);
    const moteAlpha = fromLook.moteAlpha + (toLook.moteAlpha - fromLook.moteAlpha) * e;
    ctx.fillStyle = this.art.moteColour(zone);
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      const layer = mote.layer;
      const y = slotY(mote.u, mote.drift, this.scroll, f.spans[layer], LAYER_PPM[layer], h);
      if (y < -10 || y > h + 10) continue;
      const x = mote.x * w;
      ctx.globalAlpha = clamp01(mote.glow * (0.35 + lit(f, x, y))) * moteAlpha;
      ctx.beginPath();
      ctx.arc(x, y, mote.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fog between the distance and the diver.
    const fogAlpha = fromLook.fogAlpha + (toLook.fogAlpha - fromLook.fogAlpha) * e;
    this.art.drawFog(ctx, zone, w, h, fogAlpha);

    // Light pool. One gradient per frame is acceptable on the fallback.
    const light = this.visualLight;
    if (light > 0.01) {
      const reach = h * (0.18 + light * 0.5);
      const glow = ctx.createRadialGradient(f.dx, f.dy, 0, f.dx, f.dy, reach);
      glow.addColorStop(0, this.art.lightColour(zone));
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.18 * light;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    this.art.drawDiver(ctx, f, rotation, this.kick, bob, this.art.lightColour(zone));
    this.drawBubbles(ctx, f);

    const vignetteAlpha =
      fromLook.vignetteAlpha + (toLook.vignetteAlpha - fromLook.vignetteAlpha) * e;
    this.art.drawVignette(ctx, w, h, vignetteAlpha);
  }

  private drawBubbles(ctx: CanvasRenderingContext2D, f: Frame): void {
    if (f.reduced) return;
    if (f.exhaling) {
      this.bubbleAccumulator += f.dt * 4;
      while (this.bubbleAccumulator >= 1) {
        this.bubbleAccumulator -= 1;
        for (let i = 0; i < BUBBLE_POOL; i += 1) {
          const b = this.bubbles[i];
          if (b.alive) continue;
          b.alive = true;
          b.age = 0;
          b.x = f.lampX;
          b.z = f.depth + (f.lampY - f.h / 2) / PIXELS_PER_METRE;
          break;
        }
      }
    } else {
      this.bubbleAccumulator = 0;
    }
    ctx.strokeStyle = this.bubbleCss;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < BUBBLE_POOL; i += 1) {
      const b = this.bubbles[i];
      if (!b.alive) continue;
      b.age += f.dt;
      if (b.age >= BUBBLE_LIFE) {
        b.alive = false;
        continue;
      }
      b.z -= 0.9 * f.dt;
      const k = b.age / BUBBLE_LIFE;
      const x = b.x + 4 * Math.sin(3 * b.age + b.phase);
      const y = f.h / 2 + (b.z - f.depth) * PIXELS_PER_METRE;
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.beginPath();
      ctx.arc(x, y, 3 + 4 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
