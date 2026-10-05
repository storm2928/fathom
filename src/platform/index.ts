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
