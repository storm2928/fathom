import type { BreathEngine } from '@fathom/breath/types';
import { startInput } from '@fathom/game/input/inputSource';
import type { InputPlan, StartedInput } from '@fathom/game/input/inputSource';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { DiverPose } from '@fathom/game/scene/renderer';
import { BreathConductor } from '@fathom/game/session/conductor';
import type { PromptWindow } from '@fathom/game/session/conductor';
import { SessionMachine } from '@fathom/game/session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '@fathom/game/session/sessionMachine';
import type { InputCode } from '@fathom/game/surface/diveLog';

/**
 * One dive, wired: input → conductor → session → scene. The same order the
 * website's DiveView uses, without React, so it can be tested end to end.
 *
 * The input is started first and before any other await, because the
 * microphone's AudioContext must be created inside the tap that began the
 * dive — WebKit is strict about that.
 */

export interface DiveSceneLike {
  attach(engine: BreathEngine, conductor: BreathConductor): () => void;
  setZone(zone: number): void;
  setPose(pose: DiverPose): void;
  reset(): void;
  settle(): void;
  readonly depth: number;
  readonly light: number;
}

/** What the dive itself did, for the end-of-dive screen. */
export interface DiveStats {
  /** metres earned by the end, from the scene */
  depth: number;
  /** 0-based index of the deepest zone the arc entered */
  zone: number;
  /** the longest scored exhale, ms; 0 when none was scored */
  longestExhaleMs: number;
}

export interface DiveCallbacks {
  onState(state: SessionState): void;
  /** `sweepMs` is the window in wall-clock time, for the breath ring. */
  onPrompt(window: PromptWindow, sweepMs: number): void;
  onResult(result: SessionResult, input: InputCode, stats: DiveStats): void;
}

export type DiveInput = 'mic' | 'touch' | 'scripted';

export interface InputFactories {
  mic(): BreathEngine;
  touch(): SpacebarBreathEngine;
  scripted(conductor: BreathConductor, timeScale: number): BreathEngine;
}

/** Which visual zone each stage of the arc belongs to. Surfacing keeps the last. */
export const ZONE_FOR_STATE: Partial<Record<SessionState, number>> = {
  calibrating: 0,
  'zone-1': 0,
  'zone-2': 1,
  'zone-3': 2,
};

/** What tells the controller the app went to the background: `document`, in the app. */
export interface Lifecycle {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** The starting prompt rate. The arc only ever slows from here. */
const START_RR = 12;

export class DiveController {
  private readonly scene: DiveSceneLike;
  private readonly callbacks: DiveCallbacks;
  private readonly factories: InputFactories;
  private readonly lifecycle: Lifecycle | null;

  private starting = false;
  /** Leave was pressed while the input was still starting. */
  private cancelled = false;
  private engine: BreathEngine | null = null;
  private touchEngine: SpacebarBreathEngine | null = null;
  private conductor: BreathConductor | null = null;
  private machine: SessionMachine | null = null;
  private detach: (() => void)[] = [];
  private code: InputCode = 'microphone';
  private zone = 0;
  private longestExhaleMs = 0;
  private breathingOut = false;

  constructor(
    scene: DiveSceneLike,
    callbacks: DiveCallbacks,
    factories: InputFactories,
    lifecycle: Lifecycle | null = (globalThis as { document?: Lifecycle }).document ?? null,
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.factories = factories;
    this.lifecycle = lifecycle;
  }

  get running(): boolean {
    return this.machine !== null;
  }

  /** A breath out is under way right now (the engine's exhale phase). */
  get exhaling(): boolean {
    return this.running && this.breathingOut;
  }

  /**
   * A breath out starting now would be scored. Open through calibration and the
   * exhale and rest steps; closed during the inhale beats. The soundscape keeps
   * quiet on the speaker while it is open.
   */
  get exhaleWindow(): boolean {
    return this.running && (this.conductor?.exhaleExpected ?? false);
  }

  /** The engine a finger presses, when the dive is on touch. */
  get touch(): SpacebarBreathEngine | null {
    return this.touchEngine;
  }

  /**
   * Begin a dive. Resolves with what actually started, or null if a dive is
   * already starting or running. Throws if no input could start at all.
   */
  async start(config: {
    plan: SessionPlan;
    input: DiveInput;
    timeScale?: number;
  }): Promise<StartedInput | null> {
    if (this.starting || this.running) return null;
    this.starting = true;
    this.cancelled = false;
    try {
      // Only the fixture may run fast; a person breathes in real time.
      const timeScale = config.input === 'scripted' ? (config.timeScale ?? 1) : 1;
      const conductor = new BreathConductor({ targetRR: START_RR, timeScale });

      const started = await startInput(this.planFor(config.input, conductor, timeScale));
      // Left before the input finished starting — a microphone prompt still on
      // screen, say. Release it rather than run a dive nobody is watching.
      if (this.cancelled) {
        started.engine.stop();
        return null;
      }
      this.engine = started.engine;
      this.code = started.code;
      this.touchEngine =
        started.code === 'touch' ? (started.engine as SpacebarBreathEngine) : null;
      conductor.attach(started.engine);
      this.conductor = conductor;

      this.zone = 0;
      this.longestExhaleMs = 0;
      this.scene.reset();
      this.detach.push(this.scene.attach(started.engine, conductor));
      this.breathingOut = false;
      this.detach.push(
        started.engine.on('phase-change', ({ phase }) => {
          this.breathingOut = phase === 'exhale';
        }),
      );
      this.detach.push(
        started.engine.on('exhale-end', ({ durationMs }) => {
          this.longestExhaleMs = Math.max(this.longestExhaleMs, durationMs);
        }),
      );
      this.detach.push(
        conductor.on((window) => this.callbacks.onPrompt(window, window.durationMs / timeScale)),
      );

      const machine = new SessionMachine(started.engine, conductor, {
        plan: config.plan,
        timeScale,
        onState: (state) => this.onState(state),
        onResult: (result) => this.onResult(result),
      });
      this.machine = machine;
      this.watchLifecycle();
      this.scene.setPose('level');
      // The machine starts the conductor once calibration is done (#29).
      void machine.start();
      return started;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Leave early. The session reports what it measured so far; a dive whose
   * input is still starting is cancelled instead.
   */
  stop(): void {
    if (this.starting) {
      this.cancelled = true;
      return;
    }
    this.machine?.stop();
  }

  // ------------------------------------------------------------- internals

  /**
   * A dive does not carry on in the background. iOS interrupts the microphone
   * there and a hold cannot continue, so going to the background is leaving:
   * the session ends where it stood and the input is released.
   */
  private watchLifecycle(): void {
    const lifecycle = this.lifecycle;
    if (!lifecycle) return;
    const onVisibility = () => {
      if (lifecycle.visibilityState === 'hidden') this.stop();
    };
    lifecycle.addEventListener('visibilitychange', onVisibility);
    this.detach.push(() => lifecycle.removeEventListener('visibilitychange', onVisibility));
  }

  private planFor(input: DiveInput, conductor: BreathConductor, timeScale: number): InputPlan {
    switch (input) {
      case 'mic':
        return {
          primary: this.factories.mic(),
          code: 'microphone',
          fallback: () => this.factories.touch(),
          fallbackCode: 'touch',
        };
      case 'touch':
        return { primary: this.factories.touch(), code: 'touch' };
      case 'scripted':
        return { primary: this.factories.scripted(conductor, timeScale), code: 'scripted' };
    }
  }

  private onState(state: SessionState): void {
    const zone = ZONE_FOR_STATE[state];
    if (zone !== undefined) {
      this.scene.setZone(zone);
      this.zone = Math.max(this.zone, zone);
    }
    if (state === 'calibrating' || state === 'surfacing') this.scene.setPose('level');
    else if (zone !== undefined) this.scene.setPose('descending');
    this.callbacks.onState(state);
  }

  private onResult(result: SessionResult): void {
    const code = this.code;
    const stats: DiveStats = {
      depth: this.scene.depth,
      zone: this.zone,
      longestExhaleMs: this.longestExhaleMs,
    };
    this.teardown();
    this.scene.settle();
    this.callbacks.onResult(result, code, stats);
  }

  private teardown(): void {
    for (const off of this.detach) off();
    this.detach = [];
    this.conductor?.stop();
    this.conductor = null;
    this.engine?.stop();
    this.engine = null;
    this.touchEngine = null;
    this.machine = null;
    this.breathingOut = false;
  }
}
