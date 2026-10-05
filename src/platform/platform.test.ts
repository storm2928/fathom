import { test, assert, equal } from '../game/testing/harness.ts';
import { createPlatform } from './platform.ts';
import type { WakeLockHandle } from './platform.ts';

/**
 * The platform seam: haptics, keep-awake, and whether this is the app.
 *
 * The rule under test is that nothing here can stop a dive. A plugin that is
 * missing or rejects, or a browser without a wake lock, is a quieter dive, not
 * a broken one.
 */

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fakeWakeLock(fail = false) {
  const log: string[] = [];
  return {
    log,
    api: {
      request(): Promise<WakeLockHandle> {
        log.push('request');
        if (fail) return Promise.reject(new Error('NotAllowedError'));
        return Promise.resolve({
          release() {
            log.push('release');
            return Promise.resolve();
          },
        });
      },
    },
  };
}

function fakeVisibility() {
  let handler: (() => void) | null = null;
  return {
    visibilityState: 'visible',
    addEventListener(_type: 'visibilitychange', h: () => void) {
      handler = h;
    },
    fire(state: 'visible' | 'hidden') {
      this.visibilityState = state;
      handler?.();
    },
  };
}

test('the website reports that it is not the app', () => {
  equal(createPlatform({ native: false }).isNativeApp(), false);
  equal(createPlatform({ native: true }).isNativeApp(), true);
});

test('haptics never fire on the website', () => {
  const calls: string[] = [];
  const platform = createPlatform({
    native: false,
    haptics: { impact: (s) => (calls.push(s), Promise.resolve()) },
  });
  platform.haptic('prompt');
  equal(calls.length, 0, 'the website vibrated');
});

test('in the app, prompts tap lightly and surfacing taps harder', () => {
  const calls: string[] = [];
  const platform = createPlatform({
    native: true,
    haptics: { impact: (s) => (calls.push(s), Promise.resolve()) },
  });
  platform.haptic('prompt');
  platform.haptic('surface');
  equal(calls.join(','), 'light,medium');
});

test('a haptics plugin that rejects or throws does not reach the dive', async () => {
  const rejecting = createPlatform({
    native: true,
    haptics: { impact: () => Promise.reject(new Error('no vibrator')) },
  });
  const throwing = createPlatform({
    native: true,
    haptics: {
      impact: () => {
        throw new Error('plugin not implemented');
      },
    },
  });
  rejecting.haptic('prompt');
  throwing.haptic('surface');
  await flush();
  // Reaching this line without an unhandled rejection is the assertion.
  assert(true);
});

test('on the website, keeping awake takes a wake lock and letting go releases it', async () => {
  const lock = fakeWakeLock();
  const platform = createPlatform({ native: false, wakeLock: lock.api });
  await platform.keepAwake(true);
  await platform.keepAwake(false);
  equal(lock.log.join(','), 'request,release');
});

test('a refused wake lock or a browser without one is not an error', async () => {
  await createPlatform({ native: false, wakeLock: fakeWakeLock(true).api }).keepAwake(true);
  await createPlatform({ native: false }).keepAwake(true);
  assert(true);
});

test('the wake lock is taken again when a hidden tab comes back mid-dive', async () => {
  const lock = fakeWakeLock();
  const visibility = fakeVisibility();
  const platform = createPlatform({ native: false, wakeLock: lock.api, visibility });
  await platform.keepAwake(true);
  visibility.fire('hidden');
  visibility.fire('visible');
  await flush();
  equal(lock.log.join(','), 'request,request', 'the lock the browser dropped was not re-taken');
});

test('a tab coming back after the dive does not take a wake lock', async () => {
  const lock = fakeWakeLock();
  const visibility = fakeVisibility();
  const platform = createPlatform({ native: false, wakeLock: lock.api, visibility });
  await platform.keepAwake(true);
  await platform.keepAwake(false);
  visibility.fire('hidden');
  visibility.fire('visible');
  await flush();
  equal(lock.log.join(','), 'request,release');
});

test('letting go while the wake lock request is still pending gives it straight back', async () => {
  const lock = fakeWakeLock();
  const platform = createPlatform({ native: false, wakeLock: lock.api });
  const pending = platform.keepAwake(true);
  await platform.keepAwake(false);
  await pending;
  await flush();
  equal(lock.log.join(','), 'request,release', 'the screen was left awake after the dive');
});

test('in the app, keep-awake uses the plugin and not the browser API', async () => {
  const calls: string[] = [];
  const lock = fakeWakeLock();
  const platform = createPlatform({
    native: true,
    wakeLock: lock.api,
    nativeKeepAwake: {
      keepAwake: () => (calls.push('on'), Promise.resolve()),
      allowSleep: () => (calls.push('off'), Promise.resolve()),
    },
  });
  await platform.keepAwake(true);
  await platform.keepAwake(false);
  equal(calls.join(','), 'on,off');
  equal(lock.log.length, 0, 'the app used the browser wake lock');
});

test('a keep-awake plugin that rejects does not reach the dive', async () => {
  const platform = createPlatform({
    native: true,
    nativeKeepAwake: {
      keepAwake: () => Promise.reject(new Error('unavailable')),
      allowSleep: () => Promise.reject(new Error('unavailable')),
    },
  });
  await platform.keepAwake(true);
  await platform.keepAwake(false);
  assert(true);
});
