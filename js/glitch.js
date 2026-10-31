// Screen glitches for the intense moments: the picture tears into shifted strips, its color channels
// slide apart, blocks jump out of place and bands drop to low resolution, all for a split second.
//
// Cheap on purpose: the finished frame is copied once, then pasted back in pieces, and nothing runs
// at all while the level is at zero. A new tear pattern is picked only every few frames, which also
// looks more like a bad signal than noise that changes constantly. Everything here is local and visual.

import { VIEW_W as W, VIEW_H as H } from './pixel.js';

const DECAY = 2.4;                      // level lost per second (a full-strength hit lasts ~0.4 s)
const PATTERN_MS = 55;

function layer() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

let frame = null, red = null, cyan = null, tiny = null;
let level = 0;
let last = 0;
let nextPattern = 0;
let tears = [], blocks = [], lines = [], flips = [];
let roll = 0, split = 0, splitBand = null;

// amount 0..1: how hard this moment hits. Big hits don't stack forever, they just extend the jolt.
export function addGlitch(amount) {
  level = Math.min(1, Math.max(level, amount) + amount * 0.15);
}

const rnd = (min, max) => min + Math.random() * (max - min);

function newPattern(k) {
  tears = Array.from({ length: Math.round(2 + k * 11) }, () => ({
    y: Math.floor(rnd(0, H)),
    h: Math.floor(rnd(2, 8 + k * 28)),
    dx: Math.round(rnd(-1, 1) * (5 + k * 70)),
    pixel: Math.random() < 0.18 + k * 0.2,
  }));
  blocks = Array.from({ length: Math.round(k * 7) }, () => {
    const w = Math.floor(rnd(16, 120)), h = Math.floor(rnd(6, 44));
    const x = Math.floor(rnd(0, W - w)), y = Math.floor(rnd(0, H - h));
    return { x, y, w, h, dx: x + Math.round(rnd(-50, 50)), dy: y + Math.round(rnd(-14, 14)) };
  });
  lines = Array.from({ length: Math.round(1 + k * 8) }, () => ({
    y: Math.floor(rnd(0, H)),
    color: ['#ff2bd6', '#2bfff0', '#ffffff', '#39ff14'][Math.floor(Math.random() * 4)],
  }));
  flips = k > 0.65 ? [{ x: Math.floor(rnd(0, W - 100)), y: Math.floor(rnd(0, H - 40)), w: Math.floor(rnd(40, 180)), h: Math.floor(rnd(8, 44)) }] : [];
  roll = k > 0.7 && Math.random() < 0.45 ? Math.round(rnd(-24, 24)) : 0;
  split = k > 0.2 ? Math.round(1 + k * 5) : 0;
  // Weak glitches split only one band of the screen; strong ones split the whole picture.
  const h = k > 0.6 ? H : Math.floor(rnd(30, 110));
  splitBand = { y: k > 0.6 ? 0 : Math.floor(rnd(0, H - h)), h };
}

// `pressure` keeps the screen twitching while something is wrong (you're infected, sudden death).
export function drawGlitch(ctx, pressure = 0) {
  const now = performance.now();
  level = Math.max(0, level - (Math.min(100, now - last) / 1000) * DECAY);
  last = now;
  const k = Math.max(level, pressure > 0 && Math.random() < pressure * 0.35 ? pressure : 0);
  if (k < 0.02) return;

  if (!frame) {
    frame = layer();
    red = layer();
    cyan = layer();
    tiny = layer();
  }
  if (now >= nextPattern) {
    nextPattern = now + PATTERN_MS;
    newPattern(k);
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  frame.g.globalCompositeOperation = 'copy';
  frame.g.drawImage(ctx.canvas, 0, 0);

  // Vertical hold slipping: the whole picture jumps and wraps around.
  if (roll) {
    ctx.drawImage(frame.c, 0, roll);
    ctx.drawImage(frame.c, 0, roll > 0 ? roll - H : roll + H);
    frame.g.drawImage(ctx.canvas, 0, 0);
  }

  // Color channels sliding apart.
  if (split) {
    const { y, h } = splitBand;
    for (const [l, tint] of [[red, '#ff0000'], [cyan, '#00ffff']]) {
      l.g.globalCompositeOperation = 'copy';
      l.g.drawImage(frame.c, 0, y, W, h, 0, y, W, h);
      l.g.globalCompositeOperation = 'multiply';
      l.g.fillStyle = tint;
      l.g.fillRect(0, y, W, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, y, W, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(red.c, 0, y, W, h, -split, y, W, h);
    ctx.drawImage(cyan.c, 0, y, W, h, split, y, W, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Torn strips, shifted sideways and wrapped around. Some drop to a chunky low resolution.
  for (const t of tears) {
    const h = Math.min(t.h, H - t.y);
    if (t.pixel) {
      const sw = Math.ceil(W / 8), sh = Math.max(1, Math.ceil(h / 4));
      tiny.g.globalCompositeOperation = 'copy';
      tiny.g.drawImage(frame.c, 0, t.y, W, h, 0, 0, sw, sh);
      ctx.drawImage(tiny.c, 0, 0, sw, sh, t.dx, t.y, W, h);
    } else {
      ctx.drawImage(frame.c, 0, t.y, W, h, t.dx, t.y, W, h);
    }
    ctx.drawImage(frame.c, 0, t.y, W, h, t.dx > 0 ? t.dx - W : t.dx + W, t.y, W, h);
  }

  for (const b of blocks) ctx.drawImage(frame.c, b.x, b.y, b.w, b.h, b.dx, b.dy, b.w, b.h);

  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#ffffff';
  for (const f of flips) ctx.fillRect(f.x, f.y, f.w, f.h);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6;
  for (const l of lines) {
    ctx.fillStyle = l.color;
    ctx.fillRect(0, l.y, W, 1);
  }
  ctx.restore();
}
