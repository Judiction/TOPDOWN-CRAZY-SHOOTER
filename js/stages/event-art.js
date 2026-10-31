// Art for the things that barge onto the desktop: flying toasters, the paperclip, the purple ape, the
// printer, the calculator, the CD tray and the system dialogs. Everything is drawn once and cached.

import { tinyText, powerupIcon } from '../icons.js';
import { kit } from './win98-art.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = {};
const once = (key, make) => (cache[key] ??= make());

function paint(w, h, draw) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  draw(g, kit(g));
  return c;
}

export function toasterFrames() {
  return once('toaster', () => [0, 1, 2, 1].map((flap) => paint(40, 32, (g, k) => {
    k.fill(8, 12, 26, 15, '#101010');
    k.fill(9, 13, 24, 13, '#c8c8d0');
    k.fill(9, 13, 24, 3, '#ffffff');
    k.fill(9, 23, 24, 3, '#808088');
    k.fill(12, 11, 7, 2, '#804810');
    k.fill(22, 11, 7, 2, '#804810');
    k.fill(33, 17, 3, 3, '#101010');
    // Feathered wings, flapping: three rows of feathers fanned out from the shoulder.
    const lift = [-3, 0, 4][flap];
    for (let i = 0; i < 4; i++) {
      const len = 16 - i * 3;
      k.fill(21 - len, 11 - i * 2 + lift * (1 - i / 4) - 1, len + 1, 3, '#606070');
      k.fill(22 - len, 11 - i * 2 + lift * (1 - i / 4), len, 1, i % 2 ? '#ffffff' : '#d8d8e8');
    }
  })));
}

export function toastArt() {
  return once('toast', () => paint(16, 16, (g, k) => {
    k.fill(1, 1, 14, 14, '#301808');
    k.fill(2, 2, 12, 12, '#c98a3c');
    k.fill(4, 4, 8, 8, '#e0b060');
  }));
}

// The bootleg paperclip: a bent wire with googly eyes.
export function clipArt(blink) {
  return once(`clip:${blink}`, () => paint(30, 44, (g, k) => {
    const wire = '#b0b8c8', dark = '#505868';
    for (const [x, y, w, h] of [[6, 4, 18, 3], [6, 4, 3, 34], [21, 4, 3, 26], [11, 10, 3, 26], [11, 34, 10, 3], [19, 16, 3, 20], [6, 37, 12, 3]]) {
      k.fill(x, y, w, h, dark);
      k.fill(x, y, Math.max(1, w - 1), Math.max(1, h - 1), wire);
    }
    k.fill(5, 12, 9, 9, '#ffffff');
    k.fill(16, 12, 9, 9, '#ffffff');
    k.fill(5, 12, 9, 1, '#000000');
    k.fill(16, 12, 9, 1, '#000000');
    if (blink) {
      k.fill(6, 16, 7, 1, '#000000');
      k.fill(17, 16, 7, 1, '#000000');
    } else {
      k.fill(9, 15, 3, 4, '#000000');
      k.fill(20, 15, 3, 4, '#000000');
    }
    k.fill(5, 9, 8, 1, '#505868');
    k.fill(17, 8, 8, 1, '#505868');
  }));
}

// A yellow help balloon, wrapped to its lines.
export function balloon(lines, tail = true) {
  return once(`balloon:${lines.join('|')}`, () => {
    const w = Math.max(...lines.map((l) => l.length)) * 4 + 12, h = lines.length * 8 + 12;
    return paint(w, h + 7, (g, k) => {
      k.fill(0, 0, w, h, '#000000');
      k.fill(1, 1, w - 2, h - 2, '#ffffcc');
      lines.forEach((line, i) => tinyText(g, line, 6, 6 + i * 8, '#000000'));
      if (tail) {
        for (let i = 0; i < 7; i++) {
          k.fill(12, h + i - 1, 8 - i, 1, '#ffffcc');
          k.fill(11, h + i - 1, 1, 1, '#000000');
          k.fill(20 - i, h + i - 1, 1, 1, '#000000');
        }
      }
    });
  });
}

// The bootleg purple gorilla, mid-stride.
export function apeArt(step) {
  return once(`ape:${step}`, () => paint(36, 48, (g, k) => {
    const fur = '#6a2fa8', pale = '#b090d8', dark = '#3a1468';
    k.fill(9, 14, 18, 22, fur);
    k.fill(13, 19, 10, 13, pale);
    k.fill(11, 2, 14, 13, fur);
    k.fill(9, 6, 3, 5, fur);
    k.fill(24, 6, 3, 5, fur);
    k.fill(13, 7, 10, 7, pale);
    k.fill(15, 8, 2, 2, '#000000');
    k.fill(20, 8, 2, 2, '#000000');
    k.fill(15, 12, 7, 1, dark);
    k.fill(4, 15, 6, 19 + (step ? 2 : -2), fur);
    k.fill(26, 15, 6, 19 + (step ? -2 : 2), fur);
    k.fill(11, 36, 6, step ? 10 : 7, dark);
    k.fill(19, 36, 6, step ? 7 : 10, dark);
    k.fill(13, 0, 12, 3, '#ff3030');              // the little safari hat
  }));
}

export function printerArt() {
  return once('printer', () => powerupIcon('inkrush'));
}

export function sheetArt(turn) {
  return once(`sheet:${turn}`, () => (turn ? paint(10, 6, (g, k) => {
    k.fill(0, 0, 10, 6, '#606060');
    k.fill(1, 1, 8, 4, '#ffffff');
  }) : paint(8, 11, (g, k) => {
    k.fill(0, 0, 8, 11, '#606060');
    k.fill(1, 1, 6, 9, '#ffffff');
    k.fill(2, 3, 4, 1, '#808080');
    k.fill(2, 5, 4, 1, '#808080');
    k.fill(2, 7, 3, 1, '#808080');
  })));
}

export function keyArt() {
  return once('key', () => paint(10, 10, (g, k) => {
    k.raised(0, 0, 10, 10);
    tinyText(g, '8', 3, 3, '#000000');
  }));
}

export function calcArt() {
  return once('calc', () => paint(70, 96, (g, k) => {
    k.frame(0, 0, 70, 96, 'CALC', { buttons: ['close'] });
    k.sunken(5, 16, 60, 13, '#ffffff');
    tinyText(g, '58008', 42, 20, '#000000');
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q < 4; q++) {
        k.raised(5 + q * 15, 33 + r * 14, 14, 12);
        tinyText(g, '789/456*123-0.=+'[r * 4 + q], 10 + q * 15, 37 + r * 14, q === 3 ? '#ff0000' : '#000080');
      }
    }
  }));
}

export function ballArt() {
  return once('pinball', () => paint(20, 20, (g) => {
    g.fillStyle = '#404048';
    g.beginPath();
    g.arc(10, 10, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8c8d8';
    g.beginPath();
    g.arc(9, 9, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(5, 5, 4, 3);
  }));
}

export function trayArt(len) {
  return once('tray', () => paint(len, 70, (g, k) => {
    k.raised(0, 0, len, 70, '#d8d0b8');
    k.fill(14, 6, len - 30, 58, '#b8b098');
    g.fillStyle = '#908870';
    g.beginPath();
    g.arc(14 + (len - 30) / 2, 35, 27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d8d0b8';
    g.beginPath();
    g.arc(14 + (len - 30) / 2, 35, 7, 0, Math.PI * 2);
    g.fill();
    k.fill(len - 12, 4, 8, 62, '#c8c0a8');
    k.fill(len - 10, 56, 4, 3, '#30ff30');
    tinyText(g, 'CD-ROM', 18, 8, '#606050');
  }));
}

export function formatDialog() {
  return once('format', () => paint(180, 66, (g, k) => {
    k.frame(0, 0, 180, 66, 'FORMAT - WINDERS (C:)', { buttons: ['close'] });
    tinyText(g, 'WARNING: ALL DATA ON DRIVE C: WILL BE LOST', 6, 17, '#800000');
    k.sunken(6, 26, 168, 11, '#ffffff');
    k.raised(62, 45, 56, 15);
    tinyText(g, 'CANCEL', 78, 50, '#000000');
  }));
}

export function runDialog() {
  return once('run', () => paint(180, 56, (g, k) => {
    k.frame(0, 0, 180, 56, 'RUN', { buttons: ['close'] });
    tinyText(g, 'TYPE THE NAME OF A PROGRAM.', 6, 18, '#000000');
    tinyText(g, 'OPEN:', 6, 32, '#000000');
    k.sunken(30, 29, 144, 11, '#ffffff');
    k.raised(92, 42, 40, 11);
    tinyText(g, 'OK', 108, 45, '#000000');
    k.raised(134, 42, 40, 11);
    tinyText(g, 'CANCEL', 142, 45, '#000000');
  }));
}
