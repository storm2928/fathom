import type { BreathEngine } from '@fathom/breath/types';
import type { PromptStep } from '@fathom/game/session/conductor';

/**
 * Notices when a microphone dive is not hearing the player. A breath out was
 * prompted and none arrived — twice in a row — so a quiet line can suggest
 * coming closer, instead of a dive that silently goes nowhere.
 *
 * Any counted breath out counts, wherever it falls: people start a little
 * early, and the point is only whether the microphone hears them at all. One
 * breath out heard clears the hint straight away.
 */
export class UnheardWatch {
  private readonly missesToWarn: number;
  private misses = 0;
  /** a breath out was heard since the last exhale window opened */
  private heardSince = false;
  /** an exhale window has opened and not yet been judged */
  private pending = false;
  private unheard = false;
  /** the prompts have begun; breaths out before that were the calibration read */
  private prompting = false;

  constructor(missesToWarn = 2) {
    this.missesToWarn = missesToWarn;
  }

  /** A prompt window began. Returns the new state when it changed, else null. */
  window(step: PromptStep): boolean | null {
    this.prompting = true;
    if (step === 'exhale') {
      this.pending = true;
      return null;
    }
    // The breath in after a prompted breath out: judge that breath out.
    if (step === 'inhale' && this.pending) {
      this.pending = false;
      this.misses = this.heardSince ? 0 : this.misses + 1;
      this.heardSince = false;
      if (this.misses >= this.missesToWarn) return this.set(true);
    }
    return null;
  }

  /** The microphone heard a breath out begin. */
  heard(): boolean | null {
    if (!this.prompting) return null;
    this.heardSince = true;
    this.misses = 0;
    return this.set(false);
  }

  private set(next: boolean): boolean | null {
    if (next === this.unheard) return null;
    this.unheard = next;
    return next;
  }
}

/**
 * Wire a watch to a dive: the prompt windows from the conductor, and the breaths
 * out the engine actually counted (exhale-end). Not the start of any sound the
 * detector hears: on the speaker the app's own breath-in swell, and an audible
 * breath in through the nose, both start one every cycle, and they kept the
 * hint from ever appearing. Returns a teardown.
 */
export function watchHearing(
  engine: Pick<BreathEngine, 'on'>,
  prompts: { on(handler: (window: { step: PromptStep }) => void): () => void },
  report: (unheard: boolean) => void,
  watch = new UnheardWatch(),
): () => void {
  const tell = (change: boolean | null) => {
    if (change !== null) report(change);
  };
  const offs = [
    prompts.on((window) => tell(watch.window(window.step))),
    engine.on('exhale-end', () => tell(watch.heard())),
  ];
  return () => offs.forEach((off) => off());
}
