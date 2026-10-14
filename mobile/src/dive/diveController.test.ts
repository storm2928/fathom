import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { DiveController } from './diveController.ts';
import type { DiveSceneLike, DiveStats, InputFactories } from './diveController.ts';
import { ScriptedBreathEngine } from '@fathom/game/input/scriptedEngine.ts';
import { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine.ts';
import type { SessionResult, SessionState } from '@fathom/game/session/sessionMachine.ts';
import type { BreathEngine, BreathEventMap, CalibrationResult } from '@fathom/breath/types.ts';
import type { InputCode } from '@fathom/game/surface/diveLog.ts';

/**
 * A whole Quick Dive, compressed 500x, through the same wiring the app uses.
 * The scene is a recorder: these tests are about who tells it what, and when.
 */

const quiet = { addEventListener() {}, removeEventListener() {} };
const scope = globalThis as { document?: unknown };
scope.document ??= { ...quiet, visibilityState: 'visible' };

class RecordingScene implements DiveSceneLike {
  calls: string[] = [];
  depth = 0;
  light = 0;
  attach() {
    this.calls.push('attach');
    return () => this.calls.push('detach');
  }
  setZone(zone: number) {
    this.calls.push(`zone:${zone}`);
  }
  setPose(pose: string) {
    this.calls.push(`pose:${pose}`);
  }
  reset() {
    this.calls.push('reset');
  }
  settle() {
    this.calls.push('settle');
  }
}

function refusingMic(): BreathEngine & { stopped: number } {
  let stopped = 0;
  return {
    start: () => Promise.reject(new Error('Permission denied')),
    stop() {
      stopped += 1;
    },
    calibrate: (): Promise<CalibrationResult> =>
      Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true }),
    on: <K extends keyof BreathEventMap>(_e: K, _h: (p: BreathEventMap[K]) => void) => () => {},
    setExhaleExpected() {},
    usingFallbackInput: false,
    get stopped() {
      return stopped;
    },
  };
}

const factories = (overrides: Partial<InputFactories> = {}): InputFactories => ({
  mic: () => refusingMic(),
  touch: () => new SpacebarBreathEngine({ target: quiet, calibrationMs: 20 }),
  scripted: (conductor, timeScale) =>
    new ScriptedBreathEngine({ follow: conductor, timeScale, seed: 7 }),
  ...overrides,
});

function finished(controller: DiveController, start: () => Promise<unknown>) {
  return new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('dive never surfaced')), 5_000);
    void start().then(() => {
      const poll = setInterval(() => {
        if (!controller.running) {
          clearInterval(poll);
          clearTimeout(guard);
          resolve();
        }
      }, 10);
    });
  });
}

test('a scripted quick dive runs start to surface and settles the scene', async () => {
  const scene = new RecordingScene();
  const states: SessionState[] = [];
  let result: SessionResult | null = null;
  let input: InputCode | null = null;
  const controller = new DiveController(
    scene,
    {
      onState: (s) => states.push(s),
      onPrompt: () => {},
      onResult: (r, code) => {
        result = r;
        input = code;
      },
    },
    factories(),
  );

  await finished(controller, () => controller.start({ plan: 'quick', input: 'scripted', timeScale: 500 }));

  equal(scene.calls[0], 'reset', 'the scene was not reset before the dive');
  assert(scene.calls.includes('attach'));
  assert(scene.calls.includes('zone:0'));
  assert(scene.calls.includes('settle'), 'the scene was never settled');
  equal(states[0], 'calibrating');
  assert(states.includes('zone-1'));
  equal(states[states.length - 1], 'ended');
  equal((result as SessionResult | null)?.ending, 'completed');
  equal(input, 'scripted');
});

test('a refused microphone becomes a touch dive, labelled touch', async () => {
  const scene = new RecordingScene();
  const mic = refusingMic();
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories({ mic: () => mic }),
  );
  const started = await controller.start({ plan: 'quick', input: 'mic' });
  equal(started?.code, 'touch');
  equal(mic.stopped, 1, 'the refused microphone was not released');
  assert(controller.touch !== null, 'no touch engine to press');
  controller.stop();
});

test('leaving mid-dive reports stopped and releases the input', async () => {
  const scene = new RecordingScene();
  let result: SessionResult | null = null;
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: (r) => (result = r) },
    factories(),
  );
  await controller.start({ plan: 'full', input: 'touch' });
  controller.stop();
  equal((result as SessionResult | null)?.ending, 'stopped');
  equal(controller.running, false);
  equal(controller.touch, null, 'the touch engine outlived the dive');
  assert(scene.calls.includes('detach'), 'the scene kept listening to a stopped engine');
});

test('a second start while the first is starting is ignored', async () => {
  const scene = new RecordingScene();
  let built = 0;
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories({
      touch: () => {
        built += 1;
        return new SpacebarBreathEngine({ target: quiet, calibrationMs: 20 });
      },
    }),
  );
  const first = controller.start({ plan: 'quick', input: 'touch' });
  const second = controller.start({ plan: 'quick', input: 'touch' });
  equal(await second, null, 'the second start was not refused');
  await first;
  equal(built, 1, 'two engines were built');
  controller.stop();
});

/** An input that takes a while to start, like a microphone waiting on its permission prompt. */
function slowEngine(): BreathEngine & { stopped: number } {
  let stopped = 0;
  return {
    start: () => new Promise<void>((resolve) => setTimeout(resolve, 30)),
    stop() {
      stopped += 1;
    },
    calibrate: (): Promise<CalibrationResult> =>
      Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true }),
    on: <K extends keyof BreathEventMap>(_e: K, _h: (p: BreathEventMap[K]) => void) => () => {},
    setExhaleExpected() {},
    usingFallbackInput: false,
    get stopped() {
      return stopped;
    },
  };
}

test('leaving while the input is still starting cancels the dive and releases the input', async () => {
  const scene = new RecordingScene();
  const mic = slowEngine();
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories({ mic: () => mic }),
  );
  const pending = controller.start({ plan: 'quick', input: 'mic' });
  controller.stop();
  equal(await pending, null, 'a cancelled start still reported a dive');
  equal(controller.running, false, 'a session ran with nobody watching it');
  equal(mic.stopped, 1, 'the microphone stayed open after the dive was cancelled');
  assert(!scene.calls.includes('attach'), 'the scene was handed a cancelled dive');
});

test('sending the app to the background ends the dive as left early', async () => {
  let onVisibility: (() => void) | null = null;
  const lifecycle = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: string, handler: () => void) => {
      onVisibility = handler;
    },
    removeEventListener: () => {
      onVisibility = null;
    },
  };
  let result: SessionResult | null = null;
  const controller = new DiveController(
    new RecordingScene(),
    { onState: () => {}, onPrompt: () => {}, onResult: (r) => (result = r) },
    factories(),
    lifecycle,
  );
  await controller.start({ plan: 'full', input: 'touch' });
  lifecycle.visibilityState = 'hidden';
  (onVisibility as (() => void) | null)?.();
  equal((result as SessionResult | null)?.ending, 'stopped', 'the dive kept running in the background');
  equal(controller.running, false);
  equal(onVisibility, null, 'the visibility listener outlived the dive');
});

test('a finished dive reports its depth, deepest zone and longest exhale', async () => {
  const scene = new RecordingScene();
  scene.depth = 37.5;
  let stats: DiveStats | null = null;
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: (_r, _code, s) => (stats = s) },
    factories(),
  );
  await finished(controller, () => controller.start({ plan: 'quick', input: 'scripted', timeScale: 500 }));
  const reported = stats as DiveStats | null;
  equal(reported?.depth, 37.5, 'depth was not taken from the scene');
  equal(reported?.zone, 0, 'a quick dive reached a zone it does not have');
  assert((reported?.longestExhaleMs ?? 0) > 1_000, `longest exhale ${reported?.longestExhaleMs}ms is not a real breath`);
});

test('the controller says when a breath out is under way, for the soundscape', async () => {
  const controller = new DiveController(
    new RecordingScene(),
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories(),
  );
  equal(controller.exhaling, false);
  await controller.start({ plan: 'full', input: 'touch' });
  controller.touch?.beginHold();
  equal(controller.exhaling, true, 'a held breath out was not reported');
  controller.touch?.endHold();
  equal(controller.exhaling, false);
  controller.stop();
  equal(controller.exhaling, false, 'a stopped dive still reported a breath out');
});

test('before the prompt starts, any breath out could be scored', async () => {
  const controller = new DiveController(
    new RecordingScene(),
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories(),
  );
  equal(controller.exhaleWindow, false, 'no dive, but an exhale window was open');
  await controller.start({ plan: 'full', input: 'touch' });
  equal(controller.exhaleWindow, true, 'calibration listens to every breath');
  controller.stop();
});
