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
 *
 * If iOS takes the input away (a call, Siri, a route change) the plugin says
 * so, and if frames simply stop arriving a watchdog does — either way the
 * engine hears "lost" and ends the dive, rather than measuring silence.
 */

export interface FramesEvent {
  frames: CaptureFrame[];
}

export interface FathomMicPlugin {
  start(): Promise<{ sampleRate: number; deviceLabel: string }>;
  requestPermission?(): Promise<{ granted: boolean }>;
  stop(): Promise<void>;
  addListener(
    event: 'frames' | 'lost',
    handler: (event: FramesEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/** A live microphone sends ~50 frames a second; this much silence means it is gone. */
const DEFAULT_SILENCE_MS = 1_500;

export function createNativeMicCapture(
  plugin: FathomMicPlugin,
  options: { silenceMs?: number } = {},
): MicCapture {
  const silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
  const listeners = new Set<CaptureFrameListener>();
  const lostListeners = new Set<() => void>();
  let subscriptions: { remove: () => Promise<void> }[] = [];
  let running = false;
  let applied: AppliedSettings | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const lose = () => {
    if (!running) return;
    for (const listener of lostListeners) listener();
  };
  const arm = () => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = running ? setTimeout(lose, silenceMs) : null;
  };
  const disarm = () => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
  };

  const deliver = ({ frames }: FramesEvent) => {
    if (frames.length) arm();
    for (const frame of frames) for (const listener of listeners) listener(frame);
  };

  const unsubscribe = async () => {
    const current = subscriptions;
    subscriptions = [];
    await Promise.all(current.map((s) => s.remove()));
  };

  return {
    async start() {
      if (running || subscriptions.length) throw new Error('capture is already running');
      // Listening before starting, so the first frames are not dropped.
      subscriptions.push(await plugin.addListener('frames', deliver));
      subscriptions.push(await plugin.addListener('lost', () => lose()));
      let info: { sampleRate: number; deviceLabel: string };
      try {
        info = await plugin.start();
      } catch (cause) {
        await unsubscribe();
        throw new MicPermissionError(
          `Microphone unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
      running = true;
      arm();
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
      const wasRunning = running || subscriptions.length > 0;
      running = false;
      applied = null;
      disarm();
      if (!wasRunning) return;
      await unsubscribe();
      await plugin.stop();
    },

    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onLost(listener) {
      lostListeners.add(listener);
      return () => lostListeners.delete(listener);
    },

    get running() {
      return running;
    },

    get settings() {
      return applied;
    },
  };
}
