import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { FathomSound } from '../native/fathomSound';
import { webSound } from './web/webSound';
import { mixFor } from './soundDirector';
import type { SoundScreen } from './soundDirector';

/** What the hook reads each tick. Getters, so it always sees the live game. */
export interface SoundSource {
  screen: SoundScreen;
  depth: () => number;
  zone: number;
  exhaling: () => boolean;
  exhaleWindow: () => boolean;
  scoringSoon: () => boolean;
  /** the microphone is this dive's input */
  micDive: boolean;
  volume: number;
}

/** How often the mix is re-sent. The synth smooths between updates. */
const TICK_MS = 100;

/** The native synth in the app; the same synth on Web Audio in a browser. */
export function soundDriver(native: boolean) {
  return native ? FathomSound : webSound;
}

const sound = soundDriver(Capacitor.isNativePlatform());

/**
 * Keeps the soundscape playing the mix the game state calls for: the native
 * synth in the app, its Web Audio port in a browser. Sound stops when the app
 * goes to the background or the tab is hidden.
 */
export function useSoundscape(source: SoundSource): void {
  const latest = useRef(source);
  latest.current = source;
  const headphones = useRef(false);

  useEffect(() => {
    let routeListener: { remove: () => Promise<void> } | null = null;
    void sound.start().catch(() => {});
    void sound.getRoute()
      .then((route) => {
        headphones.current = route.headphones;
      })
      .catch(() => {});
    // Only the app hears about headphones coming and going.
    if (sound === FathomSound) {
      void FathomSound.addListener('route', (route) => {
        headphones.current = route.headphones;
      }).then((listener) => {
        routeListener = listener;
      });
    }

    const tick = setInterval(() => {
      const s = latest.current;
      void sound.setMix(
        mixFor({
          screen: s.screen,
          depth: s.depth(),
          zone: s.zone,
          exhaling: s.exhaling(),
          exhaleWindow: s.exhaleWindow(),
          scoringSoon: s.scoringSoon(),
          micDive: s.micDive,
          headphones: headphones.current,
          volume: s.volume,
        }),
      ).catch(() => {});
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void sound.stop().catch(() => {});
      else void sound.start().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      void routeListener?.remove();
      void sound.stop().catch(() => {});
    };
  }, []);
}

/** The discovery ping. */
export function playPing(): void {
  void sound.ping().catch(() => {});
}

/** Going in off the boat. */
export function playSplash(): void {
  void sound.splash().catch(() => {});
}

/** The soft inhale swell, on each breath-in prompt. */
export function playInhale(): void {
  void sound.inhale().catch(() => {});
}
