import { Capacitor } from '@capacitor/core';
import { deviceKind } from './platform';

/** Decided once, at startup: the app does not change device mid-dive. */
export const IS_NATIVE = Capacitor.isNativePlatform();

const finePointer =
  typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

export const DEVICE = deviceKind(IS_NATIVE, finePointer);
