import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { FathomSound } from '../native/fathomSound';
import { mixFor } from './soundDirector';
import type { SoundScreen } from './soundDirector';

/** What the hook reads each tick. Getters, so it always sees the live game. */
export interface SoundSource {
  screen: SoundScreen;
  depth: () => number;
  zone: number;
  exhaling: () => boolean;
  exhaleWindow: () => boolean;
  volume: number;
}

/** How often the mix is re-sent. The synth smooths between updates. */
const TICK_MS = 100;

/**
 * Keeps the native soundscape playing the mix the game state calls for. Runs
 * only in the app; in a browser (vite dev) there is no native synth and this
 * does nothing. Sound stops when the app goes to the background.
 */
export function useSoundscape(source: SoundSource): void {
  const native = Capacitor.isNativePlatform();
  const latest = useRef(source);
  latest.current = source;
  const headphones = useRef(false);

  useEffect(() => {
    if (!native) return;
    let routeListener: { remove: () => Promise<void> } | null = null;
    void FathomSound.start().catch(() => {});
    void FathomSound.getRoute()
      .then((route) => {
        headphones.current = route.headphones;
      })
      .catch(() => {});
    void FathomSound.addListener('route', (route) => {
      headphones.current = route.headphones;
    }).then((listener) => {
      routeListener = listener;
    });

    const tick = setInterval(() => {
      const s = latest.current;
      void FathomSound.setMix(
        mixFor({
          screen: s.screen,
          depth: s.depth(),
          zone: s.zone,
          exhaling: s.exhaling(),
          exhaleWindow: s.exhaleWindow(),
          headphones: headphones.current,
          volume: s.volume,
        }),
      ).catch(() => {});
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void FathomSound.stop().catch(() => {});
      else void FathomSound.start().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      void routeListener?.remove();
      void FathomSound.stop().catch(() => {});
    };
  }, [native]);
}

/** The soft inhale swell, on each breath-in prompt. */
export function playInhale(): void {
  if (Capacitor.isNativePlatform()) void FathomSound.inhale().catch(() => {});
}
