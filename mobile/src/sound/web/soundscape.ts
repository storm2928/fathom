// The underwater soundscape for the browser, ported line for line from
// Soundscape.swift: synthesized from noise and sines, no samples, and every
// voice responds continuously to how deep you are.
//
// The mix is decided in soundDirector.ts; this file only plays it. One rule is
// enforced here as well, because it is a rule about sound: with `highCut` on,
// a steep 500 Hz low-pass sits on the whole output, so the breath detector
// (which listens above 1 kHz) cannot hear the game.
//
// The render path allocates nothing: parameters are read once per block, and
// every gain the listener can hear is smoothed, so nothing clicks.

import type { SoundMix } from '../soundDirector';
import { AmbientMusic } from './ambientMusic';
import { SVF, Smooth, XorShift } from './dsp';

/** The ocean under the music: waves, wash and wind, kept light. */
const OCEAN_LEVEL = 0.5;
/** The midnight drones and the abyss hum, quieter so the music leads. */
const DEEP_BED_LEVEL = 0.5;
/** How much a breath out lifts the mix: about +3 dB at full swell. */
const SWELL_LIFT = 0.45;
const TWO_PI = 2 * Math.PI;

interface Bubble {
  active: boolean;
  phase: number;
  t: number;
  f0: number;
  decay: number;
  gain: number;
}

/** A ping's envelope: a 6 ms attack and a long, soft decay. */
const pingVoice = (t: number) => (t < 0 ? 0 : Math.min(1, t / 0.006) * Math.exp(-t / 0.45));

export class Soundscape {
  private readonly rate: number;
  private readonly rng: XorShift;

  // Parameters, written from outside, read per block.
  private target: SoundMix = {
    master: 0,
    surface: 1,
    beds: [1, 0, 0],
    lowpassHz: 2400,
    swell: 0,
    music: 1,
    musicZone: 0,
    highCut: false,
  };
  private inhaleRequested = false;
  private pingRequested = false;
  private splashRequested = false;

  // Smoothed state.
  private readonly master: Smooth;
  private readonly surface: Smooth;
  private readonly bed0: Smooth;
  private readonly bed1: Smooth;
  private readonly bed2: Smooth;
  private readonly cutoff: Smooth;
  private readonly swellLevel: Smooth;
  private readonly musicLevel: Smooth;
  private readonly music: AmbientMusic;
  private readonly cut: Smooth;

  // Noise colours.
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private brown = 0;

  // Filters.
  private readonly washBand = new SVF();
  private readonly windBand = new SVF();
  private readonly airLow = new SVF();
  private readonly abyssLow = new SVF();
  private readonly muffle = new SVF();
  private readonly muffle2 = new SVF();
  private readonly safety1 = new SVF();
  private readonly safety2 = new SVF();
  private readonly inhaleBand = new SVF();
  private readonly splashBand = new SVF();

  // Oscillator phases.
  private time = 0;
  private drone0 = 0;
  private drone1 = 0;
  private hum0 = 0;
  private hum1 = 0;
  private whalePhase = 0;

  // Events.
  private whaleT = -1;
  private nextWhale = 6;
  private clickT = -1;
  private nextClick = 3;
  private clicksLeft = 0;
  private inhaleT = -1;
  private pingT = -1;
  private pingPhase = 0;
  private splashT = -1;
  private thumpPhase = 0;

  // Whale echo.
  private readonly echo: Float64Array;
  private echoIndex = 0;

  private readonly bubbles: Bubble[] = Array.from({ length: 10 }, () => ({
    active: false,
    phase: 0,
    t: 0,
    f0: 800,
    decay: 0.02,
    gain: 0,
  }));

  private tuneCountdown = 0;

  constructor(sampleRate: number, seed = 0x0fa71234) {
    this.rate = sampleRate;
    this.rng = new XorShift(seed);
    this.master = new Smooth(0, 0.25, sampleRate);
    this.surface = new Smooth(1, 0.6, sampleRate);
    this.bed0 = new Smooth(1, 2.0, sampleRate);
    this.bed1 = new Smooth(0, 2.0, sampleRate);
    this.bed2 = new Smooth(0, 2.0, sampleRate);
    this.cutoff = new Smooth(2400, 0.3, sampleRate);
    // Slow both ways: a swell, not a switch.
    this.swellLevel = new Smooth(0, 1.2, sampleRate);
    this.musicLevel = new Smooth(1, 2.0, sampleRate);
    this.music = new AmbientMusic(sampleRate);
    this.cut = new Smooth(0, 0.08, sampleRate);
    this.echo = new Float64Array(Math.trunc(sampleRate * 0.45));

    this.washBand.tune(700, 0.7, sampleRate);
    this.windBand.tune(450, 1.2, sampleRate);
    this.airLow.tune(320, 0.7, sampleRate);
    this.abyssLow.tune(120, 0.7, sampleRate);
    this.safety1.tune(500, 0.707, sampleRate);
    this.safety2.tune(500, 0.707, sampleRate);
    this.inhaleBand.tune(500, 1.5, sampleRate);
    this.splashBand.tune(1800, 0.8, sampleRate);
  }

  setMix(mix: SoundMix): void {
    this.target = mix;
  }

  /** A soft sonar ping with one echo, for a discovery. */
  ping(): void {
    this.pingRequested = true;
  }

  /** Going in off the boat: a wash of water falling in pitch, a soft low
   *  thump, and a scatter of bubbles. */
  splash(): void {
    this.splashRequested = true;
  }

  /** A soft rising breath of filtered noise, for the inhale prompt. */
  inhale(): void {
    this.inhaleRequested = true;
  }

  render(out: Float32Array): void {
    const p = this.target;
    if (this.inhaleRequested) {
      this.inhaleRequested = false;
      this.inhaleT = 0;
    }
    if (this.pingRequested) {
      this.pingRequested = false;
      this.pingT = 0;
    }
    if (this.splashRequested) {
      this.splashRequested = false;
      this.splashT = 0;
      this.thumpPhase = 0;
      for (let i = 0; i < 6; i += 1) this.spawnBubble(1);
    }
    // Speaker safety outranks the inhale swell: it is breathy noise.
    if (p.highCut) this.inhaleT = -1;
    const rate = this.rate;
    const dt = 1 / rate;

    for (let i = 0; i < out.length; i += 1) {
      // Smoothed controls.
      const m = this.master.step(p.master);
      const sGain = this.surface.step(p.surface);
      const g0 = this.bed0.step(p.beds[0]);
      const g1 = this.bed1.step(p.beds[1]);
      const g2 = this.bed2.step(p.beds[2]);
      const fc = this.cutoff.step(p.lowpassHz);
      const sw = this.swellLevel.step(p.swell);
      const mu = this.musicLevel.step(p.music);
      const hc = this.cut.step(p.highCut ? 1 : 0);

      if (this.tuneCountdown === 0) {
        this.muffle.tune(fc, 0.707, rate);
        this.muffle2.tune(fc * 1.4, 0.6, rate);
        this.tuneCountdown = 32;
      }
      this.tuneCountdown -= 1;

      // Noise: white, pink (Kellet economy), brown.
      const white = this.nextWhite();
      this.b0 = 0.99765 * this.b0 + white * 0.099046;
      this.b1 = 0.963 * this.b1 + white * 0.2965164;
      this.b2 = 0.57 * this.b2 + white * 1.0526913;
      const pink = (this.b0 + this.b1 + this.b2 + white * 0.1848) * 0.18;
      this.brown = (this.brown + 0.02 * white) / 1.02;
      const brownOut = this.brown * 3.5;

      // Surface: slow swells of brown noise, a washing band, wind.
      const t = this.time;
      const swell =
        (0.55 + 0.45 * Math.sin(TWO_PI * 0.11 * t)) * (0.65 + 0.35 * Math.sin(TWO_PI * 0.037 * t + 1.3));
      this.washBand.step(pink);
      const wash = this.washBand.band * swell * swell * 0.9;
      this.windBand.step(pink);
      const wind = this.windBand.band * (0.7 + 0.3 * Math.sin(TWO_PI * 0.05 * t)) * 0.35;
      // Kept light: the music leads, the ocean sits under it.
      const surfaceSound = (brownOut * swell * 0.45 + wash + wind) * sGain * OCEAN_LEVEL;

      // Twilight: open, airy water. (The music carries the harmony.)
      let bedSound = 0;
      if (g0 > 0.0005) {
        bedSound += this.airLow.step(pink) * 0.2 * g0;
      }

      // Midnight: a deep drone, and now and then a whale far off.
      if (g1 > 0.0005) {
        this.drone0 += 55 * dt;
        this.drone1 += 82.5 * dt;
        let mid = Math.sin(TWO_PI * this.drone0) * 0.14 + Math.sin(TWO_PI * this.drone1) * 0.06;
        if (this.whaleT < 0) {
          this.nextWhale -= dt;
          if (this.nextWhale <= 0) {
            this.whaleT = 0;
            this.nextWhale = 18 + this.nextUnit() * 17;
          }
        } else {
          const u = this.whaleT / 3.6;
          if (u >= 1) {
            this.whaleT = -1;
          } else {
            const f = 140 + 170 * Math.sin(Math.PI * u) + 6 * Math.sin(TWO_PI * 4.2 * this.whaleT);
            this.whalePhase += f * dt;
            const env = Math.sin(Math.PI * u) ** 2;
            mid += Math.sin(TWO_PI * this.whalePhase) * env * 0.16;
            this.whaleT += dt;
          }
        }
        // A long, faint echo makes the call sound like it crossed open water.
        const delayed = this.echo[this.echoIndex];
        this.echo[this.echoIndex] = mid + delayed * 0.38;
        this.echoIndex = (this.echoIndex + 1) % this.echo.length;
        bedSound += (mid + delayed * 0.3) * g1 * DEEP_BED_LEVEL;
      }

      // Abyss: a low hum, and rare clicks out in the dark.
      if (g2 > 0.0005) {
        this.hum0 += 41 * dt;
        this.hum1 += 82 * dt;
        let deep =
          Math.sin(TWO_PI * this.hum0) * 0.17 +
          Math.sin(TWO_PI * this.hum1) * 0.05 +
          this.abyssLow.step(brownOut) * 0.5;
        if (this.clickT < 0) {
          this.nextClick -= dt;
          if (this.nextClick <= 0) {
            this.clickT = 0;
            this.clicksLeft = 1 + Math.trunc(Math.fround(this.nextUnit() * 3));
            this.nextClick = 2.5 + this.nextUnit() * 4.5;
          }
        } else {
          deep += white * Math.exp(-this.clickT / 0.0015) * 0.3;
          this.clickT += dt;
          if (this.clickT > 0.09) {
            this.clicksLeft -= 1;
            this.clickT = this.clicksLeft > 0 ? 0 : -1;
          }
        }
        bedSound += deep * g2 * DEEP_BED_LEVEL;
      }

      // Everything above is heard through the water.
      const ambient = surfaceSound + bedSound;
      const muffled = this.muffle2.step(this.muffle.step(ambient));

      // The music, not heard through the water: it is the dive's own.
      const musicSound = mu > 0.0005 ? this.music.next(p.musicZone) * mu : 0;

      // Bubbles: short rising chirps — now only the splash going in.
      let bubbleSound = 0;
      for (const b of this.bubbles) {
        if (!b.active) continue;
        const f = b.f0 * (1 + b.t * 9);
        b.phase += f * dt;
        const env = Math.exp(-b.t / b.decay);
        bubbleSound += Math.sin(TWO_PI * b.phase) * env * b.gain;
        b.t += dt;
        if (env < 0.001) b.active = false;
      }

      // The inhale: a soft swell of breathy noise rising in pitch.
      let inhaleSound = 0;
      if (this.inhaleT >= 0) {
        const u = this.inhaleT / 0.8;
        if (u >= 1) {
          this.inhaleT = -1;
        } else {
          if (this.tuneCountdown === 31) this.inhaleBand.tune(320 + 600 * u, 1.5, rate);
          this.inhaleBand.step(pink);
          inhaleSound = this.inhaleBand.band * Math.sin(Math.PI * u) * 0.5;
          this.inhaleT += dt;
        }
      }

      // The discovery ping: a pure tone sliding gently down, and its echo.
      let pingSound = 0;
      if (this.pingT >= 0) {
        if (this.pingT > 2.2) {
          this.pingT = -1;
        } else {
          this.pingPhase += (880 - 40 * Math.min(this.pingT, 1)) * dt;
          const env = pingVoice(this.pingT) + 0.35 * pingVoice(this.pingT - 0.42);
          pingSound = Math.sin(TWO_PI * this.pingPhase) * env * 0.22;
          this.pingT += dt;
        }
      }

      // The splash: noise through a band sweeping down as the water closes over.
      let splashSound = 0;
      if (this.splashT >= 0) {
        const u = this.splashT / 0.9;
        if (u >= 1) {
          this.splashT = -1;
        } else {
          if (this.tuneCountdown === 30) this.splashBand.tune(1800 - 1400 * u, 0.8, rate);
          const attack = Math.min(1, this.splashT / 0.012);
          this.splashBand.step(white);
          const wash = this.splashBand.band * attack * Math.exp(-this.splashT / 0.22) * 0.55;
          this.thumpPhase += (75 - 30 * u) * dt;
          const thump = Math.sin(TWO_PI * this.thumpPhase) * attack * Math.exp(-this.splashT / 0.12) * 0.35;
          splashSound = wash + thump;
          this.splashT += dt;
        }
      }

      // A breath out lifts the music and the water a few decibels, slowly.
      const lift = 1 + SWELL_LIFT * sw;
      let mix = (muffled + musicSound) * lift + bubbleSound + inhaleSound + pingSound + splashSound;

      // Speaker safety: crossfade into a 24 dB/oct 500 Hz low-pass.
      const safe = this.safety2.step(this.safety1.step(mix));
      mix = mix * (1 - hc) + safe * hc;

      // Gentle saturation keeps every sum inside ±1 without a hard clip.
      out[i] = Math.tanh(mix * m * 0.9);
      this.time += dt;
    }
  }

  private spawnBubble(gain: number): void {
    const b = this.bubbles.find((x) => !x.active);
    if (!b) return;
    b.active = true;
    b.phase = 0;
    b.t = 0;
    b.f0 = 900 + this.nextUnit() * 1700;
    b.decay = 0.012 + this.nextUnit() * 0.02;
    b.gain = 0.3 * gain * (0.5 + this.nextUnit() * 0.5);
  }

  /** xorshift32 → [-1, 1) */
  private nextWhite(): number {
    return this.rng.next() / 2_147_483_648 - 1;
  }

  /** [0, 1) */
  private nextUnit(): number {
    return (this.rng.next() >>> 8) / 16_777_216;
  }
}
