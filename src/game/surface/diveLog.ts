import type { SessionResult } from '../session/sessionMachine';

/**
 * The session leaves as a file you own.
 *
 * Nothing is kept for you — no account, no history, no server — so the only way
 * to have a record is to be handed one. This writes a plain JSON file to your
 * downloads folder and transmits nothing: the blob is built in the page and
 * revoked immediately after.
 *
 * JSON rather than a screenshot or a proprietary format because the point is
 * that it opens somewhere else. Anyone who wants to watch this across weeks can
 * load these into a spreadsheet or a script without asking us for an export.
 */

/** Bumped if the shape changes, so an old file is still readable later. */
const LOG_VERSION = 1;

export type InputCode = 'microphone' | 'keyboard' | 'scripted';

export interface DiveLogEntry {
  version: number;
  /** ISO 8601, local clock, so a row can be placed in someone's day */
  recordedAt: string;
  plan: string;
  ending: SessionResult['ending'];
  baselineBreathsPerMin: number;
  finalBreathsPerMin: number;
  deltaBreathsPerMin: number;
  downshiftSeconds: number | null;
  durationSeconds: number;
  scoredBreaths: number;
  /**
   * A stable code, never a translated label. A field whose value changes with
   * the UI language makes two logs from the same person incomparable, and the
   * whole point of the export is that it opens somewhere else (#32).
   */
  input: InputCode;
  signal: SessionResult['worstSignal'];
  /** Travels with the file so the numbers cannot be read as more than they are. */
  measurementNote: string;
}

const MEASUREMENT_NOTE =
  'Breathing rate counted from exhales only; inhales are rhythm-prompted, not sensed. ' +
  'This records how fast breathing was before and after one session. It is not a ' +
  'clinical measurement and not evidence about health.';

export function buildDiveLog(
  result: SessionResult,
  options: { plan: string; input: InputCode; now?: Date },
): DiveLogEntry {
  return {
    version: LOG_VERSION,
    recordedAt: (options.now ?? new Date()).toISOString(),
    plan: options.plan,
    ending: result.ending,
    baselineBreathsPerMin: Number(result.baselineRR.toFixed(2)),
    finalBreathsPerMin: Number(result.finalRR.toFixed(2)),
    deltaBreathsPerMin: Number(result.deltaRR.toFixed(2)),
    downshiftSeconds:
      result.downshiftMs === null ? null : Number((result.downshiftMs / 1000).toFixed(1)),
    durationSeconds: Number((result.durationMs / 1000).toFixed(1)),
    scoredBreaths: result.scoredBreaths,
    input: options.input,
    signal: result.worstSignal,
    measurementNote: MEASUREMENT_NOTE,
  };
}

/** Triggers a local download. Nothing leaves the device. */
export function downloadDiveLog(entry: DiveLogEntry): void {
  const stamp = entry.recordedAt.slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(entry, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `fathom-dive-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
