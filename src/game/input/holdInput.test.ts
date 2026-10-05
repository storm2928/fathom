import { test, equal } from '../testing/harness.ts';
import { holdInputFor } from './holdInput.ts';

test('a touch screen holds a finger down; a desktop holds the spacebar', () => {
  equal(holdInputFor(true).source, 'touch');
  equal(holdInputFor(true).code, 'touch');
  equal(holdInputFor(false).source, 'spacebar');
  equal(holdInputFor(false).code, 'keyboard');
});
