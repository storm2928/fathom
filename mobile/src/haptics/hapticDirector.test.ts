import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { RUMBLE_MAX, exhaleFeel } from './hapticDirector.ts';

/** What a breath out feels like in the hand. */

test('a touch breath out rumbles, easing in and growing with its length', () => {
  const start = exhaleFeel(0, 'touch').rumble ?? 0;
  const settled = exhaleFeel(0.5, 'touch').rumble ?? 0;
  const long = exhaleFeel(8, 'touch').rumble ?? 0;
  assert(start > 0 && start < settled, `no ease-in: ${start} → ${settled}`);
  assert(long > settled, 'a longer breath did not feel deeper');
  for (let s = 0; s < 20; s += 0.25) {
    const r = exhaleFeel(s, 'touch').rumble ?? 0;
    assert(r <= RUMBLE_MAX, `rumble ${r} above the cap at ${s}s`);
    assert(r >= (exhaleFeel(Math.max(0, s - 0.25), 'touch').rumble ?? 0), `rumble fell at ${s}s`);
  }
});

test('a microphone breath out gets no rumble the microphone could hear', () => {
  equal(exhaleFeel(0, 'mic').rumble, null);
  equal(exhaleFeel(6, 'mic').rumble, null);
});
