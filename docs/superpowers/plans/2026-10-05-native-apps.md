# Fathom Native Apps (Phase 1: shared work + Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fathom playable as an installed Android app (iOS follows once Xcode is available) from the same codebase as the website, with touch input, keep-awake and haptics.

**Architecture:** Capacitor wraps the existing Vite build. Everything platform-specific sits behind `src/platform/` (a pure `createPlatform(deps)` plus a thin wiring file), so game code never checks the platform. Touch input shares one `HoldBreathEngine` base with the existing spacebar engine.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Pixi.js 8, Capacitor 8.5 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/haptics` 8, `@capacitor-community/keep-awake` 8), the repo's own test harness (`src/game/testing/`), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-05-native-apps-design.md`

**Refinements to the spec found while planning (no behaviour change):**
- `InputPlan.fallback` becomes `{ create, code }` instead of a separate `fallbackCode` field, so an engine and its label can't be paired wrongly.
- The touch engine and spacebar engine share a `HoldBreathEngine` base rather than duplicating ~150 lines.
- Node must be ≥ 22.18 (Task 0): Capacitor 8 CLI requires Node ≥ 22, and the test runner needs Node's built-in TypeScript type stripping plus `module.registerHooks`.

## Global Constraints

- App ID: `dev.fathom.placeholder`; app name: `Fathom`.
- Portrait only.
- `npm run build`, `render.yaml` and website behaviour on desktop are unchanged.
- Haptics are app-only (no-op on the website). Keep-awake uses the Capacitor plugin in the app and the Screen Wake Lock API on the website.
- Platform wrappers never throw and never stop a dive.
- Dive log save button and its note are not rendered when `isNativeApp()`.
- New `InputCode` value is exactly `'touch'`. Fallback labels are named, never derived (#32).
- Every user-facing string lives in `src/shell/strings/*` with an English and a French twin (`fr: typeof en`).
- Touch replaces the spacebar when `matchMedia('(pointer: coarse)')` matches; desktop keeps the spacebar.
- Lanes: `src/breath/` belongs to the signal lane — this plan does not modify it.
- Test command: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`. New suites are imported in `src/game/testing/run.ts`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A second finger lands mid-exhale** (two-handed grip, palm on the edge): the exhale continues; only the first finger lifting ends it. → Task 2 test.
2. **Tapping Leave or Dismiss during a dive** must not start an exhale. → Task 2 test (ignore hook) + Task 2 `isInteractive` uses `closest()` so taps on a button's icon count as the button.
3. **App backgrounded or call comes in mid-hold** (`pointercancel` / hidden page): the exhale ends rather than running on. → Task 2 test.
4. **Website tab hidden and shown again mid-dive**: the browser drops the wake lock; it must be re-acquired. → Task 1 test.
5. **A native plugin is missing or rejects** (haptics on an emulator with no vibrator, keep-awake failing): the dive continues silently. → Task 1 tests.

---

### Task 0: Node 22+ and a green baseline (owner action)

**Files:** none.

- [ ] **Step 1: Ask the owner to install Node 24 LTS** (current Node is 20.13.1 at `/usr/local/bin/node`). Either the macOS installer from https://nodejs.org (replaces `/usr/local/bin/node`) or `brew install node@24 && brew link --overwrite node@24`. This is a system change: do not do it without the owner's go-ahead.

- [ ] **Step 2: Verify**

Run: `node -v`
Expected: `v24.x` (anything ≥ `v22.18.0` is acceptable)

- [ ] **Step 3: Run the existing suite in the worktree**

Run (in `~/Desktop/fathom-app`): `npm ci && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: ends with `N/N passed`, exit code 0. If anything fails here, stop and report — it is a pre-existing failure, not ours.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

---

### Task 1: `src/platform/` — haptics, keep-awake, native detection

**Files:**
- Create: `src/platform/platform.ts`
- Create: `src/platform/index.ts`
- Test: `src/platform/platform.test.ts`
- Modify: `src/game/testing/run.ts` (import the new suite)
- Modify: `package.json`, `package-lock.json` (dependencies)

**Interfaces:**
- Produces (from `src/platform/index.ts`): `isNativeApp(): boolean`, `keepAwake(on: boolean): Promise<void>`, `haptic(kind: HapticKind): void`, type `HapticKind = 'prompt' | 'surface'`.
- Produces (from `src/platform/platform.ts`): `createPlatform(deps: PlatformDeps): Platform` (tests only).

- [ ] **Step 1: Install dependencies**

Run: `npm install @capacitor/core@^8.5.2 @capacitor/haptics@^8.0.2 @capacitor-community/keep-awake@^8.0.1`

- [ ] **Step 2: Write the failing tests** — `src/platform/platform.test.ts`

```ts
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
```

Add to `src/game/testing/run.ts`, after the last suite import:

```ts
import './../../platform/platform.test.ts';
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: FAIL — cannot find module `./platform.ts`.

- [ ] **Step 4: Implement** — `src/platform/platform.ts`

```ts
/**
 * Everything that differs between the website and the installed app, behind
 * one seam, so the game never asks which one it is running in.
 *
 * Built from injected pieces rather than importing Capacitor here, so the rules
 * can be tested without a browser or a phone. The rule that matters most:
 * nothing in here may stop a dive. A missing plugin, a refused wake lock or a
 * phone without a vibrator makes for a quieter dive, never a broken one.
 */

export type HapticKind = 'prompt' | 'surface';

export interface WakeLockHandle {
  release(): Promise<void>;
}

export interface PlatformDeps {
  /** running inside the Capacitor app */
  native: boolean;
  haptics?: { impact(style: 'light' | 'medium'): Promise<void> };
  nativeKeepAwake?: { keepAwake(): Promise<void>; allowSleep(): Promise<void> };
  /** the browser's Screen Wake Lock API, where it exists */
  wakeLock?: { request(type: 'screen'): Promise<WakeLockHandle> };
  /** the document, for re-taking a wake lock the browser dropped while hidden */
  visibility?: {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', handler: () => void): void;
  };
}

export interface Platform {
  isNativeApp(): boolean;
  keepAwake(on: boolean): Promise<void>;
  haptic(kind: HapticKind): void;
}

export function createPlatform(deps: PlatformDeps): Platform {
  let wanted = false;
  let held: WakeLockHandle | null = null;

  const takeWebLock = async () => {
    if (!deps.wakeLock || held) return;
    let handle: WakeLockHandle | null = null;
    try {
      handle = await deps.wakeLock.request('screen');
    } catch {
      return;
    }
    // Let go of while the request was in flight: hand it straight back rather
    // than leaving the screen awake after the dive.
    if (!wanted) {
      await handle.release().catch(() => {});
      return;
    }
    held = handle;
  };

  // The browser releases a wake lock whenever the page is hidden. Coming back
  // mid-dive, it is taken again; coming back afterwards, it is not.
  deps.visibility?.addEventListener('visibilitychange', () => {
    if (deps.native || !wanted || deps.visibility?.visibilityState !== 'visible') return;
    held = null;
    void takeWebLock();
  });

  return {
    isNativeApp: () => deps.native,

    async keepAwake(on) {
      wanted = on;
      try {
        if (deps.native) {
          if (!deps.nativeKeepAwake) return;
          await (on ? deps.nativeKeepAwake.keepAwake() : deps.nativeKeepAwake.allowSleep());
          return;
        }
        if (on) {
          await takeWebLock();
        } else if (held) {
          const handle = held;
          held = null;
          await handle.release();
        }
      } catch {
        // Never stops a dive. See above.
      }
    },

    haptic(kind) {
      if (!deps.native || !deps.haptics) return;
      try {
        void deps.haptics.impact(kind === 'surface' ? 'medium' : 'light').catch(() => {});
      } catch {
        // A plugin that throws synchronously is as harmless as one that rejects.
      }
    },
  };
}
```

`src/platform/index.ts`:

```ts
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { createPlatform } from './platform';

export type { HapticKind } from './platform';

/**
 * The real platform, wired once. Game code imports these three functions and
 * nothing else from here.
 */
const platform = createPlatform({
  native: Capacitor.isNativePlatform(),
  haptics: {
    impact: (style) =>
      Haptics.impact({ style: style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }),
  },
  nativeKeepAwake: KeepAwake,
  wakeLock: 'wakeLock' in navigator ? navigator.wakeLock : undefined,
  visibility: document,
});

export const isNativeApp = (): boolean => platform.isNativeApp();
export const keepAwake = (on: boolean): Promise<void> => platform.keepAwake(on);
export const haptic: typeof platform.haptic = (kind) => platform.haptic(kind);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: all pass, including the 11 new platform cases.

- [ ] **Step 6: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed (index.ts is not yet imported by the app; the build type-checks it).

- [ ] **Step 7: Commit**

```bash
git add src/platform src/game/testing/run.ts package.json package-lock.json
git commit -m "Add the platform seam for haptics and keep-awake

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `HoldBreathEngine` base and the touch engine

**Files:**
- Create: `src/game/input/holdEngine.ts`
- Create: `src/game/input/touchHoldEngine.ts`
- Modify: `src/game/input/spacebarEngine.ts` (becomes a subclass; behaviour unchanged)
- Test: `src/game/input/holdEngines.test.ts`
- Modify: `src/game/testing/run.ts`

**Interfaces:**
- Produces: `abstract class HoldBreathEngine implements BreathEngine` with `protected press(): void`, `protected release(): void`, `protected readonly interrupt: () => void`, `protected get isRunning(): boolean`, `protected get holding(): boolean`, `protected abstract bind(): void`, `protected abstract unbind(): void`; `interface HoldEngineOptions { targetExhaleMs?: number; minHoldMs?: number; calibrationMs?: number }`; `isInteractive(target: EventTarget | null): boolean`.
- Produces: `class TouchHoldEngine extends HoldBreathEngine`, options `TouchHoldEngineOptions extends HoldEngineOptions { target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>; ignore?: (target: EventTarget | null) => boolean }`.
- `SpacebarBreathEngine` keeps its exported name and `SpacebarEngineOptions` (now `extends HoldEngineOptions` plus `target?`).

- [ ] **Step 1: Write the failing tests** — `src/game/input/holdEngines.test.ts`

```ts
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
```

Add to `src/game/testing/run.ts` after the `inputSource.test.ts` import:

```ts
import './../input/holdEngines.test.ts';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: FAIL — cannot find module `./touchHoldEngine.ts`.

- [ ] **Step 3: Create `src/game/input/holdEngine.ts`**

Move the shared logic out of `spacebarEngine.ts` unchanged in behaviour. Two Node-safety changes: `document` and `Element` are checked with `typeof` before use, so the engines can be tested without a DOM.

```ts
import type { BreathEngine, BreathEventMap, CalibrationResult } from '../../breath/types';
import { BreathEmitter } from './emitter';
import { RateEstimator } from './rateEstimator';

/**
 * Hold something down for as long as you are exhaling: the spacebar, or a
 * finger on the screen.
 *
 * Every event is shaped exactly like the microphone's, so nothing downstream
 * has to know which input is driving. What a hold honestly cannot do is judge
 * smoothness — it is down or it is not — so quality is length against the
 * target and nothing else.
 *
 * Subclasses only translate their own events into `press()` and `release()`.
 */

export interface HoldEngineOptions {
  /** exhale length that scores full marks, ms */
  targetExhaleMs?: number;
  /** holds shorter than this are taps, not breaths */
  minHoldMs?: number;
  /** how long calibrate() listens before reporting a baseline */
  calibrationMs?: number;
}

const DEFAULTS: Required<HoldEngineOptions> = {
  targetExhaleMs: 6_000,
  minHoldMs: 400,
  calibrationMs: 10_000,
};

/** Rate reported when calibration saw too few breaths to measure one. */
const ASSUMED_BASELINE_RR = 15;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Controls that already mean something when pressed, tapped or spaced. */
const INTERACTIVE =
  'button, a, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"])';

/**
 * Whether an event landed on (or inside) a control. `closest` rather than the
 * tag name, because a tap on a button's icon targets the SVG, not the button.
 */
export function isInteractive(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(INTERACTIVE) !== null;
}

export abstract class HoldBreathEngine implements BreathEngine {
  readonly usingFallbackInput = true;

  private readonly emitter = new BreathEmitter();
  private readonly rate = new RateEstimator();
  private readonly cfg: Required<HoldEngineOptions>;

  private running = false;
  private startedAt = 0;
  private holdStartedAt: number | null = null;
  private scored = 0;

  constructor(options: HoldEngineOptions = {}) {
    this.cfg = {
      targetExhaleMs: options.targetExhaleMs ?? DEFAULTS.targetExhaleMs,
      minHoldMs: options.minHoldMs ?? DEFAULTS.minHoldMs,
      calibrationMs: options.calibrationMs ?? DEFAULTS.calibrationMs,
    };
  }

  /** Attach this input's own listeners. */
  protected abstract bind(): void;
  /** Remove them. */
  protected abstract unbind(): void;

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.startedAt = performance.now();
    this.scored = 0;
    this.rate.reset();

    this.bind();
    // A hold whose release never arrives — the app backgrounded, a lost focus —
    // would leave an exhale open forever and report an absurd duration later.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.interrupt);
    }

    // Nothing is being sensed, and the session should say so rather than let a
    // green light imply a microphone is working.
    this.emitter.emit('signal-quality', { level: 'good' });
    return Promise.resolve();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.abandonHold();

    this.unbind();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.interrupt);
    }
  }

  /**
   * Baseline read. Someone using a hold is asked to hold for the length of
   * their real exhale, so onset-to-onset still measures their actual breathing
   * rate — but if they did not press at all there is nothing to measure, and
   * saying so beats inventing a number the surface screen would later compare
   * against.
   */
  calibrate(): Promise<CalibrationResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const measured = this.rate.breathsPerMin();
        resolve({
          baselineRR: measured ?? ASSUMED_BASELINE_RR,
          // No microphone, so there is no room to measure. Reported as silent
          // rather than as a plausible-looking floor that was never sampled.
          noiseFloor: 0,
          ok: measured !== null,
        });
      }, this.cfg.calibrationMs);
    });
  }

  on<K extends keyof BreathEventMap>(
    event: K,
    handler: (payload: BreathEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  /**
   * Deliberately inert, and that is the point.
   *
   * The #27 gate exists to stop an *acoustic* false positive: an audible inhale
   * is broadband noise the detector cannot tell from an exhale. A hold cannot
   * produce that false positive — the person says when the exhale starts and
   * when it ends. Applying the filter here would only throw away real breaths,
   * which is what reported a breather at half their true rate in #29.
   *
   * The method stays so the conductor can attach to any input without asking
   * what kind it is.
   */
  setExhaleExpected(): void {
    // Intentionally does nothing. See above.
  }

  /** Exhales accepted so far, for a shell that wants to confirm input is landing. */
  get scoredExhales(): number {
    return this.scored;
  }

  // ------------------------------------------------------- for subclasses

  protected get isRunning(): boolean {
    return this.running;
  }

  protected get holding(): boolean {
    return this.holdStartedAt !== null;
  }

  /** The exhale starts now. Ignored while one is already in flight. */
  protected press(): void {
    if (!this.running || this.holdStartedAt !== null) return;
    const at = this.elapsed();
    this.holdStartedAt = at;
    this.rate.mark(at);
    this.emitter.emit('phase-change', { phase: 'exhale', at });
  }

  /** The exhale ends now: scored if long enough, discarded as a tap if not. */
  protected release(): void {
    const startedAt = this.holdStartedAt;
    if (startedAt === null) return;
    this.holdStartedAt = null;

    const at = this.elapsed();
    const durationMs = at - startedAt;

    if (durationMs < this.cfg.minHoldMs) {
      // A tap, not a breath. Discarded rather than skipped: nothing happened
      // here, so the breaths either side of it are still adjacent.
      this.rate.discard();
      this.emitter.emit('phase-change', { phase: 'idle', at });
      return;
    }

    this.scored += 1;
    this.emitter.emit('exhale-end', {
      durationMs,
      quality: clamp01(durationMs / this.cfg.targetExhaleMs),
    });
    const breathsPerMin = this.rate.breathsPerMin();
    if (breathsPerMin !== null) {
      // Confidence is high because there is nothing to misread — the person
      // said when the exhale started and when it ended.
      this.emitter.emit('rr-update', { breathsPerMin, confidence: 0.95 });
    }

    this.emitter.emit('phase-change', { phase: 'idle', at });
  }

  /** Focus or visibility lost: end the breath where it stood rather than letting it run on. */
  protected readonly interrupt = () => {
    this.release();
  };

  // ------------------------------------------------------------- internals

  private elapsed(): number {
    return performance.now() - this.startedAt;
  }

  /** Drop an in-flight hold without scoring it, on stop. */
  private abandonHold(): void {
    if (this.holdStartedAt === null) return;
    this.holdStartedAt = null;
    // Abandoned on stop, so no breath was completed to measure.
    this.rate.discard();
    this.emitter.emit('phase-change', { phase: 'idle', at: this.elapsed() });
  }
}
```

- [ ] **Step 4: Replace `src/game/input/spacebarEngine.ts` with the subclass**

```ts
import { HoldBreathEngine, isInteractive } from './holdEngine';
import type { HoldEngineOptions } from './holdEngine';

/**
 * Hold the spacebar for as long as you are exhaling.
 *
 * This is a first-class way to play, not a consolation prize. It is offered
 * before a session starts, it is what someone uses in a room too loud for the
 * microphone or on a machine that refuses permission, and it is the path a
 * desktop falls back to if the microphone does not clear its gate. The breath
 * logic lives in `HoldBreathEngine`; this only reads the key.
 */

export interface SpacebarEngineOptions extends HoldEngineOptions {
  /** where key events are listened for; injectable for tests */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

export class SpacebarBreathEngine extends HoldBreathEngine {
  private readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

  constructor(options: SpacebarEngineOptions = {}) {
    super(options);
    this.target = options.target ?? window;
  }

  protected bind(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.interrupt);
  }

  protected unbind(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.interrupt);
  }

  private readonly onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || key.repeat || !this.isRunning) return;
    // Space is how a keyboard user presses a focused button. Swallowing it
    // everywhere would make the app unusable without a mouse, which is a steep
    // price for a breath. Anything focusable keeps its own meaning for Space.
    if (isInteractive(event.target)) return;
    // Otherwise the page scrolls under the diver on every breath.
    key.preventDefault();
    this.press();
  };

  private readonly onKeyUp = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== 'Space' || !this.isRunning) return;
    // No hold in flight means the keydown was ignored — on a button, say — so
    // this keyup is not ours to consume either.
    if (!this.holding) return;
    key.preventDefault();
    this.release();
  };
}
```

- [ ] **Step 5: Create `src/game/input/touchHoldEngine.ts`**

```ts
import { HoldBreathEngine, isInteractive } from './holdEngine';
import type { HoldEngineOptions } from './holdEngine';

/**
 * Hold a finger on the screen for as long as you are exhaling.
 *
 * The phone's spacebar: what a phone falls back to when the microphone is
 * refused, and a first-class choice in a room too loud for it. The breath
 * logic lives in `HoldBreathEngine`; this only reads the touch.
 *
 * One finger is the breath. A second finger landing — a thumb shifting its
 * grip — neither restarts the exhale nor ends it; only the finger that started
 * it can.
 */

export interface TouchHoldEngineOptions extends HoldEngineOptions {
  /** where pointer events are listened for; injectable for tests */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** touches that are not breaths — a tap on Leave, say; injectable for tests */
  ignore?: (target: EventTarget | null) => boolean;
}

export class TouchHoldEngine extends HoldBreathEngine {
  private readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  private readonly ignore: (target: EventTarget | null) => boolean;
  private pointerId: number | null = null;

  constructor(options: TouchHoldEngineOptions = {}) {
    super(options);
    this.target = options.target ?? window;
    this.ignore = options.ignore ?? isInteractive;
  }

  protected bind(): void {
    this.target.addEventListener('pointerdown', this.onDown);
    this.target.addEventListener('pointerup', this.onEnd);
    this.target.addEventListener('pointercancel', this.onEnd);
    this.target.addEventListener('blur', this.interrupt);
  }

  protected unbind(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointerup', this.onEnd);
    this.target.removeEventListener('pointercancel', this.onEnd);
    this.target.removeEventListener('blur', this.interrupt);
    this.pointerId = null;
  }

  private readonly onDown = (event: Event) => {
    if (!this.isRunning || this.holding) return;
    // The HUD's buttons sit over the scene. Tapping one is not a breath.
    if (this.ignore(event.target)) return;
    this.pointerId = (event as PointerEvent).pointerId;
    this.press();
  };

  private readonly onEnd = (event: Event) => {
    if (!this.holding || (event as PointerEvent).pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.release();
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: all pass, including the 8 new hold-engine cases.

- [ ] **Step 7: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed. `DiveView.tsx` still constructs `SpacebarBreathEngine({ calibrationMs })` and compiles unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/game/input src/game/testing/run.ts
git commit -m "Add touch-and-hold input on a shared hold engine

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Touch as an input choice and the phone's microphone fallback

**Files:**
- Modify: `src/game/surface/diveLog.ts:19` (`InputCode`)
- Modify: `src/game/input/inputSource.ts` (`InputSource`, `InputPlan.fallback`, `startInput`)
- Create: `src/game/input/holdInput.ts`
- Modify: `src/game/input/inputSource.test.ts`
- Test: `src/game/input/holdInput.test.ts`
- Modify: `src/game/testing/run.ts`
- Modify: `src/shell/strings/setup.ts`, `src/shell/strings/dive.ts`, `src/shell/strings/safety.ts`, `src/shell/strings/how.ts`, `src/shell/strings/surface.ts`
- Modify: `src/shell/ui/icons.tsx`, `src/shell/ui/index.ts` (`IconTouch`)
- Modify: `src/game/scene/DiveView.tsx`

**Interfaces:**
- Consumes: `TouchHoldEngine`, `SpacebarBreathEngine` (Task 2).
- Produces: `InputCode = 'microphone' | 'keyboard' | 'touch' | 'scripted'`; `InputSource = 'scripted' | 'spacebar' | 'touch' | 'mic'`; `InputPlan.fallback?: { create: () => BreathEngine; code: InputCode }`; `holdInputFor(coarsePointer: boolean): { source: 'touch' | 'spacebar'; code: 'touch' | 'keyboard' }`.

- [ ] **Step 1: Write the failing tests**

`src/game/input/holdInput.test.ts`:

```ts
import { test, equal } from '../testing/harness.ts';
import { holdInputFor } from './holdInput.ts';

test('a touch screen holds a finger down; a desktop holds the spacebar', () => {
  equal(holdInputFor(true).source, 'touch');
  equal(holdInputFor(true).code, 'touch');
  equal(holdInputFor(false).source, 'spacebar');
  equal(holdInputFor(false).code, 'keyboard');
});
```

In `src/game/input/inputSource.test.ts`, change every `fallback: () => X` to `fallback: { create: () => X, code: 'keyboard' }` (five call sites: the tests "a microphone that starts…", "a microphone that is refused…", "the refused microphone is stopped…", "the reason…", and "a fallback that also fails…"). Then add:

```ts
test('on a phone, a refused microphone hands the dive to touch and says so', async () => {
  const touch = fakeEngine();
  const started = await startInput({
    primary: fakeEngine(new Error('Microphone unavailable: NotAllowedError')),
    code: 'microphone',
    fallback: { create: () => touch, code: 'touch' },
  });

  equal(started.engine, touch);
  equal(started.code, 'touch', 'a touch session was logged as something else');
  equal(started.fellBack, true);
});
```

Add to `src/game/testing/run.ts` after the `holdEngines.test.ts` import:

```ts
import './../input/holdInput.test.ts';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: FAIL — cannot find module `./holdInput.ts` (type errors are not checked by the runner; `npm run build` catches them in Step 6).

- [ ] **Step 3: Implement the input changes**

`src/game/surface/diveLog.ts:19`:

```ts
export type InputCode = 'microphone' | 'keyboard' | 'touch' | 'scripted';
```

`src/game/input/inputSource.ts` — change the type, the `fallback` field and the fallback branch:

```ts
export type InputSource = 'scripted' | 'spacebar' | 'touch' | 'mic';
```

```ts
  /**
   * Built only if `primary` refuses. Present for the microphone and nothing
   * else: a spacebar or fixture that will not start is a bug, and substituting
   * for it silently would make a broken input look like a working one.
   *
   * The code travels with the engine, named rather than derived, because an
   * input that quietly reports something else would put a wrong label in an
   * exported log (#32). A desktop falls back to the keyboard, a phone to touch.
   */
  fallback?: { create: () => BreathEngine; code: InputCode };
```

```ts
    const engine = plan.fallback.create();
    // Deliberately unguarded: if the fallback will not start either there is no
    // way to play, and reporting that as a working dive would be a lie the
    // session would then act on.
    await engine.start();

    return {
      engine,
      code: plan.fallback.code,
      fellBack: true,
      reason: error instanceof Error ? error.message : String(error),
    };
```

`src/game/input/holdInput.ts`:

```ts
import type { InputCode } from '../surface/diveLog';

/**
 * Which hold-to-exhale input this device gets: a finger on a touch screen, the
 * spacebar everywhere else. Decided once by the pointer, so a phone is never
 * told to hold a key it does not have.
 */
export function holdInputFor(coarsePointer: boolean): {
  source: 'touch' | 'spacebar';
  code: Extract<InputCode, 'touch' | 'keyboard'>;
} {
  return coarsePointer ? { source: 'touch', code: 'touch' } : { source: 'spacebar', code: 'keyboard' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`
Expected: all pass.

- [ ] **Step 5: Strings, icon and DiveView**

`src/shell/strings/setup.ts` — in `en`, add after `spacebarDesc`, rename `spacebarNote` to `holdNote`, and add after `micRefused` and `inputKeyboard`:

```ts
  touchTitle: 'Touch',
  touchDesc: 'Hold a finger on the screen for as long as you breathe out. No microphone at all.',
```
```ts
  holdNote: 'The microphone stays off for the whole dive.',
```
```ts
  micRefusedTouch:
    'The microphone was not available, so touch is driving this dive instead — hold a finger on the screen for as long as you are exhaling. ({reason})',
```
```ts
  inputTouch: 'Touch',
```

In `fr`, the same keys:

```ts
  touchTitle: 'Écran tactile',
  touchDesc: "Maintenez un doigt sur l'écran aussi longtemps que vous expirez. Aucun microphone.",
```
```ts
  holdNote: 'Le microphone reste éteint pendant toute la plongée.',
```
```ts
  micRefusedTouch:
    "Le microphone n'était pas disponible : c'est donc l'écran tactile qui pilote cette plongée — maintenez un doigt dessus aussi longtemps que vous expirez. ({reason})",
```
```ts
  inputTouch: 'Écran tactile',
```

`src/shell/strings/dive.ts` — add after `exhaleKey` in `en` and `fr` respectively:

```ts
      exhaleTouch: 'Hold a finger on the screen',
```
```ts
      exhaleTouch: "Maintenez un doigt sur l'écran",
```

Shared copy that names only the spacebar — replace whole strings:

| File / key | English | French |
|---|---|---|
| `safety.ts:22` (en) / `:50` (fr) | `… You can also play the whole thing with the spacebar, or by touch on a phone, and never turn the microphone on at all.` | `… Vous pouvez aussi tout faire à la barre d'espace, ou au toucher sur un téléphone, sans jamais activer le microphone.` |
| `safety.ts:31` / `:59` | `The next screen lets you choose the microphone or a hold — the spacebar, or a finger on a phone. Nothing asks for permission until you pick.` | `L'écran suivant vous laisse choisir le microphone ou un appui maintenu — la barre d'espace, ou un doigt sur un téléphone. Aucune permission n'est demandée avant votre choix.` |
| `how.ts:8` / `:38` | `Choose the microphone or a hold — the spacebar, or a finger on a phone. Two prompted breaths in charge your dive light; one long, slow breath out takes you down.` | `Choisissez le microphone ou un appui maintenu — la barre d'espace, ou un doigt sur un téléphone. Deux inspirations guidées chargent votre lampe ; une longue expiration lente vous fait descendre.` |
| `how.ts:25` / `:55` (`limit1`) | `With a hold, only the length of each exhale can be judged — a key or a finger is down or it is not.` | `Avec un appui maintenu, seule la durée de chaque expiration peut être évaluée — une touche ou un doigt est posé ou ne l'est pas.` |
| `surface.ts:39` / `:77` (`lostFix`) | `A quieter room, or a hold instead of the microphone, will usually fix it.` | `Une pièce plus calme, ou un appui maintenu plutôt que le microphone, règle généralement le problème.` |

(The `…` in the safety row stands for the unchanged first sentence of that string.)

`src/shell/ui/icons.tsx` — add after `IconSpacebar`:

```tsx
export function IconTouch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="14" r="2.5" />
      <path d="M7.8 9.8a6 6 0 0 1 8.4 0" />
      <path d="M5 7a10 10 0 0 1 14 0" />
    </Svg>
  );
}
```

`src/shell/ui/index.ts` — export `IconTouch` beside `IconSpacebar` in the icons export list.

`src/game/scene/DiveView.tsx`:

1. Imports: add `import { TouchHoldEngine } from '../input/touchHoldEngine';`, `import { holdInputFor } from '../input/holdInput';`, and `IconTouch` to the `../../shell/ui` import list.
2. Replace lines 54–55 (`PLAYABLE_SOURCES`, `ALL_SOURCES`) with nothing; they become per-render values (step 4 below).
3. `CODE_LABEL` gains `touch: (t) => t.setup.inputTouch,`; `EXHALE_CAPTION` gains `touch: (t) => t.dive.prompt.exhaleTouch,`.
4. Inside `DiveView`, after `const landscape = …`:

```tsx
  // A phone holds a finger down where a desktop holds the spacebar. Chosen by
  // the pointer, so nobody is told to hold a key they do not have.
  const hold = holdInputFor(useMediaQuery('(pointer: coarse)'));
  const holdEngine = () =>
    hold.source === 'touch'
      ? new TouchHoldEngine({ calibrationMs: CALIBRATION_MS })
      : new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS });
  const playableSources: Source[] = ['mic', hold.source];
  const allSources: Source[] = ['mic', hold.source, 'scripted'];
```

5. In `planFor`, the `'mic'` case becomes:

```tsx
        case 'mic':
          return {
            primary: createBreathEngine(),
            code: 'microphone',
            fallback: { create: holdEngine, code: hold.code },
          };
```

and add a `'touch'` case beside `'spacebar'`; both now use the helper:

```tsx
        case 'spacebar':
        case 'touch':
          return { primary: holdEngine(), code: hold.code };
```

6. The setup `Segmented` maps `(DEV_TOOLS ? allSources : playableSources)`; icon/title/description add the touch branch:

```tsx
                  icon={
                    option === 'mic' ? (
                      <IconMic size={20} />
                    ) : option === 'spacebar' ? (
                      <IconSpacebar size={20} />
                    ) : option === 'touch' ? (
                      <IconTouch size={20} />
                    ) : (
                      <IconNumbers size={20} />
                    )
                  }
                  title={
                    option === 'mic'
                      ? t.setup.micTitle
                      : option === 'spacebar'
                        ? t.setup.spacebarTitle
                        : option === 'touch'
                          ? t.setup.touchTitle
                          : t.setup.scriptedTitle
                  }
                  description={
                    option === 'mic'
                      ? t.setup.micDesc
                      : option === 'spacebar'
                        ? t.setup.spacebarDesc
                        : option === 'touch'
                          ? t.setup.touchDesc
                          : t.setup.scriptedDesc
                  }
```

7. The note under Start: `{source === 'spacebar' && …t.setup.spacebarNote…}` becomes `{(source === 'spacebar' || source === 'touch') && <p className="t-small setup__note">{t.setup.holdNote}</p>}`.
8. The fallback notice text becomes `{fill(inputCode === 'touch' ? t.setup.micRefusedTouch : t.setup.micRefused, { reason: fallbackReason })}`.
9. In `DiveView.tsx`, update the comment on lines 139–140 to say "The hold input (spacebar, or touch on a phone) sits beside it as an equal choice".

- [ ] **Step 6: Tests, build, lint**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm run build && npm run lint`
Expected: all pass. `npm run build` type-checks that every `Record<InputCode, …>` has a `touch` entry and `fr` has every new key.

- [ ] **Step 7: Browser check**

Run `npm run dev`. Desktop browser: setup shows Microphone and Spacebar (unchanged). Chrome DevTools device toolbar (a phone preset, touch on, reload): setup shows Microphone and Touch with the new icon; pick Touch, start a Quick dive, press-and-hold on the scene during "Breathe out" — depth increases; tapping Leave ends the dive and does not start an exhale.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Offer touch-and-hold on touch screens and fall back to it on phones

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Keep-awake, haptics and hiding the dive log in the app

**Files:**
- Modify: `src/game/scene/DiveView.tsx`
- Modify: `src/game/surface/SurfaceScreen.tsx:174-191`

**Interfaces:**
- Consumes: `isNativeApp`, `keepAwake`, `haptic` from `src/platform` (Task 1).

- [ ] **Step 1: Wire keep-awake** — `DiveView.tsx`, import `import { haptic, keepAwake } from '../../platform';` and add after the `data-diving` layout effect:

```tsx
  // The screen stays on for the length of a dive and not a moment longer. A
  // phone that dims mid-exhale has ended the session for the person holding it.
  useEffect(() => {
    if (!running) return;
    void keepAwake(true);
    return () => {
      void keepAwake(false);
    };
  }, [running]);
```

- [ ] **Step 2: Wire haptics** — in the `conductor.on((window) => { … })` handler, first line:

```tsx
      // A light tap on each prompted beat, so the rhythm can be followed with
      // eyes closed. Rest is silence. A no-op on the website.
      if (window.step !== 'rest') haptic('prompt');
```

and in `onResult`, after `scene.settle();`:

```tsx
        haptic('surface');
```

- [ ] **Step 3: Hide the dive log in the app** — `SurfaceScreen.tsx`: import `import { isNativeApp } from '../../platform';`. Wrap the save `Button` (lines 178–186) in `{!isNativeApp() && ( … )}` and the `surface__save-note` paragraph (line 191) the same way, with this comment above the button:

```tsx
            {/* The export is a browser download, which an installed app has
                nowhere to put. The website keeps it; the apps leave it out. */}
```

- [ ] **Step 4: Tests, build, lint**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 5: Browser check**

`npm run dev`, desktop Chrome: start a Quick dive; in DevTools console, `navigator.wakeLock` exists and the dive runs; at the surface the Save dive log button is still shown (website).

- [ ] **Step 6: Commit**

```bash
git add src/game/scene/DiveView.tsx src/game/surface/SurfaceScreen.tsx
git commit -m "Keep the screen awake, tap the rhythm, and drop the download in the app

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Portrait phone layout and safe areas

**Files:**
- Modify: `src/App.css` (`.topnav`, immersive block)
- Modify: `src/game/scene/DiveView.css` (`.hud__top`)
- Modify: other screen CSS only where Step 3 finds a defect

- [ ] **Step 1: Safe-area and touch CSS**

`src/App.css`, in `.topnav`, replace `height: var(--nav-h);` and `padding: 0 var(--page-pad);` with:

```css
  /* The notch. Zero on a desktop, so the website is unchanged. */
  height: calc(var(--nav-h) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) var(--page-pad) 0;
```

`src/App.css`, extend the immersive block:

```css
/* A finger held on the scene is a breath: no text selection, no callout
   menu, no scroll or zoom gesture under it. */
html[data-diving='1'] {
  overflow: hidden;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

`src/game/scene/DiveView.css`, in `.hud__top`, replace `padding: var(--s-4);` with:

```css
  padding: var(--s-4);
  padding-top: calc(var(--s-4) + env(safe-area-inset-top, 0px));
```

- [ ] **Step 2: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Portrait pass at phone size**

`npm run dev`, Playwright browser resized to 390×844, then each route in `src/shell/router.ts` plus a dev scripted Quick dive (10×) through to the surface screen. Screenshot each. Acceptance for every screen: no horizontal scroll (`document.documentElement.scrollWidth <= 390`), no text clipped or overlapping, every button fully visible and at least 44px tall, the tab bar does not cover the last content. Fix defects in the owning CSS file with the smallest change, at `max-width: 599px` (the existing phone breakpoint) so desktop is untouched. Re-screenshot at 1280×800 to confirm desktop is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "Fit the screens to a phone held upright, clear of the notch

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Capacitor and the Android app

**Files:**
- Create: `capacitor.config.ts`
- Create: `android/` (generated, committed)
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `package.json` (scripts, dependencies)

- [ ] **Step 1: Install and initialise**

```bash
npm install @capacitor/android@^8.5.2
npm install -D @capacitor/cli@^8.5.2
npx cap init Fathom dev.fathom.placeholder --web-dir dist
```

Then make `capacitor.config.ts` exactly:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The installed apps load the same `dist/` the website deploys, bundled inside
 * the app, so they work offline and fetch nothing from a server.
 * The app ID is a placeholder until the first store submission.
 */
const config: CapacitorConfig = {
  appId: 'dev.fathom.placeholder',
  appName: 'Fathom',
  webDir: 'dist',
};

export default config;
```

Add to `package.json` scripts: `"build:app": "npm run build && cap sync"`.

- [ ] **Step 2: Add Android**

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run build && npx cap add android
```

If Gradle later fails with `Unsupported class file major version 69` (Android Studio's bundled JDK is 25), install JDK 21 (`brew install --cask temurin@21`, owner approval) and set `JAVA_HOME=$(/usr/libexec/java_home -v 21)`.

- [ ] **Step 3: Manifest** — `android/app/src/main/AndroidManifest.xml`:

On the `<activity android:name=".MainActivity" …>` element add `android:screenOrientation="portrait"`. Before `</manifest>`, beside the existing `INTERNET` permission, add:

```xml
    <!-- Breath is analysed on the device. Nothing is recorded or sent. -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

- [ ] **Step 4: Sync and build the APK**

```bash
npm run build:app
cd android && ./gradlew assembleDebug && cd ..
```

Expected: `BUILD SUCCESSFUL`; `android/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 5: Run on the emulator**

```bash
npx cap run android --list
npx cap run android --target <the Medium_Phone_API_37.0 id from the list>
```

In the emulator's Extended controls (⋯) → Microphone, turn on "Virtual microphone uses host audio input".

- [ ] **Step 6: Device checks** (with the owner; record pass/fail for each)

1. Microphone dive: grant the permission prompt; complete a Quick dive by breathing; depth moves on exhales.
2. Refused microphone: clear app data, start with Microphone, deny the prompt → the touch notice shows and a held finger drives the dive.
3. Touch chosen directly: setup shows Microphone and Touch; Leave works without starting an exhale.
4. Screen stays on through a full Quick dive with a short screen timeout set in emulator settings.
5. Surface screen shows no Save dive log button.
6. Rotating the emulator does not rotate the app.
7. A real Android phone, if available: repeat 1, and confirm haptics on prompts.

If check 1 fails, stop and report the logcat output (`adb logcat | grep -i -E "chromium|capacitor|audio"`) before changing anything.

- [ ] **Step 7: Commit**

```bash
git add capacitor.config.ts android package.json package-lock.json
git commit -m "Add the Android app via Capacitor

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Merge readiness

**Files:** none new.

- [ ] **Step 1: Full verification**

Run: `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 2: Website unchanged**

`npm run preview`, desktop browser at 1280×800: safety, how it works, research and a spacebar Quick dive behave as on `main`; Save dive log is present on the surface screen.

- [ ] **Step 3: Ask the owner before merging** `app` into `main` (pushing `main` deploys the website through Render). On approval:

```bash
cd ~/Desktop/fathom && git merge --no-ff app
```

Do not push without the owner's say-so. The `app` branch and worktree are removed only after the merge lands and the owner agrees.
