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
    let handle: WakeLockHandle;
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
