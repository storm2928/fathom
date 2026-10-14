import { MicPermissionError } from '@fathom/breath/capture';
import type {
  AppliedSettings,
  CaptureFrame,
  CaptureFrameListener,
  MicCapture,
} from '@fathom/breath/capture';

/**
 * The microphone on iOS, captured natively.
 *
 * Inside the app's web view, iOS hands getUserMedia a mock device in the
 * simulator and gives the page no say over the audio session on a phone. So
 * the app records with AVAudioEngine instead (FathomMicPlugin.swift), runs the
 * same frame measurements the web worklet does (BreathFrameProcessor.swift,
 * checked frame-for-frame by scripts/dsp-parity), and hands the frames to the
 * unchanged breath engine through its `capture` option.
 */

export interface FramesEvent {
  frames: CaptureFrame[];
}

export interface FathomMicPlugin {
  start(): Promise<{ sampleRate: number; deviceLabel: string }>;
  stop(): Promise<void>;
  addListener(
    event: 'frames',
    handler: (event: FramesEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export function createNativeMicCapture(plugin: FathomMicPlugin): MicCapture {
  const listeners = new Set<CaptureFrameListener>();
  let subscription: { remove: () => Promise<void> } | null = null;
  let applied: AppliedSettings | null = null;

  const deliver = ({ frames }: FramesEvent) => {
    for (const frame of frames) for (const listener of listeners) listener(frame);
  };

  return {
    async start() {
      if (subscription) throw new Error('capture is already running');
      // Listening before starting, so the first frames are not dropped.
      subscription = await plugin.addListener('frames', deliver);
      let info: { sampleRate: number; deviceLabel: string };
      try {
        info = await plugin.start();
      } catch (cause) {
        await subscription.remove();
        subscription = null;
        throw new MicPermissionError(
          `Microphone unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
      // The session runs in AVAudioSession's measurement mode, which turns off
      // the voice processing (echo cancellation, noise suppression, gain
      // control) that would otherwise delete a slow exhale.
      applied = {
        sampleRate: info.sampleRate,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        deviceLabel: info.deviceLabel,
        processingVerdict: 'clean',
      };
      return applied;
    },

    async stop() {
      const current = subscription;
      subscription = null;
      applied = null;
      if (!current) return;
      await current.remove();
      await plugin.stop();
    },

    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get running() {
      return subscription !== null;
    },

    get settings() {
      return applied;
    },
  };
}
