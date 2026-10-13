/**
 * How a before/after change is stated. Shared by the website's surface screen
 * and the app's results card so the two can never word the same dive
 * differently.
 */

/** Below this the change is inside the noise of the estimate. */
export const MEANINGFUL_DELTA_RR = 0.5;

export type Verdict = 'slowed' | 'unchanged' | 'sped';

/** `deltaRR` is baseline minus final: positive means breathing slowed. */
export function verdictFor(deltaRR: number): Verdict {
  if (deltaRR >= MEANINGFUL_DELTA_RR) return 'slowed';
  if (deltaRR <= -MEANINGFUL_DELTA_RR) return 'sped';
  return 'unchanged';
}
