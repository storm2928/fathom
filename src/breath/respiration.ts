/**
 * Respiratory rate, and the calibration read that establishes a baseline.
 *
 * The before/after respiratory-rate delta is the objective result FATHOM shows
 * on the surface screen and puts in the video. If this number is noisy, the
 * central claim of the project is noisy, so this module would rather report a
 * failure than a plausible-looking guess.
 *
 * Rate comes from the median of recent inter-breath intervals, never the mean.
 * A single missed breath merges two cycles into one double-length interval; a
 * mean would swallow that and report a rate roughly a third too slow, while a
 * median steps over it.
 */

import type { CaptureFrame } from './capture.ts';
import type { DetectorFrameResult } from './detector.ts';

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ------------------------------------------------------------- rate estimate */

export interface RespirationOptions {
  /** how many recent intervals the median is taken over */
  windowSize: number;
  /** shorter than this is not a breath cycle, it is a detector artefact */
  minIntervalMs: number;
  /** longer than this means we missed too much to call it a cycle */
  maxIntervalMs: number;
  /** relative median deviation at which consistency scores zero */
  dispersionTolerance: number;
}

export const DEFAULT_RESPIRATION_OPTIONS: RespirationOptions = {
  windowSize: 6,
  minIntervalMs: 1500,
  maxIntervalMs: 25000,
  dispersionTolerance: 0.35,
};

export interface RespirationEstimate {
  breathsPerMin: number;
  /** 0–1: falls with few intervals and with inconsistent ones */
  confidence: number;
  intervalsUsed: number;
}

export interface RespirationEstimator {
  /** Feed the start of each detected exhale. Returns null until a rate exists. */
  addExhaleStart(startedAt: number): RespirationEstimate | null;
  current(): RespirationEstimate | null;
  reset(): void;
}

export function createRespirationEstimator(
  overrides: Partial<RespirationOptions> = {}
): RespirationEstimator {
  const options = { ...DEFAULT_RESPIRATION_OPTIONS, ...overrides };
  let intervals: number[] = [];
  let lastStart: number | null = null;

  function estimate(): RespirationEstimate | null {
    if (intervals.length === 0) return null;

    const centre = median(intervals);
    if (!(centre > 0)) return null;

    // Median absolute deviation, normalised — a scale-free measure of how
    // ragged the breathing is that one outlier cannot inflate.
    const deviations = intervals.map((value) => Math.abs(value - centre));
    const relativeDeviation = median(deviations) / centre;
    const consistency = clamp01(1 - relativeDeviation / options.dispersionTolerance);
    // One interval is a measurement, not a pattern. Never claim otherwise.
    const sampleScore = clamp01(intervals.length / options.windowSize);

    return {
      breathsPerMin: 60000 / centre,
      confidence: clamp01(consistency * sampleScore),
      intervalsUsed: intervals.length,
    };
  }

  return {
    addExhaleStart(startedAt: number) {
      const previous = lastStart;
      lastStart = startedAt;
      if (previous === null) return estimate();

      const gap = startedAt - previous;
      // Out-of-range gaps are dropped rather than fed to the median: a gap that
      // long or short is evidence of a detection problem, not of breathing.
      if (gap >= options.minIntervalMs && gap <= options.maxIntervalMs) {
        intervals.push(gap);
        while (intervals.length > options.windowSize) intervals.shift();
      }
      return estimate();
    },

    current: estimate,

    reset() {
      intervals = [];
      lastStart = null;
    },
  };
}

/* ---------------------------------------------------------------- calibration */

export type CalibrationFailure =
  /** the floor is too high for a breath to clear it by the margin we need */
  | 'room-too-loud'
  /** nothing that looked like a breath arrived at all */
  | 'no-breaths-detected'
  /** breaths arrived, but too few intervals to take a median over */
  | 'too-few-breaths';

export interface CalibrationOptions {
  /** the guided read runs at least this long */
  minDurationMs: number;
  /** and is abandoned after this long regardless */
  maxDurationMs: number;
  /** intervals required before a baseline is trustworthy enough to return */
  minIntervals: number;
  /** the room is judged this early so a hopeless room fails fast */
  earlyCheckMs: number;
  /** noise floor above which a breath cannot reliably be told from the room */
  maxNoiseFloor: number;
}

export const DEFAULT_CALIBRATION_OPTIONS: CalibrationOptions = {
  minDurationMs: 10000,
  maxDurationMs: 30000,
  // Two intervals means three breaths: enough for a median to mean something.
  minIntervals: 2,
  earlyCheckMs: 1500,
  // ≈ -40 dBFS. Above this the breath cannot clear the floor by the margin the
  // detector needs, and any baseline we produced would be fiction.
  maxNoiseFloor: 0.01,
};

export interface CalibrationOutcome {
  ok: boolean;
  /** breaths per minute; 0 when the read failed */
  baselineRR: number;
  noiseFloor: number;
  breathsSeen: number;
  /** 0–1 confidence in the baseline. Report it; do not bury it. */
  confidence: number;
  reason?: CalibrationFailure;
}

export interface Calibrator {
  /** Returns null while the read is still running, an outcome when it settles. */
  push(frame: CaptureFrame, result: DetectorFrameResult): CalibrationOutcome | null;
  /** 0–1 against the minimum duration, for a progress indicator. */
  readonly progress: number;
  reset(): void;
}

export function createCalibrator(
  overrides: Partial<CalibrationOptions> = {},
  estimator: RespirationEstimator = createRespirationEstimator()
): Calibrator {
  const options = { ...DEFAULT_CALIBRATION_OPTIONS, ...overrides };

  let startedAt: number | null = null;
  let elapsed = 0;
  let breathsSeen = 0;
  let settled = false;

  function finish(
    ok: boolean,
    noiseFloor: number,
    reason?: CalibrationFailure
  ): CalibrationOutcome {
    settled = true;
    const estimate = estimator.current();
    return {
      ok,
      baselineRR: ok && estimate ? estimate.breathsPerMin : 0,
      noiseFloor,
      breathsSeen,
      confidence: ok && estimate ? estimate.confidence : 0,
      ...(reason ? { reason } : {}),
    };
  }

  return {
    push(frame: CaptureFrame, result: DetectorFrameResult) {
      if (settled) return null;
      if (startedAt === null) startedAt = frame.t;
      elapsed = frame.t - startedAt;

      // Judge the room early. Ten seconds of reading a room that was never
      // going to work is ten seconds of a person being told to breathe at a
      // machine that cannot hear them.
      if (elapsed >= options.earlyCheckMs && result.noiseFloor > options.maxNoiseFloor) {
        return finish(false, result.noiseFloor, 'room-too-loud');
      }

      if (result.exhale) {
        breathsSeen++;
        estimator.addExhaleStart(result.exhale.startedAt);
      }

      const estimate = estimator.current();
      const enough = (estimate?.intervalsUsed ?? 0) >= options.minIntervals;

      if (elapsed >= options.minDurationMs && enough) {
        return finish(true, result.noiseFloor);
      }
      if (elapsed >= options.maxDurationMs) {
        // Held on past the minimum hoping for another breath and never got it.
        // Say so rather than publishing a baseline built on one interval, and
        // distinguish hearing nothing from hearing too little — they send the
        // person to different fixes.
        if (enough) return finish(true, result.noiseFloor);
        return finish(
          false,
          result.noiseFloor,
          breathsSeen === 0 ? 'no-breaths-detected' : 'too-few-breaths'
        );
      }
      return null;
    },

    get progress() {
      return clamp01(elapsed / options.minDurationMs);
    },

    reset() {
      startedAt = null;
      elapsed = 0;
      breathsSeen = 0;
      settled = false;
      estimator.reset();
    },
  };
}
