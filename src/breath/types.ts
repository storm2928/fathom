/**
 * THE CONTRACT between the signal engine and the experience layer.
 * The engine (src/breath/) emits these; the game (src/game/) consumes them.
 * Changes here require sign-off from BOTH team members — see DEVELOPMENT.md.
 */

export type BreathPhase = 'idle' | 'inhale' | 'exhale';

export type SignalQuality = 'good' | 'degraded' | 'unusable';

/** Continuous sample, emitted ~30–60Hz while the engine runs. */
export interface BreathSample {
  /** ms since session start */
  t: number;
  phase: BreathPhase;
  /** 0–1 normalized mic envelope */
  amplitude: number;
  /** 0–1 detector confidence for the current phase */
  confidence: number;
}

/** Discrete events the game reacts to. */
export interface BreathEventMap {
  /** phase transition (idle→inhale, inhale→exhale, etc.) */
  'phase-change': { phase: BreathPhase; at: number };
  /** a completed exhale, scored */
  'exhale-end': {
    durationMs: number;
    /** 0–1: length + smoothness vs. current target */
    quality: number;
  };
  /** rolling respiratory-rate estimate */
  'rr-update': { breathsPerMin: number; confidence: number };
  /** overall signal health; the game must degrade honestly on 'unusable' */
  'signal-quality': { level: SignalQuality };
}

export interface CalibrationResult {
  baselineRR: number;
  noiseFloor: number;
  ok: boolean;
}

/** What the engine exposes to the app. Implementation lives in src/breath/. */
export interface BreathEngine {
  start(): Promise<void>;
  stop(): void;
  /** ~10s guided baseline read at session start */
  calibrate(): Promise<CalibrationResult>;
  on<K extends keyof BreathEventMap>(
    event: K,
    handler: (payload: BreathEventMap[K]) => void
  ): () => void;
  /**
   * The session arc tells the engine when it is prompting an exhale. Detections
   * that BEGIN outside that window are not scored and do not reach the rate
   * estimate — an audible inhale is spectrally too close to an exhale to
   * separate by sound, and counting it overstated the reported rate by ~65%.
   *
   * Required rather than optional, because "detections outside the prompted
   * window are not scored" is a correctness property that has to hold for every
   * engine, including the scripted fixture. An optional method invites a silent
   * no-op on exactly the number the product rests on.
   *
   * The window is read ONCE, at the onset of a breath, and that answer follows
   * the breath however long it runs. Re-reading it at the end would refuse
   * exhales that outlasted the prompt — the longest ones, which are the whole
   * point of the protocol.
   *
   * Defaults to expected, so free-breathing stretches (calibration, quiet time)
   * accept everything without having to opt in. See #27.
   */
  setExhaleExpected(expected: boolean): void;
  /** keyboard fallback: spacebar hold = exhale. Always available. */
  readonly usingFallbackInput: boolean;
}
