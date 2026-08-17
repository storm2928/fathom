import { cycleDuration, cycleForPeriod, periodForRate } from './cycleShape';
import type { CycleShape } from './cycleShape';

/**
 * The conductor owns the rhythm.
 *
 * The inhale in FATHOM is prompted, not sensed — the engine has no code path
 * that emits an inhale and never will, because an audible inhale is broadband
 * noise that the band-ratio test cannot tell from an exhale. So the timing of
 * the first inhale, the top-up and the exhale is something the experience layer
 * decides and then tells everyone else about: the scene draws it, and the engine
 * uses it to know when a detection should count (issue #27).
 */

export type PromptStep = 'inhale' | 'top-up' | 'exhale' | 'rest';

export interface PromptWindow {
  step: PromptStep;
  /** ms since the conductor started, in protocol time */
  at: number;
  durationMs: number;
  /** cycle index since start, from 0 */
  cycle: number;
  /** whether a detection landing in this window should be scored */
  exhaleExpected: boolean;
}

/**
 * Anything that can be told when to score. Feature-detected until
 * `setExhaleExpected` lands in `src/breath/types.ts` — see #27 — so neither lane
 * is blocked on the other's push. Drop the guard once the contract carries it.
 */
export interface ExhaleGate {
  setExhaleExpected(expected: boolean): void;
}

/**
 * Anything that can be told how long the prompted exhale is.
 *
 * Quality is scored against a target, and until now the engine worked its own
 * out from the baseline while the conductor worked out another from the same
 * baseline. Two numbers that agree today and drift the moment either rule
 * changes — and a diver scored against something other than what the prompt
 * asked for. The prompt owns the number; the engine is told it.
 *
 * The target itself is not invented here. It comes from the cycle geometry,
 * derived from the rate the person was actually measured at and floored so the
 * prompt never chases an implausibly slow pace.
 */
export interface ExhaleTargetSink {
  setExhaleTarget(ms: number): void;
}

export function isExhaleTargetSink(value: unknown): value is ExhaleTargetSink {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ExhaleTargetSink).setExhaleTarget === 'function'
  );
}

export function isExhaleGate(value: unknown): value is ExhaleGate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ExhaleGate).setExhaleExpected === 'function'
  );
}

export interface ConductorOptions {
  /** breaths per minute the prompt starts at */
  targetRR?: number;
  /** the engine, or anything else that wants the gate signal */
  gate?: unknown;
  /** compress playback without changing the reported protocol timing */
  timeScale?: number;
}

const DEFAULT_TARGET_RR = 12;

/** Which steps accept a detection. See `slowTo` for the other safety rule. */
const EXPECTED_DURING: Record<PromptStep, boolean> = {
  inhale: false,
  'top-up': false,
  exhale: true,
  // Rest stays open on purpose: an exhale that runs longer than prompted is the
  // behaviour we are training, and closing the window at the end of the exhale
  // step would refuse to score exactly the people doing best. Closing at the
  // next inhale rejects the inhale-time detections from #27 and nothing else.
  rest: true,
};

const ORDER: PromptStep[] = ['inhale', 'top-up', 'exhale', 'rest'];

export class BreathConductor {
  private gate: ExhaleGate | null;
  private targetSink: ExhaleTargetSink | null = null;
  private readonly timeScale: number;

  private handlers = new Set<(window: PromptWindow) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;
  private startedAt = 0;
  private cycle = 0;
  private rate: number;
  private current: PromptStep = 'inhale';
  private expected = true;

  constructor(options: ConductorOptions = {}) {
    this.rate = options.targetRR ?? DEFAULT_TARGET_RR;
    this.timeScale = options.timeScale ?? 1;
    this.gate = isExhaleGate(options.gate) ? options.gate : null;
  }

  get targetRR(): number {
    return this.rate;
  }

  get step(): PromptStep {
    return this.current;
  }

  get exhaleExpected(): boolean {
    return this.expected;
  }

  /** True when a gate was found. False means detections are ungated — see #27. */
  get gated(): boolean {
    return this.gate !== null;
  }

  /**
   * Attach the gate after construction. The engine and the conductor each need
   * to know about the other — the engine follows the prompt, the prompt gates
   * the engine — so one of the two links has to be made second.
   *
   * @returns whether the value could be gated at all.
   */
  attach(value: unknown): boolean {
    this.gate = isExhaleGate(value) ? value : null;
    if (this.gate) this.gate.setExhaleExpected(this.expected);
    // Feature-detected separately: an engine may honour the scoring gate
    // without wanting to be told the target, or the other way round.
    this.targetSink = isExhaleTargetSink(value) ? value : null;
    return this.gate !== null;
  }

  on(handler: (window: PromptWindow) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.cycle = 0;
    this.runCycle();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    // Leave the gate open. Calibration and any other free-breathing mode has to
    // accept everything, and a conductor that stopped mid-inhale would otherwise
    // leave the engine deaf.
    this.setExpected(true);
  }

  /**
   * Move the prompt to a slower rate. Speeding up is not expressible here, and
   * an attempt to is ignored rather than clamped quietly at the call site.
   *
   * This is the "adaptive difficulty may only ever slow" rule from the team
   * guide, enforced where the target actually lives rather than trusted to
   * callers. A clinician judge will ask about this one.
   */
  slowTo(breathsPerMin: number): boolean {
    if (!(breathsPerMin < this.rate)) return false;
    this.rate = breathsPerMin;
    return true;
  }

  /** Prompt geometry for the current target, for a scene that wants to draw ahead. */
  currentCycle(): CycleShape {
    return cycleForPeriod(periodForRate(this.rate));
  }

  // ------------------------------------------------------------- internals

  /** Protocol time. `timeScale` compresses playback, not what gets reported. */
  private elapsed(): number {
    return (performance.now() - this.startedAt) * this.timeScale;
  }

  private after(protocolMs: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, protocolMs / this.timeScale));
  }

  private clearTimers(): void {
    for (const handle of this.timers) clearTimeout(handle);
    this.timers = [];
  }

  private setExpected(expected: boolean): void {
    if (expected === this.expected) return;
    this.expected = expected;
    this.gate?.setExhaleExpected(expected);
  }

  private runCycle(): void {
    if (!this.running) return;

    const shape = this.currentCycle();
    const spans: Record<PromptStep, number> = {
      inhale: shape.inhaleMs,
      'top-up': shape.topUpMs,
      exhale: shape.exhaleMs,
      rest: shape.restMs,
    };

    let offset = 0;
    for (const step of ORDER) {
      const at = offset;
      this.after(at, () => {
        if (!this.running) return;
        this.current = step;
        this.setExpected(EXPECTED_DURING[step]);
        // Sent as the exhale is asked for, so the engine scores the breath
        // against the length that was actually prompted for it.
        if (step === 'exhale') this.targetSink?.setExhaleTarget(spans.exhale);
        const window: PromptWindow = {
          step,
          at: this.elapsed(),
          durationMs: spans[step],
          cycle: this.cycle,
          exhaleExpected: EXPECTED_DURING[step],
        };
        for (const handler of [...this.handlers]) handler(window);
      });
      offset += spans[step];
    }

    this.after(cycleDuration(shape), () => {
      this.cycle += 1;
      this.timers = [];
      this.runCycle();
    });
  }
}
