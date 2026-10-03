import {
  ARENA, COLS, ROWS, BULLET_RADIUS, MAX_HP, MAG_SIZE, RELOAD_TIME, PEN_CAPACITY,
  POWERUP_RADIUS, FAT_DURATION, SMALL_DURATION, SHIELD_RADIUS, SHIELD_HITS,
  playerRadius, brushRadius, shieldPositions,
} from './game.js';
import { createBackground, BG_W, BG_H } from './background.js';
import { PX, VIEW_W, VIEW_H, snap, disc, ring, drawSprite, rect, drawText, hexToRgb } from './pixel.js';

const ORPHAN_RGB = [107, 114, 128];

export const POWERUP_STYLE = {
  fat:      { label: 'FAT',  fill: '#fb923c', outline: '#9a3412' },
  ricochet: { label: 'RIC',  fill: '#ef4444', outline: '#7f1d1d' },
  small:    { label: 'SMOL', fill: '#3b82f6', outline: '#1e3a8a' },
  defense:  { label: 'DEF',  fill: '#22c55e', outline: '#14532d' },
};

const SHIELD_FRESH = '#86efac';
const SHIELD_CRACKED = '#16a34a';
const BULLET_STYLE = {
  normal:   { fill: '#ffe066', outline: '#7a5c00' },
  ricochet: { fill: '#ff6b6b', outline: '#7f1d1d' },
};
const BAR_BG = '#000000aa';

// Walls are drawn onto a tiny offscreen canvas (one pixel per cell), then scaled up.
const wallCanvas = document.createElement('canvas');
wallCanvas.width = COLS;
wallCanvas.height = ROWS;
const wallCtx = wallCanvas.getContext('2d');
const wallPixels = wallCtx.createImageData(COLS, ROWS);
let wallsDrawnVersion = -1;

// Background art: rendered into a tiny canvas at ~30fps, then scaled up with no smoothing.
const BG_FRAME_MS = 1000 / 30;
const bgCanvas = document.createElement('canvas');
bgCanvas.width = BG_W;
bgCanvas.height = BG_H;
const bgCtx = bgCanvas.getContext('2d');
const bgImage = bgCtx.createImageData(BG_W, BG_H);
const bgPixels = new Uint32Array(bgImage.data.buffer);
let bgSeed = null;
let bgArt = null;
let bgStart = 0;
let bgLastDraw = -Infinity;

// Hit flash: when a player is hit, the background art glows in their color (color-dodge blend),
// instantly at peak strength, then fades out smoothly.
const FLASH_MS = 300;
const FLASH_STRENGTH = 0.3;           // peak opacity of the tint (1 = full color-dodge)
const seenHits = {};                  // player id -> hit count already flashed for
let flash = null;                     // { color, start }

// The canvas is VIEW_W x VIEW_H real pixels; CSS scales it up with nearest-neighbor (see style.css).
// We scale by a whole number of device pixels whenever the window allows, so every game pixel is the same size.
export function initCanvas(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const max = Math.min((window.innerWidth * dpr) / VIEW_W, (window.innerHeight * dpr) / VIEW_H);
    const scale = max >= 1 ? Math.floor(max) : max;
    canvas.style.width = `${(VIEW_W * scale) / dpr}px`;
    canvas.style.height = `${(VIEW_H * scale) / dpr}px`;
  };
  window.addEventListener('resize', fit);
  fit();
  return canvas.getContext('2d');
}

// localId = whose HUD to show; input = their current controls (for the pen cursor).
export function render(ctx, game, localId, input) {
  // Everything below is in arena units; this maps them onto the half-resolution canvas.
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  ctx.imageSmoothingEnabled = false;

  drawBackground(ctx, game.bgSeed);
  drawHitFlash(ctx, game);
  drawWalls(ctx, game);

  const border = '#3a3f4b';
  rect(ctx, 0, 0, ARENA.w, PX * 2, border);
  rect(ctx, 0, ARENA.h - PX * 2, ARENA.w, PX * 2, border);
  rect(ctx, 0, 0, PX * 2, ARENA.h, border);
  rect(ctx, ARENA.w - PX * 2, 0, PX * 2, ARENA.h, border);

  for (const u of game.powerups) drawPowerup(ctx, u);
  for (const p of Object.values(game.players)) drawPlayer(ctx, p);

  const br = Math.round(BULLET_RADIUS / PX);
  for (const b of game.bullets) {
    const s = b.ricochet ? BULLET_STYLE.ricochet : BULLET_STYLE.normal;
    drawSprite(ctx, disc(br, s.fill, s.outline), b.x, b.y);
  }

  const me = game.players[localId];
  if (me) drawHud(ctx, me, input);
}

function drawBackground(ctx, seed) {
  const now = performance.now();
  if (seed !== bgSeed) {
    bgSeed = seed;
    bgArt = createBackground(seed);
    bgStart = now;
    bgLastDraw = -Infinity;
  }
  if (now - bgLastDraw >= BG_FRAME_MS) {
    bgArt.draw(bgPixels, (now - bgStart) / 1000);
    bgCtx.putImageData(bgImage, 0, 0);
    bgLastDraw = now;
  }
  ctx.drawImage(bgCanvas, 0, 0, ARENA.w, ARENA.h);
}

function drawHitFlash(ctx, game) {
  const now = performance.now();
  for (const p of Object.values(game.players)) {
    if (p.hitCount > (seenHits[p.id] ?? p.hitCount)) flash = { color: p.color, start: now };
    seenHits[p.id] = p.hitCount;
  }
  if (!flash) return;
  const k = (now - flash.start) / FLASH_MS;
  if (k >= 1) {
    flash = null;
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.globalAlpha = FLASH_STRENGTH * (1 - k) * (1 - k);  // ease-out: no ramp up, smooth falloff
  ctx.fillStyle = flash.color;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.restore();
}

function drawWalls(ctx, game) {
  if (game.wallsVersion !== wallsDrawnVersion) {
    // Each cell is painted in the color of the player who drew it (gray if they've left).
    const colors = {};
    for (const p of Object.values(game.players)) colors[p.slot] = hexToRgb(p.color);
    const d = wallPixels.data;
    for (let i = 0; i < game.walls.length; i++) {
      const o = i * 4;
      const slot = game.walls[i];
      const rgb = colors[slot] || ORPHAN_RGB;
      d[o] = rgb[0];
      d[o + 1] = rgb[1];
      d[o + 2] = rgb[2];
      d[o + 3] = slot ? 255 : 0;
    }
    wallCtx.putImageData(wallPixels, 0, 0);
    wallsDrawnVersion = game.wallsVersion;
  }
  ctx.drawImage(wallCanvas, 0, 0, ARENA.w, ARENA.h);
}

function drawPowerup(ctx, u) {
  const s = POWERUP_STYLE[u.type];
  drawSprite(ctx, disc(Math.round(POWERUP_RADIUS / PX), s.fill, s.outline, 2), u.x, u.y);
  drawText(ctx, s.label, u.x + PX, u.y + PX, { color: '#ffffff', outline: s.outline, align: 'center', valign: 'middle' });
}

// ---- player sprite: a classic arrow mouse cursor ----

// Pixel mask, tip at the top-left. Edge pixels become the outline, the rest is fill.
const CURSOR_MASK = [
  'X',
  'XX',
  'XXX',
  'XXXX',
  'XXXXX',
  'XXXXXX',
  'XXXXXXX',
  'XXXXXXXX',
  'XXXXXXXXX',
  'XXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXX',
  'XXX.XXXX',
  'XX..XXXX',
  'X....XXXX',
  '.....XXXX',
  '......XX',
];
const CURSOR_ROWS = CURSOR_MASK.length;
const CURSOR_COLS = Math.max(...CURSOR_MASK.map((row) => row.length));
const cursorAt = (c, r) => r >= 0 && r < CURSOR_ROWS && CURSOR_MASK[r][c] === 'X';
// 0 = empty, 1 = outline, 2 = fill
const CURSOR_CELLS = CURSOR_MASK.map((row, r) =>
  Array.from({ length: CURSOR_COLS }, (_, c) => {
    if (!cursorAt(c, r)) return 0;
    const edge = !cursorAt(c - 1, r) || !cursorAt(c + 1, r) || !cursorAt(c, r - 1) || !cursorAt(c, r + 1);
    return edge ? 1 : 2;
  })
);
// The sprite is centered on the player by its center of mass, and rotated so the tip points along the aim.
const CURSOR_CENTER = (() => {
  let sx = 0, sy = 0, n = 0;
  CURSOR_CELLS.forEach((row, r) => row.forEach((v, c) => {
    if (v) { sx += c + 0.5; sy += r + 0.5; n++; }
  }));
  return { x: sx / n, y: sy / n };
})();
const CURSOR_TIP_ANGLE = Math.atan2(0.5 - CURSOR_CENTER.y, 0.5 - CURSOR_CENTER.x);
const CURSOR_LENGTH = 2.4;            // sprite height, in player radii

const darkColors = {};
function darken(hex) {
  if (!darkColors[hex]) {
    const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 0.55));
    darkColors[hex] = `rgb(${r}, ${g}, ${b})`;
  }
  return darkColors[hex];
}

// Rasterizes the rotated cursor onto the pixel grid (no smoothing), so it looks like an aliased
// cursor at any angle. A few hundred samples per player — trivial.
function drawCursor(ctx, x, y, angle, radius, color) {
  const scale = (radius * CURSOR_LENGTH) / CURSOR_ROWS;   // arena px per mask cell
  const rot = angle - CURSOR_TIP_ANGLE;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const reach = Math.hypot(CURSOR_COLS, CURSOR_ROWS) * scale;
  const P = PX;
  const x0 = Math.floor((x - reach) / P) * P, x1 = x + reach;
  const y0 = Math.floor((y - reach) / P) * P, y1 = y + reach;

  const fill = new Path2D(), outline = new Path2D();
  for (let sy = y0; sy < y1; sy += P) {
    for (let sx = x0; sx < x1; sx += P) {
      const dx = sx + P / 2 - x, dy = sy + P / 2 - y;
      const c = Math.floor((dx * cos - dy * sin) / scale + CURSOR_CENTER.x);
      const r = Math.floor((dx * sin + dy * cos) / scale + CURSOR_CENTER.y);
      if (c < 0 || c >= CURSOR_COLS || r < 0 || r >= CURSOR_ROWS) continue;
      const v = CURSOR_CELLS[r][c];
      if (v === 1) outline.rect(sx, sy, P, P);
      else if (v === 2) fill.rect(sx, sy, P, P);
    }
  }
  ctx.fillStyle = darken(color);
  ctx.fill(outline);
  ctx.fillStyle = color;
  ctx.fill(fill);
}

function drawPlayer(ctx, p) {
  const r = playerRadius(p);

  ctx.globalAlpha = p.alive ? 1 : 0.25;
  drawCursor(ctx, p.x, p.y, p.aim, r, p.color);
  ctx.globalAlpha = 1;

  if (!p.alive) return;

  // Defense spheres: bright green when intact, darker green once they've taken a hit.
  const sr = Math.round(SHIELD_RADIUS / PX);
  for (const s of shieldPositions(p)) {
    const fill = s.hits >= SHIELD_HITS ? SHIELD_FRESH : SHIELD_CRACKED;
    drawSprite(ctx, disc(sr, fill, POWERUP_STYLE.defense.outline), s.x, s.y);
  }

  // Bars are drawn relative to the snapped position so they don't shimmer against the sprite.
  const px = snap(p.x), py = snap(p.y);

  // Health bar above the cursor.
  const w = 40, h = 4;
  const x = px - w / 2, y = snap(py - r - 16);
  rect(ctx, x - PX, y - PX, w + PX * 2, h + PX * 2, BAR_BG);
  const frac = p.hp / MAX_HP;
  rect(ctx, x, y, w * frac, h, frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171');

  // Thin reload bar under the health bar, visible to everyone.
  if (p.reloading > 0) rect(ctx, x, y + h + PX * 2, w * (1 - p.reloading / RELOAD_TIME), PX, '#e5e7eb');
  // GET SMALL timer, below that.
  if (p.small > 0) rect(ctx, x, y + h + PX * 4, w * (p.small / SMALL_DURATION), PX, POWERUP_STYLE.small.fill);

  // Vertical ink bar on the left of the cursor, in the player's color, filling from the bottom.
  const iw = 4, ih = 36;
  const ix = snap(px - r * 1.3 - 9), iy = py - ih / 2;
  rect(ctx, ix - PX, iy - PX, iw + PX * 2, ih + PX * 2, BAR_BG);
  const inkH = snap((p.ink / PEN_CAPACITY) * ih);
  rect(ctx, ix, iy + ih - inkH, iw, inkH, p.color);

  // FAT WALLS timer: thin bar just left of the ink bar.
  if (p.fat > 0) {
    const fh = snap(ih * (p.fat / FAT_DURATION));
    rect(ctx, ix - PX * 3, iy + ih - fh, PX, fh, POWERUP_STYLE.fat.fill);
  }

  drawText(ctx, p.name, px, y - PX * 2, { color: '#e5e7eb', align: 'center', valign: 'bottom' });
}

function drawHud(ctx, me, input) {
  // Ammo, bottom-left.
  const x = 16, y = ARENA.h - 12;
  if (me.reloading > 0) {
    drawText(ctx, `RELOADING ${me.reloading.toFixed(1)}s`, x, y, { size: 16, color: '#facc15', valign: 'bottom' });
  } else {
    drawText(ctx, `${me.ammo} / ${MAG_SIZE}`, x, y, { size: 16, color: me.ammo <= 5 ? '#f87171' : '#e5e7eb', valign: 'bottom' });
  }
  if (me.ricochet > 0) {
    drawText(ctx, `RICOCHET x${me.ricochet}`, x, y - 44, { size: 16, color: POWERUP_STYLE.ricochet.fill, valign: 'bottom' });
  }

  // Pen cursor while in draw mode.
  if (input.draw && me.alive) {
    const color = me.ink > 0 ? me.color : '#f87171';
    const r = Math.round(brushRadius(me) / PX);
    // Dark rings just inside and outside keep it readable on any background.
    drawSprite(ctx, ring(r + 1, '#000000'), input.mx, input.my);
    drawSprite(ctx, ring(r - 1, '#000000'), input.mx, input.my);
    drawSprite(ctx, ring(r, color), input.mx, input.my);
  }
}
