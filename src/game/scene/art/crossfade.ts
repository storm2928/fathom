/**
 * Zone changes are never a cut. The renderer keeps the previous zone drawn
 * and blends it out over 2.4 s (1.2 s, linear, under reduced motion).
 */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class ZoneCrossfade {
  /** the zone fading out; -1 when none */
  from = -1;
  /** the zone fading in */
  to = 0;
  /** 0-1 raw progress; 1 means settled on `to` */
  blend = 1;

  begin(from: number, to: number): void {
    this.from = from;
    this.to = to;
    this.blend = 0;
  }

  get done(): boolean {
    return this.blend >= 1;
  }

  /** Advance and return the eased blend for this frame. */
  step(dtSeconds: number, reduced: boolean): number {
    if (this.blend < 1) {
      this.blend = clamp01(this.blend + dtSeconds / (reduced ? 1.2 : 2.4));
      if (this.blend >= 1) this.from = -1;
    }
    return this.eased(reduced);
  }

  eased(reduced: boolean): number {
    const b = this.blend;
    return reduced ? b : b * b * (3 - 2 * b);
  }
}
