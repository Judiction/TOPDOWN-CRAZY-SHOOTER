// Pixel-art drawing helpers. The game is drawn in arena units but onto a half-resolution canvas
// (PX arena units per pixel) that the browser scales up with nearest-neighbor. Canvas can't turn off
// anti-aliasing for circles or text, so those are pre-rendered once as hard-edged sprites and cached.

import { ARENA } from './game.js';

export const PX = 2;
export const VIEW_W = ARENA.w / PX;   // 640
export const VIEW_H = ARENA.h / PX;   // 360
export const FONT = 'Silkscreen';     // pixel font, crisp at 8px and 16px (loaded from Google Fonts in index.html)

export const snap = (v) => Math.round(v / PX) * PX;

const cache = new Map();
function cached(key, build) {
  let img = cache.get(key);
  if (!img) {
    if (cache.size > 600) cache.clear();
    img = build();
    cache.set(key, img);
  }
  return img;
}

// Called once the web font finishes loading, so text drawn with the fallback font gets redrawn.
export function clearSpriteCache() {
  cache.clear();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

// Slightly generous radius test: small discs come out chunky and not perfectly round, like hand-drawn pixel art.
const inDisc = (dx, dy, r) => dx * dx + dy * dy <= r * r + r * 0.8;

// Filled pixel disc of radius r (pixels) with an outline `ow` pixels thick.
export function disc(r, fill, outline, ow = 1) {
  return cached(`disc|${r}|${fill}|${outline}|${ow}`, () => {
    const size = r * 2 + 1;
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r, dy = y - r;
        if (!inDisc(dx, dy, r)) continue;
        g.fillStyle = outline && !inDisc(dx, dy, r - ow) ? outline : fill;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  });
}

// One-pixel pixel-circle outline of radius r (pixels).
export function ring(r, color) {
  return cached(`ring|${r}|${color}`, () => {
    const size = r * 2 + 1;
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    g.fillStyle = color;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r, dy = y - r;
        if (inDisc(dx, dy, r) && !inDisc(dx, dy, r - 1)) g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  });
}

// Draws a sprite centered on (x, y), snapped to the pixel grid.
export function drawSprite(ctx, img, x, y) {
  const left = snap(x) - Math.floor(img.width / 2) * PX;
  const top = snap(y) - Math.floor(img.height / 2) * PX;
  ctx.drawImage(img, left, top, img.width * PX, img.height * PX);
}

// Pixel-snapped rectangle, in arena units.
export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), snap(w), snap(h));
}

// Text rendered once at the font's native size, thresholded to hard on/off pixels, with a 1px outline
// so it reads on top of the busy background. size should be 8 or 16.
export function textSprite(str, size, color, outline) {
  return cached(`text|${str}|${size}|${color}|${outline}`, () => {
    const font = `${size}px ${FONT}, monospace`;
    const probe = makeCanvas(1, 1).getContext('2d');
    probe.font = font;
    const w = Math.ceil(probe.measureText(str).width) + 2;
    const h = size + 3;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.font = font;
    g.textBaseline = 'top';
    g.fillStyle = '#fff';
    g.fillText(str, 1, 1);

    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const on = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) on[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
    const [fr, fg, fb] = hexToRgb(color);
    const [or, og, ob] = outline ? hexToRgb(outline) : [0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4;
        let px = null;
        if (on[i]) px = [fr, fg, fb];
        else if (outline && touches(on, w, h, x, y)) px = [or, og, ob];
        if (px) {
          d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255;
        } else d[o + 3] = 0;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

function touches(on, w, h, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[ny * w + nx]) return true;
    }
  }
  return false;
}

// align: 'left' | 'center' | 'right'; valign: 'top' | 'middle' | 'bottom'.
// scale blows the pixels up (whole numbers keep it crisp) for big headline text.
export function drawText(ctx, str, x, y, { size = 8, color = '#ffffff', outline = '#000000', align = 'left', valign = 'top', scale = 1 } = {}) {
  const img = textSprite(str, size, color, outline);
  const w = img.width * PX * scale, h = img.height * PX * scale;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const top = valign === 'middle' ? y - h / 2 : valign === 'bottom' ? y - h : y;
  ctx.drawImage(img, snap(left), snap(top), w, h);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
