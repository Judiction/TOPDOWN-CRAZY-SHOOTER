// One-shot visual effects driven by game events: explosions, meteor strikes (white flash + screen
// shake), the ERASER's rainbow dissolve, and rocket smoke. Purely cosmetic and local to each screen,
// so nothing here is sent over the network.

import { ARENA, COLS, ROWS, EXPLOSION_RADIUS, meteorRadius, meteorFlashes } from './game.js';
import { PX, snap, disc, ring, drawSprite, drawText } from './pixel.js';

const booms = [];                     // { x, y, r, start, dur }
const puffs = [];                     // rocket smoke: { x, y, born }
let shake = { until: 0, amp: 0, dur: 1 };
let whiteFlash = null;                // { start, dur }
let invertFlash = null;
let erase = null;                     // { start, cells: Int32Array, thresholds: Float32Array }
let seenEventId = null;

const PUFF_MS = 450;
const ERASE_MS = 900;

// Rainbow lookup for the eraser dissolve.
const RAINBOW = Array.from({ length: 64 }, (_, i) => {
  const h = (i / 64) * 6;
  const f = (n) => Math.round(255 * Math.max(0, Math.min(1, Math.abs(((h + n) % 6) - 3) - 1)));
  return [f(0), f(4), f(2)];
});

const eraseCanvas = document.createElement('canvas');
eraseCanvas.width = COLS;
eraseCanvas.height = ROWS;
const eraseCtx = eraseCanvas.getContext('2d');
const eraseImage = eraseCtx.createImageData(COLS, ROWS);

// Call at the start of each frame, BEFORE walls are redrawn: wallImage still holds the walls as
// they were last drawn, which the eraser effect needs to dissolve them.
export function updateFx(game, now, wallImage) {
  const events = game.events;
  const newest = events.length ? events[events.length - 1].id : 0;
  if (seenEventId === null || newest < seenEventId) seenEventId = newest;   // first frame / new game: don't replay
  for (const e of events) {
    if (e.id <= seenEventId) continue;
    seenEventId = e.id;
    if (e.type === 'explode') {
      booms.push({ x: e.x, y: e.y, r: EXPLOSION_RADIUS, start: now, dur: 350 });
      addShake(now, 4, 160);
    } else if (e.type === 'meteor') {
      booms.push({ x: e.x, y: e.y, r: e.r * 1.1, start: now, dur: 650 });
      whiteFlash = { start: now, dur: 450 };
      addShake(now, 10, 450);
    } else if (e.type === 'erase') {
      startErase(now, wallImage);
      invertFlash = { start: now, dur: 650 };
    }
  }
  // Rocket smoke: a puff behind every rocket each frame.
  for (const b of game.bullets) {
    if (b.kind !== 'rocket') continue;
    const s = Math.hypot(b.vx, b.vy) || 1;
    puffs.push({ x: b.x - (b.vx / s) * 10, y: b.y - (b.vy / s) * 10, born: now });
  }
  while (puffs.length && (now - puffs[0].born > PUFF_MS || puffs.length > 400)) puffs.shift();
}

function addShake(now, amp, dur) {
  if (now < shake.until && shake.amp > amp) return;
  shake = { until: now + dur, amp, dur };
}

// Screen offset for this frame (whole pixels, so the art stays crisp).
export function shakeOffset(now) {
  if (now >= shake.until) return { x: 0, y: 0 };
  const a = shake.amp * ((shake.until - now) / shake.dur);
  return { x: snap((Math.random() * 2 - 1) * a), y: snap((Math.random() * 2 - 1) * a) };
}

function startErase(now, wallImage) {
  const cells = [];
  const d = wallImage.data;
  for (let i = 0; i < COLS * ROWS; i++) if (d[i * 4 + 3]) cells.push(i);
  const thresholds = new Float32Array(cells.length);
  for (let i = 0; i < thresholds.length; i++) thresholds[i] = Math.random();
  erase = { start: now, cells: Int32Array.from(cells), thresholds };
}

// After the background: the ERASER briefly inverts the background art.
export function drawBackgroundFx(ctx, now) {
  if (!invertFlash) return;
  const k = (now - invertFlash.start) / invertFlash.dur;
  if (k >= 1) return void (invertFlash = null);
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = (1 - k) ** 1.5;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.restore();
}

// After the walls: erased walls flash through a moving rainbow and dissolve pixel by pixel.
export function drawWallFx(ctx, now) {
  if (!erase) return;
  const k = (now - erase.start) / ERASE_MS;
  if (k >= 1) return void (erase = null);
  const d = eraseImage.data;
  d.fill(0);
  const shift = Math.floor(now / 12);
  for (let i = 0; i < erase.cells.length; i++) {
    if (erase.thresholds[i] < k) continue;
    const cell = erase.cells[i];
    const x = cell % COLS, y = (cell / COLS) | 0;
    const [r, g, b] = RAINBOW[(x + y + shift) & 63];
    const o = cell * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  eraseCtx.putImageData(eraseImage, 0, 0);
  ctx.drawImage(eraseCanvas, 0, 0, ARENA.w, ARENA.h);
}

// Meteor warnings: a black/white circle that grows and flashes faster until impact.
export function drawMeteors(ctx, game) {
  for (const m of game.meteors || []) {
    const white = meteorFlashes(m) % 2 === 1;
    const color = white ? '#ffffff' : '#000000';
    const r = Math.max(2, Math.round(meteorRadius(m) / PX));
    ctx.globalAlpha = 0.3;
    drawSprite(ctx, disc(r, color, null), m.x, m.y);
    ctx.globalAlpha = 1;
    drawSprite(ctx, ring(r, color), m.x, m.y);
    drawSprite(ctx, ring(r - 1, color), m.x, m.y);
    // The final size, faintly, so you can tell how big it will get.
    ctx.globalAlpha = 0.35;
    drawSprite(ctx, ring(Math.round(m.r / PX), white ? '#000000' : '#ffffff'), m.x, m.y);
    ctx.globalAlpha = 1;
  }
}

export function drawSmoke(ctx, now) {
  for (const p of puffs) {
    const k = (now - p.born) / PUFF_MS;
    if (k >= 1) continue;
    ctx.globalAlpha = 0.55 * (1 - k);
    drawSprite(ctx, disc(Math.max(1, Math.round(3 * (1 - k * 0.6))), '#d4d4d8', null), p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// On top of everything: blasts, the meteor's white flash, and the ERASED! shout.
export function drawTopFx(ctx, now) {
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    const k = (now - b.start) / b.dur;
    if (k >= 1) {
      booms.splice(i, 1);
      continue;
    }
    const grow = 1 - (1 - k) ** 3;
    const r = Math.max(1, Math.round((b.r * (0.3 + 0.7 * grow)) / PX));
    const fill = k < 0.25 ? '#ffffff' : k < 0.55 ? '#fde047' : '#fb923c';
    ctx.globalAlpha = 0.85 * (1 - k);
    drawSprite(ctx, disc(r, fill, null), b.x, b.y);
    ctx.globalAlpha = 1 - k;
    drawSprite(ctx, ring(r + 2, '#ffffff'), b.x, b.y);
  }
  ctx.globalAlpha = 1;

  if (whiteFlash) {
    const k = (now - whiteFlash.start) / whiteFlash.dur;
    if (k >= 1) whiteFlash = null;
    else {
      ctx.globalAlpha = 0.85 * (1 - k) ** 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ARENA.w, ARENA.h);
      ctx.globalAlpha = 1;
    }
  }

  if (erase) {
    const k = (now - erase.start) / ERASE_MS;
    const color = `rgb(${RAINBOW[Math.floor(now / 40) & 63].join(',')})`;
    ctx.globalAlpha = Math.min(1, 2 * (1 - k));
    drawText(ctx, 'ERASED!', ARENA.w / 2, ARENA.h / 2, { size: 16, scale: 3, color: toHex(color), align: 'center', valign: 'middle' });
    ctx.globalAlpha = 1;
  }
}

function toHex(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
