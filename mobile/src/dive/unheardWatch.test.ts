import { test, equal } from '@fathom/game/testing/harness.ts';
import { UnheardWatch } from './unheardWatch.ts';

/** One prompted breath: the window opens for the breath out, then the next breath in. */
function cycle(watch: UnheardWatch, breathedOut: boolean): string {
  const changes = [watch.window('exhale')];
  if (breathedOut) changes.push(watch.heard());
  changes.push(watch.window('rest'), watch.window('inhale'), watch.window('top-up'));
  return changes.filter((c) => c !== null).join(',');
}

test('two prompted breaths out with nothing heard raise the hint', () => {
  const watch = new UnheardWatch();
  equal(cycle(watch, false), '', 'one miss alone must not raise it');
  equal(cycle(watch, false), 'true');
});

test('one breath out heard clears the hint at once', () => {
  const watch = new UnheardWatch();
  cycle(watch, false);
  cycle(watch, false);
  equal(watch.window('exhale'), null);
  equal(watch.heard(), false);
  equal(watch.heard(), null, 'cleared twice');
});

test('a breath out that starts just before its window still counts', () => {
  const watch = new UnheardWatch();
  for (let i = 0; i < 4; i += 1) {
    watch.window('top-up');
    watch.heard();
    equal(cycle(watch, false), '', 'an early breath out was counted as a miss');
  }
});

test('a miss followed by a breath out starts the count again', () => {
  const watch = new UnheardWatch();
  cycle(watch, false);
  cycle(watch, true);
  equal(cycle(watch, false), '', 'misses were added across a heard breath');
});

test('breaths out during the calibration read do not count for the first prompt', () => {
  const watch = new UnheardWatch();
  watch.heard();
  watch.heard();
  equal(cycle(watch, false), '');
  equal(cycle(watch, false), 'true', 'a calibration breath hid the first missed prompt');
});
