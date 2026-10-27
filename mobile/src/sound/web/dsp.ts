/**
 * The building blocks of the browser soundscape, ported from Soundscape.swift.
 * Plain arithmetic: nothing here allocates once constructed.
 */

/** Topology-preserving state-variable filter (Zavalishin). Stable under
 *  fast cutoff changes, which the depth sweep needs. */
export class SVF {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  /** The band-pass output of the last step; `step` returns the low-pass. */
  band = 0;

  tune(cutoff: number, q: number, rate: number): void {
    const g = Math.tan((Math.PI * Math.min(cutoff, rate * 0.45)) / rate);
    const k = 1 / q;
    this.a1 = 1 / (1 + g * (g + k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  /** Returns the low-pass output and leaves the band-pass in `band`. */
  step(v0: number): number {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.band = v1;
    return v2;
  }
}

/** One-pole smoother for anything audible. */
export class Smooth {
  value: number;
  private readonly coef: number;
  constructor(value: number, seconds: number, rate: number) {
    this.value = value;
    this.coef = Math.exp(-1 / (seconds * rate));
  }
  step(target: number): number {
    this.value = target + (this.value - target) * this.coef;
    return this.value;
  }
}

/** xorshift32, as the Swift synth runs it on a UInt32. */
export class XorShift {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.state;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    this.state = x;
    return x;
  }
}
