/**
 * What a dive writes to Apple Health, when the player has turned it on: one
 * mindful session, from when the dive began to when it ended. Minutes only —
 * never a breathing rate, a depth or anything that reads as a score.
 */

/** Shorter than this is a dive that was left, not a session. */
export const MIN_MINDFUL_MS = 30_000;

export function mindfulSession(
  result: { durationMs: number },
  endedAt: Date,
): { start: Date; end: Date } | null {
  const ms = result.durationMs;
  if (!Number.isFinite(ms) || ms < MIN_MINDFUL_MS) return null;
  return { start: new Date(endedAt.getTime() - ms), end: endedAt };
}
