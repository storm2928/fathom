import { createBreathEngine } from '@fathom/breath/engine';
import { ScriptedBreathEngine } from '@fathom/game/input/scriptedEngine';
import { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { InputFactories } from './diveController';

/** How long the baseline read listens on the inputs that measure one. */
const CALIBRATION_MS = 10_000;

export const productionInputs: InputFactories = {
  mic: () => createBreathEngine(),
  touch: () => new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
  scripted: (conductor, timeScale) => new ScriptedBreathEngine({ follow: conductor, timeScale }),
};
