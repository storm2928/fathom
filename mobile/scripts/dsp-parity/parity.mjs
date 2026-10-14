/**
 * The native microphone must measure breath exactly the way the web worklet
 * does — the detector, its thresholds and the breathing recordings were all
 * tuned on the worklet's numbers. This runs one synthetic signal through both
 * and fails if any frame differs.
 *
 *     npm run test:dsp -w mobile
 *
 * The signal covers what the detector cares about: silence, low hum (voice
 * band), broadband noise (breath band), a rumble that must be filtered out,
 * and a clipped stretch for the pre-filter peak.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const here = new URL('.', import.meta.url).pathname;
const repo = new URL('../../../', import.meta.url).pathname;
const SAMPLE_RATES = [48_000, 44_100];
const BLOCK = 128; // the Web Audio render quantum

function signal(rate) {
  // Deterministic noise, so a failure is reproducible.
  let seed = 0x0fa7;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  const seconds = 3;
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i += 1) {
    const t = i / rate;
    let x = 0;
    if (t < 0.5) x = 0; // silence
    else if (t < 1.0) x = 0.2 * Math.sin(2 * Math.PI * 220 * t); // voiced hum
    else if (t < 1.6) x = 0.05 * noise(); // breath-like broadband noise
    else if (t < 2.0) x = 0.3 * Math.sin(2 * Math.PI * 40 * t) + 0.01 * noise(); // rumble
    else if (t < 2.4) x = Math.max(-1, Math.min(1, 1.6 * Math.sin(2 * Math.PI * 300 * t))); // clipped
    else x = 0.002 * noise(); // room tone
    out[i] = x;
  }
  return out;
}

function webFrames(samples, rate) {
  const frames = [];
  let Processor = null;
  const context = {
    sampleRate: rate,
    Math,
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: (frame) => frames.push(frame) };
      }
    },
    registerProcessor: (_name, cls) => {
      Processor = cls;
    },
  };
  vm.runInNewContext(readFileSync(join(repo, 'public/breath-processor.js'), 'utf8'), context);
  const processor = new Processor();
  for (let i = 0; i < samples.length; i += BLOCK) {
    processor.process([[samples.subarray(i, i + BLOCK)]]);
  }
  return frames;
}

function nativeFrames(samples, rate, bin, dir) {
  const input = join(dir, `signal-${rate}.f32`);
  writeFileSync(input, Buffer.from(samples.buffer));
  const out = execFileSync(bin, [input, String(rate)], { encoding: 'utf8', maxBuffer: 64 << 20 });
  return out.trim().split('\n').map((line) => JSON.parse(line));
}

const dir = mkdtempSync(join(tmpdir(), 'fathom-dsp-'));
const bin = join(dir, 'parity');
execFileSync('swiftc', [
  '-O',
  '-o',
  bin,
  join(repo, 'mobile/ios/App/App/BreathFrameProcessor.swift'),
  join(here, 'main.swift'),
]);

const FIELDS = ['t', 'peak', 'level', 'voice', 'high', 'zcr'];
let failures = 0;
for (const rate of SAMPLE_RATES) {
  const samples = signal(rate);
  const web = webFrames(samples, rate);
  const native = nativeFrames(samples, rate, bin, dir);
  if (web.length !== native.length) {
    console.log(`FAIL ${rate}Hz: ${web.length} web frames vs ${native.length} native frames`);
    failures += 1;
    continue;
  }
  let worst = 0;
  for (let i = 0; i < web.length; i += 1) {
    for (const field of FIELDS) {
      const a = web[i][field];
      const b = native[i][field];
      const diff = Math.abs(a - b) / Math.max(1e-12, Math.abs(a));
      if (diff > worst) worst = diff;
      if (Math.abs(a - b) > 1e-9 + 1e-9 * Math.abs(a)) {
        if (failures < 10) console.log(`FAIL ${rate}Hz frame ${i} ${field}: web ${a} native ${b}`);
        failures += 1;
      }
    }
  }
  console.log(`  ok   ${rate}Hz: ${web.length} frames match (worst relative diff ${worst.toExponential(2)})`);
}

if (failures > 0) {
  console.log(`\n${failures} mismatch(es)`);
  process.exit(1);
}
console.log('\nnative and web breath frames agree');
