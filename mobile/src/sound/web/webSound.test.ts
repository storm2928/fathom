import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { webSound } from './webSound.ts';

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
