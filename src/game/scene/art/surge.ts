/**
 * The descent surge.
 *
 * While the drawn depth is still catching the earned depth, the water goes
 * past a little faster than the depth alone would move it and a faint wake
 * trails the diver. One eased factor drives both, so every parallax layer
 * speeds up in step and the parallax stays true. It rises over about 400 ms,
 * falls over about 700 ms, never overshoots and never oscillates. Under
 * reduced motion it holds at 1 and the wake stays hidden.
 */

const RISE_SECONDS = 0.4;
const FALL_SECONDS = 0.7;
const PEAK = 1.8;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class DescentSurge {
  /** raw 0-1 progress; the eased values below are derived from it */
  private k = 0;
  /** multiplier for scroll and drift speed; 1 at rest, at most PEAK */
  factor = 1;
  /** 0-1 wake strength, eased the same way */
  wake = 0;

  /** Advance for this frame and return the speed factor. */
  step(descending: boolean, dtSeconds: number, reduced: boolean): number {
    if (reduced) {
      this.k = 0;
      this.factor = 1;
      this.wake = 0;
      return 1;
    }
    const delta = descending ? dtSeconds / RISE_SECONDS : -dtSeconds / FALL_SECONDS;
    this.k = clamp01(this.k + delta);
    const e = this.k * this.k * (3 - 2 * this.k);
    this.wake = e;
    this.factor = 1 + (PEAK - 1) * e;
    return this.factor;
  }
}
