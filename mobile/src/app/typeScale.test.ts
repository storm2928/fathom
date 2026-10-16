import { test, equal } from '@fathom/game/testing/harness.ts';
import { MAX_TYPE_SCALE, typeScale } from './typeScale.ts';

test('the default iOS text size reads at the size the screens were drawn for', () => {
  equal(typeScale(17), 1);
});

test('larger text sizes scale reading text up, to a ceiling', () => {
  equal(typeScale(20.4), 1.2);
  equal(typeScale(23), 23 / 17);
  equal(typeScale(53), MAX_TYPE_SCALE);
});

test('smaller sizes and nonsense keep the drawn size', () => {
  equal(typeScale(14), 1);
  equal(typeScale(Number.NaN), 1);
  equal(typeScale(0), 1);
});
