import { test, assert, equal } from '../testing/harness.ts';
import { metresForExhale, REFERENCE_EXHALE_MS } from './descent.ts';

/**
 * The safety rule, pinned.
 *
 * "The adaptive difficulty may only ever slow breathing targets. The game must
 * never reward fast breathing or breath-holds" is a claim we make in the README
 * and will make to clinician judges. A claim that rests on nobody having changed
 * a constant is not a claim. These fail if someone does.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

const QUALITY = 0.8;

test('longer exhales always travel further', () => {
  for (let ms = 200; ms < 15_000; ms += 200) {
    assert(
      metresForExhale(ms + 200, QUALITY) > metresForExhale(ms, QUALITY),
      `descent was not increasing at ${ms}ms — cutting a breath short would pay`,
    );
  }
});

test('slower breathing wins over the same span of exhaling', () => {
  // Twelve seconds of exhaling, spent as different numbers of breaths.
  const BUDGET_MS = 12_000;
  const totalFor = (exhaleMs: number) =>
    (BUDGET_MS / exhaleMs) * metresForExhale(exhaleMs, QUALITY);

  const lengths = [1_000, 1_500, 2_000, 3_000, 4_000, 6_000, 12_000];
  for (let i = 1; i < lengths.length; i += 1) {
    assert(
      totalFor(lengths[i]) > totalFor(lengths[i - 1]),
      `${lengths[i]}ms breaths did not beat ${lengths[i - 1]}ms breaths — ` +
        'breathing faster would be a viable strategy',
    );
  }

  // The gap should be substantial, not a rounding artefact.
  assert(totalFor(6_000) > totalFor(1_000) * 2);
});

test('a breath-hold earns nothing', () => {
  // A held breath emits no exhale, so there is no duration to score.
  equal(metresForExhale(0, 1), 0);
  equal(metresForExhale(-500, 1), 0);
});

test('quality helps but never zeroes a real breath', () => {
  const worst = metresForExhale(REFERENCE_EXHALE_MS, 0);
  const best = metresForExhale(REFERENCE_EXHALE_MS, 1);
  assert(worst > 0, 'a breath that happened must count for something');
  assert(best > worst, 'quality must matter');
  // A bad-signal session should not read as a total failure to the person.
  assert(worst > best * 0.5);
});

test('quality is monotonic and clamped outside 0..1', () => {
  for (let q = 0; q < 1; q += 0.1) {
    assert(
      metresForExhale(REFERENCE_EXHALE_MS, q + 0.1) >=
        metresForExhale(REFERENCE_EXHALE_MS, q),
    );
  }
  equal(
    metresForExhale(REFERENCE_EXHALE_MS, 5),
    metresForExhale(REFERENCE_EXHALE_MS, 1),
  );
  equal(
    metresForExhale(REFERENCE_EXHALE_MS, -5),
    metresForExhale(REFERENCE_EXHALE_MS, 0),
  );
});

test('mid-breath scoring is safe to call repeatedly as the exhale runs', () => {
  // The scene calls this with the elapsed duration every frame. It must never
  // move backwards, or the diver would visibly rise while still exhaling.
  let previous = 0;
  for (let ms = 0; ms <= 8_000; ms += 100) {
    const now = metresForExhale(ms, QUALITY);
    assert(now >= previous, `descent went backwards at ${ms}ms`);
    previous = now;
  }
});
