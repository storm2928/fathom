import { Capacitor, registerPlugin } from '@capacitor/core';

/** The app's Apple Health plugin (ios/App/App/FathomHealthPlugin.swift). */
interface FathomHealthPlugin {
  available(): Promise<{ available: boolean }>;
  authorize(): Promise<{ granted: boolean }>;
  saveMindful(options: { start: number; end: number }): Promise<void>;
}

const plugin = registerPlugin<FathomHealthPlugin>('FathomHealth');
const native = Capacitor.isNativePlatform();

/** Unavailable in a browser. Never throws: a failed write is not the player's problem. */
export const health = {
  available: async (): Promise<boolean> =>
    native ? (await plugin.available().catch(() => ({ available: false }))).available : false,
  authorize: async (): Promise<boolean> =>
    native ? (await plugin.authorize().catch(() => ({ granted: false }))).granted : false,
  saveMindful: async (start: Date, end: Date): Promise<void> => {
    if (!native) return;
    await plugin.saveMindful({ start: start.getTime(), end: end.getTime() }).catch(() => {});
  },
};
