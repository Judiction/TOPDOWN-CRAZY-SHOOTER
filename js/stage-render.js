// Draws the living desktop: wallpaper, clutter, taskbar, pop-ups, menus, viruses and the OS's own
// tantrums. The heavy art is built once into canvases (see stages/win98-art.js), so a frame is just
// a few drawImage calls no matter how busy the desktop looks.

import { ARENA, TASKBAR_H } from './game.js';
import { PX, snap, drawSprite, drawText, ring } from './pixel.js';
import { STAGES, DEFAULT_STAGE } from './stages/index.js';
import {
  createStage, menuTargets, cardAt, CASCADE_CARDS, VIRUS_RADIUS, POPUP, POPUP_LIFE, BSOD_OUT,
  toasterAt, trayReach, TOASTERS, TRAY_LEN, FORMAT_CANCEL,
} from './stage.js';
import { powerupIcon, tinyText } from './icons.js';
import { appArt } from './stages/apps-art.js';
import { drawWallpaper } from './stages/wallpapers.js';
import {
  toasterFrames, clipArt, balloon, apeArt, printerArt, calcArt, ballArt, trayArt, formatDialog, runDialog,
} from './stages/event-art.js';
import {
  drawClutter, eraseClutter, drawTaskbar, drawPopup, drawMenu, drawCard, bootScreen, drawBootBar,
  POST_LINES, BSOD_LINES, W98,
} from './stages/win98-art.js';

const VIEW = { w: ARENA.w / PX, h: ARENA.h / PX };
const CLIP_TEXT = [
  ["IT LOOKS LIKE YOU'RE", 'TRYING TO WIN!', 'WOULD YOU LIKE HELP?'],
  ["IT LOOKS LIKE YOU'RE", 'WRITING A WILL.', 'NEED A TEMPLATE?'],
  ['HI! I SEE YOU ARE', 'BEING SHOT AT.', 'TIP: DO NOT.'],
  ['DID YOU KNOW?', 'YOU CAN PRESS F1', 'FOR MORE OF ME.'],
];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---- cached art ----

let wallKey = null, wallCanvas = null;
export function wallpaperFor(seed, choice = 'random') {
  const key = `${seed}:${choice}`;
  if (key !== wallKey) {
    wallKey = key;
    wallCanvas = drawWallpaper(seed, choice);
  }
  return wallCanvas;
}

const clutterCanvas = makeCanvas(VIEW.w, VIEW.h);
let clutterFor = null, clutterGone = -1;
function clutterLayer(stage) {
  if (stage !== clutterFor) {
    clutterFor = stage;
    clutterGone = stage.gone.length;
    drawClutter(clutterCanvas, stage);
  } else if (stage.gone.length !== clutterGone) {
    // Deleted icons are just wiped from the layer, so even a hail of bullets costs nothing.
    for (const i of stage.gone.slice(clutterGone)) eraseClutter(clutterCanvas, stage.clutter[i]);
    clutterGone = stage.gone.length;
  }
  return clutterCanvas;
}

let taskbar = null;
function taskbarLayer(bar) {
  taskbar ??= drawTaskbar(bar);
  return taskbar;
}

const popupArt = {}, menuArt = {};
let cardArt = null;

const popupSprite = (def, frame) => (popupArt[`${def.id}:${frame}`] ??= drawPopup(def, frame));
const menuSprite = (kind, m) => (menuArt[kind] ??= drawMenu(kind, m));

// The desktop you see behind the menus: same wallpaper and clutter, nobody fighting on it.
let menuStage = null, menuSeed = null;
const MENU_BAR = { x: 0, y: ARENA.h - TASKBAR_H, w: ARENA.w, h: TASKBAR_H };

export function drawMenuDesktop(ctx, seed, wallpaper = 'random') {
  if (seed !== menuSeed) {
    menuSeed = seed;
    menuStage = createStage(DEFAULT_STAGE, seed);
    // Keep the middle of the screen clear for the logo and the windows.
    menuStage.clutter = menuStage.clutter.filter((c) => c.col < 3 || c.col > 10);
  }
  ctx.drawImage(wallpaperFor(seed, wallpaper), 0, 0, ARENA.w, ARENA.h);
  ctx.drawImage(clutterLayer(menuStage), 0, 0, ARENA.w, ARENA.h);
  ctx.drawImage(taskbarLayer(MENU_BAR), 0, 0, ARENA.w, ARENA.h);
}

// A little picture of a wallpaper for the Display Properties dialog.
export function stagePreview(wallpaper, seed) {
  const c = makeCanvas(VIEW.w, VIEW.h);
  const g = c.getContext('2d');
  g.drawImage(wallpaper === 'random' ? wallpaperFor(seed, 'random') : drawWallpaper(seed, wallpaper), 0, 0);
  g.drawImage(taskbarLayer(MENU_BAR), 0, 0);
  if (wallpaper === 'random') tinyText(g, '?? A NEW ONE EVERY ROUND ??', VIEW.w / 2 - 54, VIEW.h / 2, '#ffffff');
  return c;
}

// ---- layers ----

// Everything under the walls.
export function drawStageBack(ctx, game) {
  const s = game.stage;
  if (!s?.ready) return;
  for (const a of s.apps) drawApp(ctx, a);
  const k = Math.min(1, s.t / 0.7);     // icons appear left to right as the desktop finishes loading
  const w = VIEW.w * k;
  ctx.drawImage(clutterLayer(s), 0, 0, w, VIEW.h, 0, 0, w * PX, ARENA.h);
}

// A program window: its page, then the only parts of it that move.
function drawApp(ctx, a) {
  const art = appArt(a.kind, a.variant, a.w / PX, a.h / PX);
  const open = Math.min(1, a.age / 0.14);   // zooms open
  const w = a.w * (0.5 + 0.5 * open), h = a.h * (0.5 + 0.5 * open);
  ctx.drawImage(art.c, snap(a.x + (a.w - w) / 2), snap(a.y + (a.h - h) / 2), w, h);
  if (open >= 1) art.live(ctx, a.x, a.y, a, performance.now());
}

// Everything over the walls but under the players.
export function drawStageMid(ctx, game, now) {
  const s = game.stage;
  if (game.desktop) {
    // The taskbar slides up from below once the OS is ready.
    const y = s ? Math.round((1 - Math.min(1, s.t / 0.3)) * TASKBAR_H) : 0;
    ctx.drawImage(taskbarLayer(game.desktop.bar), 0, y, ARENA.w, ARENA.h);
  }
  if (!s?.ready) return;
  const def = STAGES[s.id];

  // A used-up Start button or clock is greyed out, like anything disabled on a desktop.
  for (const h of def.hotspots) {
    if (h.does !== 'menu' || !s.spent.includes(h.menu)) continue;
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = W98.face;
    ctx.fillRect(h.x + 6, h.y + 8, h.w - 12, h.h - 12);
    ctx.globalAlpha = 1;
  }

  for (const m of s.mines) drawSprite(ctx, mineTile(), m.x, m.y);

  for (const u of s.popups) {
    const kind = def.popups.find((p) => p.id === u.kind);
    if (!kind) continue;
    if (u.life < 1.5 && Math.floor(now / 90) % 2) continue;   // blinks before it closes by itself
    // They hang in the air, each on its own slow drift (only the picture moves, not the trigger area).
    const t = now / 1000 + u.id * 1.9;
    const x = u.x + Math.sin(t * 1.15) * 7, y = u.y + Math.sin(t * 1.9) * 8;
    // A new window zooms open.
    const open = Math.min(1, (POPUP_LIFE - u.life) / 0.14);
    const w = POPUP.w * (0.5 + 0.5 * open), h = POPUP.h * (0.5 + 0.5 * open);
    const left = snap(x + (POPUP.w - w) / 2), top = snap(y + (POPUP.h - h) / 2);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000000';
    ctx.fillRect(left + 10, top + 12, w, h);
    ctx.globalAlpha = 1;
    const speed = kind.scam ? 110 : 190;                 // scams flash harder
    ctx.drawImage(popupSprite(kind, (Math.floor(now / speed) + u.id) % 2), left, top, w, h);
  }

  if (s.menu) drawOpenMenu(ctx, game, def);

  if (s.cascade) drawCascade(ctx, s.cascade);
  else if (cascadeDirty) clearCascade();

  if (s.sweep) {
    const y = (s.sweep.t / 4) * (ARENA.h - TASKBAR_H);
    ctx.fillStyle = '#000080';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, snap(y) - 8, ARENA.w, 16);
    ctx.globalAlpha = 1;
    drawText(ctx, 'SCANDISK: CHECKING FOR BAD SECTORS...', ARENA.w / 2, y, { align: 'center', valign: 'middle' });
  }

  for (const v of s.viruses) drawVirus(ctx, s, def, v, now);
}

// Over the players: whatever has barged onto the desktop.
export function drawStageOver(ctx, game, now) {
  const s = game.stage;
  if (!s?.ready) return;
  const fx = s.fx;
  const sprite = (img, x, y, scale = 1) => ctx.drawImage(img, snap(x), snap(y), img.width * PX * scale, img.height * PX * scale);

  if (fx.printer) {
    const e = fx.printer;
    sprite(printerArt(), e.x - 24, e.y - 24);
  }
  if (fx.toasters) {
    const frames = toasterFrames(), flap = Math.floor(now / 110);
    for (let i = 0; i < TOASTERS; i++) {
      const at = toasterAt(i, fx.toasters.t);
      if (at) sprite(frames[(flap + i) % frames.length], at.x - 40, at.y - 32);
    }
  }
  if (fx.ball) sprite(ballArt(), fx.ball.x - 20, fx.ball.y - 20);
  if (fx.calc) sprite(calcArt(), fx.calc.x - 70, fx.calc.y - 96);
  if (fx.tray) {
    const e = fx.tray, art = trayArt(TRAY_LEN / PX);
    sprite(art, ARENA.w - trayReach(e) * TRAY_LEN, e.y);
  }
  if (fx.ape) {
    const e = fx.ape;
    sprite(apeArt(e.walking && Math.floor(now / 170) % 2 ? 1 : 0), e.x - 36, e.y - 48);
    if (!e.walking && !e.done) sprite(balloon(['HI THERE! WANT A', 'FREE, TOTALLY SAFE', 'SPECIAL OFFER?']), e.x - 24, e.y - 128);
  }
  if (fx.clip) {
    const e = fx.clip, p = game.players[e.pid];
    if (p) {
      const bob = Math.sin(now / 260) * 6;
      const left = p.x > ARENA.w - 240, x = p.x + (left ? -86 : 40), y = Math.max(100, p.y - 20) + bob;
      sprite(clipArt(Math.floor(now / 1700) % 4 === 3 ? 1 : 0), x, y - 6);
      sprite(balloon(CLIP_TEXT[e.line % CLIP_TEXT.length]), left ? x - 170 : x + 4, y - 86);
    }
  }
  if (fx.format) {
    const e = fx.format, x = FORMAT_CANCEL.x, y = FORMAT_CANCEL.y;
    sprite(formatDialog(), x + 0, y);
    ctx.fillStyle = '#000080';
    const blocks = Math.floor((e.t / e.dur) * 20);
    for (let i = 0; i < blocks; i++) ctx.fillRect(x + 16 + i * 16.4, y + 56, 13 * 1, 18);
  }
  if (fx.run) {
    const x = 460, y = 90;
    sprite(runDialog(), x, y);
    const shown = fx.run.typed.slice(0, Math.floor(fx.run.t * 9));
    ctx.save();
    ctx.translate(x + 66, y + 62);
    ctx.scale(PX, PX);
    tinyText(ctx, shown, 0, 0, '#000000');
    ctx.restore();
  }
}

// Screen-space, on top of everything.
export function drawStageTop(ctx, game, now) {
  const s = game.stage;
  if (!s) return;
  if (s.modem > 0) {
    bitmaps.modem ??= modemDialog();
    ctx.drawImage(bitmaps.modem, ARENA.w / 2 - 130, 96, 260, 76);
    const n = Math.floor(now / 250) % 4;
    drawText(ctx, `CONNECTING${'.'.repeat(n)}`, ARENA.w / 2 - 110, 132, { color: '#000000', outline: null });
  }
}

// The blue screen covers absolutely everything, HUD included. On its way out it doesn't just vanish:
// it breaks into strips that slide apart and drop away until the level is showing through.
let tornBands = [], nextTear = 0;

export function drawBlueScreen(ctx, game, now) {
  const s = game.stage;
  if (!(s?.bsod > 0)) return;
  bitmaps.bsod ??= blueScreen();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.bsod > BSOD_OUT) {
    ctx.drawImage(bitmaps.bsod, 0, 0);
    return;
  }
  const k = 1 - s.bsod / BSOD_OUT;      // 0 = whole, 1 = gone
  if (now >= nextTear) {
    nextTear = now + 45;
    tornBands = [];
    for (let y = 0; y < VIEW.h;) {
      const h = 4 + Math.floor(Math.random() * 22);
      if (Math.random() > k * k * 1.05) tornBands.push({ y, h, dx: Math.round((Math.random() * 2 - 1) * (6 + k * 190)) });
      y += h;
    }
  }
  for (const b of tornBands) ctx.drawImage(bitmaps.bsod, 0, b.y, VIEW.w, b.h, b.dx, b.y, VIEW.w, b.h);
}

// The OS loading. left/total are seconds; `full` = a cold boot, otherwise a quick restart.
export function drawBoot(ctx, { left, total, full }) {
  const t = total - left;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  if (full && t < 2.6) {
    const shown = Math.floor(t * 4.2);
    POST_LINES.slice(0, shown).forEach((line, i) => {
      if (line) drawText(ctx, line, 40, 40 + i * 24, { color: '#c0c0c0', outline: null });
    });
    if (Math.floor(t * 4) % 2) drawText(ctx, '_', 40, 40 + Math.min(shown, POST_LINES.length) * 24, { color: '#c0c0c0', outline: null });
    return;
  }
  if (!full && t < 0.5) {
    drawText(ctx, 'RESTARTING...', 40, 40, { color: '#c0c0c0', outline: null });
    return;
  }
  if (left < 0.5) {
    ctx.fillStyle = W98.teal;            // the desktop colour comes up before anything is drawn on it
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
    return;
  }
  ctx.drawImage(bootScreen(), 0, 0, ARENA.w, ARENA.h);
  drawBootBar(ctx, ARENA.h - 28, 16, t);
}

// Display settings: 16 colors is a CSS filter (so the GPU does it), low resolution is just the frame
// shrunk and blown back up.
let shownMode = null;
const lowResFrame = makeCanvas(VIEW.w, VIEW.h);
const lowResCtx = lowResFrame.getContext('2d');

export function setDisplayMode(ctx, canvas, mode) {
  if (mode !== shownMode) {
    shownMode = mode;
    canvas.style.filter = mode === 'colors' ? 'url(#sixteen-colors)' : '';
  }
  if (mode !== 'lowres') return;
  const w = Math.ceil(VIEW.w / 3), h = Math.ceil(VIEW.h / 3);
  lowResCtx.globalCompositeOperation = 'copy';
  lowResCtx.drawImage(ctx.canvas, 0, 0, w, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lowResFrame, 0, 0, w, h, 0, 0, w * 3, h * 3);
  ctx.restore();
}

// ---- pieces ----

const bitmaps = {};

function mineTile() {
  if (bitmaps.mine) return bitmaps.mine;
  const c = makeCanvas(20, 20);
  const g = c.getContext('2d');
  g.fillStyle = '#c0c0c0';
  g.fillRect(0, 0, 20, 20);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 20, 2);
  g.fillRect(0, 0, 2, 20);
  g.fillStyle = '#808080';
  g.fillRect(0, 18, 20, 2);
  g.fillRect(18, 0, 2, 20);
  const icon = powerupIcon('mine');
  if (icon) g.drawImage(icon, -2, -2);
  return (bitmaps.mine = c);
}

function modemDialog() {
  const c = makeCanvas(130, 38);
  const g = c.getContext('2d');
  g.fillStyle = '#c0c0c0';
  g.fillRect(0, 0, 130, 38);
  g.fillStyle = '#000080';
  g.fillRect(2, 2, 126, 10);
  tinyText(g, 'DIAL-UP NETWORKING', 5, 5, '#ffffff');
  g.fillStyle = '#000000';
  g.fillRect(0, 37, 130, 1);
  g.fillRect(129, 0, 1, 38);
  tinyText(g, '28.8 KBPS - EVERYTHING SLOWS DOWN', 3, 29, '#000000');
  return c;
}

function blueScreen() {
  const c = makeCanvas(VIEW.w, VIEW.h);
  const g = c.getContext('2d');
  g.fillStyle = '#0000aa';
  g.fillRect(0, 0, VIEW.w, VIEW.h);
  g.fillStyle = '#aaaaaa';
  g.fillRect(VIEW.w / 2 - 34, 84, 68, 10);
  tinyText(g, 'WINDERS', VIEW.w / 2 - 14, 87, '#0000aa');
  BSOD_LINES.forEach((line, i) => tinyText(g, line, 60, 112 + i * 12, '#ffffff'));
  return c;
}

function drawOpenMenu(ctx, game, def) {
  const s = game.stage;
  const m = def.menus[s.menu.kind];
  ctx.drawImage(menuSprite(s.menu.kind, m), m.x, m.y, m.w, m.h);
  // Whichever row someone is standing on lights up, like a hover.
  const targets = menuTargets(m);
  targets.forEach((r, i) => {
    const on = Object.values(game.players).some((p) => p.alive && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    if (!on) return;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = W98.navy;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  });
}

// The Solitaire win: cards bounce away and leave a smeared trail, painted onto one canvas.
const cascadeCanvas = makeCanvas(VIEW.w, VIEW.h);
const cascadeCtx = cascadeCanvas.getContext('2d');
let cascadeDirty = false;

function clearCascade() {
  cascadeCtx.clearRect(0, 0, VIEW.w, VIEW.h);
  cascadeDirty = false;
}

function drawCascade(ctx, c) {
  cardArt ??= drawCard();
  cascadeDirty = true;
  // The trail fades as it goes, so the fight stays visible behind it.
  cascadeCtx.globalCompositeOperation = 'destination-out';
  cascadeCtx.fillStyle = 'rgba(0,0,0,0.07)';
  cascadeCtx.fillRect(0, 0, VIEW.w, VIEW.h);
  cascadeCtx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < CASCADE_CARDS; i++) {
    if (c.dead.includes(i)) continue;
    const at = cardAt(i, c.t);
    if (at) cascadeCtx.drawImage(cardArt, Math.round(at.x / PX) - 10, Math.round(at.y / PX) - 14);
  }
  ctx.globalAlpha = 0.9;
  ctx.drawImage(cascadeCanvas, 0, 0, ARENA.w, ARENA.h);
  ctx.globalAlpha = 1;
}

const virusCaptions = {};
function virusCaption(label) {
  if (virusCaptions[label]) return virusCaptions[label];
  const w = label.length * 4 + 3;
  const c = makeCanvas(w, 9);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, w, 9);
  g.fillStyle = '#006000';
  g.fillRect(1, 1, w - 2, 7);
  tinyText(g, label, 2, 2, '#66ff66');
  return (virusCaptions[label] = c);
}

function drawVirus(ctx, s, def, v, now) {
  const kind = def.viruses.find((k) => k.id === v.kind);
  const age = s.t - v.born;
  if (age < 1 && Math.floor(now / 70) % 2) return;     // flickers in, harmless
  const jitter = Math.sin(now / 45 + v.id) * 2;        // it twitches: it's clearly not a normal icon
  const icon = powerupIcon(v.kind);
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 120);
  drawSprite(ctx, ring(Math.round(VIRUS_RADIUS / PX) + 2, '#39ff14'), v.x, v.y);
  ctx.globalAlpha = 1;
  if (icon) drawSprite(ctx, icon, v.x + jitter, v.y);
  drawSprite(ctx, virusCaption(kind?.label || 'VIRUS'), v.x, v.y + VIRUS_RADIUS + 14);
}
