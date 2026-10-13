import { test, assert, equal } from '../testing/harness.ts';
import { SpacebarBreathEngine } from './spacebarEngine.ts';
import type { BreathEventMap } from '../../breath/types.ts';

/**
 * The hold engine driven by something other than a key: a finger on a phone.
 * The rules must not change with the source — a tap is not a breath, a hold
 * is one, and nothing happens before start or after stop.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

const quiet = { addEventListener() {}, removeEventListener() {} };
// start() listens for visibilitychange on document, which Node does not have.
const scope = globalThis as { document?: unknown };
scope.document ??= { ...quiet, visibilityState: 'visible' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function record(engine: SpacebarBreathEngine) {
  const exhales: BreathEventMap['exhale-end'][] = [];
  const phases: string[] = [];
  engine.on('exhale-end', (e) => exhales.push(e));
  engine.on('phase-change', (e) => phases.push(e.phase));
  return { exhales, phases };
}

test('a held touch is one scored exhale', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 10, targetExhaleMs: 1_000 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  await sleep(40);
  engine.endHold();
  equal(seen.exhales.length, 1, 'the hold did not score');
  assert(seen.exhales[0].durationMs >= 30, `duration ${seen.exhales[0].durationMs}ms is too short`);
  equal(seen.phases.join(','), 'exhale,idle');
  engine.stop();
});

test('a tap is not a breath', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 400 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  engine.endHold();
  equal(seen.exhales.length, 0, 'a tap scored as an exhale');
  engine.stop();
});

test('holds before start are ignored', () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 0 });
  const seen = record(engine);
  engine.beginHold();
  engine.endHold();
  equal(seen.phases.length, 0, 'an engine that was never started emitted');
});

test('a second press while held does not restart the breath', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 10 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  await sleep(30);
  engine.beginHold();
  engine.endHold();
  equal(seen.exhales.length, 1);
  assert(seen.exhales[0].durationMs >= 25, 'the second press restarted the clock');
  engine.stop();
});
