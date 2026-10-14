import { test, assert, equal } from '../testing/harness.ts';
import { DiveScene } from './diveScene.ts';
import type { SceneRenderer, SceneState } from './renderer.ts';
import { BreathEmitter } from '../input/emitter.ts';
import { BreathConductor } from '../session/conductor.ts';
import type { BreathEngine, BreathEventMap } from '../../breath/types.ts';

/**
 * One scene for the whole app: dive after dive on the same renderer, so the
 * WebGL context is never torn down and rebuilt. That only works if a reset
 * really does put the diver back at the surface.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

class NullRenderer implements SceneRenderer {
  last: SceneState | null = null;
  render(state: SceneState): void {
    this.last = state;
  }
  resize(): void {}
  destroy(): void {}
}

// Depth only moves inside the frame loop, so the tests drive frames by hand.
const queued: FrameRequestCallback[] = [];
const g = globalThis as Record<string, unknown>;
g.requestAnimationFrame = (cb: FrameRequestCallback) => queued.push(cb);
g.cancelAnimationFrame = () => {};
g.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
let clock = 0;

/** Run `count` frames 50 ms apart (the scene's own dt cap), never behind real time. */
function pump(count = 1): void {
  for (let i = 0; i < count; i += 1) {
    const cb = queued.shift();
    if (!cb) return;
    clock = Math.max(clock, performance.now()) + 50;
    cb(clock);
  }
}

function stubEngine(emitter: BreathEmitter): BreathEngine {
  return {
    start: () => Promise.resolve(),
    stop() {},
    calibrate: () => Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true }),
    on: <K extends keyof BreathEventMap>(e: K, h: (p: BreathEventMap[K]) => void) =>
      emitter.on(e, h),
    setExhaleExpected() {},
    usingFallbackInput: true,
  };
}

const canvas = {} as HTMLCanvasElement;

test('reset puts the diver back at the surface and bumps the epoch', () => {
  const renderer = new NullRenderer();
  const scene = new DiveScene(renderer, canvas, { reducedMotion: true });
  const emitter = new BreathEmitter();
  scene.attach(stubEngine(emitter), new BreathConductor());
  scene.start();
  emitter.emit('phase-change', { phase: 'exhale', at: 0 });
  emitter.emit('exhale-end', { durationMs: 6_000, quality: 1 });
  scene.setZone(2);
  pump(3);
  assert((renderer.last?.depth ?? 0) > 5, 'the breath did not move the diver — test is not exercising depth');
  equal(renderer.last?.zone, 2);
  const before = scene.epoch;

  scene.reset();
  pump();

  equal(scene.depth, 0, 'depth survived the reset');
  equal(scene.drawnDepth, 0, 'drawn depth survived the reset');
  equal(scene.light, 0, 'light survived the reset');
  equal(renderer.last?.depth, 0, 'the renderer was still shown the old depth');
  equal(renderer.last?.zone, 0, 'zone survived the reset');
  equal(renderer.last?.epoch, before + 1, 'epoch did not advance');
  scene.stop();
});

test('reset detaches the previous dive’s engine', () => {
  const renderer = new NullRenderer();
  const scene = new DiveScene(renderer, canvas, { reducedMotion: true });
  const emitter = new BreathEmitter();
  scene.attach(stubEngine(emitter), new BreathConductor());
  scene.start();
  scene.reset();
  emitter.emit('phase-change', { phase: 'exhale', at: 0 });
  emitter.emit('exhale-end', { durationMs: 6_000, quality: 1 });
  pump(3);
  equal(renderer.last?.depth, 0, 'a stale engine still moved the diver after reset');
  scene.stop();
});

test('a fast-forwarded dive charges the light at the same speed-up as everything else', async () => {
  const lightAfter = async (timeScale: number) => {
    queued.length = 0; // frames left behind by earlier, stopped scenes
    const renderer = new NullRenderer();
    const scene = new DiveScene(renderer, canvas, { reducedMotion: true, timeScale });
    const conductor = new BreathConductor({ timeScale });
    scene.attach(stubEngine(new BreathEmitter()), conductor);
    scene.start();
    conductor.start();
    // The breath-in prompt, which charges the light, arrives on the next tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    pump(3); // 150 ms of wall clock
    const light = renderer.last?.light ?? 0;
    conductor.stop();
    scene.stop();
    return light;
  };
  const real = await lightAfter(1);
  const fast = await lightAfter(10);
  assert(real > 0 && real < 0.3, `real-time charge ${real}`);
  assert(fast > real * 5, `at 10x the light only reached ${fast} (real time: ${real})`);
});

test('ascend rises smoothly back to the surface and the first zone', () => {
  queued.length = 0;
  const renderer = new NullRenderer();
  const scene = new DiveScene(renderer, canvas, { reducedMotion: true });
  const emitter = new BreathEmitter();
  scene.attach(stubEngine(emitter), new BreathConductor());
  scene.start();
  emitter.emit('phase-change', { phase: 'exhale', at: 0 });
  emitter.emit('exhale-end', { durationMs: 6_000, quality: 1 });
  scene.setZone(2);
  pump(2);
  const deep = renderer.last?.depth ?? 0;
  assert(deep > 5, 'test needs depth to rise from');

  scene.ascend(1);
  pump(10); // half a second
  const halfway = renderer.last?.depth ?? 0;
  assert(halfway > 0 && halfway < deep, `halfway depth ${halfway} of ${deep}`);
  equal(renderer.last?.zone, 0, 'the water did not start back toward the first zone');

  pump(14); // past the end
  equal(renderer.last?.depth, 0, 'the ascent did not reach the surface');
  scene.stop();
});
