/**
 * What the soundscape should be playing right now, from the state of the game.
 * Pure: the native synth (Soundscape.swift) renders whatever this returns.
 *
 * The rule this file exists to keep: the breath detector listens for
 * broadband energy above 1 kHz (public/breath-processor.js). On the phone's
 * speaker, while a breath out can be scored, the mix carries nothing above
 * SPEAKER_SAFE_HZ and no bubbles — otherwise the game's own sound could read as
 * a breath, or keep a real one going after it ended. Headphones are exempt:
 * the microphone cannot hear them.
 */

export type SoundScreen = 'safety' | 'title' | 'predive' | 'dive' | 'results';

export interface SoundInput {
  screen: SoundScreen;
  /** metres */
  depth: number;
  /** 0-based zone from the session arc */
  zone: number;
  /** a breath out is in progress */
  exhaling: boolean;
  /** the conductor would score a breath out that started now */
  exhaleWindow: boolean;
  /** output goes to headphones rather than the speaker */
  headphones: boolean;
  /** settings volume, 0-1 */
  volume: number;
}

export interface SoundMix {
  /** 0-1, includes the settings volume */
  master: number;
  /** waves and wind above you */
  surface: number;
  /** one gain per zone bed */
  beds: [number, number, number];
  /** underwater muffling on the surface and the beds */
  lowpassHz: number;
  /** 0-1 bubble intensity */
  bubbles: number;
  /** speaker safety: the synth removes everything above SPEAKER_SAFE_HZ */
  highCut: boolean;
}

/** Above this the breath detector starts to listen (its voice band ends at 1 kHz). */
export const SPEAKER_SAFE_HZ = 500;

/** Just under the surface: the waves are already muffled, but bright. */
const SURFACE_LOWPASS_HZ = 2400;
/** The floor of the muffling, reached by the abyss. */
const DEEP_LOWPASS_HZ = 260;
/** Depth over which the surface fades out entirely. */
const SURFACE_GONE_METRES = 120;
/** Depth over which the filter closes from bright to deep. */
const FILTER_CLOSES_METRES = 300;

/** How loud each screen is, before the settings volume. */
const SCREEN_LEVEL: Record<SoundScreen, number> = {
  safety: 0.45,
  title: 0.55,
  predive: 0.6,
  dive: 1,
  results: 0.45,
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function mixFor(input: SoundInput): SoundMix {
  const depth = Math.max(0, input.depth);

  // Exponential sweep: each metre takes off the same share of the brightness,
  // which sounds even, rather than the same number of hertz.
  const k = clamp01(depth / FILTER_CLOSES_METRES);
  let lowpassHz = SURFACE_LOWPASS_HZ * (DEEP_LOWPASS_HZ / SURFACE_LOWPASS_HZ) ** k;

  const surfaceK = 1 - clamp01(depth / SURFACE_GONE_METRES);
  const surface = surfaceK * surfaceK;

  const zone = Math.min(2, Math.max(0, Math.round(input.zone)));
  const beds: [number, number, number] = [0, 0, 0];
  beds[zone] = 0.7 + 0.3 * (1 - surface);

  let bubbles = input.exhaling && input.screen === 'dive' ? 1 : 0;

  const highCut = !input.headphones && input.exhaleWindow && input.screen === 'dive';
  if (highCut) {
    bubbles = 0;
    lowpassHz = Math.min(lowpassHz, SPEAKER_SAFE_HZ);
  }

  return {
    master: clamp01(input.volume) * SCREEN_LEVEL[input.screen],
    surface,
    beds,
    lowpassHz,
    bubbles,
    highCut,
  };
}
