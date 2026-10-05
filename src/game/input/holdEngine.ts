import type { BreathEngine, BreathEventMap, CalibrationResult } from '../../breath/types';
import { BreathEmitter } from './emitter';
import { RateEstimator } from './rateEstimator';

/**
 * Hold something down for as long as you are exhaling: the spacebar, or a
 * finger on the screen.
 *
 * Every event is shaped exactly like the microphone's, so nothing downstream
 * has to know which input is driving. What a hold honestly cannot do is judge
 * smoothness — it is down or it is not — so quality is length against the
 * target and nothing else.
 *
 * Subclasses only translate their own events into `press()` and `release()`.
 */

export interface HoldEngineOptions {
  /** exhale length that scores full marks, ms */
  targetExhaleMs?: number;
  /** holds shorter than this are taps, not breaths */
  minHoldMs?: number;
  /** how long calibrate() listens before reporting a baseline */
  calibrationMs?: number;
}

const DEFAULTS: Required<HoldEngineOptions> = {
  targetExhaleMs: 6_000,
  minHoldMs: 400,
  calibrationMs: 10_000,
};

/** Rate reported when calibration saw too few breaths to measure one. */
const ASSUMED_BASELINE_RR = 15;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Controls that already mean something when pressed, tapped or spaced. */
const INTERACTIVE =
  'button, a, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"])';

/**
 * Whether an event landed on (or inside) a control. `closest` rather than the
 * tag name, because a tap on a button's icon targets the SVG, not the button.
 */
export function isInteractive(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(INTERACTIVE) !== null;
}

export abstract class HoldBreathEngine implements BreathEngine {
  readonly usingFallbackInput = true;

  private readonly emitter = new BreathEmitter();
  private readonly rate = new RateEstimator();
  private readonly cfg: Required<HoldEngineOptions>;

  private running = false;
  private startedAt = 0;
  private holdStartedAt: number | null = null;
  private scored = 0;

  constructor(options: HoldEngineOptions = {}) {
    this.cfg = {
      targetExhaleMs: options.targetExhaleMs ?? DEFAULTS.targetExhaleMs,
      minHoldMs: options.minHoldMs ?? DEFAULTS.minHoldMs,
      calibrationMs: options.calibrationMs ?? DEFAULTS.calibrationMs,
    };
  }

  /** Attach this input's own listeners. */
  protected abstract bind(): void;
  /** Remove them. */
  protected abstract unbind(): void;

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.startedAt = performance.now();
    this.scored = 0;
    this.rate.reset();

    this.bind();
    // A hold whose release never arrives — the app backgrounded, a lost focus —
    // would leave an exhale open forever and report an absurd duration later.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.interrupt);
    }

    // Nothing is being sensed, and the session should say so rather than let a
    // green light imply a microphone is working.
    this.emitter.emit('signal-quality', { level: 'good' });
    return Promise.resolve();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.abandonHold();

    this.unbind();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.interrupt);
    }
  }

  /**
   * Baseline read. Someone using a hold is asked to hold for the length of
   * their real exhale, so onset-to-onset still measures their actual breathing
   * rate — but if they did not press at all there is nothing to measure, and
   * saying so beats inventing a number the surface screen would later compare
   * against.
   */
  calibrate(): Promise<CalibrationResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const measured = this.rate.breathsPerMin();
        resolve({
          baselineRR: measured ?? ASSUMED_BASELINE_RR,
          // No microphone, so there is no room to measure. Reported as silent
          // rather than as a plausible-looking floor that was never sampled.
          noiseFloor: 0,
          ok: measured !== null,
        });
      }, this.cfg.calibrationMs);
    });
  }

  on<K extends keyof BreathEventMap>(
    event: K,
    handler: (payload: BreathEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  /**
   * Deliberately inert, and that is the point.
   *
   * The #27 gate exists to stop an *acoustic* false positive: an audible inhale
   * is broadband noise the detector cannot tell from an exhale. A hold cannot
   * produce that false positive — the person says when the exhale starts and
   * when it ends. Applying the filter here would only throw away real breaths,
   * which is what reported a breather at half their true rate in #29.
   *
   * The method stays so the conductor can attach to any input without asking
   * what kind it is.
   */
  setExhaleExpected(): void {
    // Intentionally does nothing. See above.
  }

  /** Exhales accepted so far, for a shell that wants to confirm input is landing. */
  get scoredExhales(): number {
    return this.scored;
  }

  // ------------------------------------------------------- for subclasses

  protected get isRunning(): boolean {
    return this.running;
  }

  protected get holding(): boolean {
    return this.holdStartedAt !== null;
  }

  /** The exhale starts now. Ignored while one is already in flight. */
  protected press(): void {
    if (!this.running || this.holdStartedAt !== null) return;
    const at = this.elapsed();
    this.holdStartedAt = at;
    this.rate.mark(at);
    this.emitter.emit('phase-change', { phase: 'exhale', at });
  }

  /** The exhale ends now: scored if long enough, discarded as a tap if not. */
  protected release(): void {
    const startedAt = this.holdStartedAt;
    if (startedAt === null) return;
    this.holdStartedAt = null;

    const at = this.elapsed();
    const durationMs = at - startedAt;

    if (durationMs < this.cfg.minHoldMs) {
      // A tap, not a breath. Discarded rather than skipped: nothing happened
      // here, so the breaths either side of it are still adjacent.
      this.rate.discard();
      this.emitter.emit('phase-change', { phase: 'idle', at });
      return;
    }

    this.scored += 1;
    this.emitter.emit('exhale-end', {
      durationMs,
      quality: clamp01(durationMs / this.cfg.targetExhaleMs),
    });
    const breathsPerMin = this.rate.breathsPerMin();
    if (breathsPerMin !== null) {
      // Confidence is high because there is nothing to misread — the person
      // said when the exhale started and when it ended.
      this.emitter.emit('rr-update', { breathsPerMin, confidence: 0.95 });
    }

    this.emitter.emit('phase-change', { phase: 'idle', at });
  }

  /** Focus or visibility lost: end the breath where it stood rather than letting it run on. */
  protected readonly interrupt = () => {
    this.release();
  };

  // ------------------------------------------------------------- internals

  private elapsed(): number {
    return performance.now() - this.startedAt;
  }

  /** Drop an in-flight hold without scoring it, on stop. */
  private abandonHold(): void {
    if (this.holdStartedAt === null) return;
    this.holdStartedAt = null;
    // Abandoned on stop, so no breath was completed to measure.
    this.rate.discard();
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }
}
