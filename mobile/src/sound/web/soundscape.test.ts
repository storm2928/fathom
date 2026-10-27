import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import type { SoundMix } from '../soundDirector.ts';
import { Soundscape } from './soundscape.ts';

/**
 * The browser's soundscape, measured the way scripts/sound-check measures the
 * native one: the same scenarios, the same checks, the same thresholds. The
 * rule that matters most: with the speaker safety cut on, almost nothing is
 * left above 1 kHz, where the breath detector listens.
 */

const RATE = 48_000;
const BLOCK = 512;

function mix(changes: Partial<SoundMix>): SoundMix {
  return {
    master: 1,
    surface: 1,
    beds: [1, 0, 0],
    lowpassHz: 2400,
    swell: 0,
    music: 1,
    musicZone: 0,
    highCut: false,
    ...changes,
  };
}

const SCENARIOS: Record<string, SoundMix> = {
  silent: mix({ master: 0, swell: 1 }),
  shallow: mix({}),
  deep: mix({ lowpassHz: 260, surface: 0, musicZone: 2 }),
  swell: mix({ swell: 1 }),
  music: mix({ surface: 0, beds: [0, 0, 0] }),
  'music-abyss': mix({ surface: 0, beds: [0, 0, 0], musicZone: 2 }),
  'speaker-window': mix({ swell: 1, highCut: true }),
  midnight: mix({ surface: 0, beds: [0, 1, 0], lowpassHz: 700 }),
  abyss: mix({ surface: 0, beds: [0, 0, 1], lowpassHz: 300 }),
  ping: mix({ surface: 0, beds: [0, 0, 0], music: 0 }),
  splash: mix({ surface: 0, beds: [0, 0, 0], music: 0 }),
};

/** A 2nd-order TPT high-pass; two in a row isolate the detector's band. */
class HighPass {
  private ic1 = 0;
  private ic2 = 0;
  private readonly a1: number;
  private readonly a2: number;
  private readonly a3: number;
  private readonly k = Math.SQRT2;
  constructor(fc: number) {
    const g = Math.tan((Math.PI * fc) / RATE);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  step(v0: number): number {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return v0 - this.k * v1 - v2;
  }
}

interface Measure {
  rms: number;
  high: number;
  peak: number;
}

function measure(name: string): Measure {
  const soundscape = new Soundscape(RATE, 7);
  soundscape.setMix(SCENARIOS[name]);
  const buffer = new Float32Array(BLOCK);
  const blocks = Math.floor((RATE * 4) / BLOCK);
  for (let i = 0; i < blocks; i += 1) soundscape.render(buffer);
  if (name === 'ping') soundscape.ping();
  if (name === 'splash') soundscape.splash();

  const hp1 = new HighPass(1000);
  const hp2 = new HighPass(1000);
  let sum = 0;
  let highSum = 0;
  let peak = 0;
  let n = 0;
  for (let i = 0; i < blocks; i += 1) {
    soundscape.render(buffer);
    for (const x of buffer) {
      sum += x * x;
      const h = hp2.step(hp1.step(x));
      highSum += h * h;
      peak = Math.max(peak, Math.abs(x));
      n += 1;
    }
  }
  return { rms: Math.sqrt(sum / n), high: Math.sqrt(highSum / n), peak };
}

const measured = new Map<string, Measure>();
const m = (name: string): Measure => {
  if (!measured.has(name)) measured.set(name, measure(name));
  return measured.get(name)!;
};

test('volume zero is silence', () => {
  equal(m('silent').peak, 0);
});

test('every scenario is audible and never clips', () => {
  for (const name of Object.keys(SCENARIOS)) {
    if (name === 'silent') continue;
    const r = m(name);
    assert(r.rms > 0.005, `${name} is inaudible: rms ${r.rms}`);
    assert(r.peak <= 1, `${name} clips: peak ${r.peak}`);
  }
});

test('sinking takes the brightness away', () => {
  assert(m('deep').high < m('shallow').high * 0.35, `deep ${m('deep').high} vs shallow ${m('shallow').high}`);
});

test('a breath out lifts the mix a few decibels', () => {
  const ratio = m('swell').rms / m('shallow').rms;
  assert(ratio > 1.2 && ratio < 2, `swell / shallow rms ${ratio}`);
});

test('abyss music is darker than twilight music', () => {
  assert(m('music-abyss').high < m('music').high);
});

test('the speaker cut leaves nothing above 1 kHz for the microphone', () => {
  const r = m('speaker-window');
  assert(r.high < r.rms * 0.1, `high ${r.high} of rms ${r.rms}`);
});

test('the same seed renders the same sound', () => {
  const a = new Soundscape(RATE, 7);
  const b = new Soundscape(RATE, 7);
  a.setMix(SCENARIOS.shallow);
  b.setMix(SCENARIOS.shallow);
  const x = new Float32Array(BLOCK);
  const y = new Float32Array(BLOCK);
  for (let i = 0; i < 20; i += 1) {
    a.render(x);
    b.render(y);
  }
  assert(x.every((v, i) => v === y[i]), 'two renders from one seed differ');
});
