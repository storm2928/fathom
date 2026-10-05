import { HoldBreathEngine, isInteractive } from './holdEngine';
import type { HoldEngineOptions } from './holdEngine';

/**
 * Hold the spacebar for as long as you are exhaling.
 *
 * This is a first-class way to play, not a consolation prize. It is offered
 * before a session starts, it is what someone uses in a room too loud for the
 * microphone or on a machine that refuses permission, and it is the path a
 * desktop falls back to if the microphone does not clear its gate. The breath
 * logic lives in `HoldBreathEngine`; this only reads the key.
 */

export interface SpacebarEngineOptions extends HoldEngineOptions {
  /** where key events are listened for; injectable for tests */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

export class SpacebarBreathEngine extends HoldBreathEngine {
  private readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

  constructor(options: SpacebarEngineOptions = {}) {
    super(options);
    this.target = options.target ?? window;
  }

  protected bind(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.interrupt);
  }

  protected unbind(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.interrupt);
  }

  private readonly onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || key.repeat || !this.isRunning) return;
    // Space is how a keyboard user presses a focused button. Swallowing it
    // everywhere would make the app unusable without a mouse, which is a steep
    // price for a breath. Anything focusable keeps its own meaning for Space.
    if (isInteractive(event.target)) return;
    // Otherwise the page scrolls under the diver on every breath.
    key.preventDefault();
    this.press();
  };

  private readonly onKeyUp = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || !this.isRunning) return;
    // No hold in flight means the keydown was ignored — on a button, say — so
    // this keyup is not ours to consume either.
    if (!this.holding) return;
    key.preventDefault();
    this.release();
  };
}
