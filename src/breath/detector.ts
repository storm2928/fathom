/**
 * Exhale detection: turns the measured frame stream into exhale events that
 * survive a real room.
 *
 * Nothing here senses an inhale. The inhale in FATHOM is rhythm-prompted, not
 * microphone-sensed, and this module only ever reports 'idle' or 'exhale'.
 * That is a claim the README and the video make, so it stays true in the code.
 *
 * Quality rewards *longer and smoother*, never louder. Loudness would reward
 * forcing the breath, which is the opposite of what the protocol trains.
 */

import type { CaptureFrame } from './capture.ts';
import { bandRatio } from './capture.ts';

export type DetectorPhase = 'idle' | 'exhale';

export type RejectReason =
  /** shorter than a real exhale: a click, a cough, a single word */
  | 'too-short'
  /** ran past the ceiling: a fan switching on, not a person */
  | 'too-long';

export interface ExhaleResult {
  /** ms on the audio clock, at the moment level first crossed the open threshold */
  startedAt: number;
  endedAt: number;
  durationMs: number;
  /** 0–1, combining length against target and smoothness. Never loudness. */
  quality: number;
  /** 0–1 mean detector confidence across the exhale */
  confidence: number;
}

export interface RejectedExhale {
  reason: RejectReason;
  durationMs: number;
}

export interface DetectorFrameResult {
  phase: DetectorPhase;
  /** level over the adaptive noise floor, in dB */
  snrDb: number;
  noiseFloor: number;
  /** 0–1. Falls as the signal approaches a decision boundary. */
  confidence: number;
  /** set on the frame where a valid exhale completed */
  exhale?: ExhaleResult;
  /** set when a candidate was thrown away, so the debug page can show why */
  rejected?: RejectedExhale;
}

export interface DetectorOptions {
  /** dB over the noise floor at which an exhale may open */
  openSnrDb: number;
  /** dB over the noise floor below which it may close. Must be under openSnrDb. */
  closeSnrDb: number;
  /** level must hold above openSnrDb this long before the exhale is believed */
  onsetDebounceMs: number;
  /** level must hold below closeSnrDb this long before the exhale is ended */
  hangoverMs: number;
  /** anything shorter is not a breath */
  minExhaleMs: number;
  /** anything longer is not a breath either */
  maxExhaleMs: number;
  /** an exhale must be broadband; below this it is probably speech */
  minBandRatio: number;
  /** duration scoring full marks for length */
  targetExhaleMs: number;
  /** normalised frame-to-frame jitter at which smoothness scores zero */
  jitterTolerance: number;
  /** seconds for the floor to follow the level downward */
  floorFallSeconds: number;
  /** seconds for the floor to follow the level upward, while idle */
  floorRiseSeconds: number;
  /** initial guess at the floor, replaced quickly during warmup */
  initialNoiseFloor: number;
  /** the floor adapts fast in both directions for this long after a reset */
  warmupMs: number;
}

export const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  // Measured against a real 47s session on a Blue Yeti X in a quiet room. The
  // level there never returned to the floor between breaths — it sat 2-8dB
  // above it — so a close threshold under that band meant the exhale simply
  // stopped closing, and one span ran 14.5s. 6dB sits above that residual band.
  //
  // 9dB open was picked over 10 because it found ten breaths against eight and
  // the intervals came out *more* regular, not less (relative deviation 0.333
  // against 0.389): at 10dB the median gap jumped from 3.5s to 5.7s, which is
  // the signature of breaths being missed and two cycles read as one.
  openSnrDb: 9,
  closeSnrDb: 6,
  onsetDebounceMs: 120,
  // Measured against two real sessions rather than a synthetic wobble. Real
  // gaps between breaths run 400-600ms, so a long hangover does not bridge a
  // stumble — it swallows the gap and reports two breaths as one. At 700ms,
  // nine of fourteen reported breaths in a real session contained a run of
  // silence 300ms or longer, meaning they were pairs. At 250ms neither session
  // produced a single merged breath, and no breath was split either.
  hangoverMs: 250,
  // A cough or a single word runs 300–500ms. A real exhale runs seconds.
  minExhaleMs: 800,
  maxExhaleMs: 15000,
  // Measured separation is wide — speech reads ~0.04, breath well above 1 — so
  // this sits low deliberately. Rejecting a real breath is worse than letting
  // an unvoiced fricative through, and the duration gate catches those anyway.
  minBandRatio: 0.6,
  targetExhaleMs: 6000,
  // Provisional. Needs tuning against real recordings on the debug page.
  jitterTolerance: 0.35,
  floorFallSeconds: 0.5,
  floorRiseSeconds: 5,
  initialNoiseFloor: 1e-4,
  warmupMs: 500,
};

/** dB above the nearest decision boundary at which we are fully confident. */
const CONFIDENCE_MARGIN_DB = 6;

/** Clipped audio is not trustworthy, whatever else it looks like. */
const CLIPPING_CONFIDENCE = 0.3;
const CLIPPING_PEAK = 0.99;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

type InternalState = 'idle' | 'candidate' | 'open' | 'hangover' | 'lockout';

export interface ExhaleDetector {
  push(frame: CaptureFrame): DetectorFrameResult;
  reset(): void;
  /** Retune while running. The debug meter drives this so tuning needs no rebuild. */
  setOptions(next: Partial<DetectorOptions>): void;
  readonly options: DetectorOptions;
  readonly noiseFloor: number;
}

export function createExhaleDetector(
  overrides: Partial<DetectorOptions> = {}
): ExhaleDetector {
  const options: DetectorOptions = { ...DEFAULT_DETECTOR_OPTIONS, ...overrides };

  let state: InternalState;
  let noiseFloor: number;
  let lastT: number | null;
  let firstT: number | null;

  let candidateStart = 0;
  let fellBelowAt = 0;

  // Accumulated across the current exhale, for quality and confidence.
  let levelSum = 0;
  let jitterSum = 0;
  let frameCount = 0;
  let previousLevel = 0;
  let confidenceSum = 0;

  function reset(): void {
    state = 'idle';
    noiseFloor = options.initialNoiseFloor;
    lastT = null;
    firstT = null;
    candidateStart = 0;
    fellBelowAt = 0;
    resetAccumulators();
  }

  function resetAccumulators(): void {
    levelSum = 0;
    jitterSum = 0;
    frameCount = 0;
    previousLevel = 0;
    confidenceSum = 0;
  }

  function updateNoiseFloor(level: number, dtSeconds: number, warmup: boolean): void {
    const falling = level < noiseFloor;
    // While an exhale is open the floor may follow the level down but never up:
    // otherwise a long breath teaches the detector that the breath is silence.
    // A level that never returns under the close threshold would hold this
    // frozen forever, which is what the ceiling and the lockout after it exist
    // to break — letting the floor rise here instead would make a running fan
    // register as one long breath rather than being thrown away.
    const exhaling = state === 'open' || state === 'hangover' || state === 'candidate';
    if (!falling && exhaling && !warmup) return;

    const tau = warmup
      ? 0.15
      : falling
        ? options.floorFallSeconds
        : options.floorRiseSeconds;
    const alpha = 1 - Math.exp(-dtSeconds / tau);
    noiseFloor += (level - noiseFloor) * alpha;
    // A floor of zero would make every SNR infinite.
    if (noiseFloor < 1e-7) noiseFloor = 1e-7;
  }

  function frameConfidence(snrDb: number, ratio: number, peak: number): number {
    const exhaling = state === 'open' || state === 'hangover';
    const boundary = exhaling ? options.closeSnrDb : options.openSnrDb;
    let confidence = clamp01(Math.abs(snrDb - boundary) / CONFIDENCE_MARGIN_DB);

    // Breath is broadband. The less broadband it is, the less we can claim.
    if (exhaling) {
      const ratioScore = Number.isFinite(ratio)
        ? clamp01(ratio / options.minBandRatio)
        : 1;
      confidence *= ratioScore;
    }

    if (peak >= CLIPPING_PEAK) confidence *= CLIPPING_CONFIDENCE;
    return confidence;
  }

  /** Length and smoothness only. Loudness is deliberately not an input. */
  function scoreQuality(durationMs: number): number {
    const length = clamp01(durationMs / options.targetExhaleMs);

    const meanLevel = frameCount > 0 ? levelSum / frameCount : 0;
    const meanJitter = frameCount > 1 ? jitterSum / (frameCount - 1) : 0;
    // Normalising jitter by mean level is what keeps loudness out of the score:
    // the same breath recorded louder has proportionally larger jitter.
    const relativeJitter = meanLevel > 0 ? meanJitter / meanLevel : 1;
    const smoothness = clamp01(1 - relativeJitter / options.jitterTolerance);

    return clamp01(0.6 * length + 0.4 * smoothness);
  }

  function finishExhale(endedAt: number): ExhaleResult | RejectedExhale {
    const durationMs = endedAt - candidateStart;
    if (durationMs < options.minExhaleMs) {
      return { reason: 'too-short', durationMs };
    }
    return {
      startedAt: candidateStart,
      endedAt,
      durationMs,
      quality: scoreQuality(durationMs),
      confidence: frameCount > 0 ? clamp01(confidenceSum / frameCount) : 0,
    };
  }

  reset();

  return {
    push(frame: CaptureFrame): DetectorFrameResult {
      if (firstT === null) firstT = frame.t;
      const dtSeconds = lastT === null ? 0.02 : Math.max(1e-4, (frame.t - lastT) / 1000);
      lastT = frame.t;
      const warmup = frame.t - firstT < options.warmupMs;

      updateNoiseFloor(frame.level, dtSeconds, warmup);

      const snrDb =
        frame.level > 0 ? 20 * Math.log10(frame.level / noiseFloor) : -Infinity;
      const ratio = bandRatio(frame);
      const confidence = frameConfidence(snrDb, ratio, frame.peak);

      const breathLike = ratio >= options.minBandRatio;
      const aboveOpen = snrDb >= options.openSnrDb && breathLike;
      const aboveClose = snrDb >= options.closeSnrDb;

      let exhale: ExhaleResult | undefined;
      let rejected: RejectedExhale | undefined;

      switch (state) {
        case 'idle':
          if (aboveOpen && !warmup) {
            state = 'candidate';
            candidateStart = frame.t;
            resetAccumulators();
          }
          break;

        case 'candidate':
          if (!aboveOpen) {
            // Never reached the debounce: a click, a chair creak, a consonant.
            state = 'idle';
          } else if (frame.t - candidateStart >= options.onsetDebounceMs) {
            state = 'open';
          }
          break;

        case 'open':
          if (frame.t - candidateStart >= options.maxExhaleMs) {
            // Not a person. Discard it and wait for the level to fall before
            // believing anything again, so a running fan cannot retrigger.
            rejected = { reason: 'too-long', durationMs: frame.t - candidateStart };
            state = 'lockout';
          } else if (!aboveClose) {
            state = 'hangover';
            fellBelowAt = frame.t;
          }
          break;

        case 'hangover':
          if (aboveClose) {
            // The same breath wobbling, not a new one. This is what stops a
            // single exhale being reported as three.
            state = 'open';
          } else if (frame.t - fellBelowAt >= options.hangoverMs) {
            const outcome = finishExhale(fellBelowAt);
            if ('reason' in outcome) rejected = outcome;
            else exhale = outcome;
            state = 'idle';
          }
          break;

        case 'lockout':
          if (!aboveClose) state = 'idle';
          break;
      }

      // Accumulate only while a candidate is alive, so the statistics describe
      // the breath rather than the silence around it.
      if (state === 'candidate' || state === 'open' || state === 'hangover') {
        if (frameCount > 0) jitterSum += Math.abs(frame.level - previousLevel);
        previousLevel = frame.level;
        levelSum += frame.level;
        confidenceSum += confidence;
        frameCount++;
      }

      return {
        phase: state === 'open' || state === 'hangover' ? 'exhale' : 'idle',
        snrDb,
        noiseFloor,
        confidence,
        ...(exhale ? { exhale } : {}),
        ...(rejected ? { rejected } : {}),
      };
    },

    reset,
    setOptions(next: Partial<DetectorOptions>) {
      Object.assign(options, next);
    },
    options,
    get noiseFloor() {
      return noiseFloor;
    },
  };
}
