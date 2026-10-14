import { useEffect, useRef } from 'react';
import { haptics } from '../native/fathomHaptics';
import { exhaleFeel } from './hapticDirector';
import type { HapticInput } from './hapticDirector';

/** How often a breath out is checked. Fast enough that the rumble starts with the breath. */
const TICK_MS = 50;

/**
 * Follows the live dive and plays the breath-out feel: a rumble that eases in
 * and deepens on touch dives, a single onset pulse on microphone dives.
 * Prompt taps and the zone thud are fired where those events happen (App).
 */
export function useHaptics(options: {
  enabled: boolean;
  diving: boolean;
  input: HapticInput;
  exhaling: () => boolean;
}): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!options.enabled || !options.diving) return;
    let since: number | null = null;

    const tick = setInterval(() => {
      const { exhaling, input } = latest.current;
      const now = performance.now();
      if (exhaling()) {
        if (since === null) {
          since = now;
          const { rumble } = exhaleFeel(0, input);
          if (rumble === null) haptics.tap('onset');
          else haptics.exhaleStart(rumble);
        } else {
          const { rumble } = exhaleFeel((now - since) / 1000, input);
          if (rumble !== null) haptics.exhaleLevel(rumble);
        }
      } else if (since !== null) {
        since = null;
        haptics.exhaleStop();
      }
    }, TICK_MS);

    return () => {
      clearInterval(tick);
      haptics.exhaleStop();
    };
  }, [options.enabled, options.diving]);
}
