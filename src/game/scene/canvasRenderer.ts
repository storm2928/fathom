import {
  PIXELS_PER_METRE,
  driftMotes,
  lookForZone,
  seedMotes,
} from './renderer';
import type { Mote, SceneRenderer, SceneState } from './renderer';

/**
 * The 2D fallback.
 *
 * Kept because WebGL is not guaranteed: a locked-down machine, a blocked
 * context, a browser with hardware acceleration off. A judge on a borrowed
 * laptop should see a dive rather than a blank rectangle, and this is cheap
 * insurance for that.
 */

const MOTE_COUNT = 70;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class CanvasSceneRenderer implements SceneRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly motes: Mote[];
  private readonly reducedMotion: boolean;

  constructor(canvas: HTMLCanvasElement, options: { reducedMotion?: boolean } = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.reducedMotion = options.reducedMotion ?? false;
    this.motes = this.reducedMotion ? [] : seedMotes(MOTE_COUNT);
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.canvas.width = Math.round(clientWidth * dpr);
    this.canvas.height = Math.round(clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(state: SceneState, dtSeconds: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;

    if (!this.reducedMotion) driftMotes(this.motes, dtSeconds, state.depth);
    const look = lookForZone(state.zone);

    const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, look.top);
    gradient.addColorStop(1, look.bottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);

    const centre = h / 2;
    for (const mote of this.motes) {
      const y = centre + (mote.depth - state.depth) * PIXELS_PER_METRE;
      if (y < -10 || y > h + 10) continue;
      const lit = clamp01(1 - Math.abs(y - centre) / (h * 0.45)) * state.light;
      this.ctx.globalAlpha = clamp01(mote.glow * (0.35 + lit));
      this.ctx.fillStyle = look.mote;
      this.ctx.beginPath();
      this.ctx.arc(mote.x * w, y, mote.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    if (state.light > 0.01) {
      const reach = h * (0.18 + state.light * 0.5);
      const glow = this.ctx.createRadialGradient(w / 2, centre, 0, w / 2, centre, reach);
      glow.addColorStop(0, look.light);
      glow.addColorStop(1, 'transparent');
      this.ctx.globalAlpha = 0.18 * state.light;
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.globalAlpha = 1;
    }

    this.ctx.save();
    this.ctx.translate(w / 2, centre);
    this.ctx.rotate(state.descending ? 0.12 : 0);
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = `hsl(190 40% ${72 + state.light * 20}%)`;
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.fillStyle = 'hsl(185 40% 82% / 0.85)';
    this.ctx.font = '500 13px ui-monospace, Consolas, monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${state.depth.toFixed(1)} m`, 16, 26);
    this.ctx.textAlign = 'right';
    this.ctx.fillText(state.promptStep, w - 16, 26);
    this.ctx.fillText(`light ${(state.light * 100).toFixed(0)}%`, w - 16, 44);
    this.ctx.textAlign = 'left';
  }

  destroy(): void {
    // Nothing retained: the canvas belongs to the caller.
  }
}
