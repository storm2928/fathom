import { registerPlugin } from '@capacitor/core';
import type { FathomMicPlugin } from './nativeMicCapture';

/** The app's own microphone plugin (ios/App/App/FathomMicPlugin.swift). */
export const FathomMic = registerPlugin<FathomMicPlugin>('FathomMic');
