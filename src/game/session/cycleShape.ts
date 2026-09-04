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
 * downshifts the exhale absorbs almost all of the extra time. By 8 breaths/min
 * it is nearly twice the whole inhale side. That widening ratio is what the
 * protocol trains, so the prompt has to show it rather than just slowing
 * everything down uniformly.
 *
 * The bases carry most of the inhale side's length and its slopes stay
 * shallow, because a real inhale does not shrink much with pace: played with
 * the earlier, steeper numbers, the prompt asked for an inhale faster than
 * natural at every rate anyone actually starts at, and keeping up meant
 * rushing — the opposite of what the prompt is for. The top-up stays nearly
 * flat for the same reason from the other side: it is a sigh, quick by
 * nature, and it does not get slower just because the breathing does.
 *
 * The rest is the steep one. Played straight, the remainder rule pours every
 * second a slower rate frees up into the exhale, and by the deep zones the
 * prompt asked for a five-second breath out and then allowed under a second
 * to sit with it — long past where the exhale stopped feeling sustainable.
 * So as the rate slows, the rest claims a real share of the freed time and
 * the exhale takes the remainder, still growing, still dominant — the
 * dominance test bounds the rest from above just as it bounds the inhale.
 */
const PARTS = {
  inhale: { base: 1150, ofPeriod: 0.06 },
  topUp: { base: 300, ofPeriod: 0.03 },
  rest: { base: 480, ofPeriod: 0.12 },
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
