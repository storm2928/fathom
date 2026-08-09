/**
 * The real BreathEngine: microphone capture, feature extraction, exhale
 * detection, calibration and respiratory rate, behind the contract in types.ts.
 *
 * The experience layer swaps the scripted engine for this one by changing which
 * factory it calls. Nothing else about this file is public.
 *
 * There is no code path here that emits phase 'inhale'. The inhale in FATHOM is
 * rhythm-prompted, not sensed — the README and the video say so, and a
 * clinician judge will check. If an inhale ever needs to be reported, it comes
 * from the prompt in the experience layer, not from this microphone.
 */

import type {
  BreathEngine,
  BreathEventMap,
  BreathPhase,
  CalibrationResult,
  SignalQuality,
} from './types.ts';
import { createMicCapture } from './capture.ts';
import type { AppliedSettings, CaptureFrame } from './capture.ts';
import { createExhaleDetector } from './detector.ts';
import type { DetectorOptions } from './detector.ts';
import { createCalibrator, createRespirationEstimator } from './respiration.ts';
import type { CalibrationOptions } from './respiration.ts';

type Handler<K extends keyof BreathEventMap> = (payload: BreathEventMap[K]) => void;

export interface BreathEngineOptions {
  detector?: Partial<DetectorOptions>;
  calibration?: Partial<CalibrationOptions>;
}

/**
 * Confidence below this, sustained, means we are guessing rather than reading.
 * Sustained matters: a single marginal frame is normal at the edges of a breath.
 */
const DEGRADED_CONFIDENCE = 0.45;
const DEGRADED_SUSTAIN_MS = 2000;

/** Above this floor a breath cannot clear the detector's margin. */
const UNUSABLE_NOISE_FLOOR = 0.02;

export interface RealBreathEngine extends BreathEngine {
  /**
   * Drive an exhale from outside the microphone — the keyboard fallback path.
   * Deliberately outside the BreathEngine interface: this is a hook for the
   * experience layer's spacebar input, not part of the shared contract.
   */
  pushFallbackExhale(startedAt: number, endedAt: number): void;
  /** What the browser actually applied to the track, once started. */
  readonly appliedSettings: AppliedSettings | null;
}

export function createBreathEngine(
  options: BreathEngineOptions = {}
): RealBreathEngine {
  const capture = createMicCapture();
  const detector = createExhaleDetector(options.detector);
  const estimator = createRespirationEstimator();

  const handlers: { [K in keyof BreathEventMap]: Set<Handler<K>> } = {
    'phase-change': new Set(),
    'exhale-end': new Set(),
    'rr-update': new Set(),
    'signal-quality': new Set(),
  };

  let running = false;
  let fallback = false;
  let lastPhase: BreathPhase = 'idle';
  let lastQuality: SignalQuality | null = null;
  let lowConfidenceSince: number | null = null;

  let calibrator: ReturnType<typeof createCalibrator> | null = null;
  let settleCalibration: ((result: CalibrationResult) => void) | null = null;
  let failCalibration: ((reason: Error) => void) | null = null;

  function emit<K extends keyof BreathEventMap>(
    event: K,
    payload: BreathEventMap[K]
  ): void {
    for (const handler of handlers[event]) handler(payload);
  }

  function setPhase(phase: BreathPhase, at: number): void {
    if (phase === lastPhase) return;
    lastPhase = phase;
    emit('phase-change', { phase, at });
  }

  function setSignalQuality(level: SignalQuality): void {
    if (level === lastQuality) return;
    lastQuality = level;
    emit('signal-quality', { level });
  }

  /**
   * Honest rather than optimistic: a browser that would not say what it applied
   * is degraded, not good, because we cannot confirm the breath survived.
   */
  function assessQuality(frame: CaptureFrame, confidence: number, floor: number): void {
    const settings = capture.settings;

    if (fallback || settings?.processingVerdict === 'overridden') {
      setSignalQuality('unusable');
      return;
    }
    if (floor > UNUSABLE_NOISE_FLOOR) {
      setSignalQuality('unusable');
      return;
    }

    if (confidence < DEGRADED_CONFIDENCE) {
      if (lowConfidenceSince === null) lowConfidenceSince = frame.t;
    } else {
      lowConfidenceSince = null;
    }
    const sustainedLow =
      lowConfidenceSince !== null && frame.t - lowConfidenceSince >= DEGRADED_SUSTAIN_MS;

    if (sustainedLow || frame.peak >= 0.99 || settings?.processingVerdict === 'unknown') {
      setSignalQuality('degraded');
      return;
    }
    setSignalQuality('good');
  }

  function recordExhale(startedAt: number, durationMs: number, quality: number): void {
    emit('exhale-end', { durationMs, quality });
    const estimate = estimator.addExhaleStart(startedAt);
    if (estimate) {
      emit('rr-update', {
        breathsPerMin: estimate.breathsPerMin,
        confidence: estimate.confidence,
      });
    }
  }

  function onFrame(frame: CaptureFrame): void {
    const result = detector.push(frame);

    setPhase(result.phase, frame.t);
    assessQuality(frame, result.confidence, result.noiseFloor);

    if (result.exhale) {
      recordExhale(result.exhale.startedAt, result.exhale.durationMs, result.exhale.quality);
    }

    if (calibrator) {
      const outcome = calibrator.push(frame, result);
      if (outcome) {
        const settle = settleCalibration;
        calibrator = null;
        settleCalibration = null;
        failCalibration = null;
        settle?.({
          baselineRR: outcome.baselineRR,
          noiseFloor: outcome.noiseFloor,
          ok: outcome.ok,
        });
      }
    }
  }

  capture.onFrame(onFrame);

  function teardown(): void {
    running = false;
    calibrator = null;
    settleCalibration = null;
    const fail = failCalibration;
    failCalibration = null;
    fail?.(new Error('Engine stopped before calibration finished.'));
    // Fire and forget: the contract declares stop() as void, but the release
    // itself is not optional — no hot microphone after a session ends.
    void capture.stop();
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      detector.reset();
      estimator.reset();
      lastPhase = 'idle';
      lastQuality = null;
      lowConfidenceSince = null;

      try {
        await capture.start();
        fallback = false;
        running = true;
      } catch (error) {
        // The microphone is unavailable or refused. Say so plainly and let the
        // experience layer fall back to the keyboard, rather than pretending.
        fallback = true;
        running = true;
        setSignalQuality('unusable');
        throw error;
      }
    },

    stop(): void {
      teardown();
    },

    calibrate(): Promise<CalibrationResult> {
      if (fallback) {
        return Promise.resolve({ baselineRR: 0, noiseFloor: 0, ok: false });
      }
      if (!running) {
        return Promise.reject(new Error('Call start() before calibrate().'));
      }
      if (calibrator) {
        return Promise.reject(new Error('Calibration is already running.'));
      }

      estimator.reset();
      calibrator = createCalibrator(options.calibration, estimator);
      return new Promise<CalibrationResult>((resolve, reject) => {
        settleCalibration = resolve;
        failCalibration = reject;
      });
    },

    on<K extends keyof BreathEventMap>(event: K, handler: Handler<K>): () => void {
      handlers[event].add(handler);
      return () => {
        handlers[event].delete(handler);
      };
    },

    pushFallbackExhale(startedAt: number, endedAt: number): void {
      const durationMs = endedAt - startedAt;
      if (durationMs <= 0) return;
      setPhase('exhale', startedAt);
      setPhase('idle', endedAt);
      // Quality from length alone: a key press has no smoothness to measure,
      // and claiming one would be inventing a number.
      const target = detector.options.targetExhaleMs;
      const quality = Math.min(1, durationMs / target);
      recordExhale(startedAt, durationMs, quality);
    },

    get usingFallbackInput() {
      return fallback;
    },

    get appliedSettings() {
      return capture.settings;
    },
  };
}
