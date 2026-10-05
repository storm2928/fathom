import type { InputCode } from '../surface/diveLog';

/**
 * Which hold-to-exhale input this device gets: a finger on a touch screen, the
 * spacebar everywhere else. Decided once by the pointer, so a phone is never
 * told to hold a key it does not have.
 */
export function holdInputFor(coarsePointer: boolean): {
  source: 'touch' | 'spacebar';
  code: Extract<InputCode, 'touch' | 'keyboard'>;
} {
  return coarsePointer ? { source: 'touch', code: 'touch' } : { source: 'spacebar', code: 'keyboard' };
}
