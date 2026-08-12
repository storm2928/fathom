/**
 * Test entry point. Runs on the TypeScript directly with no build step and no
 * dependencies:
 *
 *     node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 *
 * Add a new suite by importing it here. Exits non-zero when anything fails.
 */
import './../../breath/exhaleGate.test.ts';
import './../../breath/engine.test.ts';
import './../../breath/exhaleTarget.test.ts';
import './../input/rateEstimator.test.ts';
import './../scene/descent.test.ts';
import './../session/cycleShape.test.ts';
import './../session/conductor.test.ts';
import './../session/sessionMachine.test.ts';
import { runAll } from './harness.ts';

await runAll();
