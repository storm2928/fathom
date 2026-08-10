/**
 * How a breath becomes depth.
 *
 * This file is the reward loop, so it is where the safety rule from the team
 * guide either holds or does not: the game must never reward fast breathing or
 * breath-holds. It is kept separate from anything that draws so the rule can be
 * read, argued with, and checked without wading through a renderer — a clinician
 * judge asking "what exactly does this reward?" should be able to be handed this
 * file.
 *
 * Three properties it guarantees:
 *
 * 1. **Longer always beats shorter.** `metresForExhale` is strictly increasing
 *    in duration, so there is no length at which cutting a breath short pays.
 *
 * 2. **Slower beats faster over the same time.** Depth grows super-linearly with
 *    exhale length, so two 3s exhales travel less than one 6s exhale even though
 *    they spend the same six seconds exhaling. Breathing faster to squeeze in
 *    more breaths is strictly worse, which is what stops the descent becoming a
 *    hyperventilation speedrun.
 *
 * 3. **Holding your breath does nothing.** Depth only advances during and after
 *    an exhale. A held breath emits no exhale, so it earns no descent — it is
 *    not penalised either, it simply is not a move.
 */

/** The exhale length the scoring is calibrated around. */
export const REFERENCE_EXHALE_MS = 6_000;

/** Metres travelled by a reference-length exhale at full quality. */
export const METRES_AT_REFERENCE = 12;

/**
 * Above 1 makes depth super-linear in exhale length, which is what enforces
 * property 2. At 1.6, one 6s exhale travels roughly 50% further than two 3s
 * exhales. Do not drop this to 1 — that would make breathing rate irrelevant,
 * and anything below 1 would actively reward breathing faster.
 */
const DURATION_EXPONENT = 1.6;

/**
 * Quality scales the result but never zeroes it. A breath that happened still
 * counts for something: the floor is what stops a bad-signal session reading as
 * a failure to the person doing it, which matters more than scoring precision.
 */
const QUALITY_FLOOR = 0.55;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Metres descended for an exhale of a given length and quality.
 *
 * Also used mid-breath with the elapsed duration so far, which is safe precisely
 * because it is monotonic: the diver glides down as the exhale runs rather than
 * lurching when it ends.
 */
export function metresForExhale(durationMs: number, quality: number): number {
  if (durationMs <= 0) return 0;
  const lengthFactor = (durationMs / REFERENCE_EXHALE_MS) ** DURATION_EXPONENT;
  const qualityFactor = QUALITY_FLOOR + (1 - QUALITY_FLOOR) * clamp01(quality);
  return METRES_AT_REFERENCE * lengthFactor * qualityFactor;
}

/**
 * Depth at which the water is as dark as it gets. Purely a lighting number:
 * it drives how the background fades with depth and nothing else.
 *
 * These used to be called zones and be read as a progression, which put a depth
 * band on the canvas contradicting the session's actual stage (#30) — a Quick
 * Dive has one zone, but crossing 60m made the scene claim zone 2. Zones belong
 * to the session arc; the scene only knows how deep and therefore how dark.
 */
export const DARKEST_AT_METRES = 360;
