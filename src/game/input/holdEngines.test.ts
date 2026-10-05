import { test, equal } from '../testing/harness.ts';
import { TouchHoldEngine } from './touchHoldEngine.ts';
import { SpacebarBreathEngine } from './spacebarEngine.ts';
import type { BreathEngine } from '../../breath/types.ts';

/**
 * Hold-to-exhale inputs: a finger on the screen and the spacebar. Both are
 * driven here through a bare EventTarget, which is all they listen on.
 */

function pointer(type: string, pointerId: number): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

function key(type: string, code = 'Space'): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  Object.defineProperty(event, 'repeat', { value: false });
  return event;
}

/** Records the phase changes and completed exhales an engine reports. */
function record(engine: BreathEngine) {
  const log: string[] = [];
  engine.on('phase-change', ({ phase }) => log.push(phase));
  engine.on('exhale-end', () => log.push('end'));
  return log;
}

test('a finger held and lifted is one exhale', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(pointer('pointerup', 1));
  engine.stop();
  equal(log.join(','), 'exhale,end,idle');
});

test('a second finger landing mid-exhale neither restarts nor ends it', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(pointer('pointerdown', 2));
  target.dispatchEvent(pointer('pointerup', 2));
  equal(log.join(','), 'exhale', 'the second finger changed the breath');
  target.dispatchEvent(pointer('pointerup', 1));
  engine.stop();
  equal(log.join(','), 'exhale,end,idle');
});

test('a cancelled touch ends the exhale rather than leaving it open', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(pointer('pointercancel', 1));
  engine.stop();
  equal(log.join(','), 'exhale,end,idle');
});

test('losing focus mid-hold ends the exhale, and the next touch starts a new one', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(new Event('blur'));
  target.dispatchEvent(pointer('pointerdown', 2));
  engine.stop();
  equal(log.join(','), 'exhale,end,idle,exhale,idle');
});

test('a touch on a control (Leave, Dismiss) is not a breath', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0, ignore: () => true });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(pointer('pointerup', 1));
  engine.stop();
  equal(log.length, 0, 'tapping a button started an exhale');
});

test('a tap shorter than a breath is discarded, not scored', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 60_000 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(pointer('pointerdown', 1));
  target.dispatchEvent(pointer('pointerup', 1));
  engine.stop();
  equal(log.join(','), 'exhale,idle');
  equal(engine.scoredExhales, 0);
});

test('a stopped touch engine stops listening', async () => {
  const target = new EventTarget();
  const engine = new TouchHoldEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  engine.stop();
  target.dispatchEvent(pointer('pointerdown', 1));
  equal(log.length, 0);
});

test('the spacebar still drives an exhale after the refactor', async () => {
  const target = new EventTarget();
  const engine = new SpacebarBreathEngine({ target, minHoldMs: 0 });
  const log = record(engine);
  await engine.start();
  target.dispatchEvent(key('keydown'));
  target.dispatchEvent(key('keyup'));
  target.dispatchEvent(key('keydown', 'KeyA'));
  engine.stop();
  equal(log.join(','), 'exhale,end,idle');
  equal(engine.scoredExhales, 1);
});
