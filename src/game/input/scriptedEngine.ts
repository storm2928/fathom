import type {
  BreathEngine,
  BreathEventMap,
  CalibrationResult,
  SignalQuality,
} from '../../breath/types';
import { BreathEmitter } from './emitter';

/**
 * A BreathEngine that produces a plausible cyclic-sighing pattern with no
 * microphone involved.
 *
 * It exists so the dive scene, the session arc and the surface screen can be
 * built, demoed and tested before the signal engine lands — and afterwards, as
 * the fixture the real detector gets compared against. It is a development
 * harness, never a product surface: a person breathing has no effect on it.
 *
 * Determinism: every number comes from a seeded generator, so the same seed and
 * the same knob settings replay the same session. Event payloads carry the
 * scheduled duration rather than a measured one, so a timer that fires late
 * cannot change what the game sees.
 */

/** One breath cycle. Durations are in real milliseconds, before `timeScale`. */
export interface ScriptedBreath {
  /** first inhale */
  inhaleMs: number;
  /** the second, shorter inhale stacked on top — the sigh */
  topUpMs: number;
  /** the long exhale that drives the dive */
  exhaleMs: number;
  /** the pause at the bottom before the next cycle */
  restMs: number;
  /** 0–1, reported on `exhale-end` */
  quality: number;
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
  /** how long `calibrate()` takes, before `timeScale` */
  calibrationMs?: number;
  /** run the whole session faster; 10 makes a five-minute arc take thirty seconds */
  timeScale?: number;
  /** a fixed cycle sequence, looped — overrides the generator entirely */
  script?: ScriptedBreath[];
}

const DEFAULTS: Required<Omit<ScriptedEngineOptions, 'script'>> = {
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

/**
 * Cycle shape. The inhale side grows only weakly with the cycle length, so as
 * someone downshifts the exhale absorbs almost all of the extra time: at 15
 * breaths/min the exhale is a little longer than the inhale, and by 8 it is
 * roughly twice as long. That widening ratio is the thing the protocol trains,
 * so the generated pattern has to show it.
 */
const SHAPE = {
  inhale: { base: 700, ofPeriod: 0.1 },
  topUp: { base: 350, ofPeriod: 0.06 },
  rest: { base: 250, ofPeriod: 0.04 },
};

/** Shortest exhale the generator will produce, however fast the target rate. */
const MIN_EXHALE_MS = 1_200;
/** Cycles averaged into a reported respiratory rate. */
const RR_WINDOW = 3;

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
  private readonly cfg: Required<Omit<ScriptedEngineOptions, 'script'>>;
  private readonly script?: ScriptedBreath[];

  private rand: () => number;
  private running = false;
  private startedAt = 0;
  private cycle = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private recentPeriods: number[] = [];
  private signal: SignalQuality;
  private exhaleScale = 1;
  private qualityBias: number;

  constructor(options: ScriptedEngineOptions = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.script = options.script;
    this.rand = mulberry32(this.cfg.seed);
    this.signal = this.cfg.signalQuality;
    this.qualityBias = this.cfg.quality;
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.startedAt = performance.now();
    this.cycle = 0;
    this.recentPeriods = [];
    this.rand = mulberry32(this.cfg.seed);
    this.emitter.emit('signal-quality', { level: this.signal });
    this.runCycle();
    return Promise.resolve();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }

  /**
   * The guided baseline read. Resolves after `calibrationMs` with the rate the
   * generator is currently producing, which is what a working detector would
   * have measured over the same window.
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

  // ---- knobs, for exercising states that are hard to produce on purpose ----

  /** Mean exhale quality reported from here on, 0–1. */
  setQuality(quality: number): void {
    this.qualityBias = clamp01(quality);
  }

  /**
   * Stretches or shortens exhales relative to the target rate. Below 1 this
   * simulates someone breathing faster than the protocol asks for, which is the
   * case the scene and the scoring need to handle without rewarding it.
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
   * timescale a real session runs at; `timeScale` only compresses playback. So a
   * session watched at 10× still reports the exhale lengths and the settling
   * curve that a real five-minute dive would have produced.
   */
  private elapsed(): number {
    return (performance.now() - this.startedAt) * this.cfg.timeScale;
  }

  private confidence(): number {
    if (this.signal === 'unusable') return 0.1;
    return this.signal === 'degraded' ? 0.55 : 0.9;
  }

  private after(realMs: number, fn: () => void): void {
    const handle = setTimeout(fn, realMs / this.cfg.timeScale);
    this.timers.push(handle);
  }

  private clearTimers(): void {
    for (const handle of this.timers) clearTimeout(handle);
    this.timers = [];
  }

  private nextBreath(): ScriptedBreath {
    if (this.script && this.script.length > 0) {
      return this.script[this.cycle % this.script.length];
    }

    // Rate relaxes exponentially from the starting rate toward the settled one.
    // The inhale side of the cycle stays roughly constant — as in the protocol,
    // it is the exhale that lengthens as someone downshifts.
    const t = this.elapsed();
    const { startRR, settledRR, settleMs, jitter } = this.cfg;
    const targetRR = settledRR + (startRR - settledRR) * Math.exp(-t / settleMs);
    const period = 60_000 / targetRR;

    const spread = () => 1 + (this.rand() - 0.5) * jitter * 0.5;
    const part = (s: { base: number; ofPeriod: number }) =>
      (s.base + period * s.ofPeriod) * spread();
    const inhaleMs = part(SHAPE.inhale);
    const topUpMs = part(SHAPE.topUp);
    const restMs = part(SHAPE.rest);
    const exhaleMs =
      Math.max(MIN_EXHALE_MS, period - inhaleMs - topUpMs - restMs) * this.exhaleScale;

    return {
      inhaleMs,
      topUpMs,
      exhaleMs,
      restMs,
      quality: clamp01(this.qualityBias + (this.rand() - 0.5) * jitter * 0.8),
    };
  }

  private runCycle(): void {
    if (!this.running) return;

    const breath = this.nextBreath();
    const period = breath.inhaleMs + breath.topUpMs + breath.exhaleMs + breath.restMs;

    this.emitter.emit('phase-change', { phase: 'inhale', at: this.elapsed() });

    // The second inhale arrives as a repeated 'inhale' transition. The contract
    // in src/breath/types.ts has no way to say "double inhale", and the double
    // inhale is the distinctive half of cyclic sighing — the scene needs it to
    // charge the dive light twice. Raised on issue #6; until the contract gains
    // a way to express it, a repeat of the same phase is the signal.
    this.after(breath.inhaleMs, () => {
      this.emitter.emit('phase-change', { phase: 'inhale', at: this.elapsed() });
    });

    this.after(breath.inhaleMs + breath.topUpMs, () => {
      this.emitter.emit('phase-change', { phase: 'exhale', at: this.elapsed() });
    });

    this.after(breath.inhaleMs + breath.topUpMs + breath.exhaleMs, () => {
      this.emitter.emit('exhale-end', {
        durationMs: breath.exhaleMs,
        quality: breath.quality,
      });
      this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });

      this.recentPeriods.push(period);
      if (this.recentPeriods.length > RR_WINDOW) this.recentPeriods.shift();
      const mean =
        this.recentPeriods.reduce((sum, p) => sum + p, 0) / this.recentPeriods.length;
      this.emitter.emit('rr-update', {
        breathsPerMin: 60_000 / mean,
        confidence: this.confidence(),
      });
    });

    this.after(period, () => {
      this.cycle += 1;
      this.timers = [];
      this.runCycle();
    });
  }
}
