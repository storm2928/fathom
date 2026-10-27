// Generated ambient music for the dive, ported from AmbientMusic.swift: slow,
// warm chords that fade into one another about once a breath, and now and then
// a soft bell from the same scale. Brighter chords with bells in the twilight,
// lower and slower at midnight, a few low chords and no bells in the abyss.

import { XorShift } from './dsp';

/** The chords each zone moves through, as MIDI notes (D major, kept soft). */
const PROGRESSIONS: number[][][] = [
  [[50, 57, 64, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 59]],
  [[38, 45, 52, 54], [35, 42, 45, 50], [31, 38, 42, 47], [33, 40, 45, 47]],
  [[38, 45, 52], [43, 50, 57]],
];
/** Seconds each chord holds before the next fades in. */
const CHORD_SECONDS = [8, 11, 15];
/** Bell notes, D major pentatonic; none in the abyss. */
const BELL_NOTES: number[][] = [[74, 76, 78, 81, 83, 86], [62, 64, 66, 69, 71], []];
/** Seconds between bells: a random wait in this range. */
const BELL_GAP: [number, number][] = [[3, 7], [7, 14], [0, 0]];
const BELL_LEVEL = [0.07, 0.05, 0];

const ATTACK = 2.5;
const RELEASE = 3.5;
const NOTE_LEVEL = 0.06;
/** Two oscillators per note, a few cents apart, for warmth. */
const DETUNE = 0.0009;
const TWO_PI = 2 * Math.PI;
const UINT32_MAX_F = Math.fround(4294967295);

interface ChordSlot {
  active: boolean;
  age: number;
  hold: number;
  count: number;
  freqs: Float64Array;
  phaseA: Float64Array;
  phaseB: Float64Array;
}

interface Bell {
  active: boolean;
  t: number;
  freq: number;
  phase: number;
  partial: number;
  level: number;
}

const newSlot = (): ChordSlot => ({
  active: false,
  age: 0,
  hold: 8,
  count: 0,
  freqs: new Float64Array(4),
  phaseA: new Float64Array(4),
  phaseB: new Float64Array(4),
});

const newBell = (): Bell => ({ active: false, t: 0, freq: 0, phase: 0, partial: 0, level: 0 });

/** Fade in over the attack, hold, then fade out over the release. */
function envelope(age: number, hold: number): number {
  const rise = Math.min(1, age / ATTACK);
  const fall = age < hold ? 1 : Math.max(0, 1 - (age - hold) / RELEASE);
  return rise * rise * (3 - 2 * rise) * fall;
}

/** A warm voice: the fundamental with a little second and third harmonic. */
function voice(phase: number): number {
  const s = Math.sin(TWO_PI * phase);
  const c = Math.cos(TWO_PI * phase);
  return s + 0.22 * (2 * s * c) + 0.06 * (s * (3 - 4 * s * s));
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Swift's truncatingRemainder for positive values. */
const wrap = (x: number) => x % 1;

export class AmbientMusic {
  private readonly rate: number;
  private readonly rng: XorShift;
  private readonly slots = [newSlot(), newSlot()];
  private current = 0;
  private chordIndex = 0;
  private untilNextChord = 0;
  private readonly bells = [newBell(), newBell(), newBell()];
  private untilNextBell = 2;
  private time = 0;

  constructor(rate: number, seed = 0x5eedc40d) {
    this.rate = rate;
    this.rng = new XorShift(seed);
  }

  /** One sample of music for this zone (0 twilight, 1 midnight, 2 abyss). */
  next(rawZone: number): number {
    const zone = Math.max(0, Math.min(2, rawZone | 0));
    const dt = 1 / this.rate;

    this.untilNextChord -= dt;
    if (this.untilNextChord <= 0) this.startChord(zone);

    let out = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      const env = envelope(slot.age, slot.hold);
      if (env <= 0 && slot.age > slot.hold) {
        slot.active = false;
        continue;
      }
      for (let n = 0; n < slot.count; n += 1) {
        const f = slot.freqs[n];
        slot.phaseA[n] = wrap(slot.phaseA[n] + f * (1 + DETUNE) * dt);
        slot.phaseB[n] = wrap(slot.phaseB[n] + f * (1 - DETUNE) * dt);
        // A slow shimmer per note, so a held chord breathes.
        const shimmer = 0.8 + 0.2 * Math.sin(TWO_PI * (0.05 + 0.013 * n) * this.time + n);
        out += (voice(slot.phaseA[n]) + voice(slot.phaseB[n])) * 0.5 * shimmer * env * NOTE_LEVEL;
      }
      slot.age += dt;
    }

    // Bells.
    const notes = BELL_NOTES[zone];
    if (notes.length > 0) {
      this.untilNextBell -= dt;
      if (this.untilNextBell <= 0) {
        this.ring(notes, BELL_LEVEL[zone]);
        const [lo, hi] = BELL_GAP[zone];
        this.untilNextBell = lo + this.nextUnit() * (hi - lo);
      }
    }
    for (const bell of this.bells) {
      if (!bell.active) continue;
      bell.phase = wrap(bell.phase + bell.freq * dt);
      bell.partial = wrap(bell.partial + bell.freq * 2.76 * dt);
      const attack = Math.min(1, bell.t / 0.005);
      const body = Math.sin(TWO_PI * bell.phase) * Math.exp(-bell.t / 2.2);
      const shine = 0.3 * Math.sin(TWO_PI * bell.partial) * Math.exp(-bell.t / 0.6);
      out += (body + shine) * attack * bell.level;
      bell.t += dt;
      if (bell.t > 8) bell.active = false;
    }

    this.time += dt;
    return out;
  }

  private startChord(zone: number): void {
    const chords = PROGRESSIONS[zone];
    this.chordIndex = (this.chordIndex + 1) % chords.length;
    const notes = chords[this.chordIndex];
    const hold = CHORD_SECONDS[zone];
    this.current = 1 - this.current;
    const slot = this.slots[this.current];
    slot.active = true;
    slot.age = 0;
    slot.hold = hold;
    slot.count = Math.min(notes.length, slot.freqs.length);
    for (let n = 0; n < slot.count; n += 1) {
      slot.freqs[n] = hz(notes[n]);
      slot.phaseA[n] = this.nextUnit();
      slot.phaseB[n] = this.nextUnit();
    }
    // The next chord starts as this one begins to let go.
    this.untilNextChord = hold;
  }

  private ring(notes: number[], level: number): void {
    const bell = this.bells.find((b) => !b.active);
    if (!bell) return;
    const note = notes[Math.trunc(Math.fround(this.nextUnit() * notes.length)) % notes.length];
    bell.active = true;
    bell.t = 0;
    bell.freq = hz(note);
    bell.phase = 0;
    bell.partial = 0;
    bell.level = level;
  }

  /** [0, 1], as Swift's Float(rng) / Float(UInt32.max). */
  private nextUnit(): number {
    return Math.fround(Math.fround(this.rng.next()) / UINT32_MAX_F);
  }
}
