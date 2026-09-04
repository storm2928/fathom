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
import type { AppliedSettings, CaptureFrame, MicCapture } from './capture.ts';
import { createExhaleDetector } from './detector.ts';
import type { DetectorOptions } from './detector.ts';
import { createExhaleGate } from './exhaleGate.ts';
import { createExhaleTarget } from './exhaleTarget.ts';
import { createCalibrator, createRespirationEstimator } from './respiration.ts';
import type { CalibrationOptions } from './respiration.ts';

type Handler<K extends keyof BreathEventMap> = (payload: BreathEventMap[K]) => void;

export interface BreathEngineOptions {
  detector?: Partial<DetectorOptions>;
  calibration?: Partial<CalibrationOptions>;
  /**
   * Substitute the capture source. Production leaves this alone and gets the
   * microphone; tests pass a stand-in so the assembled engine can be driven by
   * synthesised frames, which is the only way the wiring between the detector,
   * the gate and the rate estimator gets covered.
   */
  capture?: MicCapture;
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
  /**
   * The exhale the diver is currently being prompted for, so quality is scored
   * against what they were actually asked to do (#15). Raises the target and
   * can never lower it — the one-way rule is enforced in exhaleTarget.ts.
   *
   * Deliberately outside the BreathEngine interface for now. Putting it on the
   * contract needs storm2928's sign-off under working agreement 6, and it is
   * proposed on #15; feature-detect it until then, the way the conductor
   * already does for the #27 gate.
   */
  setExhaleTarget(ms: number): void;
  /** Current target in ms. For the debug meter and for tests. */
  readonly exhaleTargetMs: number;
  /** What the browser actually applied to the track, once started. */
  readonly appliedSettings: AppliedSettings | null;
}

export function createBreathEngine(
  options: BreathEngineOptions = {}
): RealBreathEngine {
  const capture = options.capture ?? createMicCapture();
  const detector = createExhaleDetector(options.detector);
  const estimator = createRespirationEstimator();
  const gate = createExhaleGate();
  const exhaleTarget = createExhaleTarget();

  /**
   * The target lives in exhaleTarget.ts, which owns the one-way rule; the
   * detector holds the copy that scoring actually reads. Pushed through one
   * function so the two can never disagree about what a good breath is.
   */
  function applyExhaleTarget(): void {
    detector.setOptions({ targetExhaleMs: exhaleTarget.ms });
  }

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

  /**
   * Armed when the exhale window opens while a span is already sounding, so the
   * gate can be given a second onset reading — see the comment above the
   * re-latch in onFrame. `relatchFrom` is the audio-clock time of the first
   * frame after the window opened, null until that frame arrives.
   */
  let relatchArmed = false;
  let relatchFrom: number | null = null;
  /** The window as last told, so only a real closed→open edge arms a reading. */
  let windowExpected = true;

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

    // Read the prompt window once, here, as the breath opens — before setPhase
    // moves lastPhase out from under the comparison. Reading it again when the
    // breath ends would refuse every exhale that outlasted the prompt, which is
    // the longest and best ones. exhaleGate.ts has the measurements.
    if (result.phase === 'exhale' && lastPhase !== 'exhale') gate.onset();

    // The second reading: a span still sounding once the window has opened.
    //
    // A diver following the prompt inhales audibly, tops up, and exhales on
    // cue — and the pause between the top-up and the exhale is usually shorter
    // than the detector's hangover, so all three arrive as one span whose
    // onset sits in the closed window. Latched once at onset, that span is
    // refused whole, cycle after cycle: the prompted exhale itself, delivered
    // exactly as asked, scores nothing, and a session that responded to every
    // breath during calibration goes silent the moment the zones begin.
    //
    // So a span that is still sounding when the window opens is read again.
    // Not immediately: an audible inhale that already fell quiet is coasting
    // through the hangover, and re-latching on its tail would score exactly
    // the sound #27 exists to refuse. It must outlive that tail plus one
    // onset debounce — the same evidence a fresh onset would need — before
    // the second reading is believed.
    if (relatchArmed) {
      if (result.phase !== 'exhale') {
        relatchArmed = false;
        relatchFrom = null;
      } else {
        relatchFrom ??= frame.t;
        const sustainMs = detector.options.hangoverMs + detector.options.onsetDebounceMs;
        if (frame.t - relatchFrom >= sustainMs) {
          gate.onset();
          relatchArmed = false;
          relatchFrom = null;
        }
      }
    }

    setPhase(result.phase, frame.t);
    assessQuality(frame, result.confidence, result.noiseFloor);

    if (result.exhale) {
      // A refused detection is dropped whole: no exhale-end, and its onset
      // never reaches the estimator. That last part is what keeps the rate
      // honest. The gate closes over the prompted inhale, so what it refuses is
      // an audible inhale — a sound that happens *inside* a breath cycle rather
      // than starting one. Leaving it out therefore leaves the exhales either
      // side correctly adjacent, one true cycle apart.
      //
      // The alternative — treating it as a real breath that merely went
      // uncounted, and so breaking the interval chain — would be right if the
      // refused sound were an exhale. It is not, and doing that would break the
      // chain on every single cycle and report no rate at all for precisely the
      // breathers this gate was built for.
      if (gate.resolve()) {
        recordExhale(result.exhale.startedAt, result.exhale.durationMs, result.exhale.quality);
      }
    }

    if (calibrator) {
      const outcome = calibrator.push(frame, result);
      if (outcome) {
        const settle = settleCalibration;
        calibrator = null;
        settleCalibration = null;
        failCalibration = null;
        // Place the starting yardstick where this diver actually is. A failed
        // read leaves it at the gentlest target rather than inventing one.
        if (outcome.ok) {
          exhaleTarget.seed(outcome.baselineRR);
          applyExhaleTarget();
        }
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
      // Back to free-breathing. A window left closed by the previous session
      // would gate the next one's calibration shut and fail it silently.
      gate.reset();
      // A new dive starts where this diver is, not where the last one ended.
      exhaleTarget.reset();
      applyExhaleTarget();
      lastPhase = 'idle';
      lastQuality = null;
      lowConfidenceSince = null;
      relatchArmed = false;
      relatchFrom = null;
      windowExpected = true;

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

    setExhaleExpected(expected: boolean): void {
      gate.setExpected(expected);
      // Edges only: a caller repeating the same window must not keep resetting
      // the sustain clock, or the second reading would never come due.
      if (expected === windowExpected) return;
      windowExpected = expected;
      // Opening onto a span already in progress arms the second reading; the
      // window closing stands any pending one down. A latch taken while the
      // window was open is left alone either way — the long exhale that
      // outlasts its prompt keeps the answer it latched at onset.
      if (expected && lastPhase === 'exhale') {
        relatchArmed = true;
        relatchFrom = null;
      } else {
        relatchArmed = false;
        relatchFrom = null;
      }
    },

    setExhaleTarget(ms: number): void {
      exhaleTarget.request(ms);
      applyExhaleTarget();
    },

    pushFallbackExhale(startedAt: number, endedAt: number): void {
      const durationMs = endedAt - startedAt;
      if (durationMs <= 0) return;
      // Deliberately ungated. The window exists to reject an acoustic false
      // positive — an audible inhale the detector cannot tell from an exhale —
      // and a keypress cannot produce one. Gating here would only discard real
      // input from someone using the keyboard exactly as intended.
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

    get exhaleTargetMs() {
      return exhaleTarget.ms;
    },

    get appliedSettings() {
      return capture.settings;
    },
  };
}
