/**
 * Signal debug meter — a developer tool for tuning the detector against a real
 * room, a real microphone and a real breath.
 *
 * Honest before pretty. The numbers quoted in the README and the video come out
 * of this page, so it shows the noise floor and the thresholds it is actually
 * using rather than a smoothed version of them.
 *
 * Served from debug.html so the main app entry point stays untouched.
 */

import { bandRatio, createMicCapture, isProcessorOn } from '../capture.ts';
import type { AppliedSettings, CaptureFrame, ReportedSetting } from '../capture.ts';
import { createExhaleDetector } from '../detector.ts';
import type { DetectorOptions, DetectorFrameResult } from '../detector.ts';
import { buildRecording, parseRecording, replayRecording } from '../recording.ts';
import type { BreathRecording } from '../recording.ts';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`debug page is missing #${id}`);
  return found as T;
}

const startButton = el<HTMLButtonElement>('start');
const stopButton = el<HTMLButtonElement>('stop');
const resetButton = el<HTMLButtonElement>('resetDetector');
const status = el('status');
const canvas = el<HTMLCanvasElement>('trace');
const controls = el('controls');
const configWarning = el('configWarning');
const exhaleRows = el('exhales');
const verdict = el('verdict');
const recordButton = el<HTMLButtonElement>('record');
const downloadButton = el<HTMLButtonElement>('download');
const loadInput = el<HTMLInputElement>('loadFile');
const replayButton = el<HTMLButtonElement>('replay');
const recordStatus = el('recordStatus');
const replayOut = el('replayOut');

const out = {
  dbfs: el('dbfs'),
  snr: el('snr'),
  ratio: el('ratio'),
  zcr: el('zcr'),
  phase: el('phase'),
  conf: el('conf'),
  clip: el('clip'),
  fps: el('fps'),
};

const capture = createMicCapture();
const detector = createExhaleDetector();

/** Seconds of history in the trace. */
const WINDOW_SECONDS = 15;
const FRAME_HZ = 50;
const HISTORY = WINDOW_SECONDS * FRAME_HZ;

/** Trace vertical range, in dBFS. */
const TOP_DBFS = 0;
const BOTTOM_DBFS = -90;

interface TracePoint {
  levelDb: number;
  floorDb: number;
  openDb: number;
  exhaling: boolean;
}

const trace: TracePoint[] = [];
let latest: (DetectorFrameResult & { frame: CaptureFrame }) | null = null;
let windowStart = 0;
let windowFrames = 0;
let exhaleCount = 0;

/** Non-null while recording. Raw frames only — detection is re-derived on replay. */
let capturedFrames: CaptureFrame[] | null = null;
let loadedRecording: BreathRecording | null = null;

function toDbfs(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : BOTTOM_DBFS;
}

/* ---------------------------------------------------------------- controls */

interface ControlSpec {
  key: keyof DetectorOptions;
  label: string;
  min: number;
  max: number;
  step: number;
}

const CONTROL_SPECS: ControlSpec[] = [
  // A breath in a quiet room clears the floor by 30dB and more, so these have
  // to reach past that or the upper half of the tuning range is unreachable —
  // which is exactly where you go to suppress false positives in a quiet room.
  { key: 'openSnrDb', label: 'open threshold (dB over floor)', min: 2, max: 45, step: 0.5 },
  { key: 'closeSnrDb', label: 'close threshold (dB over floor)', min: 1, max: 40, step: 0.5 },
  { key: 'onsetDebounceMs', label: 'onset debounce (ms)', min: 0, max: 600, step: 10 },
  { key: 'hangoverMs', label: 'release hangover (ms)', min: 0, max: 2500, step: 10 },
  { key: 'minExhaleMs', label: 'min exhale (ms)', min: 200, max: 3000, step: 50 },
  { key: 'maxExhaleMs', label: 'ceiling (ms)', min: 3000, max: 30000, step: 500 },
  { key: 'minBandRatio', label: 'min high / voice ratio', min: 0, max: 3, step: 0.05 },
  { key: 'targetExhaleMs', label: 'target exhale (ms)', min: 2000, max: 12000, step: 250 },
  { key: 'jitterTolerance', label: 'jitter tolerance', min: 0.05, max: 1.5, step: 0.05 },
];

function checkConfig(): void {
  // Equal thresholds mean no hysteresis at all, which is the bug the two
  // thresholds exist to prevent. Say so rather than silently correcting it.
  configWarning.textContent =
    detector.options.closeSnrDb >= detector.options.openSnrDb
      ? 'Close threshold is not below open threshold — there is no hysteresis, and one breath will report as several.'
      : '';
}

function buildControls(): void {
  for (const spec of CONTROL_SPECS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'control';

    const label = document.createElement('label');
    label.textContent = spec.label;
    label.htmlFor = `ctl-${spec.key}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `ctl-${spec.key}`;
    slider.min = String(spec.min);
    slider.max = String(spec.max);
    slider.step = String(spec.step);
    slider.value = String(detector.options[spec.key]);

    const readout = document.createElement('output');
    readout.textContent = String(detector.options[spec.key]);

    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      detector.setOptions({ [spec.key]: value });
      readout.textContent = String(value);
      checkConfig();
    });

    wrapper.append(label, slider, readout);
    controls.append(wrapper);
  }
}

/* ------------------------------------------------------------------ output */

function reportSetting(id: string, value: ReportedSetting): void {
  const node = el(id);
  const on = isProcessorOn(value);
  if (on === undefined) {
    node.textContent = 'not reported';
    node.className = 'warn';
    return;
  }
  node.textContent = String(value);
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

function logExhale(
  atMs: number,
  durationMs: number,
  quality: number | null,
  confidence: number | null,
  outcome: string,
  outcomeClass: string
): void {
  if (exhaleCount === 0) exhaleRows.replaceChildren();
  exhaleCount++;

  const row = document.createElement('tr');
  const cells = [
    `${(atMs / 1000).toFixed(1)}s`,
    `${(durationMs / 1000).toFixed(2)}s`,
    quality === null ? '—' : quality.toFixed(3),
    confidence === null ? '—' : confidence.toFixed(3),
    outcome,
  ];
  for (const [i, text] of cells.entries()) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (i === cells.length - 1) cell.className = outcomeClass;
    row.append(cell);
  }
  exhaleRows.prepend(row);

  while (exhaleRows.childElementCount > 40) exhaleRows.lastElementChild?.remove();
}

/* ------------------------------------------------------------------- frame */

function onFrame(frame: CaptureFrame): void {
  const result = detector.push(frame);
  latest = { ...result, frame };

  if (capturedFrames) {
    capturedFrames.push(frame);
    recordStatus.textContent = `Recording — ${capturedFrames.length} frames, ${(
      capturedFrames.length / FRAME_HZ
    ).toFixed(1)}s.`;
  }

  windowFrames++;
  if (windowStart === 0) windowStart = frame.t;
  const elapsed = frame.t - windowStart;
  if (elapsed >= 1000) {
    out.fps.textContent = `${Math.round((windowFrames * 1000) / elapsed)} Hz`;
    windowStart = frame.t;
    windowFrames = 0;
  }

  const floorDb = toDbfs(result.noiseFloor);
  trace.push({
    levelDb: toDbfs(frame.level),
    floorDb,
    openDb: floorDb + detector.options.openSnrDb,
    exhaling: result.phase === 'exhale',
  });
  while (trace.length > HISTORY) trace.shift();

  if (result.exhale) {
    logExhale(
      result.exhale.endedAt,
      result.exhale.durationMs,
      result.exhale.quality,
      result.exhale.confidence,
      'exhale',
      'good'
    );
  }
  if (result.rejected) {
    logExhale(frame.t, result.rejected.durationMs, null, null, result.rejected.reason, 'warn');
  }
}

/* ------------------------------------------------------------------ render */

function yFor(db: number, height: number): number {
  const clamped = db < BOTTOM_DBFS ? BOTTOM_DBFS : db > TOP_DBFS ? TOP_DBFS : db;
  return height - ((clamped - BOTTOM_DBFS) / (TOP_DBFS - BOTTOM_DBFS)) * height;
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  pick: (point: TracePoint) => number,
  stroke: string,
  width: number,
  height: number,
  dashed = false
): void {
  ctx.beginPath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dashed ? [4, 4] : []);
  for (const [i, point] of trace.entries()) {
    const x = (i / HISTORY) * width;
    const y = yFor(pick(point), height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function render(): void {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#17303a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#4a6673';
    ctx.font = '10px ui-monospace, monospace';
    for (let db = -20; db >= -80; db -= 20) {
      const y = yFor(db, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${db}`, 3, y - 3);
    }

    // Shade the spans the detector called an exhale.
    ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
    let spanStart: number | null = null;
    for (const [i, point] of trace.entries()) {
      if (point.exhaling && spanStart === null) spanStart = i;
      if ((!point.exhaling || i === trace.length - 1) && spanStart !== null) {
        const x0 = (spanStart / HISTORY) * width;
        ctx.fillRect(x0, 0, ((i - spanStart) / HISTORY) * width, height);
        spanStart = null;
      }
    }

    if (trace.length > 1) {
      drawSeries(ctx, (p) => p.openDb, '#fbbf24', width, height, true);
      drawSeries(ctx, (p) => p.floorDb, '#7d9aa6', width, height);
      drawSeries(ctx, (p) => p.levelDb, '#22d3ee', width, height);
    }
  }

  if (latest) {
    const { frame, snrDb, confidence, phase } = latest;
    out.dbfs.textContent = toDbfs(frame.level).toFixed(1);
    // At rest the level sits on the floor and rounds to a negative zero, which
    // reads like a fault rather than the quiet it is.
    out.snr.textContent = !Number.isFinite(snrDb)
      ? '—'
      : Math.abs(snrDb) < 0.05
        ? '0.0'
        : snrDb.toFixed(1);
    const br = bandRatio(frame);
    out.ratio.textContent = Number.isFinite(br) ? br.toFixed(2) : '∞';
    out.ratio.className = br >= detector.options.minBandRatio ? 'good' : 'warn';
    out.zcr.textContent = frame.zcr.toFixed(3);
    out.phase.textContent = phase;
    out.phase.className = phase === 'exhale' ? 'good' : '';
    out.conf.textContent = confidence.toFixed(2);
    out.conf.className = confidence < 0.4 ? 'bad' : confidence < 0.7 ? 'warn' : 'good';
    const clipping = frame.peak >= 0.99;
    out.clip.textContent = clipping ? 'CLIP' : 'ok';
    out.clip.className = clipping ? 'bad' : '';
  }

  requestAnimationFrame(render);
}

/* -------------------------------------------------------------------- wire */

capture.onFrame(onFrame);
buildControls();
checkConfig();
requestAnimationFrame(render);

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Requesting microphone…';
  try {
    const settings = await capture.start();
    showSettings(settings);
    status.textContent = 'Running. Breathe out slowly at the microphone.';
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

resetButton.addEventListener('click', () => {
  detector.reset();
  trace.length = 0;
  latest = null;
});

/* --------------------------------------------------------- record & replay */

function clearExhaleTable(): void {
  exhaleCount = 0;
  const empty = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'empty';
  cell.textContent = 'nothing yet';
  empty.append(cell);
  exhaleRows.replaceChildren(empty);
}

recordButton.addEventListener('click', () => {
  if (capturedFrames) {
    const frames = capturedFrames;
    capturedFrames = null;
    recordButton.textContent = 'Start recording';
    recordButton.classList.remove('recording');
    downloadButton.disabled = frames.length === 0;
    loadedRecording = buildRecording(frames, detector.options, capture.settings);
    replayButton.disabled = false;
    recordStatus.textContent = `Recorded ${frames.length} frames (${(
      frames.length / FRAME_HZ
    ).toFixed(1)}s). Download it, or replay it at different thresholds.`;
    return;
  }

  capturedFrames = [];
  recordButton.textContent = 'Stop recording';
  recordButton.classList.add('recording');
  downloadButton.disabled = true;
  recordStatus.textContent = 'Recording — 0 frames.';
});

downloadButton.addEventListener('click', () => {
  if (!loadedRecording) return;
  const blob = new Blob([JSON.stringify(loadedRecording)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fathom-breath-${loadedRecording.createdAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

loadInput.addEventListener('change', async () => {
  const file = loadInput.files?.[0];
  if (!file) return;
  try {
    loadedRecording = parseRecording(await file.text());
    replayButton.disabled = false;
    downloadButton.disabled = false;
    recordStatus.className = 'note';
    recordStatus.textContent =
      `Loaded ${loadedRecording.frames.length} frames from ${file.name} — ` +
      `${loadedRecording.sampleRate}Hz, ${loadedRecording.device}, ` +
      `processing ${loadedRecording.processingVerdict}.`;
  } catch (error) {
    loadedRecording = null;
    replayButton.disabled = true;
    recordStatus.className = 'bad';
    recordStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  loadInput.value = '';
});

replayButton.addEventListener('click', () => {
  const recording = loadedRecording;
  if (!recording) return;

  const summary = replayRecording(recording, detector.options);

  // Re-run through the live path too, so the trace and table show the replay
  // rather than whatever the microphone was doing a moment ago.
  detector.reset();
  trace.length = 0;
  clearExhaleTable();
  const wasRecording = capturedFrames;
  capturedFrames = null;
  for (const frame of recording.frames) onFrame(frame);
  capturedFrames = wasRecording;

  const rr = summary.respiration;
  const rejectCounts = summary.rejects.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {});

  replayOut.textContent = [
    `${summary.frames} frames · ${(summary.durationMs / 1000).toFixed(1)}s · floor ${(
      20 * Math.log10(summary.noiseFloorAtEnd)
    ).toFixed(1)} dBFS`,
    `exhales: ${summary.exhales.length}` +
      (summary.meanQuality === null
        ? ''
        : `  ·  mean quality ${summary.meanQuality.toFixed(3)}`),
    summary.exhales.length
      ? `durations: ${summary.exhales.map((e) => (e.durationMs / 1000).toFixed(2) + 's').join(', ')}`
      : 'durations: —',
    summary.exhales.length
      ? `qualities: ${summary.exhales.map((e) => e.quality.toFixed(2)).join(', ')}`
      : 'qualities: —',
    `rejected: ${
      Object.keys(rejectCounts).length
        ? Object.entries(rejectCounts).map(([k, v]) => `${k} x${v}`).join(', ')
        : 'none'
    }`,
    rr
      ? `respiratory rate: ${rr.breathsPerMin.toFixed(2)} bpm (confidence ${rr.confidence.toFixed(
          2
        )}, ${rr.intervalsUsed} intervals)`
      : 'respiratory rate: not enough intervals',
  ].join('\n');
});
