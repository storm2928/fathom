/**
 * The soundscape on the audio thread. Bundled by Vite as its own module and
 * loaded with audioWorklet.addModule (see webSound.ts).
 */
import type { SoundMix } from '../soundDirector';
import { Soundscape } from './soundscape';

// The AudioWorkletGlobalScope, declared here rather than pulled into the
// app's DOM typings.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

export type SoundMessage = { type: 'mix'; mix: SoundMix } | { type: 'ping' | 'splash' | 'inhale' };

class SoundscapeProcessor extends AudioWorkletProcessor {
  private readonly synth = new Soundscape(sampleRate);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<SoundMessage>) => {
      const message = event.data;
      if (message.type === 'mix') this.synth.setMix(message.mix);
      else this.synth[message.type]();
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, ...rest] = outputs[0];
    if (!left) return true;
    this.synth.render(left);
    for (const channel of rest) channel.set(left);
    return true;
  }
}

registerProcessor('fathom-soundscape', SoundscapeProcessor);
