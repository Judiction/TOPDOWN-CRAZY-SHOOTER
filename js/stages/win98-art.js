// WINDERS 98's look. Everything here is drawn in code (no images) into cached canvases, so the whole
// desktop costs a handful of drawImage calls per frame. Sizes are in screen pixels (640 x 360).

import { VIEW_W, VIEW_H, textSprite } from '../pixel.js';
import { powerupIcon, shortcutIcon, tinyText } from '../icons.js';
import { CLUTTER, POPUP, menuTargets } from '../stage.js';
import { cloudsInto } from './wallpapers.js';

export const W98 = { face: '#c0c0c0', light: '#dfdfdf', white: '#ffffff', shadow: '#808080', dark: '#000000', navy: '#000080', blue: '#1084d0', teal: '#008080' };
export const TASK_BUTTON = { x: 94, w: 140 };
export const TRAY_W = 92;
const CONTROLS_TEXT = 'WASD MOVE  CLICK SHOOT  R RELOAD  SPACE+CLICK DRAW  M MUTE  ESC MENU';

function canvas(w = VIEW_W, h = VIEW_H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---- Win98 widget kit ----

export function kit(g) {
  const fill = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const raised = (x, y, w, h, face = W98.face) => {
    fill(x, y, w, h, face);
    fill(x, y, w, 1, W98.white);
    fill(x, y, 1, h, W98.white);
    fill(x, y + h - 1, w, 1, W98.dark);
    fill(x + w - 1, y, 1, h, W98.dark);
    fill(x + 1, y + h - 2, w - 2, 1, W98.shadow);
    fill(x + w - 2, y + 1, 1, h - 2, W98.shadow);
  };
  const sunken = (x, y, w, h, face) => {
    fill(x, y, w, h, face);
    fill(x, y, w, 1, W98.shadow);
    fill(x, y, 1, h, W98.shadow);
    fill(x, y + h - 1, w, 1, W98.white);
    fill(x + w - 1, y, 1, h, W98.white);
  };
  // The title-bar gradient: navy fading to blue.
  const gradient = (x, y, w, h, from = [0, 0, 128], to = [16, 132, 208]) => {
    for (let i = 0; i < w; i++) {
      const k = i / Math.max(1, w - 1);
      fill(x + i, y, 1, h, `rgb(${from.map((v, j) => Math.round(v + (to[j] - v) * k)).join(',')})`);
    }
  };
  const smallButton = (x, y, glyph) => {
    raised(x, y, 9, 8);
    g.fillStyle = '#000000';
    if (glyph === 'min') g.fillRect(x + 2, y + 5, 4, 1);
    else if (glyph === 'max') {
      g.fillRect(x + 2, y + 1, 5, 2);
      g.fillRect(x + 2, y + 2, 1, 4);
      g.fillRect(x + 6, y + 2, 1, 4);
      g.fillRect(x + 2, y + 5, 5, 1);
    } else {
      for (let i = 0; i < 4; i++) {
        g.fillRect(x + 2 + i, y + 2 + i, 1, 1);
        g.fillRect(x + 5 - i, y + 2 + i, 1, 1);
        g.fillRect(x + 3 + i, y + 2 + i, 1, 1);
        g.fillRect(x + 6 - i, y + 2 + i, 1, 1);
      }
    }
  };
  // A whole window frame with title bar. Returns the y where its content starts.
  const frame = (x, y, w, h, title, { buttons = ['close'], from, to } = {}) => {
    fill(x, y, w, h, W98.face);
    fill(x, y, w, 1, W98.light);
    fill(x, y, 1, h, W98.light);
    fill(x + 1, y + 1, w - 2, 1, W98.white);
    fill(x + 1, y + 1, 1, h - 2, W98.white);
    fill(x, y + h - 1, w, 1, W98.dark);
    fill(x + w - 1, y, 1, h, W98.dark);
    fill(x + 1, y + h - 2, w - 2, 1, W98.shadow);
    fill(x + w - 2, y + 1, 1, h - 2, W98.shadow);
    const tx = x + 3, ty = y + 3, tw = w - 6;
    gradient(tx, ty, tw, 11, from, to);
    tinyText(g, title, tx + 3, ty + 3, '#ffffff');
    let bx = tx + tw - 11;
    for (const b of buttons) {
      smallButton(bx, ty + 1, b);
      bx -= b === 'close' ? 11 : 9;
    }
    return ty + 12;
  };
  return { fill, raised, sunken, gradient, frame };
}

// ---- the icons left all over the desktop ----

export function eraseClutter(c, item) {
  c.getContext('2d').clearRect(Math.round(item.x / 2) - 1, Math.round(item.y / 2) - 1, CLUTTER.pitchX / 2, CLUTTER.pitchY / 2);
}

export function drawClutter(c, stage) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, VIEW_W, VIEW_H);
  // The Recycle Bin never gets deleted: it's one of the things you can shoot.
  g.drawImage(powerupIcon('eraser'), 608, 80);
  tinyText(g, 'RECYCLE BIN', 599, 106, '#000000');
  tinyText(g, 'RECYCLE BIN', 598, 105, '#ffffff');
  g.drawImage(powerupIcon('disc'), 608, 130);
  tinyText(g, 'CD-ROM (D:)', 599, 156, '#000000');
  tinyText(g, 'CD-ROM (D:)', 598, 155, '#ffffff');
  stage.clutter.forEach((item, i) => {
    if (stage.gone.includes(i)) return;
    const x = Math.round(item.x / 2), y = Math.round(item.y / 2);
    const icon = powerupIcon(item.icon);
    if (icon) g.drawImage(icon, x + 6, y);
    const tw = item.label.length * 4 - 1;
    const lx = x + Math.round((CLUTTER.w / 2 - tw) / 2);
    tinyText(g, item.label, lx + 1, y + 27, '#000000');
    tinyText(g, item.label, lx, y + 26, '#ffffff');
  });
}

// ---- taskbar ----

function flag(k, x, y) {
  k.fill(x, y, 4, 4, '#ff0000');
  k.fill(x + 5, y, 4, 4, '#00a000');
  k.fill(x, y + 5, 4, 4, '#0000ff');
  k.fill(x + 5, y + 5, 4, 4, '#ffd000');
}

export function drawTaskbar(bar) {
  const c = canvas();
  const g = c.getContext('2d');
  const k = kit(g);
  const by = Math.round(bar.y / 2), bh = Math.round(bar.h / 2), bw = VIEW_W;
  k.fill(0, by, bw, bh, W98.face);
  k.fill(0, by, bw, 1, W98.light);
  k.fill(0, by + 1, bw, 1, W98.white);
  const sy = by + 3, sh = bh - 5;
  k.raised(2, sy, 52, sh);
  flag(k, 6, sy + Math.floor((sh - 9) / 2));
  const start = textSprite('START', 8, '#000000', null);
  g.drawImage(start, 18, sy + Math.floor((sh - start.height) / 2) + 1);
  k.fill(57, sy, 1, sh, W98.shadow);
  k.fill(58, sy, 1, sh, W98.white);
  // Quick Launch: show desktop, then the web browser.
  const show = powerupIcon('folder');
  g.drawImage(show, 0, 0, 24, 24, 61, sy, 12, 12);
  g.drawImage(powerupIcon('exploder'), 0, 0, 24, 24, 74, sy, 12, 12);
  k.fill(89, sy, 1, sh, W98.shadow);
  k.fill(90, sy, 1, sh, W98.white);
  // The pressed-in button your ammo sits on (dithered = the active program).
  k.sunken(TASK_BUTTON.x, sy, TASK_BUTTON.w, sh, W98.face);
  for (let y = sy + 1; y < sy + sh - 1; y++) {
    for (let x = TASK_BUTTON.x + 1 + ((y + sy) % 2); x < TASK_BUTTON.x + TASK_BUTTON.w - 1; x += 2) k.fill(x, y, 1, 1, W98.white);
  }
  k.fill(TASK_BUTTON.x, sy, TASK_BUTTON.w, 1, W98.dark);
  k.fill(TASK_BUTTON.x, sy, 1, sh, W98.dark);
  const trayX = bw - TRAY_W - 3;
  const textW = CONTROLS_TEXT.length * 4 - 1;
  const midL = TASK_BUTTON.x + TASK_BUTTON.w + 4, midR = trayX - 4;
  if (textW <= midR - midL) tinyText(g, CONTROLS_TEXT, Math.round((midL + midR - textW) / 2), by + Math.floor((bh - 5) / 2) + 1, '#000000');
  k.sunken(trayX, sy, TRAY_W, sh, W98.face);
  const spx = trayX + 4, spy = sy + Math.floor((sh - 7) / 2);
  k.fill(spx, spy + 2, 2, 3, '#000000');
  k.fill(spx + 2, spy + 1, 1, 5, '#000000');
  k.fill(spx + 3, spy, 1, 7, '#000000');
  for (const [dx, dy] of [[5, 2], [6, 1], [5, 4], [6, 5], [6, 3]]) k.fill(spx + dx, spy + dy, 1, 1, '#808080');
  // The Display Properties tray icon: a tiny monitor.
  k.fill(spx + 12, spy, 11, 8, '#000000');
  k.fill(spx + 13, spy + 1, 9, 6, '#008080');
  k.fill(spx + 15, spy + 8, 5, 1, '#404040');
  return c;
}

// ---- score window: a solid, breakable text editor ----

export function drawScoreWindow(win, scoreTop) {
  const c = canvas();
  const g = c.getContext('2d');
  const k = kit(g);
  const x = Math.round(win.x / 2), y = Math.round(win.y / 2), w = Math.round(win.w / 2), h = Math.round(win.h / 2);
  k.frame(x, y, w, h, 'SCORES.TXT - NOTEPADDLE', { buttons: ['close', 'max', 'min'] });
  const top = y + Math.round(scoreTop / 2) - 2;
  k.sunken(x + 3, top, w - 6, y + h - 3 - top, '#ffffff');
  k.fill(x + 4, top + 1, w - 8, 1, W98.dark);
  k.fill(x + 4, top + 1, 1, y + h - 5 - top, W98.dark);
  return c;
}

// ---- pop-ups ----

// Two frames per pop-up: the picture flips between them so titles, text and the OK button all flash.
// Green means it helps, red means it hurts, and the scams just scream.
export function drawPopup(def, frame) {
  const w = POPUP.w / 2, h = POPUP.h / 2;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const scam = def.scam;
  const alert = def.good ? { from: [0, 110, 0], to: [90, 230, 60] } : { from: [150, 0, 0], to: [255, 90, 40] };
  const loud = frame ? { from: [255, 0, 170], to: [255, 220, 0] } : { from: [255, 220, 0], to: [255, 0, 170] };
  const bar = scam ? loud : frame ? alert : {};
  const body = k.frame(0, 0, w, h, def.title, bar);
  const paper = scam ? (frame ? '#ff00aa' : '#ffff00') : W98.face;
  if (scam) k.fill(3, body, w - 6, h - body - 3, paper);
  const icon = powerupIcon(def.icon);
  if (icon) g.drawImage(icon, 4, body + 3);
  const ink = scam ? (frame ? '#ffff00' : '#d00000') : frame ? (def.good ? '#006000' : '#c00000') : '#000000';
  def.lines.forEach((line, i) => tinyText(g, line, 28, body + 7 + i * 8, ink));
  // The OK button: the bit everyone's instinct says to click. It's practically begging.
  const bx = w / 2 - 15, by = h - 15;
  k.raised(bx, by, 30, 11, frame ? '#ffff00' : W98.face);
  k.fill(bx, by, 30, 1, W98.dark);
  k.fill(bx, by, 1, 11, W98.dark);
  tinyText(g, 'OK', bx + 12, by + 3, frame ? '#ff0000' : '#000000');
  if (frame) {
    tinyText(g, '>>', bx - 11, by + 3, ink);
    tinyText(g, '<<', bx + 34, by + 3, ink);
  }
  return c;
}

// ---- menus ----

export function drawMenu(kind, m) {
  const w = m.w / 2, h = m.h / 2;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  if (kind === 'start') {
    k.raised(0, 0, w, h);
    // The tall banner down the side of the Start menu.
    k.gradient(3, 3, 17, h - 6);
    g.save();
    g.translate(15, h - 6);
    g.rotate(-Math.PI / 2);
    g.drawImage(textSprite('WINDERS 98', 8, '#ffffff', null), 0, -8);
    g.restore();
    menuTargets({ ...m, x: 0, y: 0 }).forEach((r, i) => {
      const y = Math.round(r.y / 2), rh = Math.round(r.h / 2);
      const row = m.rows[i];
      const icon = powerupIcon(ROW_ICONS[row.id] || 'exe');
      if (icon) g.drawImage(icon, 0, 0, 24, 24, 24, y + Math.floor((rh - 16) / 2), 16, 16);
      tinyText(g, row.label, 44, y + Math.floor((rh - 5) / 2), '#000000');
    });
    return c;
  }
  // Date/Time Properties.
  const body = k.frame(0, 0, w, h, 'DATE/TIME PROPERTIES');
  const now = new Date();
  const month = now.toLocaleString('en', { month: 'long' }).toUpperCase();
  tinyText(g, `${month} ${now.getFullYear()}`, 8, body + 3, '#000000');
  k.sunken(6, body + 11, 106, 76, '#ffffff');
  'SMTWTFS'.split('').forEach((d, i) => tinyText(g, d, 11 + i * 14, body + 14, '#000080'));
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const slot = d - 1 + first;
    const x = 9 + (slot % 7) * 14, y = body + 22 + Math.floor(slot / 7) * 10;
    if (d === now.getDate()) k.fill(x - 1, y - 2, 13, 9, W98.navy);
    tinyText(g, `${d}`, x + (d < 10 ? 3 : 1), y, d === now.getDate() ? '#ffffff' : '#000000');
  }
  // An analog clock face.
  const cx = 142, cy = body + 42, r = 24;
  k.sunken(cx - r - 3, cy - r - 3, r * 2 + 6, r * 2 + 6, W98.teal);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.fill(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2, i % 3 ? '#c0c0c0' : '#ffff00');
  }
  const hand = (a, len, color) => {
    for (let d = 0; d < len; d++) k.fill(Math.round(cx + Math.sin(a) * d), Math.round(cy - Math.cos(a) * d), 2, 2, color);
  };
  hand(((now.getHours() % 12) / 12) * Math.PI * 2, 12, '#ffffff');
  hand((now.getMinutes() / 60) * Math.PI * 2, 19, '#ffffff');
  for (const b of m.buttons) {
    const x = Math.round(b.x / 2), y = Math.round(b.y / 2), bw = Math.round(b.w / 2), bh = Math.round(b.h / 2);
    k.raised(x, y, bw, bh);
    tinyText(g, b.label, x + Math.round((bw - (b.label.length * 4 - 1)) / 2), y + Math.floor((bh - 5) / 2), '#000000');
  }
  return c;
}

const ROW_ICONS = { minesweeper: 'mine', solitaire: 'doc', paint: 'paintbomb', pinball: 'joystick', calculator: 'exe', exploder: 'exploder', cleanup: 'eraser', run: 'exe', shutdown: 'blackout' };

// ---- a playing card for the Solitaire win ----

export function drawCard() {
  const c = canvas(20, 28);
  const g = c.getContext('2d');
  const k = kit(g);
  k.fill(0, 0, 20, 28, '#000000');
  k.fill(1, 1, 18, 26, '#ffffff');
  tinyText(g, 'A', 3, 3, '#ff0000');
  k.fill(8, 10, 2, 2, '#ff0000');
  k.fill(11, 10, 2, 2, '#ff0000');
  k.fill(7, 12, 7, 2, '#ff0000');
  k.fill(8, 14, 5, 2, '#ff0000');
  k.fill(9, 16, 3, 2, '#ff0000');
  k.fill(10, 18, 1, 1, '#ff0000');
  return c;
}

// ---- boot ----

const LOGO_KEY = {};
export function bootScreen() {
  if (LOGO_KEY.c) return LOGO_KEY.c;
  const c = canvas();
  const g = c.getContext('2d');
  cloudsInto(g, VIEW_W, VIEW_H, 1998, { sky: [110, 170, 240], top: [60, 120, 220], brightness: 1 });
  const k = kit(g);
  for (const [dx, dy, color] of [[0, 0, '#ff0000'], [11, 0, '#00a000'], [0, 11, '#0000ff'], [11, 0 + 11, '#ffd000']]) k.fill(204 + dx, 136 + dy, 9, 9, color);
  g.save();
  g.imageSmoothingEnabled = false;
  const m = textSprite('MACROSOFT', 8, '#ffffff', '#000000');
  g.drawImage(m, 238, 126);
  const t = textSprite('WINDERS', 16, '#ffffff', '#000000');
  g.drawImage(t, 232, 134, t.width * 2, t.height * 2);
  const n = textSprite('98', 16, '#ffff66', '#000000');
  g.drawImage(n, 232 + t.width * 2 + 6, 134, n.width * 2, n.height * 2);
  g.restore();
  LOGO_KEY.c = c;
  return c;
}

export const POST_LINES = [
  'BOOTLEG MODULAR BIOS V4.51PG',
  'COPYRIGHT (C) 1998, TOTALLY LEGIT SOFTWARE INC.',
  '',
  'MAIN PROCESSOR : PENTIUM-ISH 266MHZ',
  'MEMORY TEST : 64512K OK',
  '',
  'DETECTING IDE DRIVES ... DOODLE-DISK 4.3GB',
  'STARTING WINDERS 98...',
];

// The moving strip along the bottom of the boot logo: the real one is a palette trick, this is
// the same idea with a few rectangles.
export function drawBootBar(ctx, y, h, t) {
  const blocks = 40, w = 640 / blocks;
  for (let i = 0; i < blocks; i++) {
    const hue = ((i * 9 + t * 260) % 360 + 360) % 360;
    ctx.fillStyle = `hsl(${Math.round(hue / 30) * 30},85%,50%)`;
    ctx.fillRect(i * w * 2, y, w * 2 + 1, h);
  }
}

export const BSOD_LINES = [
  'A FATAL EXCEPTION 0E HAS OCCURRED AT 0028:C0011E36 IN VXD VMM(01) +',
  '00010E36. THE CURRENT APPLICATION WILL BE TERMINATED.',
  '',
  '*  PRESS ANY KEY TO TERMINATE THE CURRENT APPLICATION.',
  '*  PRESS CTRL+ALT+DEL AGAIN TO RESTART YOUR COMPUTER. YOU WILL',
  '   LOSE ANY UNSAVED INFORMATION IN ALL APPLICATIONS.',
  '',
  '                 PRESS ANY KEY TO CONTINUE _',
];

export { shortcutIcon };
