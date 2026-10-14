import { Capacitor } from '@capacitor/core';
import { createBreathEngine } from '@fathom/breath/engine';
import { ScriptedBreathEngine } from '@fathom/game/input/scriptedEngine';
import { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import { FathomMic } from '../native/fathomMic';
import { createNativeMicCapture } from '../native/nativeMicCapture';
import type { InputFactories } from './diveController';

/** How long the baseline read listens on the inputs that measure one. */
const CALIBRATION_MS = 10_000;

export const productionInputs: InputFactories = {
  // In the app the microphone is captured natively; in a browser (vite dev)
  // the web worklet does the same job.
  mic: () =>
    Capacitor.isNativePlatform()
      ? createBreathEngine({ capture: createNativeMicCapture(FathomMic) })
      : createBreathEngine(),
  touch: () => new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
  scripted: (conductor, timeScale) => new ScriptedBreathEngine({ follow: conductor, timeScale }),
};
