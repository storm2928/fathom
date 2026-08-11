/**
 * The prompted-exhale window (#27).
 *
 * An audible inhale is broadband turbulent noise, spectrally close enough to an
 * exhale that the band-ratio test cannot separate the two. On the first real
 * session the detector opened on inhales, and counting them as breaths
 * overstated the reported respiratory rate by roughly 65% — on the one number
 * the whole before/after claim rests on.
 *
 * This is not fixable acoustically with the features we carry, and it does not
 * need to be. The inhale is rhythm-prompted: the session arc knows exactly when
 * it is asking for one. So rather than trying to tell inhale from exhale by
 * sound, the engine is simply told when an exhale is expected, and refuses to
 * score detections that began outside that window. Exact, rather than
 * probabilistic.
 *
 * ## The gate is read once, at onset
 *
 * This is the whole design, and getting it wrong is silent. Reading the window
 * when a breath *ends* refuses every exhale that outlasted the prompt — which
 * is the longest breaths, precisely the behaviour the protocol trains. That
 * would break the "may only ever slow" rule from the other direction: not by
 * speeding the target up, but by refusing to score the person who went slower
 * than they were asked to. Measured on a real session, reading at the end
 * refused 17 of 25 onsets when only 6 had actually begun in a closed window.
 *
 * So the answer is latched when the breath begins and follows it to the end,
 * however long it runs and whatever the prompt does in the meantime.
 *
 * ## Default open
 *
 * A gate nobody has configured scores everything. Calibration and any other
 * free-breathing stretch are reads of an unprompted person, and they must not
 * have to opt in to being heard — an engine that defaulted closed would fail
 * silently and report a baseline of nothing.
 */

export interface ExhaleGate {
  /** The session arc calls this as the prompt moves between inhale and exhale. */
  setExpected(expected: boolean): void;
  /** The window right now. For the debug meter — not what scoring reads. */
  readonly expected: boolean;
  /** A breath has begun. Latches the current window as this breath's answer. */
  onset(): void;
  /** A breath has completed. True if it should be scored. Consumes the latch. */
  resolve(): boolean;
  reset(): void;
}

export function createExhaleGate(): ExhaleGate {
  let expected = true;
  /** This breath's answer, taken at its onset. Null between breaths. */
  let latched: boolean | null = null;

  return {
    setExpected(next: boolean): void {
      expected = next;
    },

    get expected(): boolean {
      return expected;
    },

    onset(): void {
      latched = expected;
    },

    resolve(): boolean {
      // No latch means no onset was seen for this breath, which the detector
      // should make impossible — a completed exhale has always passed through
      // the open state. Falling back to the current window keeps a future
      // detector change from turning into a silent scoring bug.
      const decision = latched ?? expected;
      latched = null;
      return decision;
    },

    reset(): void {
      expected = true;
      latched = null;
    },
  };
}
