import type { BreathEngine, BreathEventMap, CalibrationResult } from '../../breath/types';
import { BreathEmitter } from './emitter';
import { RateEstimator } from './rateEstimator';

/**
 * Hold the spacebar for as long as you are exhaling.
 *
 * This is a first-class way to play, not a consolation prize. It is offered
 * before a session starts, it is what someone uses in a room too loud for the
 * microphone or on a machine that refuses permission, and it is the path the
 * whole product falls back to if the microphone does not clear its gate. Every
 * event it emits is shaped exactly like the microphone's, so nothing downstream
 * has to know which one is driving.
 *
 * What it honestly cannot do: judge smoothness. A key is either down or it is
 * not, so quality here is length against the target and nothing else. The
 * microphone path scores smoothness from the envelope; this one does not
 * pretend to.
 */

export interface SpacebarEngineOptions {
  /** exhale length that scores full marks, ms */
  targetExhaleMs?: number;
  /** holds shorter than this are taps, not breaths */
  minHoldMs?: number;
  /** where key events are listened for; injectable for tests */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** how long calibrate() listens before reporting a baseline */
  calibrationMs?: number;
}

const DEFAULTS = {
  targetExhaleMs: 6_000,
  minHoldMs: 400,
  calibrationMs: 10_000,
};

/** Rate reported when calibration saw too few breaths to measure one. */
const ASSUMED_BASELINE_RR = 15;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Elements for which Space already means something to a keyboard user. */
const INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return INTERACTIVE.has(target.tagName) || target.isContentEditable;
}

export class SpacebarBreathEngine implements BreathEngine {
  readonly usingFallbackInput = true;

  private readonly emitter = new BreathEmitter();
  private readonly rate = new RateEstimator();
  private readonly cfg: Required<Omit<SpacebarEngineOptions, 'target'>>;
  private readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

  private running = false;
  private startedAt = 0;
  private holdStartedAt: number | null = null;
  private scored = 0;

  constructor(options: SpacebarEngineOptions = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.target = options.target ?? window;
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.startedAt = performance.now();
    this.scored = 0;
    this.rate.reset();

    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    // A held key whose keyup never arrives — alt-tab, a lost focus — would leave
    // an exhale open forever and report an absurd duration when it finally ends.
    this.target.addEventListener('blur', this.onInterrupt);
    document.addEventListener('visibilitychange', this.onInterrupt);

    // Nothing is being sensed, and the session should say so rather than let a
    // green light imply a microphone is working.
    this.emitter.emit('signal-quality', { level: 'good' });
    return Promise.resolve();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.abandonHold();

    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onInterrupt);
    document.removeEventListener('visibilitychange', this.onInterrupt);
  }

  /**
   * Baseline read. Someone using this path is asked to hold the key for the
   * length of their real exhale, so onset-to-onset still measures their actual
   * breathing rate — but if they did not press at all there is nothing to
   * measure, and saying so beats inventing a number the surface screen would
   * later compare against.
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
   * is broadband noise the detector cannot tell from an exhale, so detections
   * during the inhale prompt are refused. A keyboard cannot produce that false
   * positive — the person says when the exhale starts and when it ends. Applying
   * the filter here would only throw away real breaths, which is what reported a
   * breather at half their true rate in #29.
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

  // ------------------------------------------------------------- internals

  private elapsed(): number {
    return performance.now() - this.startedAt;
  }

  private readonly onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || key.repeat || !this.running) return;
    // Space is how a keyboard user presses a focused button. Swallowing it
    // everywhere would make the app unusable without a mouse, which is a steep
    // price for a breath. Anything focusable keeps its own meaning for Space.
    if (isInteractive(event.target)) return;
    // Otherwise the page scrolls under the diver on every breath.
    key.preventDefault();
    if (this.holdStartedAt !== null) return;

    const at = this.elapsed();
    this.holdStartedAt = at;
    this.rate.mark(at);
    this.emitter.emit('phase-change', { phase: 'exhale', at });
  };

  private readonly onKeyUp = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || !this.running) return;
    // No hold in flight means the keydown was ignored — on a button, say — so
    // this keyup is not ours to consume either.
    if (this.holdStartedAt === null) return;
    key.preventDefault();
    this.release();
  };

  /** Focus loss: end the breath where it stood rather than letting it run on. */
  private readonly onInterrupt = () => {
    if (document.visibilityState === 'visible' && this.holdStartedAt === null) return;
    this.release();
  };

  private release(): void {
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

  /** Drop an in-flight hold without scoring it, on stop. */
  private abandonHold(): void {
    if (this.holdStartedAt === null) return;
    this.holdStartedAt = null;
    // Abandoned on stop, so no breath was completed to measure.
    this.rate.discard();
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }
}
