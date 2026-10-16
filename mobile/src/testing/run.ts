/**
 * Mobile test entry. Same harness as the website's suite:
 *
 *     npm test -w mobile
 */
import './smoke.test.ts';
import '../app/flow.test.ts';
import '../app/storage.test.ts';
import '../app/persistentStore.test.ts';
import '../dive/diveController.test.ts';
import '../dive/unheardWatch.test.ts';
import '../native/nativeMicCapture.test.ts';
import '../screens/resultsFormat.test.ts';
import '../sound/soundDirector.test.ts';
import '../haptics/hapticDirector.test.ts';
import '../journal/discovery.test.ts';
import '../journal/journalStore.test.ts';
import '../privacy/policy.test.ts';
import { runAll } from '@fathom/game/testing/harness.ts';

await runAll();
