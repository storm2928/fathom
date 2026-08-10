import type { BreathEngine } from '../../breath/types';
import type { BreathConductor, PromptWindow } from '../session/conductor';
import { metresForExhale, DARKEST_AT_METRES } from './descent';

/**
 * The dive, drawn with untextured shapes.
 *
 * Graybox on purpose: this exists to prove the feel — that a long smooth exhale
 * reads as gliding further down than a short choppy one — before any art is
 * committed to. All drawing is confined to `draw` and the small helpers below it
 * so the renderer can be swapped for a WebGL one at the art pass (#13) without
 * touching the descent or breath wiring.
 *
 * The motion brief, which matters as much as the mechanic: descending and calm.
 * Nothing here should read as a score counter going up. No strobing, no flashes,
 * nothing that lurches.
 */

interface Mote {
  /** world position: x across the canvas, y in metres */
  x: number;
  depth: number;
  radius: number;
  glow: number;
}

const MOTE_COUNT = 90;
/** Metres of world kept populated above and below the diver. */
const MOTE_SPAN = 90;

/** Pixels drawn per metre of depth. */
const PIXELS_PER_METRE = 5;

/** How quickly the drawn depth catches the earned depth. Lower is more languid. */
const GLIDE_PER_SECOND = 1.6;

/** The dive light fades over this long once charged, so it has to be renewed. */
const LIGHT_DECAY_PER_SECOND = 0.22;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface DiveSceneOptions {
  /** Honour the viewer's motion preference; defaults to reading the media query. */
  reducedMotion?: boolean;
  /**
   * Matches the session's playback compression. The glide is wall-clock, so
   * without this a session run at 10x earns depth ten times faster than the
   * easing can draw it and the diver falls a long way behind (#31).
   */
  timeScale?: number;
}

export class DiveScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reducedMotion: boolean;
  private readonly timeScale: number;

  private motes: Mote[] = [];
  private detach: (() => void)[] = [];
  private frame = 0;
  private lastFrameAt = 0;
  private observer: ResizeObserver | null = null;

  /** Depth earned by completed breaths, in metres. */
  private earnedDepth = 0;
  /** Depth including the breath currently in progress. */
  private targetDepth = 0;
  /** Depth actually drawn, easing toward the target. */
  private shownDepth = 0;

  private exhaleStartedAt: number | null = null;
  private depthAtExhaleStart = 0;
  private lastQuality = 0.7;

  /** 0–1. Charged by the inhale prompt, spent on the way down. */
  private light = 0;
  private charging = false;
  private promptStep: string = 'inhale';

  constructor(canvas: HTMLCanvasElement, options: DiveSceneOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('dive scene needs a 2d context');
    this.canvas = canvas;
    this.ctx = ctx;
    this.reducedMotion =
      options.reducedMotion ??
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.timeScale = options.timeScale ?? 1;
    this.resize();
    this.seedMotes();
  }

  /** Wire up the breath source and the prompt. Returns a teardown. */
  attach(engine: BreathEngine, conductor: BreathConductor): () => void {
    this.detach.push(
      engine.on('phase-change', ({ phase }) => {
        if (phase === 'exhale') {
          this.exhaleStartedAt = performance.now();
          this.depthAtExhaleStart = this.earnedDepth;
        } else {
          this.exhaleStartedAt = null;
        }
      }),
    );

    this.detach.push(
      engine.on('exhale-end', ({ durationMs, quality }) => {
        this.lastQuality = quality;
        // Settle on the true value for the breath. The glide during the exhale
        // was an estimate using the previous quality, so this is a small
        // correction rather than a jump.
        this.earnedDepth = this.depthAtExhaleStart + metresForExhale(durationMs, quality);
        this.targetDepth = this.earnedDepth;
        this.exhaleStartedAt = null;
        // The light is spent by descending: it has to be recharged each cycle,
        // which is what makes the double inhale part of the loop rather than
        // decoration.
        this.light = Math.max(0, this.light - 0.35);
      }),
    );

    this.detach.push(conductor.on((window) => this.onPrompt(window)));
    return () => this.release();
  }

  start(): void {
    if (this.frame) return;
    this.lastFrameAt = performance.now();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastFrameAt) / 1000);
      this.lastFrameAt = now;
      this.update(dt, now);
      this.draw();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.observer?.disconnect();
    this.observer = null;
  }

  destroy(): void {
    this.stop();
    this.release();
  }

  /**
   * Metres earned, including the breath currently in progress. This is the
   * number to report: it is true the moment the breath earns it, whereas the
   * drawn depth is a visual easing that can still be catching up when a session
   * ends — which is how the readout and the canvas came to disagree by 50m in
   * #31. It is monotonic, so it never counts anything back.
   */
  get depth(): number {
    return this.targetDepth;
  }

  /** What is on screen right now. Trails `depth` while the glide settles. */
  get drawnDepth(): number {
    return this.shownDepth;
  }

  // ------------------------------------------------------------- internals

  private release(): void {
    for (const off of this.detach) off();
    this.detach = [];
  }

  private onPrompt(window: PromptWindow): void {
    this.promptStep = window.step;
    // Both inhale beats charge. The second one is the sigh, and it tops the
    // light up rather than starting over — which is why a double inhale lights
    // the way further than a single one.
    this.charging = window.step === 'inhale' || window.step === 'top-up';
  }

  private update(dt: number, now: number): void {
    if (this.charging) {
      this.light = clamp01(this.light + dt * 0.9);
    } else {
      this.light = Math.max(0, this.light - dt * LIGHT_DECAY_PER_SECOND);
    }

    // Glide down while the exhale is still running, using the length so far.
    // metresForExhale is monotonic in duration, so this only ever moves forward.
    if (this.exhaleStartedAt !== null) {
      const elapsed = now - this.exhaleStartedAt;
      this.targetDepth =
        this.depthAtExhaleStart + metresForExhale(elapsed, this.lastQuality);
    }

    const catchUp = this.reducedMotion
      ? 1
      : 1 - Math.exp(-GLIDE_PER_SECOND * dt * this.timeScale);
    this.shownDepth = lerp(this.shownDepth, this.targetDepth, catchUp);

    if (!this.reducedMotion) {
      for (const mote of this.motes) {
        // Motes hold still in the world; the diver moving past them is what
        // reads as descent. A slow independent drift keeps the water alive.
        mote.depth -= dt * 0.6;
      }
    }
    this.recycleMotes();
  }

  private seedMotes(): void {
    this.motes = Array.from({ length: this.reducedMotion ? 0 : MOTE_COUNT }, (_, i) => ({
      // Deterministic spread rather than random, so a screenshot of the graybox
      // looks the same twice and a visual change is attributable.
      x: ((i * 61) % 100) / 100,
      depth: ((i * 37) % MOTE_SPAN) - MOTE_SPAN / 2,
      radius: 0.6 + ((i * 13) % 20) / 10,
      glow: 0.25 + ((i * 7) % 60) / 100,
    }));
  }

  private recycleMotes(): void {
    const top = this.shownDepth - MOTE_SPAN / 2;
    const bottom = this.shownDepth + MOTE_SPAN / 2;
    for (const mote of this.motes) {
      if (mote.depth < top) mote.depth += MOTE_SPAN;
      else if (mote.depth > bottom) mote.depth -= MOTE_SPAN;
    }
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.canvas.width = Math.round(clientWidth * dpr);
    this.canvas.height = Math.round(clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- drawing: everything below here is what the art pass replaces --------

  private draw(): void {
    const { ctx } = this;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;

    this.drawWater(ctx, w, h);
    this.drawMotes(ctx, w, h);
    this.drawLight(ctx, w, h);
    this.drawDiver(ctx, w, h);
    this.drawHud(ctx, w);
  }

  /** Darkens with depth. The only thing telling you how far down you are. */
  private drawWater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const t = clamp01(this.shownDepth / DARKEST_AT_METRES);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `hsl(200 70% ${Math.max(2, 16 - t * 14)}%)`);
    gradient.addColorStop(1, `hsl(215 80% ${Math.max(1, 7 - t * 6)}%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  private drawMotes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const centre = h / 2;
    for (const mote of this.motes) {
      const y = centre + (mote.depth - this.shownDepth) * PIXELS_PER_METRE;
      if (y < -10 || y > h + 10) continue;
      // Motes near the diver catch the dive light.
      const lit = clamp01(1 - Math.abs(y - centre) / (h * 0.45)) * this.light;
      ctx.beginPath();
      ctx.arc(mote.x * w, y, mote.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(180 90% ${55 + lit * 25}% / ${mote.glow * (0.35 + lit)})`;
      ctx.fill();
    }
  }

  /** The cone the inhale charges. Grows and brightens with the light level. */
  private drawLight(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.light <= 0.01) return;
    const cx = w / 2;
    const cy = h / 2;
    const reach = h * (0.18 + this.light * 0.5);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    glow.addColorStop(0, `hsl(185 95% 70% / ${0.16 * this.light})`);
    glow.addColorStop(1, 'hsl(185 95% 70% / 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  private drawDiver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2;
    const descending = this.targetDepth - this.shownDepth > 0.05;

    ctx.save();
    ctx.translate(cx, cy);
    // Leans into the descent while moving, straightens when still. Small enough
    // to read as drifting rather than diving hard.
    ctx.rotate(descending ? 0.12 : 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(190 40% ${72 + this.light * 20}%)`;
    ctx.fill();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = 'hsl(185 40% 80% / 0.85)';
    ctx.font = '500 13px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.shownDepth.toFixed(1)} m`, 16, 26);
    // No zone here. The session's stage is shown beside the scene; a depth band
    // drawn as a zone contradicted it (#30).
    ctx.textAlign = 'right';
    ctx.fillStyle = 'hsl(185 30% 70% / 0.6)';
    ctx.fillText(this.promptStep, w - 16, 26);
    ctx.fillText(`light ${(this.light * 100).toFixed(0)}%`, w - 16, 44);
    ctx.textAlign = 'left';
  }
}
