import type { FathomSoundPlugin } from '../../native/fathomSound';
import type { SoundMix } from '../soundDirector';
import type { SoundMessage } from './soundscape.worklet';

/**
 * The soundscape in a browser: the same synth as the app (soundscape.ts),
 * played through an AudioWorklet. Same calls as the native plugin, so
 * useSoundscape drives either one.
 *
 * Browsers keep audio suspended until the person clicks or presses a key, so
 * the context is resumed on the first gesture after start. Every call is safe
 * without Web Audio and never throws: a dive goes on without sound.
 */

type WebSound = Pick<FathomSoundPlugin, 'start' | 'stop' | 'setMix' | 'inhale' | 'ping' | 'splash' | 'getRoute'>;

let context: AudioContext | null = null;
let node: AudioWorkletNode | null = null;
let loading: Promise<void> | null = null;
let wanted = false;
/** The latest mix, held until the worklet is ready to take it. */
let pendingMix: SoundMix | null = null;

const hasWebAudio = () => typeof globalThis.AudioContext === 'function';

function post(message: SoundMessage): void {
  node?.port.postMessage(message);
}

function resumeIfWanted(): void {
  if (wanted && context?.state === 'suspended') void context.resume().catch(() => {});
}

async function load(): Promise<void> {
  const { default: url } = await import('./soundscape.worklet.ts?worker&url');
  const ctx = new AudioContext();
  context = ctx;
  await ctx.audioWorklet.addModule(url);
  node = new AudioWorkletNode(ctx, 'fathom-soundscape', { outputChannelCount: [2] });
  node.connect(ctx.destination);
  if (pendingMix) post({ type: 'mix', mix: pendingMix });
  if (typeof window !== 'undefined') {
    // Any gesture unlocks audio; the listeners are cheap and stay for the page.
    window.addEventListener('pointerdown', resumeIfWanted, true);
    window.addEventListener('keydown', resumeIfWanted, true);
  }
}

export const webSound: WebSound = {
  async start() {
    if (!hasWebAudio()) return;
    wanted = true;
    try {
      loading ??= load();
      await loading;
      if (wanted) resumeIfWanted();
    } catch {
      // No sound in this browser; the game does not depend on it.
    }
  },
  async stop() {
    wanted = false;
    if (context?.state === 'running') await context.suspend().catch(() => {});
  },
  async setMix(mix) {
    pendingMix = mix;
    post({ type: 'mix', mix });
  },
  async inhale() {
    post({ type: 'inhale' });
  },
  async ping() {
    post({ type: 'ping' });
  },
  async splash() {
    post({ type: 'splash' });
  },
  // A browser cannot tell headphones from speakers, so it assumes speakers:
  // the speaker safety cut then holds on every microphone dive.
  async getRoute() {
    return { headphones: false };
  },
};
