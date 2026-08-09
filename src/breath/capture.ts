/**
 * Microphone capture for the breath engine.
 *
 * Every convenience the browser applies to a voice call works against us: noise
 * suppression in particular classifies a slow exhale as noise and deletes it.
 * So we ask for all of it off, and then report what the browser *actually*
 * applied rather than what we requested — a browser that overrides us is one we
 * cannot support, and that is a fact worth surfacing loudly and early.
 */

/** One hop of measured audio. Detection logic lives downstream, not here. */
export interface CaptureFrame {
  /** milliseconds on the audio clock */
  t: number;
  /** 0–1 RMS over the frame */
  rms: number;
  /** 0–1 peak magnitude over the frame, for clip detection */
  peak: number;
}

/**
 * Whether the capture path can be trusted.
 * - `clean`: every processor reported back explicitly off, as requested.
 * - `overridden`: the browser kept one on. Breath will be attenuated or deleted.
 * - `unknown`: the browser declined to report. Silence is not consent — we do
 *   not know the signal is intact, so we must not claim that it is.
 */
export type ProcessingVerdict = 'clean' | 'overridden' | 'unknown';

/**
 * One setting as the browser reported it. `echoCancellation` may come back as a
 * mode string ("all", "remote-only") instead of a boolean, and a mode being
 * named means the processor is active. `undefined` means it told us nothing.
 */
export type ReportedSetting = boolean | string | undefined;

/**
 * What the browser gave us, as opposed to what we asked for. `undefined` means
 * the browser declined to report that setting, which is not the same as off.
 */
export interface AppliedSettings {
  sampleRate: number;
  echoCancellation: ReportedSetting;
  noiseSuppression: ReportedSetting;
  autoGainControl: ReportedSetting;
  deviceLabel: string;
  processingVerdict: ProcessingVerdict;
}

/** `true` on, `false` off, `undefined` when the browser did not say. */
export function isProcessorOn(value: ReportedSetting): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value !== 'none';
}

export type CaptureFrameListener = (frame: CaptureFrame) => void;

export interface MicCapture {
  start(): Promise<AppliedSettings>;
  stop(): Promise<void>;
  onFrame(listener: CaptureFrameListener): () => void;
  readonly running: boolean;
  readonly settings: AppliedSettings | null;
}

export class MicUnsupportedError extends Error {}
export class MicPermissionError extends Error {}

const PROCESSOR_NAME = 'breath-capture';
const PROCESSOR_MODULE = 'breath-processor.js';

/** The three we need off, in the order we report them. */
const AUDIO_PROCESSING_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const;

function verdictFor(reported: ReportedSetting[]): ProcessingVerdict {
  const states = reported.map(isProcessorOn);
  if (states.some((state) => state === true)) return 'overridden';
  if (states.some((state) => state === undefined)) return 'unknown';
  return 'clean';
}

function readAppliedSettings(
  track: MediaStreamTrack,
  sampleRate: number
): AppliedSettings {
  const applied = track.getSettings();
  const echoCancellation = applied.echoCancellation;
  const noiseSuppression = applied.noiseSuppression;
  const autoGainControl = applied.autoGainControl;

  return {
    sampleRate,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    deviceLabel: track.label || '(unnamed device)',
    processingVerdict: verdictFor([
      echoCancellation,
      noiseSuppression,
      autoGainControl,
    ]),
  };
}

export function createMicCapture(): MicCapture {
  const listeners = new Set<CaptureFrameListener>();

  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: AudioWorkletNode | null = null;
  let sink: GainNode | null = null;
  let applied: AppliedSettings | null = null;

  async function teardown(): Promise<void> {
    processor?.port.close();
    processor?.disconnect();
    source?.disconnect();
    sink?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed') await context.close();

    processor = null;
    source = null;
    sink = null;
    stream = null;
    context = null;
  }

  async function start(): Promise<AppliedSettings> {
    if (context) throw new Error('capture is already running');

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicUnsupportedError(
        'This browser exposes no microphone API. It needs a secure context (https or localhost).'
      );
    }

    // Constructed synchronously inside the caller's click handler, so the
    // context is allowed to leave the suspended state it is born in.
    context = new AudioContext();

    try {
      if (typeof context.audioWorklet?.addModule !== 'function') {
        throw new MicUnsupportedError(
          'This browser has no AudioWorklet. Breath capture cannot run here.'
        );
      }

      await context.resume();

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_PROCESSING_CONSTRAINTS,
          video: false,
        });
      } catch (cause) {
        throw new MicPermissionError(
          `Microphone unavailable: ${cause instanceof Error ? cause.message : String(cause)}`
        );
      }

      await context.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}${PROCESSOR_MODULE}`
      );

      source = context.createMediaStreamSource(stream);
      processor = new AudioWorkletNode(context, PROCESSOR_NAME);
      processor.port.onmessage = (event: MessageEvent<CaptureFrame>) => {
        for (const listener of listeners) listener(event.data);
      };

      // A worklet node with nothing downstream may never be pulled by the
      // graph. A silent gain node keeps it running without any feedback path.
      sink = context.createGain();
      sink.gain.value = 0;
      source.connect(processor).connect(sink).connect(context.destination);

      const [track] = stream.getAudioTracks();
      if (!track) throw new MicPermissionError('Microphone stream has no audio track.');

      applied = readAppliedSettings(track, context.sampleRate);
      return applied;
    } catch (error) {
      await teardown();
      throw error;
    }
  }

  async function stop(): Promise<void> {
    await teardown();
    applied = null;
  }

  return {
    start,
    stop,
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get running() {
      return context !== null;
    },
    get settings() {
      return applied;
    },
  };
}
