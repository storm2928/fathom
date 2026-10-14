import { Capacitor, registerPlugin } from '@capacitor/core';

/** The app's haptics plugin (ios/App/App/FathomHapticsPlugin.swift). */
interface FathomHapticsPlugin {
  exhaleStart(options: { intensity: number }): Promise<void>;
  exhaleLevel(options: { intensity: number }): Promise<void>;
  exhaleStop(): Promise<void>;
  tap(options: { kind: 'inhale' | 'zone' | 'onset' | 'discovery' }): Promise<void>;
}

const plugin = registerPlugin<FathomHapticsPlugin>('FathomHaptics');
const native = Capacitor.isNativePlatform();
const quietly = (p: Promise<void>) => void p.catch(() => {});

/** Every call is a no-op in a browser, and never throws. */
export const haptics = {
  exhaleStart: (intensity: number) => native && quietly(plugin.exhaleStart({ intensity })),
  exhaleLevel: (intensity: number) => native && quietly(plugin.exhaleLevel({ intensity })),
  exhaleStop: () => native && quietly(plugin.exhaleStop()),
  tap: (kind: 'inhale' | 'zone' | 'onset' | 'discovery') => native && quietly(plugin.tap({ kind })),
};
