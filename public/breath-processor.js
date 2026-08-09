/**
 * FATHOM breath capture processor — runs on the audio thread.
 *
 * This stage only measures. It reduces each hop of raw audio to a small frame
 * of numbers and posts it to the main thread, where thresholds and the phase
 * state machine live in typechecked code that can be tuned and tested.
 *
 * The band split is the part that earns its keep. An exhale is broadband
 * turbulent noise, so most of its energy sits high. Speech and hum put their
 * energy low, and rumble from desk bumps and HVAC sits lower still. Carrying
 * the bands separately is what lets the detector refuse to be played by someone
 * talking near the microphone.
 *
 * Plain JS on purpose: worklet modules are fetched as separate files, so this
 * cannot be a .ts file. It is loaded from public/ via import.meta.env.BASE_URL.
 */

/** Hop length. ~50Hz of frames at any sample rate. */
const FRAME_SECONDS = 0.02;

/** Below this is desk bumps, handling noise and HVAC. Never signal. */
const RUMBLE_CUTOFF_HZ = 100;

/** Split between the speech-dominated band and the breath-dominated band. */
const VOICE_HIGH_SPLIT_HZ = 1000;

/** Butterworth: flattest passband, no resonant peak at the corner. */
const Q = Math.SQRT1_2;

/**
 * RBJ cookbook coefficients, normalised by a0. One biquad is 12 dB/octave —
 * not a brick wall, but the detector compares bands rather than trusting an
 * absolute edge, so a gentle slope costs us nothing.
 */
function biquadCoefficients(kind, frequency, rate) {
  const w0 = (2 * Math.PI * frequency) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);

  let b0, b1, b2;
  if (kind === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  }

  const a0 = 1 + alpha;
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Transposed direct form II: one multiply-add chain, two state words. */
class Biquad {
  constructor(kind, frequency, rate) {
    this.c = biquadCoefficients(kind, frequency, rate);
    this.z1 = 0;
    this.z2 = 0;
  }

  step(x) {
    const c = this.c;
    const y = c.b0 * x + this.z1;
    this.z1 = c.b1 * x - c.a1 * y + this.z2;
    this.z2 = c.b2 * x - c.a2 * y;
    return y;
  }
}

class BreathCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global in AudioWorkletGlobalScope.
    this.frameSamples = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));

    this.rumbleFilter = new Biquad('highpass', RUMBLE_CUTOFF_HZ, sampleRate);
    this.voiceFilter = new Biquad('lowpass', VOICE_HIGH_SPLIT_HZ, sampleRate);
    this.highFilter = new Biquad('highpass', VOICE_HIGH_SPLIT_HZ, sampleRate);

    this.samplesSeen = 0;
    this.resetFrame();
  }

  resetFrame() {
    this.sumSquares = 0;
    this.voiceSquares = 0;
    this.highSquares = 0;
    this.peak = 0;
    this.crossings = 0;
    this.lastSign = 0;
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    // The mic can be momentarily absent while the graph settles. Staying alive
    // matters more than the missing block: returning false retires us for good.
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      const raw = channel[i];

      // Peak is taken pre-filter: clipping happens at the converter, and a
      // filter would hide it by smoothing the flat top back into a curve.
      const magnitude = raw < 0 ? -raw : raw;
      if (magnitude > this.peak) this.peak = magnitude;

      const level = this.rumbleFilter.step(raw);
      const voice = this.voiceFilter.step(level);
      const high = this.highFilter.step(level);

      this.sumSquares += level * level;
      this.voiceSquares += voice * voice;
      this.highSquares += high * high;

      // Zero crossings on the rumble-filtered signal: a cheap stand-in for
      // spectral centroid. Turbulent breath crosses often, voiced speech rarely.
      const sign = level > 0 ? 1 : level < 0 ? -1 : 0;
      if (sign !== 0) {
        if (this.lastSign !== 0 && sign !== this.lastSign) this.crossings++;
        this.lastSign = sign;
      }

      this.filled++;
      this.samplesSeen++;

      if (this.filled >= this.frameSamples) {
        const n = this.filled;
        this.port.postMessage({
          // Sample-counted rather than block-quantised: respiratory rate is
          // derived from these timestamps, so they need to be exact.
          t: (this.samplesSeen / sampleRate) * 1000,
          peak: this.peak,
          level: Math.sqrt(this.sumSquares / n),
          voice: Math.sqrt(this.voiceSquares / n),
          high: Math.sqrt(this.highSquares / n),
          zcr: this.crossings / n,
        });
        this.resetFrame();
      }
    }

    return true;
  }
}

registerProcessor('breath-capture', BreathCaptureProcessor);
