import { test, equal } from '@fathom/game/testing/harness.ts';
import { clock, exhaleSeconds, wholeMetres } from './resultsFormat.ts';

/** The tiles' numbers: short, unambiguous, and honest about "nothing measured". */

test('durations read as a clock', () => {
  equal(clock(23_000), '0:23');
  equal(clock(324_000), '5:24');
  equal(clock(725_400), '12:05');
});

test('no measurement shows a dash, not a zero', () => {
  equal(clock(null), '—');
  equal(exhaleSeconds(0, 'en'), '—');
});

test('exhales read in seconds with one decimal, in the reader’s language', () => {
  equal(exhaleSeconds(9_240, 'en'), '9.2 s');
  equal(exhaleSeconds(9_240, 'fr'), '9,2 s');
});

test('depth is whole metres and never negative', () => {
  equal(wholeMetres(141.6), 142);
  equal(wholeMetres(-0.4), 0);
});
