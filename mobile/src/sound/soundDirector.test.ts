import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { SPEAKER_SAFE_HZ, mixFor } from './soundDirector.ts';
import type { SoundInput } from './soundDirector.ts';

/**
 * What the soundscape plays, and the one rule it must never break: on the
 * phone's speaker, while a breath out can be scored, nothing the microphone
 * could mistake for — or stretch into — a breath may play.
 */

const diving: SoundInput = {
  screen: 'dive',
  depth: 20,
  zone: 0,
  exhaling: false,
  exhaleWindow: false,
  scoringSoon: false,
  micDive: true,
  headphones: true,
  volume: 1,
};

test('sinking closes the underwater filter, steadily', () => {
  let last = Infinity;
  for (let depth = 0; depth <= 400; depth += 10) {
    const { lowpassHz } = mixFor({ ...diving, depth });
    assert(lowpassHz <= last, `the filter opened again at ${depth}m`);
    last = lowpassHz;
  }
  assert(mixFor({ ...diving, depth: 0 }).lowpassHz > mixFor({ ...diving, depth: 200 }).lowpassHz * 2);
});

test('the surface fades out as you leave it', () => {
  assert(mixFor({ ...diving, depth: 0 }).surface > 0.5);
  equal(mixFor({ ...diving, depth: 150 }).surface, 0);
});

test('only the current zone is heard', () => {
  for (let zone = 0; zone < 3; zone += 1) {
    const { beds } = mixFor({ ...diving, zone });
    for (let other = 0; other < 3; other += 1) {
      if (other === zone) assert(beds[other] > 0, `zone ${zone} was silent`);
      else equal(beds[other], 0, `zone ${other} played during zone ${zone}`);
    }
  }
});

test('the mix swells with a breath out, and only then', () => {
  equal(mixFor({ ...diving, exhaling: false }).swell, 0);
  assert(mixFor({ ...diving, exhaling: true }).swell > 0);
});

test('music plays on every screen, and follows the dive down through the zones', () => {
  for (const screen of ['safety', 'title', 'predive', 'dive', 'results', 'journal'] as const) {
    assert(mixFor({ ...diving, screen }).music > 0, `no music on ${screen}`);
  }
  equal(mixFor({ ...diving, zone: 0 }).musicZone, 0);
  equal(mixFor({ ...diving, zone: 2 }).musicZone, 2);
  // Back at the surface the music is the twilight's again.
  equal(mixFor({ ...diving, screen: 'title', zone: 2 }).musicZone, 0);
});

test('on the speaker, an open exhale window cuts everything the microphone could hear as breath', () => {
  const mix = mixFor({ ...diving, headphones: false, exhaleWindow: true, exhaling: true });
  equal(mix.highCut, true);
  equal(mix.swell, 0, 'the mix swelled into the microphone');
  assert(mix.lowpassHz <= SPEAKER_SAFE_HZ, `filter at ${mix.lowpassHz} Hz on the speaker`);
});

test('on headphones the full mix plays through the exhale window', () => {
  const mix = mixFor({ ...diving, headphones: true, exhaleWindow: true, exhaling: true });
  equal(mix.highCut, false);
  assert(mix.swell > 0);
});

test('outside the exhale window the speaker plays the full mix', () => {
  equal(mixFor({ ...diving, headphones: false, exhaleWindow: false }).highCut, false);
});

test('volume zero is silence, and volume scales the master', () => {
  equal(mixFor({ ...diving, volume: 0 }).master, 0);
  assert(mixFor({ ...diving, volume: 0.5 }).master < mixFor({ ...diving, volume: 1 }).master);
});

test('menus are quieter than the water', () => {
  const dive = mixFor(diving).master;
  assert(mixFor({ ...diving, screen: 'title' }).master < dive);
  assert(mixFor({ ...diving, screen: 'results' }).master < dive);
});

test('on the speaker a microphone dive never swells, even with the window closed', () => {
  // An audible inhale often reads as a breath out while the window is closed;
  // a swell on the speaker would then keep that "breath" going.
  const mix = mixFor({ ...diving, headphones: false, exhaling: true, exhaleWindow: false });
  equal(mix.swell, 0, 'the mix swelled into the microphone');
  equal(mix.highCut, true, 'an exhale on the speaker was not cut');
});

test('the cut is armed from the top-up, before the window opens', () => {
  const mix = mixFor({ ...diving, headphones: false, scoringSoon: true });
  equal(mix.highCut, true);
});

test('on the speaker the cut also ducks the low mix the detector hears as voice', () => {
  const open = mixFor({ ...diving, headphones: false, exhaleWindow: true }).master;
  const closed = mixFor({ ...diving, headphones: false }).master;
  assert(open <= closed * 0.2, `ducked master ${open} vs ${closed}`);
});

test('a touch dive has no microphone to protect: full mix on the speaker', () => {
  const mix = mixFor({ ...diving, micDive: false, headphones: false, exhaling: true, exhaleWindow: true });
  equal(mix.highCut, false);
  assert(mix.swell > 0);
});
