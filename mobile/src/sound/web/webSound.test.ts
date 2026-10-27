import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { createWebSound, webSound } from './webSound.ts';

/**
 * Where there is no Web Audio (or before the first click lets it start), the
 * soundscape stays silent and never throws: the dive goes on without it. A
 * browser cannot tell headphones from speakers, so it always assumes
 * speakers — which keeps the speaker safety cut on during a microphone dive.
 */

test('every call is safe without Web Audio', async () => {
  assert(typeof (globalThis as { AudioContext?: unknown }).AudioContext === 'undefined');
  await webSound.start();
  await webSound.setMix({
    master: 1,
    surface: 1,
    beds: [1, 0, 0],
    lowpassHz: 2400,
    swell: 0,
    music: 1,
    musicZone: 0,
    highCut: false,
  });
  await webSound.inhale();
  await webSound.ping();
  await webSound.splash();
  await webSound.stop();
});

test('a browser always reports the speaker', async () => {
  const route = await webSound.getRoute();
  equal(route.headphones, false);
});

/** A stand-in for the browser's AudioContext: suspend and resume take a tick, as they do. */
class FakeContext {
  static made: FakeContext[] = [];
  state: 'suspended' | 'running' = 'suspended';
  destination = {};
  audioWorklet = { addModule: async () => {} };
  constructor() {
    FakeContext.made.push(this);
  }
  async resume() {
    await Promise.resolve();
    this.state = 'running';
  }
  async suspend() {
    // The audio thread takes a moment to stop.
    await new Promise((r) => setTimeout(r, 5));
    this.state = 'suspended';
  }
}
class FakeNode {
  port = { postMessage: () => {} };
  connect() {}
}

test('hiding and showing the tab quickly leaves the sound playing', async () => {
  const g = globalThis as Record<string, unknown>;
  g.AudioContext = FakeContext;
  g.AudioWorkletNode = FakeNode;
  try {
    const sound = createWebSound(async () => 'worklet.js');
    await sound.start();
    const ctx = FakeContext.made.at(-1)!;
    await ctx.resume(); // the first click
    equal(ctx.state, 'running');
    // Hidden, then shown again before the suspend has landed.
    const stopping = sound.stop();
    const starting = sound.start();
    await Promise.all([stopping, starting]);
    await new Promise((r) => setTimeout(r, 20));
    equal(ctx.state, 'running');
  } finally {
    delete g.AudioContext;
    delete g.AudioWorkletNode;
  }
});
