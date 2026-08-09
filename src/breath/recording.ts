/**
 * Recording and replay of a real breath session.
 *
 * Only raw frames are stored — never detector output. That is the whole point:
 * detection is re-derived on replay, so one recording of one real person can
 * answer any number of threshold questions without anyone breathing again.
 *
 * Tuning by asking a human to breathe once per parameter change does not scale,
 * and the numbers in the detector are provisional until they have been run
 * against a real room, a real microphone and a real set of lungs.
 */

import type { AppliedSettings, CaptureFrame } from './capture.ts';
import { createExhaleDetector } from './detector.ts';
import type { DetectorOptions, ExhaleResult, RejectedExhale } from './detector.ts';
import { createRespirationEstimator } from './respiration.ts';
import type { RespirationEstimate } from './respiration.ts';

export const RECORDING_VERSION = 1;

export interface BreathRecording {
  version: number;
  createdAt: string;
  sampleRate: number;
  device: string;
  /** what the browser admitted to applying, so a suspect file stays suspect */
  processingVerdict: string;
  /** thresholds in effect at record time — context, not a constraint on replay */
  detectorOptions: DetectorOptions;
  frames: CaptureFrame[];
}

export interface ReplayReject extends RejectedExhale {
  at: number;
}

export interface ReplaySummary {
  frames: number;
  durationMs: number;
  exhales: ExhaleResult[];
  rejects: ReplayReject[];
  respiration: RespirationEstimate | null;
  /** mean quality across accepted exhales, or null if there were none */
  meanQuality: number | null;
  noiseFloorAtEnd: number;
}

export function buildRecording(
  frames: CaptureFrame[],
  detectorOptions: DetectorOptions,
  settings: AppliedSettings | null
): BreathRecording {
  return {
    version: RECORDING_VERSION,
    createdAt: new Date().toISOString(),
    sampleRate: settings?.sampleRate ?? 0,
    device: settings?.deviceLabel ?? '(unknown)',
    processingVerdict: settings?.processingVerdict ?? 'unknown',
    detectorOptions: { ...detectorOptions },
    frames,
  };
}

const FRAME_KEYS: Array<keyof CaptureFrame> = ['t', 'peak', 'level', 'voice', 'high', 'zcr'];

/**
 * Parse and validate. A malformed file is a bad file, not a crashed page —
 * and half-parsing one would produce tuning numbers built on nonsense.
 */
export function parseRecording(text: string): BreathRecording {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('That file is not a recording.');
  }
  const candidate = raw as Partial<BreathRecording>;

  if (candidate.version !== RECORDING_VERSION) {
    throw new Error(
      `Recording version ${String(candidate.version)} — this build reads version ${RECORDING_VERSION}.`
    );
  }
  if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) {
    throw new Error('That recording has no frames.');
  }
  for (const [i, frame] of candidate.frames.entries()) {
    for (const key of FRAME_KEYS) {
      if (typeof (frame as CaptureFrame)[key] !== 'number') {
        throw new Error(`Frame ${i} is missing a numeric "${key}".`);
      }
    }
  }
  return candidate as BreathRecording;
}

/**
 * Re-run detection over a recording. Overrides win over whatever was in effect
 * when it was captured, which is what makes threshold sweeps possible.
 */
export function replayRecording(
  recording: BreathRecording,
  overrides: Partial<DetectorOptions> = {}
): ReplaySummary {
  const detector = createExhaleDetector({ ...recording.detectorOptions, ...overrides });
  const estimator = createRespirationEstimator();

  const exhales: ExhaleResult[] = [];
  const rejects: ReplayReject[] = [];
  let noiseFloorAtEnd = 0;

  for (const frame of recording.frames) {
    const result = detector.push(frame);
    noiseFloorAtEnd = result.noiseFloor;
    if (result.exhale) {
      exhales.push(result.exhale);
      estimator.addExhaleStart(result.exhale.startedAt);
    }
    if (result.rejected) rejects.push({ ...result.rejected, at: frame.t });
  }

  const first = recording.frames[0];
  const last = recording.frames[recording.frames.length - 1];

  return {
    frames: recording.frames.length,
    durationMs: last.t - first.t,
    exhales,
    rejects,
    respiration: estimator.current(),
    meanQuality:
      exhales.length > 0
        ? exhales.reduce((sum, e) => sum + e.quality, 0) / exhales.length
        : null,
    noiseFloorAtEnd,
  };
}
