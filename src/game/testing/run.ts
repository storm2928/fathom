/**
 * Test entry point. Runs on the TypeScript directly with no build step and no
 * dependencies:
 *
 *     node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 *
 * Add a new suite by importing it here. Exits non-zero when anything fails.
 */
import './../input/rateEstimator.test.ts';
import './../scene/descent.test.ts';
import './../session/cycleShape.test.ts';
import './../session/conductor.test.ts';
import { runAll } from './harness.ts';

runAll();
