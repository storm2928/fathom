import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { MicPermissionError } from '@fathom/breath/capture.ts';
import type { CaptureFrame } from '@fathom/breath/capture.ts';
import { createNativeMicCapture } from './nativeMicCapture.ts';
import type { FathomMicPlugin, FramesEvent } from './nativeMicCapture.ts';

/**
 * The native microphone stands in for the web worklet behind the same
 * MicCapture interface, so the breath engine cannot tell which one it has.
 */

function frame(t: number): CaptureFrame {
  return { t, peak: 0.1, level: 0.01, voice: 0.005, high: 0.008, zcr: 0.3 };
}

class FakePlugin implements FathomMicPlugin {
  started = 0;
  stopped = 0;
  handler: ((event: FramesEvent) => void) | null = null;
  refuse: string | null = null;

  start() {
    this.started += 1;
    return this.refuse
      ? Promise.reject(new Error(this.refuse))
      : Promise.resolve({ sampleRate: 48_000, deviceLabel: 'iPhone Microphone' });
  }
  stop() {
    this.stopped += 1;
    return Promise.resolve();
  }
  addListener(_event: 'frames', handler: (event: FramesEvent) => void) {
    this.handler = handler;
    return Promise.resolve({
      remove: () => {
        this.handler = null;
        return Promise.resolve();
      },
    });
  }
  send(...frames: CaptureFrame[]) {
    this.handler?.({ frames });
  }
}

test('native frames reach every listener, in order', async () => {
  const plugin = new FakePlugin();
  const capture = createNativeMicCapture(plugin);
  const seen: number[] = [];
  capture.onFrame((f) => seen.push(f.t));
  await capture.start();
  plugin.send(frame(20), frame(40));
  plugin.send(frame(60));
  equal(seen.join(','), '20,40,60');
});

test('start reports the device and that processing is off', async () => {
  const capture = createNativeMicCapture(new FakePlugin());
  const settings = await capture.start();
  equal(settings.sampleRate, 48_000);
  equal(settings.deviceLabel, 'iPhone Microphone');
  equal(settings.processingVerdict, 'clean');
  equal(capture.running, true);
});

test('a refused microphone is a permission error and leaves nothing listening', async () => {
  const plugin = new FakePlugin();
  plugin.refuse = 'Microphone permission was denied.';
  const capture = createNativeMicCapture(plugin);
  let error: unknown = null;
  try {
    await capture.start();
  } catch (e) {
    error = e;
  }
  assert(error instanceof MicPermissionError, 'the refusal was not a MicPermissionError');
  equal(plugin.handler, null, 'a listener was left behind after a refused start');
  equal(capture.running, false);
});

test('after stop the microphone is released and frames stop arriving', async () => {
  const plugin = new FakePlugin();
  const capture = createNativeMicCapture(plugin);
  const seen: number[] = [];
  capture.onFrame((f) => seen.push(f.t));
  await capture.start();
  await capture.stop();
  plugin.send(frame(20));
  equal(plugin.stopped, 1, 'the native microphone was never stopped');
  equal(seen.length, 0, 'a frame arrived after stop');
  equal(capture.running, false);
  equal(capture.settings, null);
});
