/**
 * Lets the tests import the app's modules unchanged.
 *
 * The source uses extensionless relative imports (`./cycleShape`) because that
 * is what the bundler expects. Node's ESM resolver requires a real filename, so
 * without this every test that reaches a module with runtime imports fails to
 * resolve. Rewriting the imports across the lane to suit the test runner would
 * be the tail wagging the dog, so the runner adapts instead.
 *
 * Used only when running tests:
 *
 *     node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */
import { registerHooks } from 'node:module';

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !HAS_EXTENSION.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // Fall through — let Node report the original failure rather than a
        // confusing one about a file nobody wrote.
      }
    }
    return nextResolve(specifier, context);
  },
});
