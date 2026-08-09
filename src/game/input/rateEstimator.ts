/**
 * Respiratory rate from exhale onsets, by median.
 *
 * Onset to onset, not detection count: counting every detection as a breath is
 * what overstated the reported rate by 65% on the first real session (#27),
 * because an audible inhale reads as a detection too. Median rather than mean so
 * one missed or doubled breath cannot drag the number, which matters when the
 * before/after delta is the objective result the project rests on.
 *
 * Shared by every input source in this lane so they all report the rate the same
 * way the real estimator does.
 */

/** Onsets kept. Five intervals is enough to be stable without lagging the arc. */
const WINDOW = 6;

export class RateEstimator {
  private onsets: number[] = [];

  reset(): void {
    this.onsets = [];
  }

  /** Call at the start of every scored exhale. */
  mark(at: number): void {
    this.onsets.push(at);
    if (this.onsets.length > WINDOW) this.onsets.shift();
  }

  /**
   * Undo the most recent onset. Used when a breath turns out not to be scored —
   * dropping the detection but leaving its onset in the buffer would reintroduce
   * the same inflation from the other direction.
   */
  unmark(): void {
    this.onsets.pop();
  }

  /** Breaths per minute, or null until there are two onsets to measure between. */
  breathsPerMin(): number | null {
    if (this.onsets.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 1; i < this.onsets.length; i += 1) {
      intervals.push(this.onsets[i] - this.onsets[i - 1]);
    }

    intervals.sort((a, b) => a - b);
    const mid = intervals.length >> 1;
    const median =
      intervals.length % 2 === 0
        ? (intervals[mid - 1] + intervals[mid]) / 2
        : intervals[mid];

    return median > 0 ? 60_000 / median : null;
  }
}
