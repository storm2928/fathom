/**
 * One definition of what a breath cycle looks like, shared by the prompt the
 * conductor plays and by the scripted fixture that pretends to follow it. Two
 * definitions would drift, and the drift would show up as the fixture and the
 * real session disagreeing about a number we put in front of judges.
 */

export interface CycleShape {
  /** first inhale */
  inhaleMs: number;
  /** the second, shorter inhale stacked on top — the sigh */
  topUpMs: number;
  /** the long exhale that drives the dive */
  exhaleMs: number;
  /** the pause at the bottom before the next cycle */
  restMs: number;
}

/** Shortest exhale worth prompting or generating, however fast the rate. */
export const MIN_EXHALE_MS = 1_200;

/**
 * The inhale side grows only weakly with the cycle length, so as someone
 * downshifts the exhale absorbs almost all of the extra time: at 15 breaths/min
 * the exhale is a little longer than the inhale, and by 8 it is roughly twice as
 * long. That widening ratio is what the protocol trains, so the prompt has to
 * show it rather than just slowing everything down uniformly.
 */
const PARTS = {
  inhale: { base: 700, ofPeriod: 0.1 },
  topUp: { base: 350, ofPeriod: 0.06 },
  rest: { base: 250, ofPeriod: 0.04 },
};

export const periodForRate = (breathsPerMin: number) => 60_000 / breathsPerMin;

export const cycleDuration = (c: CycleShape) =>
  c.inhaleMs + c.topUpMs + c.exhaleMs + c.restMs;

/**
 * @param vary optional per-part multiplier, used by the fixture to add jitter.
 *   The prompt itself is played straight.
 */
export function cycleForPeriod(periodMs: number, vary: () => number = () => 1): CycleShape {
  const part = (p: { base: number; ofPeriod: number }) =>
    (p.base + periodMs * p.ofPeriod) * vary();

  const inhaleMs = part(PARTS.inhale);
  const topUpMs = part(PARTS.topUp);
  const restMs = part(PARTS.rest);
  const exhaleMs = Math.max(MIN_EXHALE_MS, periodMs - inhaleMs - topUpMs - restMs);

  return { inhaleMs, topUpMs, exhaleMs, restMs };
}
