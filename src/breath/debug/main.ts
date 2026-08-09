/**
 * Developer surface for issue #1: prove the microphone path survives a slow
 * exhale, and show what the browser actually applied to the track.
 *
 * A tool, not product surface. It is served from debug.html so the main app
 * entry point stays untouched. Issue #4 grows this into the tuning meter.
 */

import { bandRatio, createMicCapture, isProcessorOn } from '../capture.ts';
import type { AppliedSettings, CaptureFrame, ReportedSetting } from '../capture.ts';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`debug page is missing #${id}`);
  return found as T;
}

const startButton = el<HTMLButtonElement>('start');
const stopButton = el<HTMLButtonElement>('stop');
const status = el('status');
const dbfsOut = el('dbfs');
const bar = el('bar');
const levelOut = el('level');
const voiceOut = el('voice');
const highOut = el('high');
const ratioOut = el('ratio');
const zcrOut = el('zcr');
const peakOut = el('peak');
const framesOut = el('frames');
const fpsOut = el('fps');
const verdict = el('verdict');

const capture = createMicCapture();

/** Quietest level worth drawing. Below this the meter is just showing noise. */
const FLOOR_DBFS = -70;

let frameCount = 0;
let windowStart = 0;
let windowFrames = 0;

function toDbfs(rms: number): number {
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

function reportSetting(id: string, value: ReportedSetting): void {
  const node = el(id);
  const on = isProcessorOn(value);
  if (on === undefined) {
    node.textContent = 'not reported';
    node.className = 'warn';
    return;
  }
  // A mode string is worth printing verbatim — "remote-only" says more than "on".
  node.textContent = String(value);
  // We asked for off. Off is the good outcome here.
  node.className = on ? 'bad' : 'good';
}

function showSettings(settings: AppliedSettings): void {
  el('sr').textContent = `${settings.sampleRate} Hz`;
  el('device').textContent = settings.deviceLabel;
  reportSetting('ec', settings.echoCancellation);
  reportSetting('ns', settings.noiseSuppression);
  reportSetting('agc', settings.autoGainControl);

  if (settings.processingVerdict === 'overridden') {
    verdict.className = 'bad';
    verdict.textContent =
      'This browser kept audio processing on despite being asked for it off. ' +
      'Breath will be attenuated or deleted here — capture cannot be trusted on this machine.';
  } else if (settings.processingVerdict === 'unknown') {
    verdict.className = 'warn';
    verdict.textContent =
      'This browser did not report what it applied, so we cannot confirm the processors are off. ' +
      'Treat the signal as unverified and check this device against one that does report.';
  } else {
    verdict.className = 'good';
    verdict.textContent = 'All three processors reported off. Capture path is clean.';
  }
}

function onFrame(frame: CaptureFrame): void {
  frameCount++;
  windowFrames++;

  if (windowStart === 0) windowStart = frame.t;
  const elapsed = frame.t - windowStart;
  if (elapsed >= 1000) {
    fpsOut.textContent = `${Math.round((windowFrames * 1000) / elapsed)} Hz`;
    windowStart = frame.t;
    windowFrames = 0;
  }

  const dbfs = toDbfs(frame.level);
  dbfsOut.textContent = dbfs === -Infinity ? '−∞' : dbfs.toFixed(1);
  levelOut.textContent = frame.level.toFixed(5);
  voiceOut.textContent = frame.voice.toFixed(5);
  highOut.textContent = frame.high.toFixed(5);
  zcrOut.textContent = frame.zcr.toFixed(3);
  framesOut.textContent = String(frameCount);

  const ratio = bandRatio(frame);
  ratioOut.textContent = Number.isFinite(ratio) ? ratio.toFixed(2) : '∞';
  // Only worth colouring once there is something to judge; at the noise floor
  // the ratio is measuring room tone, not a person.
  const audible = frame.level > 0.002;
  ratioOut.className = audible ? (ratio >= 1 ? 'good' : 'warn') : '';

  const clipping = frame.peak >= 0.99;
  peakOut.textContent = frame.peak.toFixed(3) + (clipping ? '  CLIPPING' : '');
  peakOut.className = clipping ? 'bad' : '';

  const filled = Math.max(0, Math.min(1, (dbfs - FLOOR_DBFS) / -FLOOR_DBFS));
  bar.style.width = `${filled * 100}%`;
}

capture.onFrame(onFrame);

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Requesting microphone…';
  try {
    const settings = await capture.start();
    showSettings(settings);
    status.textContent = 'Running. Exhale slowly at the microphone.';
    status.className = 'note';
    stopButton.disabled = false;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.className = 'bad';
    startButton.disabled = false;
  }
});

stopButton.addEventListener('click', async () => {
  stopButton.disabled = true;
  await capture.stop();
  status.textContent = 'Stopped. Microphone released.';
  status.className = 'note';
  startButton.disabled = false;
});
