import { test, equal } from '@fathom/game/testing/harness.ts';
import { UnheardWatch, watchHearing } from './unheardWatch.ts';
import { BreathEmitter } from '@fathom/game/input/emitter.ts';
import type { PromptStep } from '@fathom/game/session/conductor.ts';

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

test('a long breath out still finishing into the next breath in is not a miss', () => {
  const watch = new UnheardWatch();
  for (let i = 0; i < 3; i += 1) {
    watch.window('exhale');
    watch.window('rest');
    watch.window('inhale');
    // Counted only as it ends, a moment into the breath-in prompt.
    watch.heard();
    equal(watch.window('top-up'), null, 'a late-ending breath out was judged a miss');
  }
});

test('breaths out during the calibration read do not count for the first prompt', () => {
  const watch = new UnheardWatch();
  watch.heard();
  watch.heard();
  equal(cycle(watch, false), '');
  equal(cycle(watch, false), 'true', 'a calibration breath hid the first missed prompt');
});

/** A conductor stand-in: the test opens each prompt window by hand. */
function promptSource() {
  let handler: ((w: { step: PromptStep }) => void) | null = null;
  return {
    on(h: (w: { step: PromptStep }) => void) {
      handler = h;
      return () => (handler = null);
    },
    cycle() {
      for (const step of ['inhale', 'top-up', 'exhale', 'rest'] as PromptStep[]) handler?.({ step });
    },
  };
}

test('sounds that are not counted breaths out — the app’s own swell, an audible breath in — never hide the hint', () => {
  const engine = new BreathEmitter();
  const prompts = promptSource();
  const changes: boolean[] = [];
  const stop = watchHearing(engine, prompts, (unheard) => changes.push(unheard));
  for (let i = 0; i < 4; i += 1) {
    prompts.cycle();
    // The detector hears something start, but the gate refuses it: no exhale-end.
    engine.emit('phase-change', { phase: 'exhale', at: i });
    engine.emit('phase-change', { phase: 'idle', at: i + 0.5 });
  }
  equal(changes.join(','), 'true', 'uncounted sounds kept the hint away');

  // A breath out that counts clears it.
  engine.emit('exhale-end', { durationMs: 4000, quality: 0.8 } as never);
  equal(changes.join(','), 'true,false');
  stop();
});
