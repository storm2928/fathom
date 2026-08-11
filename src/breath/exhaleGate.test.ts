/**
 * The #27 gate: detections landing outside the prompted exhale window are not
 * scored.
 *
 * The property worth testing is not the window, it is *when the window is read*.
 * Reading it when a breath ends refuses every exhale that ran past the prompt —
 * which is the longest breaths, the exact behaviour the protocol trains. On a
 * real session that was 17 of 25 onsets refused when only 6 had begun in a
 * closed window. Reading it once at onset and latching that answer for the
 * breath refuses those 6 and nothing else.
 *
 * So most of what follows is the same breath under a window that moves while it
 * is in flight, asserting the decision does not move with it.
 */

import { test, equal } from '../game/testing/harness.ts';
import { createExhaleGate } from './exhaleGate.ts';

test('an engine nobody has told anything about scores every breath', () => {
  // Free-breathing modes — calibration, quiet time — never call setExpected.
  // They must not have to opt in to being heard.
  const gate = createExhaleGate();

  gate.onset();

  equal(gate.resolve(), true, 'a breath under the default gate should score');
});

test('a breath begun inside the window scores', () => {
  const gate = createExhaleGate();
  gate.setExpected(true);

  gate.onset();

  equal(gate.resolve(), true);
});

test('a breath begun outside the window does not score', () => {
  const gate = createExhaleGate();
  gate.setExpected(false);

  gate.onset();

  equal(gate.resolve(), false);
});

test('a breath that runs past the end of the window still scores', () => {
  // The one that matters. Someone exhaling longer than they were asked to is
  // doing the thing the session is training; refusing them would enforce the
  // "may only ever slow" rule backwards.
  const gate = createExhaleGate();
  gate.setExpected(true);

  gate.onset();
  gate.setExpected(false); // the prompt moved on to the inhale mid-breath

  equal(gate.resolve(), true, 'a long exhale must not be refused for being long');
});

test('a breath begun before the window opens does not score late', () => {
  // The mirror, and the reason the latch is not just "expected at either end".
  // This is the audible inhale #27 was opened for: it begins in the inhale
  // window and is still running when the exhale prompt starts.
  const gate = createExhaleGate();
  gate.setExpected(false);

  gate.onset();
  gate.setExpected(true);

  equal(gate.resolve(), false, 'an inhale must not be rescued by the next prompt');
});

test('the window reopening and closing again mid-breath changes nothing', () => {
  const gate = createExhaleGate();
  gate.setExpected(true);

  gate.onset();
  gate.setExpected(false);
  gate.setExpected(true);
  gate.setExpected(false);

  equal(gate.resolve(), true);
});

test('each breath is judged by the window it began in, not the one before it', () => {
  const gate = createExhaleGate();

  gate.setExpected(true);
  gate.onset();
  equal(gate.resolve(), true, 'first breath');

  gate.setExpected(false);
  gate.onset();
  equal(gate.resolve(), false, 'second breath');

  gate.setExpected(true);
  gate.onset();
  equal(gate.resolve(), true, 'third breath');
});

test('the current expectation is readable, for the debug meter', () => {
  const gate = createExhaleGate();
  equal(gate.expected, true, 'defaults to expected');

  gate.setExpected(false);
  equal(gate.expected, false);

  // Reading it must not disturb a breath already in flight.
  gate.onset();
  gate.setExpected(true);
  equal(gate.expected, true, 'reports the window, not the latch');
  equal(gate.resolve(), false, 'while the breath keeps its own answer');
});

test('a breath resolved without an onset falls back to the current window', () => {
  // Should not arise — every completed exhale passes through the open state
  // first — but a gate that throws or silently scores here would turn a
  // detector change into a scoring bug, so it is pinned rather than left open.
  const gate = createExhaleGate();
  gate.setExpected(false);

  equal(gate.resolve(), false);
});

test('a reset gate is back to free-breathing', () => {
  const gate = createExhaleGate();
  gate.setExpected(false);
  gate.onset();

  gate.reset();

  equal(gate.expected, true);
  gate.onset();
  equal(gate.resolve(), true);
});
