// One-shot visual effects driven by game events: explosions, laser beams, meteor strikes (white
// flash + screen shake), the ERASER's rainbow dissolve, storms, the gravity well, the blackout, pickup
// sparkles and big announcement banners. Purely cosmetic and local to each screen, so nothing here
// is sent over the network.

import { ARENA, COLS, ROWS, EXPLOSION_RADIUS, MAP_EVENTS, PAINT_SLOT, meteorRadius, meteorFlashes, playerRadius } from './game.js';
import { PX, VIEW_W, VIEW_H, snap, disc, ring, drawSprite, drawText } from './pixel.js';
import { muzzleDistance } from './sprites.js';

const booms = [];                     // { x, y, r, start, dur }
const beams = [];                     // laser: { x, y, x2, y2, color, start }
const puffs = [];                     // rocket smoke: { x, y, born }
const sparks = [];                    // pickup particles: { x, y, vx, vy, color, born, life, shape }
const glows = [];                     // medkit flash on a player: { pid, start }
const banners = [];                   // big centered text: { text, color, start, dur }
const floats = [];                    // small text over a player: { pid, text, color, start, dur, rise }
let shake = { until: 0, amp: 0, dur: 1 };
let whiteFlash = null;                // { start, dur }
let invertFlash = null;
let redFlash = null;                  // background flash when a player dies
let storm = null;                     // { start }
let erase = null;                     // { start, cells: Int32Array, thresholds: Float32Array }
let seenEventId = null;

const PUFF_MS = 450;
const ERASE_MS = 900;
const BEAM_MS = 420;
const BANNER_MS = 1300;
const STORM_MS = 3000;
// Seconds after the event at which lightning flashes; every other strike also draws a bolt.
const STORM_STRIKES = [0, 0.1, 0.32, 0.6, 0.7, 1.05, 1.4, 1.5, 1.95, 2.3, 2.4];
const FLOAT_MS = 950;

// What each powerup is called when it pops up over the player who grabbed it.
const PICKUP_NAMES = {
  fat: 'FAT WALLS', ricochet: 'RICOCHET', small: 'GET SMALL', defense: 'DEFENSE BALLS', ghost: 'GHOST',
  speed: 'SPEED BOOTS', inkrush: 'INK RUSH', medkit: 'MEDKIT', shotgun: 'SHOTGUN', uzi: 'UZI', rocket: 'ROCKETS',
  laser: 'LASER', sniper: 'SNIPER', flamer: 'FLAMETHROWER', grenade: 'GRENADES',
};

const BANNERS = {
  erase: ['ERASED!', null],
  blackout: ['BLACKOUT!', '#fde047'],
  gravity: ['GRAVITY WELL!', '#c4b5fd'],
  paintbomb: ['PAINT BOMB!', null],
  mirror: ['MIRRORED!', '#e2e8f0'],
  inkstorm: ['INK STORM!', '#93c5fd'],
};

// Rainbow lookup for the eraser dissolve and rainbow banners.
const RAINBOW = Array.from({ length: 64 }, (_, i) => {
  const h = (i / 64) * 6;
  const f = (n) => Math.round(255 * Math.max(0, Math.min(1, Math.abs(((h + n) % 6) - 3) - 1)));
  return [f(0), f(4), f(2)];
});
const brightCache = {};
function brighten(hex) {
  if (!brightCache[hex]) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (v) => Math.round(v + (255 - v) * 0.4).toString(16).padStart(2, '0');
    brightCache[hex] = `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
  }
  return brightCache[hex];
}
const rainbowHex = (i) => `#${RAINBOW[i & 63].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const eraseCanvas = document.createElement('canvas');
eraseCanvas.width = COLS;
eraseCanvas.height = ROWS;
const eraseCtx = eraseCanvas.getContext('2d');
const eraseImage = eraseCtx.createImageData(COLS, ROWS);

const darkCanvas = document.createElement('canvas');
darkCanvas.width = VIEW_W;
darkCanvas.height = VIEW_H;
const darkCtx = darkCanvas.getContext('2d');

// Call at the start of each frame, BEFORE walls are redrawn: wallImage still holds the walls as
// they were last drawn, which the eraser effect needs to dissolve them.
export function updateFx(game, now, wallImage, localId) {
  const events = game.events;
  const newest = events.length ? events[events.length - 1].id : 0;
  if (seenEventId === null || newest < seenEventId) seenEventId = newest;   // first frame / new game: don't replay
  const hidden = (pid) => {
    const p = game.players[pid];
    return p && p.ghost > 0 && pid !== localId;   // don't give away where a ghost is
  };
  for (const e of events) {
    if (e.id <= seenEventId) continue;
    seenEventId = e.id;
    if (e.type === 'shoot' && SHELLS[e.w] && !hidden(e.pid)) ejectShell(e, now);
    if ((e.type === 'shoot' && e.w !== 'laser') || e.type === 'laser') {
      const k = KICK[e.type === 'laser' ? 'laser' : e.w];
      if (k && e.pid) kicks.set(e.pid, { start: now, ...k });
    }
    if (BANNERS[e.type]) {
      const [text, color] = BANNERS[e.type];
      banners.length = 0;               // one announcement at a time: the newest replaces the old
      banners.push({ text, color, start: now, dur: BANNER_MS });
    }
    if (e.type === 'explode') {
      booms.push({ x: e.x, y: e.y, r: e.r || EXPLOSION_RADIUS, start: now, dur: 350 });
      addShake(now, 4, 160);
    } else if (e.type === 'meteor') {
      booms.push({ x: e.x, y: e.y, r: e.r * 1.1, start: now, dur: 650 });
      whiteFlash = { start: now, dur: 450 };
      addShake(now, 10, 450);
    } else if (e.type === 'deathBlast') {
      booms.push({ x: e.x, y: e.y, r: e.r, start: now, dur: 600, red: true });
      redFlash = { start: now, dur: 500 };
      addShake(now, 9, 380);
    } else if (e.type === 'erase') {
      startErase(now, wallImage);
      invertFlash = { start: now, dur: 650 };
    } else if (e.type === 'laser') {
      // The beam leaves from the laser gun's tip, not the middle of the hand.
      const len = Math.hypot(e.x2 - e.x, e.y2 - e.y) || 1, m = muzzleDistance('laser', 18);
      beams.push({ x: e.x + ((e.x2 - e.x) / len) * m, y: e.y + ((e.y2 - e.y) / len) * m, x2: e.x2, y2: e.y2, color: e.color, start: now });
      addShake(now, 7, 250);
    } else if (e.type === 'inkstorm') {
      storm = { start: now, bolts: STORM_STRIKES.map(makeBolt) };
      addShake(now, 6, 400);
    } else if (e.type === 'pickup' && !MAP_EVENTS.includes(e.kind) && PICKUP_NAMES[e.kind] && !hidden(e.pid)) {
      floats.push({ pid: e.pid, text: PICKUP_NAMES[e.kind], color: '#ffffff', start: now, dur: FLOAT_MS, rise: false });
    }
    if (e.type === 'pickup' && e.kind === 'meteor') {
      banners.length = 0;
      banners.push({ text: 'METEORS!', color: '#fb923c', start: now, dur: BANNER_MS });
    } else if (e.type === 'heal' && !hidden(e.pid)) {
      glows.push({ pid: e.pid, start: now });
      burst(e.x, e.y, '#4ade80', 10, now, 'plus');
      floats.push({ pid: e.pid, text: `+${e.amount ?? 5} HP`, color: '#4ade80', start: now, dur: 1100, rise: true });
    } else if (e.type === 'inkRush' && !hidden(e.pid)) {
      burst(e.x, e.y, game.players[e.pid]?.color || '#3b82f6', 18, now, 'drop');
    } else if (e.type === 'chip') {
      // Pixel bits off a wall, a little brighter than the wall itself.
      if (e.slot === PAINT_SLOT) {
        for (let i = 0; i < (e.big ? 8 : 4); i++) burst(e.x, e.y, rainbowHex(Math.floor(Math.random() * 64)), 2, now, 'chip');
      } else {
        const owner = Object.values(game.players).find((p) => p.slot === e.slot);
        burst(e.x, e.y, brighten(owner?.color || '#9ca3af'), e.big ? 16 : 7, now, 'chip');
      }
    } else if (e.type === 'paintbomb') {
      for (let i = 0; i < 80; i++) burst(Math.random() * ARENA.w, Math.random() * ARENA.h, rainbowHex(i * 7), 1, now, 'drop');
    } else if (e.type === 'pickup' && e.random && e.kind === 'meteor') {
      banners.length = 0;               // the other map events announce themselves; meteors need a banner
      banners.push({ text: 'METEOR SHOWER!', color: '#fdba74', start: now, dur: BANNER_MS });
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

// A jagged lightning bolt from the top of the arena down to a random point.
function makeBolt() {
  const pts = [];
  let x = 80 + Math.random() * (ARENA.w - 160), y = 0;
  const end = ARENA.h * (0.5 + Math.random() * 0.5);
  while (y < end) {
    pts.push([x, y]);
    x += (Math.random() * 2 - 1) * 60;
    y += 30 + Math.random() * 40;
  }
  pts.push([x, end]);
  return pts;
}

// ---- weapon kick ----
// The hand/weapon sprite jumps back along the aim line (and tips a little) when it fires, then
// eases back. Purely visual; the real push-back is the recoil in game.js.
const KICK = {
  pistol: { back: 4, tip: 0.08, ms: 90 },
  uzi: { back: 3, tip: 0.05, ms: 60 },
  shotgun: { back: 8, tip: 0.22, ms: 180 },
  rocket: { back: 8, tip: 0.16, ms: 200 },
  sniper: { back: 10, tip: 0.25, ms: 220 },
  laser: { back: 12, tip: 0.3, ms: 260 },
  flamer: { back: 1.5, tip: 0.02, ms: 50 },
};
const kicks = new Map();                // player id -> { start, back, tip, ms }

// How far back (px) and how much rotated (radians) player `pid`'s sprite is right now.
export function weaponKick(pid, now) {
  const k = kicks.get(pid);
  if (!k) return null;
  const t = (now - k.start) / k.ms;
  if (t >= 1 || t < 0) {
    kicks.delete(pid);
    return null;
  }
  const e = (1 - t) * (1 - t);          // instant kick, smooth return
  return { back: k.back * e, tip: k.tip * e };
}

// ---- spent shells ----
// Pistol, uzi, shotgun and sniper kick a casing out of the right side of the gun; grenades drop their
// pin ring. Plain colored rectangles that tumble (by flipping orientation), slide to a stop and fade
// quickly. Capped, so even 8 players on full auto stay cheap.

const SHELLS = {
  pistol: { w: 2, h: 1, color: '#d1d5db', edge: '#6b7280', life: 650 },   // small silver
  uzi: { w: 2, h: 1, color: '#facc15', edge: '#a16207', life: 550 },      // small gold
  shotgun: { w: 3, h: 2, color: '#ef4444', edge: '#7f1d1d', life: 800 },  // big red
  sniper: { w: 3, h: 1, color: '#e5e7eb', edge: '#4b5563', life: 900 },   // long silver
  grenade: { ring: true, color: '#d1d5db', edge: '#4b5563', life: 900 },  // the pin
};
const MAX_SHELLS = 250;
const shells = [];

function ejectShell(e, now) {
  const def = SHELLS[e.w];
  const aim = e.a ?? 0;
  const muzzle = muzzleDistance(e.w === 'pistol' ? 'hand' : e.w, 18);
  // Out of the right-hand side of the gun, a bit backward, with some randomness.
  const dir = aim + Math.PI / 2 + 0.35 + (Math.random() - 0.5) * 0.9;
  const speed = 110 + Math.random() * 120;
  shells.push({
    x: e.x + Math.cos(aim) * muzzle * 0.5,
    y: e.y + Math.sin(aim) * muzzle * 0.5,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    spin: 8 + Math.random() * 14,          // orientation flips per second while it flies
    phase: Math.random(),
    born: now,
    def,
  });
  if (shells.length > MAX_SHELLS) shells.splice(0, shells.length - MAX_SHELLS);
}

export function drawShells(ctx, now, dt) {
  const drag = Math.exp(-4.5 * dt);
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    const k = (now - s.born) / s.def.life;
    if (k >= 1) {
      shells.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= drag;
    s.vy *= drag;
    const moving = Math.abs(s.vx) + Math.abs(s.vy) > 15;
    if (moving) s.phase += s.spin * dt;
    ctx.globalAlpha = k < 0.6 ? 1 : (1 - k) / 0.4;
    const x = snap(s.x), y = snap(s.y);
    if (s.def.ring) {
      // A tiny pixel ring: the grenade pin.
      ctx.fillStyle = s.def.edge;
      ctx.fillRect(x - PX, y - PX * 2, PX * 3, PX * 4);
      ctx.fillRect(x - PX * 2, y - PX, PX * 5, PX * 2);
      ctx.fillStyle = s.def.color;
      ctx.fillRect(x, y - PX, PX, PX);
      ctx.fillRect(x - PX, y, PX, PX);
      ctx.fillRect(x + PX, y, PX, PX);
      ctx.fillRect(x, y + PX, PX, PX);
      continue;
    }
    // Tumbling: lying one way, then the other.
    const flip = Math.floor(s.phase) % 2 === 1;
    const w = (flip ? s.def.h : s.def.w) * PX, h = (flip ? s.def.w : s.def.h) * PX;
    ctx.fillStyle = s.def.edge;
    ctx.fillRect(x - PX, y - PX, w + PX * 2, h + PX * 2);
    ctx.fillStyle = s.def.color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, n, now, shape) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (shape === 'chip' ? 90 : 60) + Math.random() * 140;
    const life = shape === 'chip' ? 220 + Math.random() * 260 : 500 + Math.random() * 400;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (shape === 'plus' ? 80 : 0), color, born: now, life, shape, big: Math.random() < 0.5 });
  }
  if (sparks.length > 300) sparks.splice(0, sparks.length - 300);
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

// After the background: the ERASER's inverted flash, and INK STORM lightning.
export function drawBackgroundFx(ctx, now) {
  if (redFlash) {
    const k = (now - redFlash.start) / redFlash.dur;
    if (k >= 1) redFlash = null;
    else {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.9 * (1 - k) ** 2;
      ctx.fillStyle = '#ff1a1a';
      ctx.fillRect(0, 0, ARENA.w, ARENA.h);
      ctx.restore();
    }
  }
  if (invertFlash) {
    const k = (now - invertFlash.start) / invertFlash.dur;
    if (k >= 1) invertFlash = null;
    else {
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = (1 - k) ** 1.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ARENA.w, ARENA.h);
      ctx.restore();
    }
  }
  if (storm) {
    const t = (now - storm.start) / 1000;
    if (t * 1000 >= STORM_MS) storm = null;
    else {
      let flash = 0, idx = 0;
      STORM_STRIKES.forEach((s, i) => {
        const v = t >= s ? Math.max(0, 1 - (t - s) / 0.11) : 0;
        if (v > flash) {
          flash = v;
          idx = i;
        }
      });
      if (flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = flash;
        ctx.fillStyle = idx % 2 ? '#ffffff' : '#60a5fa';
        ctx.fillRect(0, 0, ARENA.w, ARENA.h);
        ctx.restore();
      }
    }
  }
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

// GRAVITY WELL: a hole in the middle that flashes black and red. The background art itself gets
// sucked in (warpBackground in render.js); here: the hole, rings falling into it and specks of
// debris streaming in.
const GRAVITY_FLASH_HZ = 6;
export function gravityFlash(now) {
  return Math.floor((now / 1000) * GRAVITY_FLASH_HZ) % 2 === 1;   // true = the red beat
}

export function drawGravity(ctx, game, now) {
  const g = game.gravity;
  if (!g) return;
  const fade = Math.max(0, Math.min(1, g.t / 0.4, (g.dur - g.t) / 0.4));
  const t = now / 1000;
  const red = gravityFlash(now);
  const size = Math.max(0.15, Math.min(1, g.t / 0.5, (g.dur - g.t) / 0.5));   // the hole opens and closes

  // Rings collapsing into it, red and black.
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3) % 1;
    const r = Math.round(45 * (1 - k) ** 1.6 + 13);
    ctx.globalAlpha = fade * k;
    drawSprite(ctx, ring(r, i % 2 ? '#000000' : '#ef4444'), g.x, g.y);
  }

  // Debris streaming in, speeding up as it falls.
  for (let i = 0; i < 40; i++) {
    const k = (t * 0.55 + i * 0.137) % 1;
    const r = 26 + 520 * (1 - k) ** 2;
    const a = i * 2.39996 + k * 6;
    ctx.globalAlpha = fade * Math.min(1, k * 3);
    drawSprite(ctx, disc(1, i % 3 ? '#fca5a5' : '#000000', null), g.x + Math.cos(a) * r, g.y + Math.sin(a) * r);
  }

  // The hole: hard flashes between black with a red rim and a red ring with a black rim.
  ctx.globalAlpha = fade;
  const core = Math.max(3, Math.round((11 + (red ? 1 : 0)) * size));
  drawSprite(ctx, disc(core + 2, red ? '#000000' : '#ef4444', null), g.x, g.y);
  drawSprite(ctx, disc(core, red ? '#ef4444' : '#000000', null), g.x, g.y);
  drawSprite(ctx, disc(Math.max(1, core - 4), '#000000', null), g.x, g.y);
  ctx.globalAlpha = 1;
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

// Pickup feedback on players: medkit glow, plus/ink particles.
export function drawPlayerFx(ctx, game, now, dt) {
  for (let i = glows.length - 1; i >= 0; i--) {
    const g = glows[i];
    const k = (now - g.start) / 600;
    const p = game.players[g.pid];
    if (k >= 1 || !p) {
      glows.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 0.6 * (1 - k);
    drawSprite(ctx, disc(Math.round(14 + 10 * k), '#4ade80', null), p.x, p.y);
    ctx.globalAlpha = 1 - k;
    drawSprite(ctx, ring(Math.round(16 + 14 * k), '#bbf7d0'), p.x, p.y);
  }
  ctx.globalAlpha = 1;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    const k = (now - s.born) / s.life;
    if (k >= 1) {
      sparks.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.94;
    s.vy = s.vy * 0.94 + (s.shape === 'drop' ? 260 * dt : 0);
    ctx.globalAlpha = 1 - k;
    if (s.shape === 'plus') {
      ctx.fillStyle = s.color;
      const x = snap(s.x), y = snap(s.y);
      ctx.fillRect(x - PX, y - PX * 3, PX * 2, PX * 6);
      ctx.fillRect(x - PX * 3, y - PX, PX * 6, PX * 2);
    } else if (s.shape === 'chip') {
      const size = s.big ? PX * 2 : PX;
      ctx.fillStyle = s.color;
      ctx.fillRect(snap(s.x), snap(s.y), size, size);
    } else drawSprite(ctx, disc(1, s.color, null), s.x, s.y);
  }
  ctx.globalAlpha = 1;
}

// On top of everything in the world: blasts, laser beams and the meteor's white flash.
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
    const fill = b.red
      ? k < 0.2 ? '#ffffff' : k < 0.5 ? '#fb7185' : '#dc2626'
      : k < 0.25 ? '#ffffff' : k < 0.55 ? '#fde047' : '#fb923c';
    ctx.globalAlpha = 0.85 * (1 - k);
    drawSprite(ctx, disc(r, fill, null), b.x, b.y);
    ctx.globalAlpha = 1 - k;
    drawSprite(ctx, ring(r + 2, '#ffffff'), b.x, b.y);
  }
  ctx.globalAlpha = 1;

  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    const k = (now - b.start) / BEAM_MS;
    if (k >= 1) {
      beams.splice(i, 1);
      continue;
    }
    // A thick colored beam with a white-hot core that thins out as it fades.
    const len = Math.hypot(b.x2 - b.x, b.y2 - b.y);
    const ux = (b.x2 - b.x) / len, uy = (b.y2 - b.y) / len;
    const outer = Math.max(1, Math.round(7 * (1 - k))), core = Math.max(1, Math.round(3 * (1 - k)));
    ctx.globalAlpha = 1 - k * k;
    const glow = disc(outer, b.color, null), hot = disc(core, '#ffffff', null);
    for (let d = 0; d <= len; d += 6) drawSprite(ctx, glow, b.x + ux * d, b.y + uy * d);
    for (let d = 0; d <= len; d += 4) drawSprite(ctx, hot, b.x + ux * d, b.y + uy * d);
  }
  ctx.globalAlpha = 1;

  if (storm) drawStorm(ctx, now);

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
}

// INK STORM over the world: a dark blue tint, slanted rain, lightning bolts and bright flashes.
function drawStorm(ctx, now) {
  const t = (now - storm.start) / 1000;
  const fade = Math.min(1, t / 0.15, (STORM_MS / 1000 - t) / 0.5);
  if (fade <= 0) return;
  ctx.globalAlpha = 0.28 * fade;
  ctx.fillStyle = '#0b1e4a';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);

  ctx.fillStyle = '#bfdbfe';
  for (let i = 0; i < 160; i++) {
    const speed = 900 + (i % 5) * 120;
    const y = ((i * 263 + t * speed) % (ARENA.h + 60)) - 30;
    const x = ((i * 397 - t * speed * 0.35) % (ARENA.w + 200) + ARENA.w + 200) % (ARENA.w + 200) - 100;
    ctx.globalAlpha = fade * (0.35 + (i % 3) * 0.15);
    for (let k = 0; k < 4; k++) ctx.fillRect(snap(x - k * 2), snap(y + k * 6), PX, PX * 2);
  }

  STORM_STRIKES.forEach((s, i) => {
    const v = t >= s ? Math.max(0, 1 - (t - s) / 0.13) : 0;
    if (v <= 0) return;
    ctx.globalAlpha = 0.45 * v;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
    if (i % 2) return;
    ctx.globalAlpha = v;
    const bolt = storm.bolts[i];
    const glow = disc(3, '#93c5fd', null), core = disc(1, '#ffffff', null);
    for (let j = 1; j < bolt.length; j++) {
      const [x1, y1] = bolt[j - 1], [x2, y2] = bolt[j];
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d <= len; d += 4) {
        const x = x1 + ((x2 - x1) * d) / len, y = y1 + ((y2 - y1) * d) / len;
        drawSprite(ctx, glow, x, y);
        drawSprite(ctx, core, x, y);
      }
    }
  });
  ctx.globalAlpha = 1;
}

// BLACKOUT: everything goes dark except a small pool of light around your own cursor.
export function drawBlackout(ctx, game, me) {
  const b = game.blackout;
  if (!b) return;
  const fade = Math.min(1, b.t / 0.35, (b.dur - b.t) / 0.5);
  darkCtx.globalCompositeOperation = 'source-over';
  darkCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  darkCtx.fillStyle = '#000000';
  darkCtx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (me && me.alive) {
    darkCtx.globalCompositeOperation = 'destination-out';
    const cx = Math.round(me.x / PX), cy = Math.round(me.y / PX);
    for (const [r, a] of [[84, 0.35], [78, 0.35], [72, 1]]) {
      const s = disc(r, '#ffffff', null);
      darkCtx.globalAlpha = a;
      darkCtx.drawImage(s, cx - r, cy - r);
    }
    darkCtx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.96 * fade;
  ctx.drawImage(darkCanvas, 0, 0, ARENA.w, ARENA.h);
  ctx.globalAlpha = 1;
}

// Screen-space (never mirrored or shaken): big announcement text for map events.
export function drawBanners(ctx, now) {
  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i];
    const k = (now - b.start) / b.dur;
    if (k >= 1) {
      banners.splice(i, 1);
      continue;
    }
    // Pops in big, settles, then fades.
    const scale = k < 0.08 ? 4 : 3;
    const color = b.color || rainbowHex(Math.floor(now / 40));
    ctx.globalAlpha = Math.min(1, 3 * (1 - k));
    drawText(ctx, b.text, ARENA.w / 2, ARENA.h / 2 - 70, { size: 16, scale, color, align: 'center', valign: 'middle' });
  }
  ctx.globalAlpha = 1;
}

// Small text popping up over a player: the powerup they just grabbed (flashing), or "+5 HP" (rising).
// toScreen maps world positions to the screen, accounting for Mirror World.
export function drawFloats(ctx, game, now, localId, toScreen) {
  const stack = {};
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    const k = (now - f.start) / f.dur;
    const p = game.players[f.pid];
    if (k >= 1 || !p) {
      floats.splice(i, 1);
      continue;
    }
    if (p.ghost > 0 && p.id !== localId) continue;
    const n = (stack[f.pid] = (stack[f.pid] ?? -1) + 1);   // several at once stack upward
    const [x, y] = toScreen(p.x, p.y - playerRadius(p) - 46 - n * 18 - (f.rise ? 24 * k : 0));
    if (!f.rise && k < 0.7 && Math.floor(now / 65) % 2) continue;      // quick flashing
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    drawText(ctx, f.text, x, y, { color: f.color, align: 'center', valign: 'bottom' });
  }
  ctx.globalAlpha = 1;
}
