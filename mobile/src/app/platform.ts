/**
 * Which words and which settings fit the device the game is running on. The
 * iPhone app is `native`; a browser is `desktop` when its main pointer is a
 * mouse or trackpad, and `touch-web` otherwise (a phone or tablet browser).
 */
export type DeviceKind = 'native' | 'desktop' | 'touch-web';

export function deviceKind(native: boolean, finePointer: boolean): DeviceKind {
  if (native) return 'native';
  return finePointer ? 'desktop' : 'touch-web';
}
