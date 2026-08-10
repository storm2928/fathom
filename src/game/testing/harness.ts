/**
 * A test harness in thirty lines, because the alternatives both cost more.
 *
 * `node:test` and `node:assert` would need `"node"` in the `types` field of
 * `tsconfig.app.json`, and any real runner would need a devDependency — both are
 * shared-file changes that need sign-off from the other lane. This needs
 * neither, imports nothing, and runs on the TypeScript directly:
 *
 *     node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 *
 * It throws on failure, so the process exits non-zero and CI or a shell can tell
 * whether it passed. If we later agree to add a real runner, the test files
 * change one import line and nothing else.
 */

interface Case {
  name: string;
  fn: () => void;
}

const cases: Case[] = [];

export function test(name: string, fn: () => void): void {
  cases.push({ name, fn });
}

export function assert(condition: unknown, message = 'assertion failed'): void {
  if (!condition) throw new Error(message);
}

export function equal(actual: unknown, expected: unknown, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message ?? 'values differ'}\n    expected: ${String(expected)}\n    actual:   ${String(actual)}`,
    );
  }
}

/** Runs everything registered so far. Throws if any case failed. */
export function runAll(): void {
  const failures: { name: string; error: unknown }[] = [];

  for (const { name, fn } of cases) {
    try {
      fn();
      console.log(`  ok   ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.log(`  FAIL ${name}`);
    }
  }

  console.log(`\n${cases.length - failures.length}/${cases.length} passed`);

  if (failures.length > 0) {
    for (const { name, error } of failures) {
      console.log(`\n${name}\n  ${error instanceof Error ? error.message : String(error)}`);
    }
    throw new Error(`${failures.length} test(s) failed`);
  }
}
