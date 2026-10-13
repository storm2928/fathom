/**
 * Mobile test entry. Same harness as the website's suite:
 *
 *     npm test -w mobile
 */
import './smoke.test.ts';
import '../app/flow.test.ts';
import '../app/storage.test.ts';
import { runAll } from '@fathom/game/testing/harness.ts';

await runAll();
