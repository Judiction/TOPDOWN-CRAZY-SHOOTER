// One-shot visual effects driven by game events: explosions, laser beams, meteor strikes (white
// flash + screen shake), the ERASER's rainbow dissolve, storms, the gravity well, the blackout, pickup
// sparkles and big announcement banners. Purely cosmetic and local to each screen, so nothing here
// is sent over the network.

import { ARENA, COLS, ROWS, EXPLOSION_RADIUS, meteorRadius, meteorFlashes } from './game.js';
import { PX, VIEW_W, VIEW_H, snap, disc, ring, drawSprite, drawText } from './pixel.js';

const booms = [];                     // { x, y, r, start, dur }
const beams = [];                     // laser: { x, y, x2, y2, color, start }
const puffs = [];                     // rocket smoke: { x, y, born }
const sparks = [];                    // pickup particles: { x, y, vx, vy, color, born, life, shape }
const glows = [];                     // medkit flash on a player: { pid, start }
const banners = [];                   // big centered text: { text, color, start, dur }
let shake = { until: 0, amp: 0, dur: 1 };
let whiteFlash = null;                // { start, dur }
let invertFlash = null;
let storm = null;                     // { start }
let erase = null;                     // { start, cells: Int32Array, thresholds: Float32Array }
let seenEventId = null;

const PUFF_MS = 450;
const ERASE_MS = 900;
const BEAM_MS = 420;
const BANNER_MS = 1300;
const STORM_MS = 1700;
const STORM_STRIKES = [0, 0.14, 0.55, 0.66, 1.15];   // seconds after the event at which lightning flashes

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
    } else if (e.type === 'erase') {
      startErase(now, wallImage);
      invertFlash = { start: now, dur: 650 };
    } else if (e.type === 'laser') {
      beams.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, color: e.color, start: now });
      addShake(now, 7, 250);
    } else if (e.type === 'inkstorm') {
      storm = { start: now };
      addShake(now, 5, 300);
    } else if (e.type === 'pickup' && e.kind === 'meteor') {
      banners.length = 0;
      banners.push({ text: 'METEORS!', color: '#fb923c', start: now, dur: BANNER_MS });
    } else if (e.type === 'heal' && !hidden(e.pid)) {
      glows.push({ pid: e.pid, start: now });
      burst(e.x, e.y, '#4ade80', 10, now, 'plus');
    } else if (e.type === 'inkRush' && !hidden(e.pid)) {
      burst(e.x, e.y, game.players[e.pid]?.color || '#3b82f6', 18, now, 'drop');
    } else if (e.type === 'paintbomb') {
      for (let i = 0; i < 40; i++) burst(Math.random() * ARENA.w, Math.random() * ARENA.h, e.color, 1, now, 'drop');
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

function burst(x, y, color, n, now, shape) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (shape === 'plus' ? 80 : 0), color, born: now, life: 500 + Math.random() * 400, shape });
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
        const v = t >= s ? Math.max(0, 1 - (t - s) / 0.09) : 0;
        if (v > flash) {
          flash = v;
          idx = i;
        }
      });
      if (flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.85 * flash;
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

// GRAVITY WELL: a dark core with spiral arms of pixels swirling into it.
export function drawGravity(ctx, game, now) {
  const g = game.gravity;
  if (!g) return;
  const fade = Math.min(1, g.t / 0.4, (g.dur - g.t) / 0.4);
  const spin = now / 300;
  ctx.globalAlpha = 0.8 * fade;
  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < 26; i++) {
      const r = 26 + i * 9;
      const a = spin + arm * (Math.PI / 2) + i * 0.32 - Math.log(r) * 0.6;
      const color = i % 3 === 0 ? '#ffffff' : '#c4b5fd';
      drawSprite(ctx, disc(i < 8 ? 2 : 1, color, null), g.x + Math.cos(a) * r, g.y + Math.sin(a) * r);
    }
  }
  ctx.globalAlpha = fade;
  drawSprite(ctx, disc(12, '#0b0614', '#7c3aed', 2), g.x, g.y);
  drawSprite(ctx, ring(14 + Math.floor((now / 80) % 6), '#a78bfa'), g.x, g.y);
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
    const fill = k < 0.25 ? '#ffffff' : k < 0.55 ? '#fde047' : '#fb923c';
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
