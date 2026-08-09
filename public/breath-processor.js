/**
 * FATHOM breath capture processor — runs on the audio thread.
 *
 * This stage only measures. It reduces each hop of raw audio to a small frame
 * of numbers and posts it to the main thread, where thresholds and the phase
 * state machine live in typechecked code that can be tuned and tested.
 *
 * Plain JS on purpose: worklet modules are fetched as separate files, so this
 * cannot be a .ts file. It is loaded from public/ via import.meta.env.BASE_URL.
 */

/** Hop length. ~50Hz of frames at any sample rate. */
const FRAME_SECONDS = 0.02;

class BreathCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global in AudioWorkletGlobalScope.
    this.frameSamples = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
    this.sumSquares = 0;
    this.peak = 0;
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    // The mic can be momentarily absent while the graph settles. Staying alive
    // matters more than the missing block: returning false retires us for good.
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i];
      this.sumSquares += sample * sample;
      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > this.peak) this.peak = magnitude;
      this.filled++;

      if (this.filled >= this.frameSamples) {
        this.port.postMessage({
          t: currentTime * 1000,
          rms: Math.sqrt(this.sumSquares / this.filled),
          peak: this.peak,
        });
        this.sumSquares = 0;
        this.peak = 0;
        this.filled = 0;
      }
    }

    return true;
  }
}

registerProcessor('breath-capture', BreathCaptureProcessor);
