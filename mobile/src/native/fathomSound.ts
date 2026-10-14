import { registerPlugin } from '@capacitor/core';
import type { SoundMix } from '../sound/soundDirector';

/** The app's soundscape plugin (ios/App/App/FathomSoundPlugin.swift). */
export interface FathomSoundPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  setMix(mix: SoundMix): Promise<void>;
  inhale(): Promise<void>;
  getRoute(): Promise<{ headphones: boolean }>;
  addListener(
    event: 'route',
    handler: (route: { headphones: boolean }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const FathomSound = registerPlugin<FathomSoundPlugin>('FathomSound');
