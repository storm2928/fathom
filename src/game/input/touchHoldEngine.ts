import { HoldBreathEngine, isInteractive } from './holdEngine';
import type { HoldEngineOptions } from './holdEngine';

/**
 * Hold a finger on the screen for as long as you are exhaling.
 *
 * The phone's spacebar: what a phone falls back to when the microphone is
 * refused, and a first-class choice in a room too loud for it. The breath
 * logic lives in `HoldBreathEngine`; this only reads the touch.
 *
 * One finger is the breath. A second finger landing — a thumb shifting its
 * grip — neither restarts the exhale nor ends it; only the finger that started
 * it can.
 */

export interface TouchHoldEngineOptions extends HoldEngineOptions {
  /** where pointer events are listened for; injectable for tests */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** touches that are not breaths — a tap on Leave, say; injectable for tests */
  ignore?: (target: EventTarget | null) => boolean;
}

export class TouchHoldEngine extends HoldBreathEngine {
  private readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  private readonly ignore: (target: EventTarget | null) => boolean;
  private pointerId: number | null = null;

  constructor(options: TouchHoldEngineOptions = {}) {
    super(options);
    this.target = options.target ?? window;
    this.ignore = options.ignore ?? isInteractive;
  }

  protected bind(): void {
    this.target.addEventListener('pointerdown', this.onDown);
    this.target.addEventListener('pointerup', this.onEnd);
    this.target.addEventListener('pointercancel', this.onEnd);
    this.target.addEventListener('blur', this.interrupt);
  }

  protected unbind(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointerup', this.onEnd);
    this.target.removeEventListener('pointercancel', this.onEnd);
    this.target.removeEventListener('blur', this.interrupt);
    this.pointerId = null;
  }

  private readonly onDown = (event: Event) => {
    if (!this.isRunning || this.holding) return;
    // The HUD's buttons sit over the scene. Tapping one is not a breath.
    if (this.ignore(event.target)) return;
    this.pointerId = (event as PointerEvent).pointerId;
    this.press();
  };

  private readonly onEnd = (event: Event) => {
    if (!this.holding || (event as PointerEvent).pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.release();
  };
}
