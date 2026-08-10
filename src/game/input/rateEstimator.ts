/**
 * Respiratory rate from exhale onsets, by median.
 *
 * Onset to onset, not detection count: counting every detection as a breath is
 * what overstated the reported rate by 65% on the first real session (#27),
 * because an audible inhale reads as a detection too. Median rather than mean so
 * one missed or doubled breath cannot drag the number, which matters when the
 * before/after delta is the objective result the project rests on.
 *
 * The estimator will not measure across a breath it was told to leave out. That
 * is the fix for #29: dropping an onset and then measuring from its neighbour to
 * the one after leaves a two-cycle span being read as one cycle, which reported
 * a breather at half their true rate. A gap breaks the chain instead, so the
 * span is excluded rather than believed.
 *
 * The two ways a breath leaves the series are deliberately different:
 *   - `discard` — nothing happened. A key tap too short to be a breath. The
 *     chain is intact because no breath occurred between its neighbours.
 *   - `skip` — a breath happened but is not being counted. The chain breaks,
 *     because the next interval really does span more than one cycle.
 *
 * Shared by every input source in this lane so they all report the rate the same
 * way the real estimator does.
 */

interface Onset {
  at: number;
  /** whether the span back to the previous onset is a single true cycle */
  linked: boolean;
}

/** Onsets kept. Five intervals is enough to be stable without lagging the arc. */
const WINDOW = 6;

export class RateEstimator {
  private onsets: Onset[] = [];
  private brokenSincePrevious = false;

  reset(): void {
    this.onsets = [];
    this.brokenSincePrevious = false;
  }

  /** Call at the start of every exhale. */
  mark(at: number): void {
    this.onsets.push({
      at,
      linked: this.onsets.length > 0 && !this.brokenSincePrevious,
    });
    this.brokenSincePrevious = false;
    if (this.onsets.length > WINDOW) this.onsets.shift();
  }

  /**
   * The most recent onset was not a breath at all — a tap, a click, something
   * below the floor. Removing it leaves its neighbours correctly adjacent.
   */
  discard(): void {
    this.onsets.pop();
  }

  /**
   * The most recent onset was a real breath that is not being counted. It is
   * removed from the series *and* the next interval is disqualified, because
   * that interval spans a breath the estimate cannot see.
   */
  skip(): void {
    this.onsets.pop();
    this.brokenSincePrevious = true;
  }

  /** Breaths per minute, or null when there is no measurable interval. */
  breathsPerMin(): number | null {
    const intervals: number[] = [];
    for (let i = 1; i < this.onsets.length; i += 1) {
      if (this.onsets[i].linked) intervals.push(this.onsets[i].at - this.onsets[i - 1].at);
    }
    if (intervals.length === 0) return null;

    intervals.sort((a, b) => a - b);
    const mid = intervals.length >> 1;
    const median =
      intervals.length % 2 === 0
        ? (intervals[mid - 1] + intervals[mid]) / 2
        : intervals[mid];

    return median > 0 ? 60_000 / median : null;
  }
}
