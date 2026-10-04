import {
  ARENA, COLS, ROWS, BULLET_RADIUS, MAG_SIZE, RELOAD_TIME,
  POWERUP_RADIUS, FAT_DURATION, SMALL_DURATION, SHIELD_RADIUS, SHIELD_HITS,
  playerRadius, brushRadius, shieldPositions, mirrorScale, GHOST_DURATION, SPEED_DURATION,
  LOBBY_WALL_LIFE, LOBBY_WALL_FADE, PLAYER_RADIUS,
  PAINT_SLOT,
} from './game.js';
import {
  updateFx, shakeOffset, drawBackgroundFx, drawWallFx, drawMeteors, drawSmoke, drawTopFx,
  drawGravity, gravityFlash, drawPlayerFx, drawBlackout, drawBanners, drawFloats, drawShells,
} from './fx.js';
import { powerupIcon } from './icons.js';
import { createBackground, BG_W, BG_H } from './background.js';
import { teamsOf } from './settings.js';
import { drawPlayerSprite, darken, muzzleDistance, spriteFor, BULLET_SPRITE } from './sprites.js';
import { PX, VIEW_W, VIEW_H, snap, disc, ring, drawSprite, rect, drawText, hexToRgb, textSprite } from './pixel.js';

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
  laser:    { label: 'LASER',   fill: '#164e63', outline: '#22d3ee' },
  sniper:   { label: 'SNIPER',  fill: '#65a30d', outline: '#1a2e05' },
  flamer:   { label: 'FLAMER',  fill: '#ea580c', outline: '#431407' },
  grenade:  { label: 'GRENADE', fill: '#bef264', outline: '#365314' },
  ghost:    { label: 'GHOST',   fill: '#6b7280', outline: '#111827' },
  speed:    { label: 'SPEED',   fill: '#f43f5e', outline: '#4c0519' },
  inkrush:  { label: 'INK RUSH', fill: '#bae6fd', outline: '#0c4a6e' },
  medkit:   { label: 'MEDKIT',  fill: '#b91c1c', outline: '#450a0a' },
  blackout: { label: 'BLACKOUT', fill: '#0a0a0a', outline: '#facc15' },
  gravity:  { label: 'GRAVITY', fill: '#4c1d95', outline: '#c4b5fd' },
  paintbomb: { label: 'PAINT BOMB', fill: '#fde68a', outline: '#92400e' },
  mirror:   { label: 'MIRROR',  fill: '#e2e8f0', outline: '#334155' },
  inkstorm: { label: 'INK STORM', fill: '#1d4ed8', outline: '#bfdbfe' },
};

const SHIELD_FRESH = '#86efac';
const SHIELD_CRACKED = '#16a34a';
// Per bullet kind: pixel radius + colors. Ricochet rounds of any gun are red.
// Visual size only — collision always uses BULLET_RADIUS in game.js.
const BULLET_STYLE = {
  pistol:   { r: 2.5, fill: '#fff27a', outline: '#5c3a00' },   // 6 px: a hair smaller than the rest
  pellet:   { r: 3, fill: '#ffc46b', outline: '#5c1a00' },
  uzi:      { r: 3, fill: '#f3e8ff', outline: '#3b0764' },
  sniper:   { r: 3, fill: '#f0fdff', outline: '#0e7490' },
  grenade:  { r: 4, fill: '#a3e635', outline: '#1a2e05' },
  ricochet: { r: 3, fill: '#ff8a8a', outline: '#7f1d1d' },
};
// Faint trail behind each bullet: dots back along its direction of travel (no history needed).
const TRAIL = [[6, 2, 0.8], [12, 2, 0.6], [18, 2, 0.42], [25, 1, 0.26]];   // [distance behind, pixel radius, opacity]
const BAR_BG = '#000000aa';

// Walls are drawn onto a tiny offscreen canvas (one pixel per cell), then scaled up.
const wallCanvas = document.createElement('canvas');
wallCanvas.width = COLS;
wallCanvas.height = ROWS;
const wallCtx = wallCanvas.getContext('2d');
const wallPixels = wallCtx.createImageData(COLS, ROWS);
let wallsDrawnVersion = -1;
let wallCount = 0;
const FADE_STEPS = [50, 105, 165, 220];
// Paint bomb walls: one rainbow cycle every 96 cells along the diagonal.
const PAINT_RAINBOW = Array.from({ length: 96 }, (_, i) => {
  const h = (i / 96) * 6, x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [r, g, b].map((v) => Math.round(90 + v * 165));
});   // lobby wall opacity steps on the way out
const PING_REACH = 150;                 // how far the start-of-round radar ping spreads (arena units)

// Walls get moving white highlight bands: the walls are copied to a second small canvas each frame
// and a sweeping gradient is painted only where wall pixels are ('source-atop'). Cheap — it's 320x180.
const shineCanvas = document.createElement('canvas');
shineCanvas.width = COLS;
shineCanvas.height = ROWS;
const shineCtx = shineCanvas.getContext('2d');
const SHINE_BANDS = 3;                // highlight bands across the screen at once
const SHINE_SPEED = 0.5;              // screen widths per second

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
const justHit = new Set();            // players hit this frame: their cursor flashes white for one frame
let flash = null;                     // { color, start }

// The canvas is VIEW_W x VIEW_H real pixels; CSS scales it up with nearest-neighbor (see style.css).
// We scale by a whole number of device pixels whenever the window allows, so every game pixel is the same size.
// The aiming crosshair: a pixel-art mouse cursor drawn at the game's pixel scale, so it's as chunky
// (and as easy to see) as everything else. A real CSS cursor, so it moves with zero lag.
const CROSSHAIR = [
  '......XXX......',
  '......XWX......',
  '......XWX......',
  '......XWX......',
  '......XXX......',
  '...............',
  'XXXXX..X..XXXXX',
  'XWWWX.XWX.XWWWX',
  'XXXXX..X..XXXXX',
  '...............',
  '......XXX......',
  '......XWX......',
  '......XWX......',
  '......XWX......',
  '......XXX......',
];

let crosshairCss = 'crosshair';
let crosshairHidden = false;

// While drawing, only the brush circle is shown: the crosshair hides.
export function setCrosshairHidden(canvas, hidden) {
  if (hidden === crosshairHidden) return;
  crosshairHidden = hidden;
  canvas.style.cursor = hidden ? 'none' : crosshairCss;
}

function crosshairCursor(cssPerPixel) {
  // Browsers cap cursor images at 128 px, so keep it within that.
  const size = CROSSHAIR.length;
  const unit = Math.max(2, Math.min(Math.floor(128 / size), Math.round(cssPerPixel)));
  const c = document.createElement('canvas');
  c.width = c.height = size * unit;
  const g = c.getContext('2d');
  CROSSHAIR.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = ch === 'W' ? '#ffffff' : '#000000';
    g.fillRect(x * unit, y * unit, unit, unit);
  }));
  const hot = Math.floor((size * unit) / 2);
  return `url(${c.toDataURL()}) ${hot} ${hot}, crosshair`;
}

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
    crosshairCss = crosshairCursor(scale / dpr);
    canvas.style.cursor = crosshairHidden ? 'none' : crosshairCss;
  };
  window.addEventListener('resize', fit);
  fit();
  return canvas.getContext('2d');
}

// localId = whose HUD to show; input = their current controls (for the pen cursor).
let lastGame = null;

let lastRender = performance.now();

// options: hud (ammo etc.), pattern (opacity of the spinning-cursor pattern, used in the lobby).
export function render(ctx, game, localId, input, { hud = true, pattern = 0 } = {}) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastRender) / 1000);
  lastRender = now;
  // The world is drawn in arena units onto the half-resolution canvas, offset by any screen shake
  // and flipped during Mirror World. The HUD at the end is drawn unflipped.
  const shake = shakeOffset(now);
  const flip = mirrorScale(game.mirror);
  if (game.mirror?.axis === 'x') ctx.setTransform(flip / PX, 0, 0, 1 / PX, ((ARENA.w / 2) * (1 - flip) + shake.x) / PX, shake.y / PX);
  else if (game.mirror) ctx.setTransform(1 / PX, 0, 0, flip / PX, shake.x / PX, ((ARENA.h / 2) * (1 - flip) + shake.y) / PX);
  else ctx.setTransform(1 / PX, 0, 0, 1 / PX, shake.x / PX, shake.y / PX);
  ctx.imageSmoothingEnabled = false;
  if (game !== lastGame) {
    // New round = fresh game state: forget what we'd drawn and flashed for the old one.
    lastGame = game;
    wallsDrawnVersion = -1;
    for (const id of Object.keys(seenHits)) delete seenHits[id];
  }

  updateFx(game, now, wallPixels, localId);   // before drawWalls: the eraser effect needs the old walls
  drawBackground(ctx, game.bgSeed, game.gravity);
  if (pattern) drawCursorPattern(ctx, now / 1000, pattern);
  drawHitFlash(ctx, game);
  drawBackgroundFx(ctx, now);
  drawWalls(ctx, game);
  drawWallFx(ctx, now);
  drawShells(ctx, now, dt);            // spent shells: over the walls, under everything else

  const border = '#3a3f4b';
  rect(ctx, 0, 0, ARENA.w, PX * 2, border);
  rect(ctx, 0, ARENA.h - PX * 2, ARENA.w, PX * 2, border);
  rect(ctx, 0, 0, PX * 2, ARENA.h, border);
  rect(ctx, ARENA.w - PX * 2, 0, PX * 2, ARENA.h, border);

  drawGravity(ctx, game, now);
  drawMeteors(ctx, game);
  for (const u of game.powerups) drawPowerup(ctx, u);
  for (const p of Object.values(game.players)) {
    // Ghosts are completely invisible to everyone else — cursor, bars and name.
    if (p.alive && p.ghost > 0 && p.id !== localId) continue;
    drawPlayer(ctx, p, game.rules, p.id === localId, now);
  }
  drawPlayerFx(ctx, game, now, dt);

  drawSmoke(ctx, now);
  // Shots start at the player's center (so they can't skip through walls); they stay hidden until
  // they've left the fingertip or the gun barrel, so they look like they come out of the weapon.
  // Drawn in batches (all trails, then all bodies, then all hot centers) so the per-bullet cost is
  // a few plain pixel rectangles — cheap even with hundreds of bullets flying.
  const shots = [];
  game.bullets.forEach((b, i) => {
    if ((b.travel ?? Infinity) < MUZZLE[b.kind] && !b.bounced) return;
    if (b.kind === 'rocket') return drawRocket(ctx, b);
    if (b.kind === 'flame') {
      // Flickering fire pixels.
      const fire = FLAME_COLORS[(i + Math.floor(now / 50)) % FLAME_COLORS.length];
      return drawSprite(ctx, disc(2 + (i % 2), fire, null), b.x, b.y);
    }
    const base = BULLET_STYLE[b.kind] || BULLET_STYLE.pistol;
    const look = b.ricochet ? BULLET_STYLE.ricochet : base;
    // Pistol, shotgun and uzi rounds start pale yellow and burn down to red the farther they fly.
    const fades = !b.ricochet && FADING.has(b.kind);
    const fill = fades ? BULLET_FADE[Math.min(BULLET_FADE.length - 1, Math.floor((b.travel || 0) / 75))] : look.fill;
    shots.push({ b, base, fill, outline: fades ? '#5c1a00' : look.outline });
  });
  // Faint trail: squares back along each bullet's direction of travel, never back inside the gun.
  TRAIL.forEach(([back, r, alpha]) => {
    ctx.globalAlpha = alpha;
    const size = (r * 2 - 1) * PX, off = (r - 1) * PX;
    for (const { b, fill } of shots) {
      if (b.kind === 'grenade' || (!b.bounced && (b.travel ?? Infinity) - back < MUZZLE[b.kind])) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      ctx.fillStyle = fill;
      ctx.fillRect(snap(b.x - (b.vx / sp) * back) - off, snap(b.y - (b.vy / sp) * back) - off, size, size);
    }
  });
  ctx.globalAlpha = 1;
  for (const { b, base, fill, outline } of shots) drawSprite(ctx, disc(base.r, fill, outline), b.x, b.y);
  // White-hot center pixel makes every round pop against busy backgrounds (grenades blink).
  ctx.fillStyle = '#ffffff';
  for (const { b } of shots) {
    if (b.kind === 'grenade' && Math.floor(now / 120) % 2) continue;
    ctx.fillRect(snap(b.x), snap(b.y), PX, PX);
  }
  drawTopFx(ctx, now);

  const me = game.players[localId];
  drawBlackout(ctx, game, me);
  if (me) drawPenCursor(ctx, me, input);

  // Screen-space from here on: never shaken or mirrored.
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  const toScreen = (x, y) =>
    game.mirror?.axis === 'x' ? [ARENA.w / 2 + (x - ARENA.w / 2) * flip, y]
      : game.mirror ? [x, ARENA.h / 2 + (y - ARENA.h / 2) * flip] : [x, y];
  drawFloats(ctx, game, now, localId, toScreen);
  if (me && hud) drawHud(ctx, me);
  drawBanners(ctx, now);
}

const FLAME_COLORS = ['#fde047', '#fb923c', '#ef4444', '#fff7ae'];
const MUZZLE = Object.fromEntries(Object.entries(BULLET_SPRITE).map(([kind, sprite]) => [kind, muzzleDistance(sprite, PLAYER_RADIUS)]));
const FADING = new Set(['pistol', 'pellet', 'uzi']);
const BULLET_FADE = ['#ffffe0', '#fff59a', '#ffe066', '#ffc94d', '#ffa53d', '#ff8130', '#ff5a33', '#ff3b3b'];

// SPEED BOOTS afterimages: recent positions of fast players.
const trails = new Map();               // player id -> [{ x, y, aim, t }]

function drawBackground(ctx, seed, gravity = null) {
  const now = performance.now();
  if (seed !== bgSeed) {
    bgSeed = seed;
    bgArt = createBackground(seed);
    bgStart = now;
    bgLastDraw = -Infinity;
  }
  if (now - bgLastDraw >= BG_FRAME_MS) {
    if (gravity) {
      bgArt.draw(bgWarpSrc, (now - bgStart) / 1000);
      warpBackground(gravity, now);
    } else {
      bgArt.draw(bgPixels, (now - bgStart) / 1000);
    }
    bgCtx.putImageData(bgImage, 0, 0);
    bgLastDraw = now;
  }
  ctx.drawImage(bgCanvas, 0, 0, ARENA.w, ARENA.h);
}

// GRAVITY WELL: the background art gets sucked into the hole. Each background pixel samples the art
// from farther out and twisted around the center (a pinch + a swirl that winds tighter the longer
// the well lasts), darkening toward the core and flushing red in time with the core's flashes.
// A 160x90 remap at 30fps, so it costs next to nothing.
const bgWarpSrc = new Uint32Array(BG_W * BG_H);
const WARP_REACH = 75;                  // in background pixels (the art is 160x90)
function warpBackground(g, now) {
  const s = Math.max(0, Math.min(1, g.t / 0.6, (g.dur - g.t) / 0.6));     // eases in and out
  const cx = (g.x / ARENA.w) * BG_W, cy = (g.y / ARENA.h) * BG_H;
  const red = gravityFlash(now) ? s : 0;
  const twist = 1.2 + g.t * 1.1;
  for (let y = 0; y < BG_H; y++) {
    for (let x = 0; x < BG_W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const i = y * BG_W + x;
      if (r >= WARP_REACH) {
        bgPixels[i] = bgWarpSrc[i];
        continue;
      }
      const f = (1 - r / WARP_REACH) ** 2;
      const rs = r + s * f * WARP_REACH * 0.55;
      const a = Math.atan2(dy, dx) + s * f * twist;
      const sx = Math.min(BG_W - 1, Math.max(0, (cx + Math.cos(a) * rs) | 0));
      const sy = Math.min(BG_H - 1, Math.max(0, (cy + Math.sin(a) * rs) | 0));
      const c = bgWarpSrc[sy * BG_W + sx];
      const dark = 1 - s * 0.9 * Math.max(0, 1 - r / 32) ** 1.5;
      const cool = dark * (1 - red * f * 0.5);
      const cr = Math.min(255, (c & 255) * dark + red * f * 110) | 0;
      const cg = (((c >> 8) & 255) * cool) | 0;
      const cb = (((c >> 16) & 255) * cool) | 0;
      bgPixels[i] = ((c & 0xff000000) | (cb << 16) | (cg << 8) | cr) >>> 0;
    }
  }
}

function drawHitFlash(ctx, game) {
  const now = performance.now();
  justHit.clear();
  for (const p of Object.values(game.players)) {
    if (p.hitCount > (seenHits[p.id] ?? p.hitCount)) {
      flash = { color: p.color, start: now };
      justHit.add(p.id);
    }
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
  if (game.wallsVersion !== wallsDrawnVersion || game.wallTimes) {
    // Each cell is painted in the color of the player who drew it (gray if they've left).
    // In the lobby, cells fade out in a few hard steps as they near the end of their life.
    const colors = {};
    for (const p of Object.values(game.players)) colors[p.slot] = hexToRgb(p.color);
    const paintCols = COLS;
    const d = wallPixels.data;
    let count = 0;
    for (let i = 0; i < game.walls.length; i++) {
      const o = i * 4;
      const slot = game.walls[i];
      // Paint bomb cells: a diagonal rainbow across the whole arena.
      const rgb = slot === PAINT_SLOT ? PAINT_RAINBOW[((i % paintCols) + Math.floor(i / paintCols)) % PAINT_RAINBOW.length]
        : colors[slot] || ORPHAN_RGB;
      d[o] = rgb[0];
      d[o + 1] = rgb[1];
      d[o + 2] = rgb[2];
      let alpha = slot ? 255 : 0;
      if (slot && game.wallTimes) {
        const left = LOBBY_WALL_LIFE - (game.time - game.wallTimes[i]);
        if (left < LOBBY_WALL_FADE) alpha = FADE_STEPS[Math.max(0, Math.min(3, Math.floor((left / LOBBY_WALL_FADE) * 4)))];
      }
      d[o + 3] = alpha;
      if (slot) count++;
    }
    wallCtx.putImageData(wallPixels, 0, 0);
    wallsDrawnVersion = game.wallsVersion;
    wallCount = count;
  }
  if (!wallCount) return;
  shineCtx.globalCompositeOperation = 'copy';
  shineCtx.drawImage(wallCanvas, 0, 0);
  shineCtx.globalCompositeOperation = 'source-atop';
  const t = performance.now() / 1000;
  const grad = shineCtx.createLinearGradient(0, 0, COLS, ROWS * 0.6);
  for (let i = 0; i <= 32; i++) {
    const p = i / 32;
    const wave = Math.sin((p * SHINE_BANDS - t * SHINE_SPEED * SHINE_BANDS) * Math.PI * 2);
    const a = wave > 0 ? 0.55 * wave ** 6 + 0.08 * wave : 0;      // sharp bright stripes, soft sheen around them
    grad.addColorStop(p, `rgba(255,255,255,${a.toFixed(3)})`);
  }
  shineCtx.fillStyle = grad;
  shineCtx.fillRect(0, 0, COLS, ROWS);
  ctx.drawImage(shineCanvas, 0, 0, ARENA.w, ARENA.h);
}

function drawPowerup(ctx, u) {
  const s = POWERUP_STYLE[u.type];
  drawSprite(ctx, disc(Math.round(POWERUP_RADIUS / PX), s.fill, s.outline, 2), u.x, u.y);
  const icon = powerupIcon(u.type);
  if (icon) drawSprite(ctx, icon, u.x, u.y);
  else drawText(ctx, s.label, u.x + PX, u.y + PX, { color: '#ffffff', outline: s.outline, align: 'center', valign: 'middle' });
}

// A powerup as it looks on the map (disc + icon or label), as a small canvas at 1 pixel per game
// pixel — used by the How to Play page.
export function powerupBadge(type) {
  const s = POWERUP_STYLE[type];
  const r = Math.round(POWERUP_RADIUS / PX);
  const c = document.createElement('canvas');
  c.width = c.height = r * 2 + 1;
  const g = c.getContext('2d');
  g.drawImage(disc(r, s.fill, s.outline, 2), 0, 0);
  const icon = powerupIcon(type) || textSprite(s.label, 8, '#ffffff', s.outline);
  g.drawImage(icon, Math.floor((c.width - icon.width) / 2) + (powerupIcon(type) ? 0 : 1), Math.floor((c.height - icon.height) / 2) + (powerupIcon(type) ? 0 : 1));
  return c;
}

// Rocket: white nose, orange body, pointing where it flies.
function drawRocket(ctx, b) {
  const s = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / s, uy = b.vy / s;
  drawSprite(ctx, disc(3, '#fb923c', '#7c2d12'), b.x - ux * 6, b.y - uy * 6);
  drawSprite(ctx, disc(2, '#ffffff', '#3f3f46'), b.x + ux * 4, b.y + uy * 4);
}

// ---- player sprite: the pointing hand (see sprites.js) ----

function drawCursor(ctx, x, y, angle, radius, color, sprite = 'hand') {
  // (sprite: 'hand', or the weapon held — see sprites.js)
  drawPlayerSprite(ctx, sprite, x, y, angle, radius, color);
}

function drawPlayer(ctx, p, rules, isMe, now) {
  const r = playerRadius(p);

  // Speed boots: a trail of fading afterimages.
  let trail = trails.get(p.id);
  if (p.alive && p.speed > 0) {
    if (!trail) trails.set(p.id, (trail = []));
    trail.push({ x: p.x, y: p.y, aim: p.aim, t: now, sprite: spriteFor(p.weapon) });
  }
  if (trail) {
    while (trail.length && now - trail[0].t > 260) trail.shift();
    trail.forEach((g, i) => {
      if (i % 3) return;
      ctx.globalAlpha = 0.45 * ((i + 1) / trail.length);
      drawCursor(ctx, g.x, g.y, g.aim, r, p.color, g.sprite);
    });
    if (!trail.length) trails.delete(p.id);
  }

  // Your own ghost shows as a faint flicker so you know where you are; others don't see you at all.
  ctx.globalAlpha = !p.alive ? 0.25 : p.ghost > 0 ? (Math.floor(now / 90) % 2 ? 0.3 : 0.45) : 1;
  // Just got hit: the whole cursor flashes white.
  const hit = p.alive && justHit.has(p.id);
  drawCursor(ctx, p.x, p.y, p.aim, r, hit ? '#ffffff' : p.color, spriteFor(p.weapon));
  ctx.globalAlpha = 1;

  if (!p.alive) return;

  // Laser charging: a pulsing glow that grows until the beam fires.
  if (p.charging > 0) {
    const k = 1 - p.charging / 0.45;
    ctx.globalAlpha = 0.5 + 0.5 * (Math.floor(now / 50) % 2);
    drawSprite(ctx, ring(Math.round(12 + 10 * k), '#22d3ee'), p.x, p.y);
    drawSprite(ctx, ring(Math.round(6 + 6 * k), '#ffffff'), p.x, p.y);
    ctx.globalAlpha = 1;
  }

  // Sniper: a dotted aim line everyone can see.
  if (p.weapon === 'sniper') {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.color;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    for (let d = 30; d < 1500; d += 14) {
      const x = p.x + dx * d, y = p.y + dy * d;
      if (x < 0 || y < 0 || x > ARENA.w || y > ARENA.h) break;
      ctx.fillRect(snap(x), snap(y), PX, PX);
    }
    ctx.globalAlpha = 1;
  }

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
  // Powerup timers, stacked below: GET SMALL, SPEED BOOTS, GHOST.
  let ty = y + h + PX * 4;
  for (const [left, total, color] of [
    [p.small, SMALL_DURATION, POWERUP_STYLE.small.fill],
    [p.speed, SPEED_DURATION, POWERUP_STYLE.speed.fill],
    [p.ghost, GHOST_DURATION, '#e5e7eb'],
  ]) {
    if (left <= 0) continue;
    rect(ctx, x, ty, w * (left / total), PX, color);
    ty += PX * 2;
  }

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

// The pen circle while in draw mode (drawn in the world, so it flips with Mirror World).
function drawPenCursor(ctx, me, input) {
  if (!input.draw || !me.alive) return;
  const color = me.ink > 0 ? me.color : '#f87171';
  const r = Math.round(brushRadius(me) / PX);
  // Dark rings just inside and outside keep it readable on any background.
  drawSprite(ctx, ring(r + 1, '#000000'), input.mx, input.my);
  drawSprite(ctx, ring(r - 1, '#000000'), input.mx, input.my);
  drawSprite(ctx, ring(r, color), input.mx, input.my);
}

function drawHud(ctx, me) {
  if (!me.alive) return;
  // Ammo, bottom-left: the powerup weapon if you have one, otherwise the pistol magazine.
  const x = 16, y = ARENA.h - 12;
  if (me.weapon && me.weapon !== 'pistol') {
    const s = POWERUP_STYLE[me.weapon];
    const icon = powerupIcon(me.weapon);
    ctx.drawImage(icon, x, y - 34, icon.width * PX * 2, icon.height * PX * 2);
    const label = me.charging > 0 ? 'CHARGING...' : `${s.label} ${me.weaponAmmo}`;
    drawText(ctx, label, x + icon.width * PX * 2 + 12, y, { size: 16, color: s.fill === '#0a0a0a' ? '#ffffff' : s.fill, valign: 'bottom' });
  } else if (me.reloading > 0) {
    drawText(ctx, `RELOADING ${me.reloading.toFixed(1)}s`, x, y, { size: 16, color: '#facc15', valign: 'bottom' });
  } else {
    drawText(ctx, `${me.ammo} / ${MAG_SIZE}`, x, y, { size: 16, color: me.ammo <= 5 ? '#f87171' : '#e5e7eb', valign: 'bottom' });
  }
  if (me.ricochet > 0) {
    drawText(ctx, `RICOCHET x${me.ricochet}`, x, y - 44, { size: 16, color: POWERUP_STYLE.ricochet.fill, valign: 'bottom' });
  }

}

// Menus: the generative art with a drifting pattern of spinning cursors over it.
export function renderBackdrop(ctx, seed) {
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, seed);
  drawCursorPattern(ctx, performance.now() / 1000);
}

// 60-frame sprite sheet (10 x 6 frames of 32 px) of a cursor spinning on its axis.
const spinSheet = new Image();
spinSheet.src = 'assets/cursor-spin.png';
const SPIN_FRAMES = 60, SPIN_COLS = 10, SPIN_SIZE = 32;
const SPIN_SPACING = 100;             // arena units between cursors
const SPIN_FPS = 24;

function drawCursorPattern(ctx, t, opacity = 0.5) {
  if (!spinSheet.complete || !spinSheet.naturalWidth) return;
  const S = SPIN_SPACING, size = SPIN_SIZE * PX;
  // The whole grid drifts diagonally; each cursor is a few frames behind its neighbor, so the
  // spinning ripples across the screen in waves. Every cursor has a fixed place in an endless grid
  // (col, row are absolute, not per-screen), so nothing jumps when the drift scrolls past a cell.
  const shiftX = t * 18, shiftY = t * 10;
  const row0 = Math.floor(-shiftY / S) - 1, row1 = Math.ceil((ARENA.h - shiftY) / S) + 1;
  ctx.globalAlpha = opacity;
  for (let row = row0; row <= row1; row++) {
    const stagger = row & 1 ? S / 2 : 0;
    const col0 = Math.floor((-shiftX - stagger) / S) - 1, col1 = Math.ceil((ARENA.w - shiftX - stagger) / S) + 1;
    for (let col = col0; col <= col1; col++) {
      const x = snap(col * S + shiftX + stagger), y = snap(row * S + shiftY);
      const f = (((Math.floor(t * SPIN_FPS) + col * 3 + row * 7) % SPIN_FRAMES) + SPIN_FRAMES) % SPIN_FRAMES;
      ctx.drawImage(spinSheet, (f % SPIN_COLS) * SPIN_SIZE, Math.floor(f / SPIN_COLS) * SPIN_SIZE, SPIN_SIZE, SPIN_SIZE, x - size / 2, y - size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- match overlay: scoreboard, round, timer, countdown, banners ----

export function renderMatchHud(ctx, match, localId) {
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);   // the HUD doesn't shake
  const game = match.game;

  // HUD blocks turn see-through while a player is underneath them (spawns sit in the corners).
  const under = (x0, y0, x1, y1) =>
    Object.values(game.players).some((p) => p.alive && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1);

  // Top-left: one row per team (a solo player is a team of one) with its rounds won.
  const teams = teamsOf(match.roster);
  let y = 14;
  ctx.globalAlpha = under(0, 0, 270, 30 + teams.length * 22) ? 0.3 : 1;
  for (const t of teams) {
    const alive = t.members.some((r) => game.players[r.id]?.alive);
    rect(ctx, 16, y + 4, 10, 10, BAR_BG);
    rect(ctx, 18, y + 6, 6, 6, alive ? t.color : darken(t.color));
    const name = t.name.length > 17 ? `${t.name.slice(0, 16)}..` : t.name;
    drawText(ctx, name, 34, y, { color: alive ? '#ffffff' : '#9ca3af' });
    drawText(ctx, `${match.scores[t.key] ?? 0}`, 254, y, { color: '#ffe066', align: 'right' });
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

  // Radar ping: during the countdown, rings ripple out from YOUR cursor once per beep so you can spot
  // where you spawned. Drawn only on your own screen (localId), nothing goes over the network.
  const meNow = game.players[localId];
  if (match.phase === 'countdown' && meNow?.alive) {
    const n = Math.max(1, Math.ceil(match.timer));
    const beat = Math.min(1, Math.max(0, n - match.timer));     // 0 → 1 through this second
    // A bold ring each beep, plus a thinner one trailing just behind it.
    for (const [lag, bold] of [[0, true], [0.28, false]]) {
      const k = beat - lag;
      if (k <= 0 || k >= 1) continue;
      const grow = 1 - (1 - k) ** 2;
      const r = Math.round((playerRadius(meNow) + 10 + PING_REACH * grow) / PX / 2) * 2;
      ctx.globalAlpha = (bold ? 1 : 0.6) * (k < 0.5 ? 1 : (1 - k) / 0.5);
      const band = bold ? [r + 3, r + 2, r + 1, r, r - 1] : [r + 1, r, r - 1];
      band.forEach((rr, i) => {
        const edge = i === 0 || i === band.length - 1;
        drawSprite(ctx, ring(rr, edge ? '#000000' : meNow.color), meNow.x, meNow.y);
      });
    }
    ctx.globalAlpha = 1;
  }

  // Center: countdown, GO!, round result.
  const cy = ARENA.h / 2;
  if (match.phase === 'countdown') {
    // Each number slams in big and shrinks fast (ease-out), then fades just before the next one.
    const n = Math.max(1, Math.ceil(match.timer));
    const k = Math.min(1, Math.max(0, n - match.timer));       // 0 → 1 through this second
    const e = 1 - (1 - Math.min(1, k / 0.35)) ** 3;
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
    const color = n <= 1 ? '#f87171' : n <= 3 ? '#fde047' : '#ffffff';
    drawText(ctx, `${n}`, cx, cy, { size: 16, scale: 10 - 6 * e, color, align: 'center', valign: 'middle' });
    ctx.globalAlpha = 1;
  } else if (match.goTimer > 0) {
    const k = 1 - match.goTimer / 0.8;
    const e = 1 - (1 - Math.min(1, k / 0.3)) ** 3;
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    drawText(ctx, 'GO!', cx, cy, { size: 16, scale: 9 - 4 * e, color: '#4ade80', align: 'center', valign: 'middle' });
    ctx.globalAlpha = 1;
  } else if (match.phase === 'roundEnd') {
    const w = teams.find((t) => t.key === match.roundWinner);
    if (w) {
      // Every teammate's name; long team names get a smaller size so they fit.
      drawText(ctx, w.name, cx, cy - 30, { size: 16, scale: w.name.length > 16 ? 1 : 2, color: w.color, align: 'center', valign: 'middle' });
      drawText(ctx, w.members.length > 1 ? 'WIN THE ROUND' : 'WINS THE ROUND', cx, cy + 34, { size: 16, align: 'center', valign: 'middle' });
    } else {
      drawText(ctx, 'DRAW!', cx, cy, { size: 16, scale: 3, color: '#d1d5db', align: 'center', valign: 'middle' });
    }
  }

  const me = game.players[localId];
  // During the countdown, remind players who's on their team.
  const myTeam = me && teams.find((t) => t.key === me.color);
  if (match.phase === 'countdown' && myTeam && myTeam.members.length > 1) {
    const mates = myTeam.members.filter((r) => r.id !== localId).map((r) => r.name).join(' & ');
    drawText(ctx, `YOUR TEAM: ${mates}`, cx, ARENA.h - 20, { color: myTeam.color, align: 'center', valign: 'bottom' });
  }
  if (me && !me.alive && match.phase === 'playing') {
    drawText(ctx, 'YOU ARE OUT - WAIT FOR THE NEXT ROUND', cx, ARENA.h - 20, { color: '#d1d5db', align: 'center', valign: 'bottom' });
  }
}
