import {
  ARENA, COLS, ROWS, BULLET_RADIUS, MAG_SIZE, RELOAD_TIME,
  POWERUP_RADIUS, FAT_DURATION, SMALL_DURATION, SHIELD_RADIUS, SHIELD_HITS,
  playerRadius, brushRadius, shieldPositions,
} from './game.js';
import { updateFx, shakeOffset, drawBackgroundFx, drawWallFx, drawMeteors, drawSmoke, drawTopFx } from './fx.js';
import { powerupIcon } from './icons.js';
import { createBackground, BG_W, BG_H } from './background.js';
import { PX, VIEW_W, VIEW_H, snap, disc, ring, drawSprite, rect, drawText, hexToRgb } from './pixel.js';

const ORPHAN_RGB = [107, 114, 128];

export const POWERUP_STYLE = {
  fat:      { label: 'FAT',  fill: '#fb923c', outline: '#9a3412' },
  ricochet: { label: 'RIC',  fill: '#ef4444', outline: '#7f1d1d' },
  small:    { label: 'SMOL', fill: '#3b82f6', outline: '#1e3a8a' },
  defense:  { label: 'DEF',  fill: '#22c55e', outline: '#14532d' },
  shotgun:  { label: 'SHOTGUN', fill: '#facc15', outline: '#713f12' },
  uzi:      { label: 'UZI',     fill: '#a855f7', outline: '#3b0764' },
  rocket:   { label: 'ROCKET',  fill: '#94a3b8', outline: '#1e293b' },
  eraser:   { label: 'ERASER',  fill: '#2dd4bf', outline: '#134e4a' },
  meteor:   { label: 'METEORS', fill: '#1e1b4b', outline: '#f97316' },
};

const SHIELD_FRESH = '#86efac';
const SHIELD_CRACKED = '#16a34a';
// Per bullet kind: pixel radius + colors. Ricochet rounds of any gun are red.
const BULLET_STYLE = {
  pistol:   { r: 2, fill: '#ffe066', outline: '#7a5c00' },
  pellet:   { r: 1, fill: '#ffb347', outline: '#7c2d12' },
  uzi:      { r: 1, fill: '#e9d5ff', outline: '#3b0764' },
  ricochet: { r: 2, fill: '#ff6b6b', outline: '#7f1d1d' },
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
    // Menus size themselves in game pixels via this CSS variable.
    canvas.parentElement.style.setProperty('--px', `${scale / dpr}px`);
  };
  window.addEventListener('resize', fit);
  fit();
  return canvas.getContext('2d');
}

// localId = whose HUD to show; input = their current controls (for the pen cursor).
let lastGame = null;

export function render(ctx, game, localId, input) {
  const now = performance.now();
  // Everything below is in arena units; this maps them onto the half-resolution canvas
  // (offset by any screen shake).
  const shake = shakeOffset(now);
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, shake.x / PX, shake.y / PX);
  ctx.imageSmoothingEnabled = false;
  if (game !== lastGame) {
    // New round = fresh game state: forget what we'd drawn and flashed for the old one.
    lastGame = game;
    wallsDrawnVersion = -1;
    for (const id of Object.keys(seenHits)) delete seenHits[id];
  }

  updateFx(game, now, wallPixels);   // before drawWalls: the eraser effect needs the old walls
  drawBackground(ctx, game.bgSeed);
  drawHitFlash(ctx, game);
  drawBackgroundFx(ctx, now);
  drawWalls(ctx, game);
  drawWallFx(ctx, now);

  const border = '#3a3f4b';
  rect(ctx, 0, 0, ARENA.w, PX * 2, border);
  rect(ctx, 0, ARENA.h - PX * 2, ARENA.w, PX * 2, border);
  rect(ctx, 0, 0, PX * 2, ARENA.h, border);
  rect(ctx, ARENA.w - PX * 2, 0, PX * 2, ARENA.h, border);

  drawMeteors(ctx, game);
  for (const u of game.powerups) drawPowerup(ctx, u);
  for (const p of Object.values(game.players)) drawPlayer(ctx, p, game.rules);

  drawSmoke(ctx, now);
  for (const b of game.bullets) {
    if (b.kind === 'rocket') drawRocket(ctx, b);
    else {
      const base = BULLET_STYLE[b.kind] || BULLET_STYLE.pistol;
      const look = b.ricochet ? BULLET_STYLE.ricochet : base;
      drawSprite(ctx, disc(base.r, look.fill, look.outline), b.x, b.y);
    }
  }
  drawTopFx(ctx, now);

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
  const icon = powerupIcon(u.type);
  if (icon) drawSprite(ctx, icon, u.x, u.y);
  else drawText(ctx, s.label, u.x + PX, u.y + PX, { color: '#ffffff', outline: s.outline, align: 'center', valign: 'middle' });
}

// Rocket: white nose, orange body, pointing where it flies.
function drawRocket(ctx, b) {
  const s = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / s, uy = b.vy / s;
  drawSprite(ctx, disc(2, '#fb923c', '#7c2d12'), b.x - ux * 5, b.y - uy * 5);
  drawSprite(ctx, disc(2, '#ffffff', '#3f3f46'), b.x + ux * 3, b.y + uy * 3);
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

function drawPlayer(ctx, p, rules) {
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
  const frac = p.hp / rules.maxHp;
  rect(ctx, x, y, w * frac, h, frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171');

  // Thin reload bar under the health bar, visible to everyone.
  if (p.reloading > 0) rect(ctx, x, y + h + PX * 2, w * (1 - p.reloading / RELOAD_TIME), PX, '#e5e7eb');
  // GET SMALL timer, below that.
  if (p.small > 0) rect(ctx, x, y + h + PX * 4, w * (p.small / SMALL_DURATION), PX, POWERUP_STYLE.small.fill);

  // Vertical ink bar on the left of the cursor, in the player's color, filling from the bottom.
  const iw = 4, ih = 36;
  const ix = snap(px - r * 1.3 - 9), iy = py - ih / 2;
  rect(ctx, ix - PX, iy - PX, iw + PX * 2, ih + PX * 2, BAR_BG);
  const inkH = snap((p.ink / rules.penCapacity) * ih);
  rect(ctx, ix, iy + ih - inkH, iw, inkH, p.color);

  // FAT WALLS timer: thin bar just left of the ink bar.
  if (p.fat > 0) {
    const fh = snap(ih * (p.fat / FAT_DURATION));
    rect(ctx, ix - PX * 3, iy + ih - fh, PX, fh, POWERUP_STYLE.fat.fill);
  }

  drawText(ctx, p.name, px, y - PX * 2, { color: '#e5e7eb', align: 'center', valign: 'bottom' });
}

function drawHud(ctx, me, input) {
  if (!me.alive) return;
  // Ammo, bottom-left: the powerup weapon if you have one, otherwise the pistol magazine.
  const x = 16, y = ARENA.h - 12;
  if (me.weapon && me.weapon !== 'pistol') {
    const s = POWERUP_STYLE[me.weapon];
    const icon = powerupIcon(me.weapon);
    ctx.drawImage(icon, x, y - 34, icon.width * PX * 2, icon.height * PX * 2);
    drawText(ctx, `${s.label} ${me.weaponAmmo}`, x + icon.width * PX * 2 + 12, y, { size: 16, color: s.fill, valign: 'bottom' });
  } else if (me.reloading > 0) {
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

// Menus: just the generative art.
export function renderBackdrop(ctx, seed) {
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, seed);
}

// ---- match overlay: scoreboard, round, timer, countdown, banners ----

export function renderMatchHud(ctx, match, localId) {
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);   // the HUD doesn't shake
  const game = match.game;

  // HUD blocks turn see-through while a player is underneath them (spawns sit in the corners).
  const under = (x0, y0, x1, y1) =>
    Object.values(game.players).some((p) => p.alive && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1);

  // Top-left: every player's name and rounds won.
  let y = 14;
  ctx.globalAlpha = under(0, 0, 250, 30 + match.roster.length * 22) ? 0.3 : 1;
  for (const r of match.roster) {
    const p = game.players[r.id];
    const alive = p && p.alive;
    rect(ctx, 16, y + 4, 10, 10, BAR_BG);
    rect(ctx, 18, y + 6, 6, 6, alive ? r.color : darken(r.color));
    drawText(ctx, r.name, 34, y, { color: alive ? '#ffffff' : '#9ca3af' });
    drawText(ctx, `${match.scores[r.id] ?? 0}`, 214, y, { color: '#ffe066', align: 'right' });
    y += 22;
  }

  // Top-center: round number, then the clock (or the sudden death warning).
  const cx = ARENA.w / 2;
  ctx.globalAlpha = under(cx - 140, 0, cx + 140, 110) ? 0.3 : 1;
  drawText(ctx, `ROUND ${match.round}`, cx, 12, { size: 16, align: 'center' });
  drawText(ctx, `FIRST TO ${match.settings.roundsToWin} WINS`, cx, 52, { color: '#d1d5db', align: 'center' });
  if (match.suddenDeath) {
    if (Math.floor(performance.now() / 300) % 2 === 0) drawText(ctx, 'SUDDEN DEATH', cx, 74, { color: '#f87171', align: 'center' });
  } else if (match.settings.roundTime > 0 && match.phase === 'playing') {
    const left = Math.max(0, Math.ceil(match.settings.roundTime - match.roundTime));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    drawText(ctx, clock, cx, 74, { color: left <= 10 ? '#f87171' : '#ffffff', align: 'center' });
  }

  ctx.globalAlpha = 1;

  // Center: countdown, GO!, round result.
  const cy = ARENA.h / 2;
  if (match.phase === 'countdown') {
    drawText(ctx, `${Math.max(1, Math.ceil(match.timer))}`, cx, cy, { size: 16, scale: 4, align: 'center', valign: 'middle' });
  } else if (match.goTimer > 0) {
    drawText(ctx, 'GO!', cx, cy, { size: 16, scale: 4, color: '#4ade80', align: 'center', valign: 'middle' });
  } else if (match.phase === 'roundEnd') {
    const w = match.roster.find((r) => r.id === match.roundWinner);
    if (w) {
      drawText(ctx, w.name, cx, cy - 30, { size: 16, scale: 2, color: w.color, align: 'center', valign: 'middle' });
      drawText(ctx, 'WINS THE ROUND', cx, cy + 34, { size: 16, align: 'center', valign: 'middle' });
    } else {
      drawText(ctx, 'DRAW!', cx, cy, { size: 16, scale: 3, color: '#d1d5db', align: 'center', valign: 'middle' });
    }
  }

  const me = game.players[localId];
  if (me && !me.alive && match.phase === 'playing') {
    drawText(ctx, 'YOU ARE OUT - WAIT FOR THE NEXT ROUND', cx, ARENA.h - 20, { color: '#d1d5db', align: 'center', valign: 'bottom' });
  }
}
