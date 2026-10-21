/**
 * What the soundscape should be playing right now, from the state of the game.
 * Pure: the native synth (Soundscape.swift) renders whatever this returns.
 *
 * The rule this file exists to keep: on a microphone dive played through the
 * phone's speaker, the game must not be heard as breath. The detector wants
 * broadband energy above 1 kHz and judges it against the voice band
 * (100 Hz–1 kHz). So on the speaker:
 *   - the mix never swells on a microphone dive — an audible inhale often
 *     reads as a breath out, and a swell answering it would keep it going;
 *   - from the top-up beat (the window is about to open), through the breath
 *     out and rest, and whenever a breath out is under way, everything above
 *     SPEAKER_SAFE_HZ is cut and the rest is ducked to near-silence.
 * Headphones are exempt: the microphone cannot hear them. Touch dives are
 * exempt: nothing is listening.
 */

export type SoundScreen = 'safety' | 'title' | 'predive' | 'dive' | 'results' | 'journal';

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
  /** the top-up beat: the exhale window opens next */
  scoringSoon: boolean;
  /** the microphone is the input (as opposed to touch or the fixture) */
  micDive: boolean;
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
  /**
   * 0-1: the music and the water lift gently while you breathe out — the
   * answer to a breath, where there used to be bubbling.
   */
  swell: number;
  /** 0-1 level of the generated music, which plays on every screen */
  music: number;
  /** which zone's music: brighter at the top, lower and slower further down */
  musicZone: number;
  /** speaker safety: the synth removes everything above SPEAKER_SAFE_HZ */
  highCut: boolean;
}

/** Above this the breath detector starts to listen (its voice band ends at 1 kHz). */
export const SPEAKER_SAFE_HZ = 500;
/** "Near-silence": what the speaker keeps of the mix while it could be heard as breath. */
export const SPEAKER_DUCK = 0.12;

/** Just under the surface: the waves are already muffled, but bright. */
const SURFACE_LOWPASS_HZ = 2400;
/** The floor of the muffling, reached by the abyss. */
const DEEP_LOWPASS_HZ = 260;
/** Depth over which the surface fades out entirely. */
const SURFACE_GONE_METRES = 120;
/** Depth over which the filter closes from bright to deep. */
const FILTER_CLOSES_METRES = 300;

/** The music sits under everything, the same on every screen; SCREEN_LEVEL does the rest. */
const MUSIC_LEVEL = 1;
/** How loud each screen is, before the settings volume. */
const SCREEN_LEVEL: Record<SoundScreen, number> = {
  safety: 0.45,
  title: 0.55,
  predive: 0.6,
  dive: 1,
  results: 0.45,
  journal: 0.4,
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

  const listening = input.screen === 'dive' && input.micDive && !input.headphones;
  let swell = input.exhaling && input.screen === 'dive' && !listening ? 1 : 0;
  // Off the dive the music is the surface's: you are back in the light.
  const musicZone = input.screen === 'dive' ? zone : 0;

  const highCut = listening && (input.exhaleWindow || input.scoringSoon || input.exhaling);
  let master = clamp01(input.volume) * SCREEN_LEVEL[input.screen];
  if (highCut) {
    swell = 0;
    lowpassHz = Math.min(lowpassHz, SPEAKER_SAFE_HZ);
    master *= SPEAKER_DUCK;
  }

  return {
    master,
    surface,
    beds,
    lowpassHz,
    swell,
    music: MUSIC_LEVEL,
    musicZone,
    highCut,
  };
}
