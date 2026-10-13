import { test, equal } from '@fathom/game/testing/harness.ts';
import { metresForExhale } from '@fathom/game/scene/descent';

test('mobile tests can import shared code through @fathom', () => {
  equal(metresForExhale(0, 1), 0);
});
