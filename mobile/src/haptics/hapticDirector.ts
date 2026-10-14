/**
 * What a breath out feels like in the hand. Pure; the native plugin plays it.
 *
 * Touch dives get a continuous rumble that eases in and deepens slowly with
 * the breath's length — longer breaths take you deeper, and should feel like
 * it. Microphone dives get none: the Taptic Engine hums around 150–250 Hz,
 * inside the breath detector's voice band, and a rumble during the breath could
 * cut it short. They get one soft pulse at onset instead (see useHaptics).
 */

export type HapticInput = 'mic' | 'touch' | 'scripted';

/** The strongest the rumble ever gets. The zone thud is the only thing above it. */
export const RUMBLE_MAX = 0.55;
const RUMBLE_START = 0.15;
const RUMBLE_SETTLED = 0.35;
const EASE_IN_SECONDS = 0.4;
/** Seconds of breathing out to go from settled to the cap. */
const DEEPEN_SECONDS = 10;

export function exhaleFeel(seconds: number, input: HapticInput): { rumble: number | null } {
  if (input === 'mic') return { rumble: null };
  const t = Math.max(0, seconds);
  if (t < EASE_IN_SECONDS) {
    const u = t / EASE_IN_SECONDS;
    return { rumble: RUMBLE_START + (RUMBLE_SETTLED - RUMBLE_START) * u * u };
  }
  const deepen = Math.min(1, (t - EASE_IN_SECONDS) / DEEPEN_SECONDS);
  return { rumble: RUMBLE_SETTLED + (RUMBLE_MAX - RUMBLE_SETTLED) * deepen };
}
