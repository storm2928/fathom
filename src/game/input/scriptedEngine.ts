import type {
  BreathEngine,
  BreathEventMap,
  CalibrationResult,
  SignalQuality,
} from '../../breath/types';
import { MIN_EXHALE_MS, cycleForPeriod, periodForRate } from '../session/cycleShape';
import type { PromptWindow } from '../session/conductor';
import { BreathEmitter } from './emitter';
import { RateEstimator } from './rateEstimator';

/**
 * A BreathEngine that produces a plausible cyclic-sighing pattern with no
 * microphone involved.
 *
 * It exists so the dive scene, the session arc and the surface screen can be
 * built, demoed and tested before a real session is available — and afterwards,
 * as the fixture the real detector gets compared against. It is a development
 * harness, never a product surface: a person breathing has no effect on it.
 *
 * Fidelity rules it has to keep, or it stops being useful as a fixture:
 *   - It emits only `idle` and `exhale`. The real engine has no code path that
 *     emits `inhale` and never will, because an audible inhale is broadband
 *     noise the detector cannot separate from an exhale. Inhales are prompted by
 *     the conductor, not reported by an engine.
 *   - It honours `setExhaleExpected`, so anything relying on the #27 gate
 *     behaves the same here as it will in production.
 *   - Respiratory rate is measured exhale-onset to exhale-onset, by median —
 *     the same method the real estimator uses.
 *
 * Determinism: durations come from a seeded generator, and payloads carry the
 * scheduled duration rather than a measured one, so a timer that fires late
 * cannot change what the game sees. Passing an explicit `script` fixes a run
 * exactly.
 */

/** One breath cycle. Durations are in protocol milliseconds. */
export interface ScriptedBreath {
  inhaleMs: number;
  topUpMs: number;
  exhaleMs: number;
  restMs: number;
  /** 0–1, reported on `exhale-end` */
  quality: number;
}

/** The conductor, or anything else that plays prompt windows. */
export interface PromptSource {
  on(handler: (window: PromptWindow) => void): () => void;
}

export interface ScriptedEngineOptions {
  seed?: number;
  /** breaths/min at the start of the session */
  startRR?: number;
  /** breaths/min the pattern drifts toward */
  settledRR?: number;
  /** time constant of that drift, ms */
  settleMs?: number;
  /** mean exhale quality, 0–1 */
  quality?: number;
  /** spread applied to durations and quality, 0–1 */
  jitter?: number;
  signalQuality?: SignalQuality;
  /** how long `calibrate()` takes, in protocol time */
  calibrationMs?: number;
  /** run faster; 10 makes a five-minute arc take thirty seconds */
  timeScale?: number;
  /** a fixed cycle sequence, looped — overrides the generator */
  script?: ScriptedBreath[];
  /**
   * Follow a conductor's prompt instead of free-running. This models a person
   * who is actually doing the exercise, which is the case worth testing against:
   * a fixture drifting against the prompt would spend most of its exhales
   * suppressed by the #27 gate and tell us nothing.
   */
  follow?: PromptSource;
}

const DEFAULTS: Required<Omit<ScriptedEngineOptions, 'script' | 'follow'>> = {
  seed: 1,
  startRR: 15,
  settledRR: 8,
  settleMs: 180_000,
  quality: 0.7,
  jitter: 0.25,
  signalQuality: 'good',
  calibrationMs: 10_000,
  timeScale: 1,
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Small, fast, seedable. Any deterministic generator would do. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export class ScriptedBreathEngine implements BreathEngine {
  /**
   * True, and honestly so: nothing here is sensed. Anything gating on whether
   * the microphone is carrying the session should treat this like the spacebar.
   */
  readonly usingFallbackInput = true;

  private readonly emitter = new BreathEmitter();
  private readonly cfg: Required<Omit<ScriptedEngineOptions, 'script' | 'follow'>>;
  private readonly script?: ScriptedBreath[];
  private readonly follow?: PromptSource;

  private rand: () => number;
  private running = false;
  private startedAt = 0;
  private cycle = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly rate = new RateEstimator();
  private unfollow: (() => void) | null = null;
  private signal: SignalQuality;
  private exhaleScale = 1;
  private qualityBias: number;
  private expected = true;
  private exhaleWasExpected = true;

  constructor(options: ScriptedEngineOptions = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.script = options.script;
    this.follow = options.follow;
    this.rand = mulberry32(this.cfg.seed);
    this.signal = this.cfg.signalQuality;
    this.qualityBias = this.cfg.quality;
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.startedAt = performance.now();
    this.cycle = 0;
    this.rate.reset();
    this.rand = mulberry32(this.cfg.seed);
    this.emitter.emit('signal-quality', { level: this.signal });

    if (this.follow) {
      this.unfollow = this.follow.on((window) => this.onPrompt(window));
    } else {
      this.runCycle();
    }
    return Promise.resolve();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    this.unfollow?.();
    this.unfollow = null;
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }

  /**
   * The guided baseline read. Resolves with the rate the generator is currently
   * producing, which is what a working detector would have measured over the
   * same window.
   */
  calibrate(): Promise<CalibrationResult> {
    const baselineRR = this.cfg.startRR;
    return new Promise((resolve) => {
      this.after(this.cfg.calibrationMs, () => {
        const ok = this.signal !== 'unusable';
        if (ok) {
          this.emitter.emit('rr-update', {
            breathsPerMin: baselineRR,
            confidence: this.confidence(),
          });
        }
        resolve({
          baselineRR,
          // A plausible quiet-room floor. The real engine measures this; here it
          // only exists so consumers have something of the right shape.
          noiseFloor: this.signal === 'good' ? 0.004 : 0.02,
          ok,
        });
      });
    });
  }

  on<K extends keyof BreathEventMap>(
    event: K,
    handler: (payload: BreathEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  /**
   * The #27 gate. Detections outside the prompted window are not scored — the
   * phase still moves, because that is observation rather than measurement, but
   * nothing reaches `exhale-end` or the rate estimate.
   */
  setExhaleExpected(expected: boolean): void {
    this.expected = expected;
  }

  // ---- knobs, for exercising states that are hard to produce on purpose ----

  /** Mean exhale quality reported from here on, 0–1. */
  setQuality(quality: number): void {
    this.qualityBias = clamp01(quality);
  }

  /**
   * Stretches or shortens exhales. Below 1 this simulates someone breathing
   * faster than the protocol asks for, which the scene and the scoring have to
   * handle without rewarding it.
   */
  setExhaleScale(scale: number): void {
    this.exhaleScale = Math.max(0.2, scale);
  }

  /** Drive the honest-degradation paths without having to wreck a real room. */
  setSignalQuality(level: SignalQuality): void {
    if (level === this.signal) return;
    this.signal = level;
    this.emitter.emit('signal-quality', { level });
  }

  // ------------------------------------------------------------- internals

  /**
   * Protocol time, not wall-clock. Every duration this engine reports is in the
   * timescale a real session runs at; `timeScale` only compresses playback.
   */
  private elapsed(): number {
    return (performance.now() - this.startedAt) * this.cfg.timeScale;
  }

  private confidence(): number {
    if (this.signal === 'unusable') return 0.1;
    return this.signal === 'degraded' ? 0.55 : 0.9;
  }

  private after(protocolMs: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, protocolMs / this.cfg.timeScale));
  }

  private clearTimers(): void {
    for (const handle of this.timers) clearTimeout(handle);
    this.timers = [];
  }

  private nextQuality(): number {
    return clamp01(this.qualityBias + (this.rand() - 0.5) * this.cfg.jitter * 0.8);
  }

  /** Shared by both modes: the exhale opens, and the rate clock ticks on onset. */
  private beginExhale(): void {
    // Whether this breath counts is decided by where it STARTED, and the answer
    // is latched here. Reading the gate again at the end would throw away an
    // exhale that began when prompted and ran on past the window — which is the
    // longest, best exhales, the exact behaviour the protocol trains. The window
    // rejects detections that begin during an inhale prompt, and nothing else.
    this.exhaleWasExpected = this.expected;
    this.rate.mark(this.elapsed());
    this.emitter.emit('phase-change', { phase: 'exhale', at: this.elapsed() });
  }

  private endExhale(durationMs: number, quality: number): void {
    if (this.exhaleWasExpected) {
      this.emitter.emit('exhale-end', { durationMs, quality });
      const breathsPerMin = this.rate.breathsPerMin();
      if (breathsPerMin !== null) {
        this.emitter.emit('rr-update', { breathsPerMin, confidence: this.confidence() });
      }
    } else {
      // A breath that happened but is not being counted. Skipped rather than
      // discarded, so the estimator refuses to measure across it instead of
      // reading a two-cycle span as one cycle and halving the rate (#29).
      this.rate.skip();
    }
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }

  /** Follow mode: the simulated person is doing what the prompt asked. */
  private onPrompt(window: PromptWindow): void {
    if (!this.running || window.step !== 'exhale') return;

    const compliance = 1 + (this.rand() - 0.5) * this.cfg.jitter * 0.5;
    const durationMs = Math.max(
      MIN_EXHALE_MS,
      window.durationMs * compliance * this.exhaleScale,
    );
    const quality = this.nextQuality();

    this.beginExhale();
    this.after(durationMs, () => {
      if (!this.running) return;
      this.endExhale(durationMs, quality);
    });
  }

  private nextBreath(): ScriptedBreath {
    if (this.script && this.script.length > 0) {
      return this.script[this.cycle % this.script.length];
    }

    // Rate relaxes exponentially from the starting rate toward the settled one.
    const { startRR, settledRR, settleMs, jitter } = this.cfg;
    const targetRR =
      settledRR + (startRR - settledRR) * Math.exp(-this.elapsed() / settleMs);

    const spread = () => 1 + (this.rand() - 0.5) * jitter * 0.5;
    const shape = cycleForPeriod(periodForRate(targetRR), spread);

    return {
      ...shape,
      exhaleMs: shape.exhaleMs * this.exhaleScale,
      quality: this.nextQuality(),
    };
  }

  /** Free-running mode: the fixture keeps its own rhythm. */
  private runCycle(): void {
    if (!this.running) return;

    const breath = this.nextBreath();
    const period = breath.inhaleMs + breath.topUpMs + breath.exhaleMs + breath.restMs;
    const exhaleAt = breath.inhaleMs + breath.topUpMs;

    // No inhale events. The real engine emits only `idle` and `exhale`, so a
    // fixture that announced inhales would teach the game to depend on
    // something that never arrives in production. Inhales come from the
    // conductor.
    this.after(exhaleAt, () => this.beginExhale());
    this.after(exhaleAt + breath.exhaleMs, () => {
      this.endExhale(breath.exhaleMs, breath.quality);
    });

    this.after(period, () => {
      this.cycle += 1;
      this.timers = [];
      this.runCycle();
    });
  }
}
