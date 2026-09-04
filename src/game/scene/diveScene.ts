import type { BreathEngine } from '../../breath/types';
import type { BreathConductor, PromptWindow } from '../session/conductor';
import { metresForExhale } from './descent';
import { CanvasSceneRenderer } from './canvasRenderer';
import { PixiSceneRenderer } from './pixiRenderer';
import type { DiverPose, PromptBeat, SceneRenderer, SceneState } from './renderer';

/**
 * The dive: descent, dive light, camera.
 *
 * Nothing here draws. Pixels belong to a SceneRenderer, which means the art
 * pass changed how this looks without touching how it behaves, and the WebGL
 * and 2D paths cannot disagree about what is happening — only about how it is
 * shown.
 *
 * The motion brief, which matters as much as the mechanic: descending and calm.
 * Nothing should read as a score counter going up. No strobing, no flashes,
 * nothing that lurches.
 */

/** How quickly the drawn depth catches the earned depth. Lower is more languid. */
const GLIDE_PER_SECOND = 1.6;

/** The dive light fades over this long once charged, so it has to be renewed. */
const LIGHT_DECAY_PER_SECOND = 0.22;

/**
 * How long the loop keeps drawing after the scene comes to rest while settling.
 * The renderer eases the descent surge and its wake off over about 700 ms
 * after the drawn depth catches up; stopping on the first resting frame could
 * freeze a wake half-faded on the surface band.
 */
const REST_GRACE_SECONDS = 0.8;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface DiveSceneOptions {
  /**
   * Matches the session's playback compression. The glide is wall-clock, so
   * without this a session run at 10x earns depth ten times faster than the
   * easing can draw it and the diver falls a long way behind (#31).
   */
  timeScale?: number;
  reducedMotion?: boolean;
}

/**
 * Builds the best renderer the machine will give us.
 *
 * WebGL is not guaranteed — a locked-down laptop, hardware acceleration turned
 * off, a blocked context. Falling back rather than throwing means a judge on a
 * borrowed machine sees a dive instead of a blank rectangle.
 */
export async function createDiveRenderer(
  canvas: HTMLCanvasElement,
  options: { reducedMotion?: boolean } = {},
): Promise<SceneRenderer> {
  // Defaulted here as well as in the scene. The scene honouring the preference
  // while the renderer ignored it would leave the motes drifting for exactly
  // the people who asked for less motion.
  const resolved = {
    reducedMotion:
      options.reducedMotion ??
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  try {
    return await PixiSceneRenderer.create(canvas, resolved);
  } catch {
    return new CanvasSceneRenderer(canvas, resolved);
  }
}

export class DiveScene {
  private readonly renderer: SceneRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly timeScale: number;
  private readonly reducedMotion: boolean;

  private detach: (() => void)[] = [];
  private frame = 0;
  private lastFrameAt = 0;
  private observer: ResizeObserver | null = null;
  private settling = false;
  private restSeconds = 0;

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
  private lightCharge = 0;
  private charging = false;
  private promptStep: PromptBeat = 'none';
  private promptStartedAt: number | null = null;
  private promptDurationMs = 0;
  private pose: DiverPose = 'level';
  private startedAt = 0;
  private zone = 0;

  constructor(
    renderer: SceneRenderer,
    canvas: HTMLCanvasElement,
    options: DiveSceneOptions = {},
  ) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.timeScale = options.timeScale ?? 1;
    this.reducedMotion =
      options.reducedMotion ??
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        this.lightCharge = Math.max(0, this.lightCharge - 0.35);
      }),
    );

    this.detach.push(conductor.on((window) => this.onPrompt(window)));
    return () => this.release();
  }

  /**
   * Told by the session arc which zone is current. Not inferred from depth —
   * depth bands read as zones contradicted the arc in #30.
   */
  setZone(zone: number): void {
    this.zone = zone;
  }

  /** Told by the view how the diver should hold itself: level or head-down. */
  setPose(pose: DiverPose): void {
    this.pose = pose;
  }

  start(): void {
    if (this.frame) return;
    this.settling = false;
    this.restSeconds = 0;
    this.lastFrameAt = performance.now();
    if (!this.startedAt) this.startedAt = this.lastFrameAt;
    this.observer = new ResizeObserver(() => this.renderer.resize());
    this.observer.observe(this.canvas);

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastFrameAt) / 1000);
      this.lastFrameAt = now;
      this.update(dt, now);
      this.renderer.render(this.snapshot(now), dt);
      if (this.settling) {
        this.restSeconds = this.atRest() ? this.restSeconds + dt : 0;
        if (this.restSeconds >= REST_GRACE_SECONDS) {
          this.stop();
          return;
        }
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  /**
   * Finish the current motion, then stop on its own.
   *
   * Called when the session ends. Cutting the loop dead there would freeze the
   * diver mid-glide, and leaving it running burns a frame every 16ms for as long
   * as someone reads their result — the surface screen is where people linger.
   */
  settle(): void {
    this.settling = true;
    // Stop charging too. If the session happened to end mid-inhale the light
    // would otherwise keep filling, the rest condition would never be met, and
    // "settle" would mean "run forever".
    this.charging = false;
    this.promptStartedAt = null;
    this.promptDurationMs = 0;
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
    this.renderer.destroy();
  }

  /**
   * Metres earned, including the breath currently in progress. This is the
   * number to report: it is true the moment the breath earns it, whereas the
   * drawn depth is a visual easing that can still be catching up when a session
   * ends — which is how the readout and the canvas came to disagree in #31.
   */
  get depth(): number {
    return this.targetDepth;
  }

  /** What is on screen right now. Trails `depth` while the glide settles. */
  get drawnDepth(): number {
    return this.shownDepth;
  }

  /** 0-1 dive light charge, for the HUD meter. */
  get light(): number {
    return this.lightCharge;
  }

  // ------------------------------------------------------------- internals

  private snapshot(now: number): SceneState {
    const exhaling = this.exhaleStartedAt !== null;
    const promptProgress =
      this.promptStartedAt === null || this.promptDurationMs === 0
        ? 0
        : clamp01((now - this.promptStartedAt) / this.promptDurationMs);
    return {
      depth: this.shownDepth,
      light: this.lightCharge,
      descending: this.targetDepth - this.shownDepth > 0.05,
      zone: this.zone,
      promptStep: this.promptStep,
      exhaling,
      exhaleSeconds: exhaling ? (now - (this.exhaleStartedAt as number)) / 1000 : 0,
      charging: this.charging,
      promptProgress,
      promptDurationMs: this.promptDurationMs,
      pose: this.pose,
      elapsedSeconds: this.startedAt ? (now - this.startedAt) / 1000 : 0,
    };
  }

  /** Close enough that another frame would not change a pixel. */
  private atRest(): boolean {
    return Math.abs(this.targetDepth - this.shownDepth) < 0.05 && this.lightCharge < 0.02;
  }

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
    this.promptStartedAt = performance.now();
    this.promptDurationMs = window.durationMs / this.timeScale;
  }

  private update(dt: number, now: number): void {
    if (this.charging) {
      this.lightCharge = clamp01(this.lightCharge + dt * 0.9);
    } else {
      this.lightCharge = Math.max(0, this.lightCharge - dt * LIGHT_DECAY_PER_SECOND);
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
  }
}
