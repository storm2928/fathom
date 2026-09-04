import { Texture } from 'pixi.js';

/**
 * Every sprite texture in the scene, drawn once into small 2D canvases at
 * construction. All are white so sprites tint them; no texture is coloured at
 * draw time and no image file is involved.
 */

export interface SceneTextures {
  dot: Texture;
  softDot: Texture;
  cone: Texture;
  fog: Texture;
  vignette: Texture;
  bubble: Texture;
  fish: Texture;
  leaf: Texture;
  bell: Texture;
  strip: Texture;
  whale: Texture;
  angler: Texture;
  snow: Texture;
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** A small canvas painted once. Returns null when 2D contexts are unavailable. */
export function paintCanvas(w: number, h: number, paint: Painter): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx, w, h);
  return canvas;
}

function texture(w: number, h: number, paint: Painter): Texture {
  const canvas = paintCanvas(w, h, paint);
  return canvas ? Texture.from(canvas) : Texture.WHITE;
}

const white = (alpha: number) => `rgba(255,255,255,${alpha})`;

export const paintDot: Painter = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, white(1));
  g.addColorStop(0.35, white(0.55));
  g.addColorStop(1, white(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const paintSoftDot: Painter = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, white(1));
  g.addColorStop(0.3, white(0.35));
  g.addColorStop(1, white(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const paintCone: Painter = (ctx, w, h) => {
  const apexX = w / 2;
  const apexY = h * 0.03;
  const scales = [1.0, 1.04, 1.08];
  for (const s of scales) {
    ctx.save();
    ctx.translate(apexX, apexY);
    ctx.scale(s, s);
    ctx.translate(-apexX, -apexY);
    const g = ctx.createLinearGradient(0, apexY, 0, h);
    g.addColorStop(0, white(0.9 * 0.5));
    g.addColorStop(1, white(0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(w * 0.156, h);
    ctx.lineTo(w * 0.844, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Soften the edges with a horizontal radial falloff.
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  mask.addColorStop(0, white(1));
  mask.addColorStop(0.6, white(0.85));
  mask.addColorStop(1, white(0));
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
};

export const paintFog: Painter = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, white(0));
  g.addColorStop(0.45, white(0));
  g.addColorStop(1, white(1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const paintVignette: Painter = (ctx, w, h) => {
  const r = Math.sqrt(w * w + h * h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const paintBubble: Painter = (ctx, w, h) => {
  ctx.strokeStyle = white(0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = white(0.8);
  ctx.beginPath();
  ctx.arc(6, 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
};

export const paintFish: Painter = (ctx, w, h) => {
  ctx.fillStyle = white(1);
  ctx.beginPath();
  ctx.ellipse(8, h / 2, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, h / 2);
  ctx.lineTo(w, 0.5);
  ctx.lineTo(w, h - 0.5);
  ctx.closePath();
  ctx.fill();
};

export const paintLeaf: Painter = (ctx, w, h) => {
  ctx.fillStyle = white(1);
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, w / 2);
  ctx.fill();
};

export const paintBell: Painter = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, w / 2);
  g.addColorStop(0, white(0.55));
  g.addColorStop(1, white(0.15));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.9, w / 2 - 2, h * 0.86, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = white(0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.9, w / 2 - 2, h * 0.86, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
};

export const paintStrip: Painter = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, white(0.8));
  g.addColorStop(1, white(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const paintWhale: Painter = (ctx, w, h) => {
  const scales = [1.0, 1.05, 1.1];
  for (const s of scales) {
    ctx.save();
    ctx.translate(w * 0.45, h / 2);
    ctx.scale(s, s);
    ctx.fillStyle = white(0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = white(0.7);
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h / 2);
  ctx.lineTo(w - 2, h * 0.12);
  ctx.lineTo(w - 2, h * 0.88);
  ctx.closePath();
  ctx.fill();
};

export const paintAngler: Painter = (ctx, w, h) => {
  ctx.fillStyle = white(1);
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h / 2, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw notch.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.5);
  ctx.lineTo(w * 0.45, h * 0.42);
  ctx.lineTo(w * 0.45, h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
};

export const paintSnow: Painter = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, white(1));
  g.addColorStop(1, white(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export function buildTextures(): SceneTextures {
  return {
    dot: texture(32, 32, paintDot),
    softDot: texture(64, 64, paintSoftDot),
    cone: texture(256, 256, paintCone),
    fog: texture(1, 256, paintFog),
    vignette: texture(256, 256, paintVignette),
    bubble: texture(16, 16, paintBubble),
    fish: texture(24, 10, paintFish),
    leaf: texture(6, 24, paintLeaf),
    bell: texture(96, 72, paintBell),
    strip: texture(4, 64, paintStrip),
    whale: texture(320, 110, paintWhale),
    angler: texture(64, 40, paintAngler),
    snow: texture(8, 8, paintSnow),
  };
}
