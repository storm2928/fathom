import type { BreathEngine } from '../../breath/types';
import type { InputCode } from '../surface/diveLog';

/**
 * Starting an input, and surviving a microphone that says no.
 *
 * A refused microphone cannot simply be carried: `createBreathEngine` marks
 * itself `usingFallbackInput`, emits `signal-quality: unusable` and resolves
 * calibration as `ok: false`, and the session machine ends a dive on either of
 * the last two. So the engine that would not start is stopped and replaced,
 * rather than limped along into a session that surfaces immediately. See #35.
 *
 * This lives outside the React component on purpose: it is the one part of
 * choosing an input that has a wrong answer, and a component is not something
 * the test harness can drive.
 */

export type InputSource = 'scripted' | 'spacebar' | 'mic';

/**
 * `InputCode` is the dive log's vocabulary, imported rather than restated. What
 * actually drove the session is not always what was asked for, and the log
 * records this rather than the button that was pressed — a log that claims a
 * microphone for a keyboard session is the #32 defect again. A second spelling
 * of the same idea living here is how that defect would come back.
 */

export interface InputPlan {
  /** the engine to try */
  primary: BreathEngine;
  /** what `primary` is, if it starts */
  code: InputCode;
  /**
   * Built only if `primary` refuses. Present for the microphone and nothing
   * else: a spacebar or fixture that will not start is a bug, and substituting
   * for it silently would make a broken input look like a working one.
   */
  fallback?: () => BreathEngine;
}

export interface StartedInput {
  /** the engine that started, ready to be attached and calibrated */
  engine: BreathEngine;
  code: InputCode;
  /** whether the microphone was asked for and refused */
  fellBack: boolean;
  /** why it fell back, for a message the player can actually act on */
  reason: string | null;
}

export async function startInput(plan: InputPlan): Promise<StartedInput> {
  try {
    await plan.primary.start();
    return { engine: plan.primary, code: plan.code, fellBack: false, reason: null };
  } catch (error) {
    if (!plan.fallback) throw error;

    // Release the device before building its replacement. `capture.start()`
    // tears its own audio graph down on failure, but the engine around it is
    // left running and still holding frame listeners.
    plan.primary.stop();

    const engine = plan.fallback();
    // Deliberately unguarded: if the fallback will not start either there is no
    // way to play, and reporting that as a working dive would be a lie the
    // session would then act on.
    await engine.start();

    return {
      engine,
      // The only fallback is the spacebar. Named rather than derived, because
      // an input that quietly reports something else would put a wrong label in
      // an exported log.
      code: 'keyboard',
      fellBack: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
