import type { BreathEngine, SignalQuality } from '../../breath/types';
import type { BreathConductor } from './conductor';

/**
 * The session arc: calibrate, three zones, surface, stop.
 *
 * The important thing this file does is end. There is no way to keep diving,
 * no way to extend, no next session offered — the app measures you, tells you
 * what changed, and sends you away. That is a product decision we expect to be
 * judged on, so it is enforced here rather than left to the UI.
 *
 * The second thing it does is only ever slow down. Each zone asks for a longer
 * exhale than the last, derived from the baseline actually measured rather than
 * from a fixed number, and the conductor refuses any target that would speed
 * breathing up. A session that made you breathe faster would be training the
 * opposite of what the protocol is for.
 */

export type SessionState =
  | 'idle'
  | 'calibrating'
  | 'zone-1'
  | 'zone-2'
  | 'zone-3'
  | 'surfacing'
  | 'ended';

export type SessionEnding = 'completed' | 'signal-lost' | 'stopped';

export interface SessionResult {
  ending: SessionEnding;
  /** breaths/min measured before the dive */
  baselineRR: number;
  /** breaths/min measured over the final zone */
  finalRR: number;
  /** positive means breathing slowed, which is the direction we want */
  deltaRR: number;
  /**
   * How long it took to cover half the total change — the "downshift speed".
   * Null when there was no measurable change to be half of.
   */
  downshiftMs: number | null;
  durationMs: number;
  scoredBreaths: number;
  /** whether the microphone or the keyboard carried the session */
  usedFallbackInput: boolean;
  worstSignal: SignalQuality;
}

export interface SessionOptions {
  /** compress the whole arc for development; 1 is real time */
  timeScale?: number;
  onState?: (state: SessionState) => void;
  onResult?: (result: SessionResult) => void;
}

/** Each zone asks for a slower rate than the last, as a share of baseline. */
const ZONE_FACTORS = [0.85, 0.72, 0.62];

/**
 * The prompt will not ask for anything slower than this however low the
 * baseline was. Six breaths a minute is already a deliberate, trained pace;
 * chasing lower would be pushing rather than settling.
 */
const TARGET_FLOOR_RR = 6;

const ZONE_MS = 100_000;
const SURFACING_MS = 20_000;

const ZONE_STATES: SessionState[] = ['zone-1', 'zone-2', 'zone-3'];

const SIGNAL_RANK: Record<SignalQuality, number> = {
  good: 0,
  degraded: 1,
  unusable: 2,
};

export class SessionMachine {
  private readonly engine: BreathEngine;
  private readonly conductor: BreathConductor;
  private readonly timeScale: number;
  private readonly onState?: (state: SessionState) => void;
  private readonly onResult?: (result: SessionResult) => void;

  private state: SessionState = 'idle';
  private timers: ReturnType<typeof setTimeout>[] = [];
  private off: (() => void)[] = [];

  private startedAt = 0;
  private divingFrom = 0;
  private baselineRR = 0;
  private latestRR = 0;
  private finalZoneRates: number[] = [];
  private scoredBreaths = 0;
  private worstSignal: SignalQuality = 'good';
  private downshiftMs: number | null = null;
  private halfwayTarget: number | null = null;
  private finished = false;

  constructor(engine: BreathEngine, conductor: BreathConductor, options: SessionOptions = {}) {
    this.engine = engine;
    this.conductor = conductor;
    this.timeScale = options.timeScale ?? 1;
    this.onState = options.onState;
    this.onResult = options.onResult;
  }

  get current(): SessionState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') return;
    this.startedAt = performance.now();
    this.listen();
    this.enter('calibrating');

    const calibration = await this.engine.calibrate();
    if (this.finished) return;

    // A calibration that could not read the room is not something to paper
    // over: the whole result rests on this number, and inventing one would put
    // a fabricated delta on the surface screen.
    if (!calibration.ok) {
      this.finish('signal-lost');
      return;
    }

    this.baselineRR = calibration.baselineRR;
    this.latestRR = calibration.baselineRR;
    this.divingFrom = performance.now();
    this.runZone(0);
  }

  /** Ends the session where it stands and reports what was measured so far. */
  stop(): void {
    if (this.finished || this.state === 'idle') return;
    this.finish('stopped');
  }

  // ------------------------------------------------------------- internals

  private listen(): void {
    this.off.push(
      this.engine.on('rr-update', ({ breathsPerMin }) => {
        this.latestRR = breathsPerMin;
        if (this.state === 'zone-3') this.finalZoneRates.push(breathsPerMin);
        this.checkDownshift(breathsPerMin);
      }),
    );
    this.off.push(this.engine.on('exhale-end', () => { this.scoredBreaths += 1; }));
    this.off.push(
      this.engine.on('signal-quality', ({ level }) => {
        if (SIGNAL_RANK[level] > SIGNAL_RANK[this.worstSignal]) this.worstSignal = level;
        // Losing the signal entirely ends the dive rather than letting someone
        // keep breathing at a scene that is no longer measuring anything.
        if (level === 'unusable' && !this.finished && this.state !== 'idle') {
          this.finish('signal-lost');
        }
      }),
    );
  }

  /**
   * Downshift speed: how long until half the eventual change had happened. It
   * is only meaningful once there is a change to be half of, so the target is
   * fixed the first time the rate moves below baseline and refined nowhere else.
   */
  private checkDownshift(breathsPerMin: number): void {
    if (this.downshiftMs !== null || this.baselineRR === 0) return;
    if (this.halfwayTarget === null) {
      const slowest = Math.max(TARGET_FLOOR_RR, this.baselineRR * ZONE_FACTORS[2]);
      this.halfwayTarget = (this.baselineRR + slowest) / 2;
    }
    if (breathsPerMin <= this.halfwayTarget) {
      // Protocol time, like every other duration reported anywhere in the app.
      // timeScale compresses playback, never what gets reported — a session
      // watched at 10x still describes the five and a half minutes it modelled.
      this.downshiftMs = (performance.now() - this.divingFrom) * this.timeScale;
    }
  }

  private enter(state: SessionState): void {
    this.state = state;
    this.onState?.(state);
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms / this.timeScale));
  }

  private runZone(index: number): void {
    if (this.finished) return;
    if (index >= ZONE_STATES.length) {
      this.enter('surfacing');
      this.after(SURFACING_MS, () => this.finish('completed'));
      return;
    }

    this.enter(ZONE_STATES[index]);
    // Derived from the measured baseline, floored, and handed to a conductor
    // that will refuse it outright if it is not slower than the current target.
    const target = Math.max(TARGET_FLOOR_RR, this.baselineRR * ZONE_FACTORS[index]);
    this.conductor.slowTo(target);
    this.after(ZONE_MS, () => this.runZone(index + 1));
  }

  private finish(ending: SessionEnding): void {
    if (this.finished) return;
    this.finished = true;
    for (const handle of this.timers) clearTimeout(handle);
    this.timers = [];
    for (const off of this.off) off();
    this.off = [];

    const finalRR = this.finalZoneRates.length
      ? this.finalZoneRates.reduce((sum, r) => sum + r, 0) / this.finalZoneRates.length
      : this.latestRR;

    this.enter('ended');
    this.onResult?.({
      ending,
      baselineRR: this.baselineRR,
      finalRR,
      deltaRR: this.baselineRR - finalRR,
      downshiftMs: this.downshiftMs,
      durationMs: (performance.now() - this.startedAt) * this.timeScale,
      scoredBreaths: this.scoredBreaths,
      usedFallbackInput: this.engine.usingFallbackInput,
      worstSignal: this.worstSignal,
    });
  }
}
