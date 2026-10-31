// Programs that open on the desktop just to make it feel used: a browser showing famous old websites,
// all parodies. Purely decoration, drawn under everything else. Each page is built once into a canvas;
// a page's `live` function then draws only the parts that move, so an open window costs very little.
// Sizes are in screen pixels.

import { PX, textSprite } from '../pixel.js';
import { tinyText } from '../icons.js';
import { kit, W98 } from './win98-art.js';
import { DESK_PAGES } from './desktop-apps.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---- the browser around every page ----

function browser(k, g, w, h, title, url) {
  k.frame(0, 0, w, h, `${title} - INTERNET EXPLODER`, { buttons: ['close', 'max', 'min'] });
  tinyText(g, 'FILE  EDIT  VIEW  GO  FAVORITES  HELP', 6, 17, '#000000');
  ['BACK', 'FWD', 'STOP', 'HOME', 'SEARCH'].forEach((label, i) => {
    k.raised(4 + i * 34, 25, 32, 13);
    tinyText(g, label, 7 + i * 34, 29, '#000000');
  });
  tinyText(g, 'ADDRESS', 6, 44, '#000000');
  k.sunken(38, 41, w - 44, 11, '#ffffff');
  tinyText(g, url, 41, 44, '#000000');
  k.sunken(3, 54, w - 6, h - 67, '#ffffff');
  k.sunken(3, h - 12, w - 6, 9, W98.face);
  tinyText(g, 'DONE', 6, h - 10, '#000000');
  return { x: 4, y: 55, w: w - 8, h: h - 69 };
}

// ---- little animated "videos" (96 x 72, shown enlarged like a blurry web video) ----

const VIDEO = { w: 96, h: 72, scale: 1.5 };

function limb(g, x, y, angle, len, color, thick = 2) {
  for (let d = 0; d <= len; d += 1) g.fillRect(Math.round(x + Math.sin(angle) * d), Math.round(y + Math.cos(angle) * d), thick, thick);
  return [x + Math.sin(angle) * len, y + Math.cos(angle) * len];
}

// A small person. Angles are radians from straight down; each limb is [upper, lower].
function person(g, cx, feet, look, pose) {
  const hip = feet - 22 + (pose.bob || 0);
  const shoulder = hip - 18;
  const lean = pose.lean || 0;
  const neck = cx + lean;
  g.fillStyle = look.shirt;
  g.fillRect(Math.round(neck - 4), shoulder, 9, 19);
  for (const [side, leg] of [[-3, pose.legL], [2, pose.legR]]) {
    const [kx, ky] = limb(g, cx + side, hip, leg[0], 11, look.pants, 3);
    limb(g, kx, ky, leg[1], 10, look.pants, 3);
  }
  for (const [side, arm] of [[-1, pose.armL], [1, pose.armR]]) {
    const [ex, ey] = limb(g, neck + side * 4, shoulder + 1, arm[0], 9, look.sleeve || look.shirt, 2);
    limb(g, ex, ey, arm[1], 8, look.skin, 2);
  }
  g.fillStyle = look.skin;
  g.fillRect(Math.round(neck - 3), shoulder - 8, 7, 8);
  g.fillStyle = look.hair;
  g.fillRect(Math.round(neck - 4), shoulder - 11, 9, 4);
  g.fillRect(Math.round(neck - 4), shoulder - 8, 2, 3);
  g.fillStyle = '#000000';
  g.fillRect(Math.round(neck - 1), shoulder - 6, 1, 1);
  g.fillRect(Math.round(neck + 2), shoulder - 6, 1, 1);
}

function catFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#c9b88e';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#a89468';
  g.fillRect(0, 40, w, 4);
  const nod = f % 2;
  const tilt = [0, 1, 0, -1, 0, 1][f];
  // Blue shirt.
  g.fillStyle = '#3f6fc4';
  g.fillRect(30, 34 + nod, 36, 24);
  g.fillStyle = '#6f97df';
  g.fillRect(44, 38 + nod, 8, 16);
  // Head, ears, stripes.
  const hx = 34 + tilt, hy = 10 + nod;
  g.fillStyle = '#e39a3b';
  g.fillRect(hx, hy, 28, 24);
  g.fillRect(hx, hy - 6, 7, 7);
  g.fillRect(hx + 21, hy - 6, 7, 7);
  g.fillStyle = '#b86e1e';
  for (const x of [8, 13, 18]) g.fillRect(hx + x, hy, 2, 6);
  g.fillRect(hx, hy + 12, 5, 2);
  g.fillRect(hx + 23, hy + 12, 5, 2);
  g.fillStyle = '#ffffff';
  g.fillRect(hx + 9, hy + 16, 10, 7);
  g.fillStyle = '#20301a';
  g.fillRect(hx + 6, hy + 8, 5, 5);
  g.fillRect(hx + 17, hy + 8, 5, 5);
  g.fillStyle = '#000000';
  g.fillRect(hx + 8, hy + 9, 2, 3);
  g.fillRect(hx + 19, hy + 9, 2, 3);
  g.fillStyle = '#d85a7a';
  g.fillRect(hx + 13, hy + 15, 3, 2);
  // Keyboard, with the keys it's hitting lit up.
  g.fillStyle = '#1a1a1a';
  g.fillRect(4, 56, w - 8, 16);
  g.fillStyle = '#f2f2f2';
  for (let x = 6; x < w - 8; x += 5) g.fillRect(x, 60, 4, 12);
  g.fillStyle = '#ffd24a';
  g.fillRect(14 + ((f * 13) % 26), 60, 4, 12);
  g.fillRect(52 + ((f * 17) % 28), 60, 4, 12);
  g.fillStyle = '#000000';
  for (let x = 9; x < w - 8; x += 10) g.fillRect(x, 60, 3, 6);
  // Paws take turns coming down.
  g.fillStyle = '#e39a3b';
  g.fillRect(22, f % 2 ? 50 : 56, 12, 8);
  g.fillRect(62, f % 2 ? 56 : 50, 12, 8);
}

const DOWN = 0, OUT = 1.2, UP = 2.9;
const DANCE = [
  { armL: [-OUT, -OUT], armR: [OUT, OUT], legL: [-0.2, -0.1], legR: [0.2, 0.1] },
  { armL: [-OUT, -2.6], armR: [OUT, 2.6], legL: [-0.4, 0.2], legR: [0.1, 0], bob: 1, lean: -3 },
  { armL: [-2.2, -3], armR: [2.2, 3], legL: [-0.1, -0.5], legR: [0.5, 0.2], bob: 2 },
  { armL: [-0.5, 0.9], armR: [0.5, -0.9], legL: [-0.5, 0], legR: [0.5, 0], bob: 3 },
  { armL: [DOWN, DOWN], armR: [UP - 0.4, UP - 0.4], legL: [-0.2, 0.3], legR: [0.3, -0.2], lean: 3 },
  { armL: [UP - 0.4, UP - 0.4], armR: [DOWN, DOWN], legL: [-0.3, 0.2], legR: [0.2, -0.3], lean: -3 },
  { armL: [-1.5, 0.2], armR: [1.5, -0.2], legL: [-0.7, 0.6], legR: [0.7, -0.6], bob: 4 },
  { armL: [-2.6, -2.2], armR: [2.6, 2.2], legL: [0, 0], legR: [0.1, 0], bob: 0 },
];

function danceFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#10121e';
  g.fillRect(0, 0, w, h);
  // A spotlight on a dark stage, and a crowd in the dark.
  g.fillStyle = '#6a6a90';
  for (let y = 0; y < h - 8; y++) {
    const half = 8 + y * 0.42;
    g.fillRect(Math.round(w / 2 - half), y, Math.round(half * 2), 1);
  }
  g.fillStyle = '#5a4a30';
  g.fillRect(0, 62, w, 3);
  person(g, w / 2, 62, { skin: '#e5b58a', hair: '#3a2410', shirt: '#2a2a2a', pants: '#3f5f9c' }, DANCE[f]);
  g.fillStyle = '#05060c';
  for (let x = 0; x < w; x += 12) g.fillRect(x, 65 + ((x / 12 + f) % 2), 9, 8);
}

const RICK = [
  { armL: [-0.5, 0.8], armR: [0.5, -0.8], legL: [-0.2, 0], legR: [0.25, 0.1], lean: -2 },
  { armL: [-0.9, 0.2], armR: [0.3, -1.1], legL: [-0.1, 0], legR: [0.15, 0], bob: 1 },
  { armL: [-0.3, 1.1], armR: [0.9, -0.2], legL: [-0.25, -0.1], legR: [0.2, 0], lean: 2 },
  { armL: [-1.1, -0.2], armR: [0.5, -0.8], legL: [-0.15, 0], legR: [0.1, 0], bob: 1 },
];

function rickFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#20304a';
  g.fillRect(0, 0, w, h);
  // Stone arches at night.
  g.fillStyle = '#34486a';
  for (let x = -4; x < w; x += 24) {
    g.fillRect(x, 8, 6, 54);
    g.fillRect(x, 8, 24, 4);
  }
  g.fillStyle = '#4a4a4a';
  g.fillRect(0, 62, w, 10);
  const step = [-5, -2, 3, 0][f];
  person(g, w / 2 + step, 64, { skin: '#eec39a', hair: '#c9622a', shirt: '#1a1a1a', pants: '#26324c', sleeve: '#b7a07a' }, RICK[f]);
  // The long coat.
  g.fillStyle = '#b7a07a';
  g.fillRect(w / 2 + step - 7, 24, 3, 22);
  g.fillRect(w / 2 + step + 5, 24, 3, 22);
  tinyText(g, 'NEVER GONNA...', 21, 2, '#ffffff');
}

// A crude critter drawn in chunky blocks. `u` is the block size, so it can zoom.
function chipmunkFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#7a8a5a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#5a6a44';
  g.fillRect(0, 50, w, 22);
  // The famous turn: it snaps round, then the camera slams in on its face.
  const step = [0, 0, 1, 1, 2, 2, 3, 3][f];
  const u = [2, 2, 4, 7][step], look = step === 0 ? -1 : 0;
  const cx = w / 2 + look * u * 2, cy = h / 2 + [14, 14, 4, 2][step];
  const box = (x, y, bw, bh, color) => {
    g.fillStyle = color;
    g.fillRect(Math.round(cx + x * u), Math.round(cy + y * u), Math.round(bw * u), Math.round(bh * u));
  };
  box(-5, -5, 10, 11, '#9a6a3a');
  box(-5, -7, 2, 3, '#9a6a3a');
  box(3, -7, 2, 3, '#9a6a3a');
  box(-3, 0, 6, 5, '#d8b080');
  box(-3, -2, 2, 2, '#ffffff');
  box(1, -2, 2, 2, '#ffffff');
  box(-2 + look, -2, 1, 2, '#000000');
  box(2 + look, -2, 1, 2, '#000000');
  box(-1, 1, 2, 1, '#2a1a10');
  box(-1, 3, 1, 1, '#ffffff');
  box(0, 3, 1, 1, '#ffffff');
  if (step === 3) tinyText(g, 'DUN DUN DUNNN', 22, 2, '#ffffff');
}

function pandaFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#6f9a5a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#a89a60';
  g.fillRect(0, 54, w, 18);
  const sneeze = f >= 5;
  const jump = f === 6 ? -12 : f === 5 || f === 7 ? -6 : 0;
  const panda = (x, y, s) => {
    g.fillStyle = '#f2f2ee';
    g.fillRect(x, y, 22 * s, 18 * s);
    g.fillRect(x + 3 * s, y - 12 * s, 16 * s, 13 * s);
    g.fillStyle = '#141414';
    g.fillRect(x + 2 * s, y - 15 * s, 5 * s, 5 * s);
    g.fillRect(x + 15 * s, y - 15 * s, 5 * s, 5 * s);
    g.fillRect(x + 6 * s, y - 8 * s, 3 * s, 3 * s);
    g.fillRect(x + 13 * s, y - 8 * s, 3 * s, 3 * s);
    g.fillRect(x, y + 4 * s, 22 * s, 6 * s);
  };
  panda(46, 42 + jump, 1.3);
  panda(22, 54, 0.6);
  if (sneeze) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) g.fillRect(40 - i * 3, 42 - i + ((i * 7) % 5), 2, 2);
    tinyText(g, 'ACHOO!', 6, 6, '#ffffff');
  }
}

function nyanFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#0b2a5c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) g.fillRect((96 + (i * 37) - f * 8 + 960) % w, (i * 23) % h, 2, 2);
  // The rainbow streaming behind it.
  ['#ff2020', '#ff9a00', '#ffe600', '#30e030', '#20a0ff', '#7030ff'].forEach((color, i) => {
    g.fillStyle = color;
    for (let x = 0; x < 42; x += 8) g.fillRect(x, 24 + i * 4 + ((x / 8 + f) % 2) * 2, 8, 4);
  });
  const bob = f % 2;
  g.fillStyle = '#f0c080';
  g.fillRect(40, 20 + bob, 30, 28);
  g.fillStyle = '#ff90c8';
  g.fillRect(43, 23 + bob, 24, 22);
  g.fillStyle = '#ff3090';
  for (const [x, y] of [[46, 26], [56, 30], [50, 38], [62, 26], [60, 40]]) g.fillRect(x, y + bob, 2, 2);
  g.fillStyle = '#909090';
  g.fillRect(62, 28 + bob, 20, 15);
  g.fillRect(62, 24 + bob, 5, 5);
  g.fillRect(77, 24 + bob, 5, 5);
  g.fillRect(44 + (f % 3) * 2, 47, 5, 4);
  g.fillRect(62 - (f % 3) * 2, 47, 5, 4);
  g.fillStyle = '#000000';
  g.fillRect(66, 33 + bob, 3, 3);
  g.fillRect(75, 33 + bob, 3, 3);
  g.fillStyle = '#ff90a0';
  g.fillRect(63, 38 + bob, 3, 2);
  g.fillRect(78, 38 + bob, 3, 2);
}

function badgerFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#86c8f0';
  g.fillRect(0, 0, w, 30);
  g.fillStyle = '#5aa63a';
  g.fillRect(0, 30, w, 42);
  const badger = (x, y) => {
    g.fillStyle = '#505050';
    g.fillRect(x, y, 12, 12);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 4, y, 4, 12);
    g.fillStyle = '#000000';
    g.fillRect(x + 2, y + 4, 2, 2);
    g.fillRect(x + 8, y + 4, 2, 2);
  };
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      const up = (i + row + f) % 2 ? 0 : -5;
      badger(4 + i * 19 + (row % 2) * 6, 34 + row * 12 + up);
    }
  }
  if (f >= 4) {
    g.fillStyle = '#e04040';
    g.fillRect(36, 14, 24, 9);
    g.fillStyle = '#f0e0c0';
    g.fillRect(44, 23, 8, 9);
    tinyText(g, 'MUSHROOM!', 30, 4, '#800000');
  } else {
    tinyText(g, 'BADGER BADGER', 22, 4, '#000000');
  }
}

function bananaFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = f % 2 ? '#ff60c0' : '#40d0ff';
  g.fillRect(0, 0, w, h);
  const lean = [-3, -1, 2, 3, 1, -2][f];
  g.fillStyle = '#ffd820';
  for (let y = 0; y < 40; y++) {
    const bend = Math.round(Math.sin((y / 40) * Math.PI) * 6);
    g.fillRect(w / 2 - 6 + lean - bend, 10 + y, 13, 1);
  }
  g.fillStyle = '#6a4a10';
  g.fillRect(w / 2 - 2 + lean, 7, 4, 4);
  g.fillStyle = '#000000';
  g.fillRect(w / 2 - 6 + lean, 20, 2, 3);
  g.fillRect(w / 2 + 1 + lean, 20, 2, 3);
  g.fillStyle = '#ffd820';
  limb(g, w / 2 - 8 + lean, 30, -1.2 + (f % 2) * 1.6, 15, '#c0a010', 2);
  limb(g, w / 2 + 6 + lean, 30, 1.2 - (f % 2) * 1.6, 15, '#c0a010', 2);
  limb(g, w / 2 - 4, 49, -0.3 + (f % 3) * 0.3, 12, '#c0a010', 2);
  limb(g, w / 2 + 3, 49, 0.3 - (f % 3) * 0.3, 12, '#c0a010', 2);
  tinyText(g, 'ITS PB&J TIME!', 20, 64, '#000000');
}

function numaFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#b8b09a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#8a8270';
  g.fillRect(70, 0, 26, 40);
  g.fillStyle = '#50604a';
  g.fillRect(74, 4, 18, 20);
  // Bad webcam: head filling the frame, singing with total commitment.
  const bob = [0, 2, 0, -1, 2, 1][f], tilt = [0, 2, -2, 1, -1, 2][f];
  const x = 30 + tilt, y = 12 + bob;
  g.fillStyle = '#3a3a3a';
  g.fillRect(x - 6, 54 + bob, 48, 18);
  g.fillStyle = '#e3b48c';
  g.fillRect(x, y, 34, 40);
  g.fillStyle = '#3a2a18';
  g.fillRect(x, y, 34, 7);
  g.fillStyle = '#ffffff';
  g.fillRect(x + 5, y + 14, 9, 7);
  g.fillRect(x + 20, y + 14, 9, 7);
  g.fillStyle = '#000000';
  g.fillRect(x + 8, y + 16, 3, 3);
  g.fillRect(x + 23, y + 16, 3, 3);
  g.fillStyle = '#5a1a1a';
  const open = [8, 3, 10, 5, 9, 4][f];
  g.fillRect(x + 10, y + 27, 14, open);
  // Headset.
  g.fillStyle = '#101010';
  g.fillRect(x - 3, y + 1, 40, 3);
  g.fillRect(x - 5, y + 12, 5, 12);
  g.fillRect(x + 34, y + 12, 5, 12);
  g.fillRect(x + 4, y + 30, 8, 2);
  tinyText(g, 'NUMA NUMA YEI', 4, 2, '#000000');
}

function rainbowFrame(g, f) {
  const w = VIDEO.w, h = VIDEO.h;
  g.fillStyle = '#7fb6e6';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#4a7a3a';
  g.fillRect(0, 52, w, 20);
  g.fillStyle = '#6a7a8a';
  for (let x = 0; x < w; x++) g.fillRect(x, 52 - Math.abs(((x * 3) % 60) - 30) / 2, 1, 16);
  const arc = (r0, cy) => {
    ['#ff3030', '#ff9a20', '#ffe830', '#40d040', '#3070ff', '#8040e0'].forEach((color, i) => {
      g.fillStyle = color;
      for (let a = 0; a < 180; a += 1) {
        const t = (a / 180) * Math.PI;
        g.fillRect(Math.round(w / 2 + Math.cos(t) * (r0 - i)), Math.round(cy - Math.sin(t) * (r0 - i)), 1, 1);
      }
    });
  };
  arc(44, 62);
  arc(34, 62);
  if (f % 2) tinyText(g, 'ALL THE WAY!', 24, 2, '#ffffff');
  else tinyText(g, 'DOUBLE RAINBOW', 20, 2, '#ffff66');
}

function frames(count, paint) {
  return Array.from({ length: count }, (_, i) => {
    const c = canvas(VIDEO.w, VIDEO.h);
    paint(c.getContext('2d'), i);
    return c;
  });
}

const VIDEOS = [
  {
    title: 'KEYBOARD CAT! PLAY HIM OFF', user: 'CATFAN1984', views: '8,204,113', time: '0:54', stars: 5,
    paint: catFrame, count: 6, ms: 120,
    related: [['#e39a3b', 'CAT IN A BOX'], ['#7fb0e0', 'BABY LAUGHS'], ['#6a9a50', 'SNEEZING PANDA']],
  },
  {
    title: 'EVOLUTION OF DANCE', user: 'THEDANCEGUY', views: '19,560,207', time: '6:00', stars: 5,
    paint: danceFrame, count: DANCE.length, ms: 240,
    related: [['#3a3a58', 'NUMA NUMA'], ['#a04040', 'LEEROY!!!'], ['#50a0a0', 'THE END OF DANCE']],
  },
  {
    title: 'NEVER GONNA GIVE YOU UP', user: 'TOTALLYNOTATRAP', views: '2,145,902', time: '3:32', stars: 4,
    paint: rickFrame, count: RICK.length, ms: 190,
    related: [['#26324c', 'FREE GAME DEMO'], ['#c9622a', 'HALF-LOAF 3 LEAK'], ['#8a8a30', 'NOT A RICK ROLL']],
  },
  {
    title: 'DRAMATIC CHIPMUNK', user: 'PRAIRIEDOGG', views: '6,300,418', time: '0:05', stars: 5,
    paint: chipmunkFrame, count: 8, ms: 320,
    related: [['#9a6a3a', 'DRAMATIC HAMSTER'], ['#505050', 'BADGER BADGER'], ['#ffd820', 'PBJ TIME']],
  },
  {
    title: 'SNEEZING BABY PANDA', user: 'ZOO_CAM_44', views: '11,902,655', time: '0:16', stars: 5,
    paint: pandaFrame, count: 8, ms: 280,
    related: [['#f2f2ee', 'PANDA ROLLS DOWN'], ['#7fb0e0', 'BABY LAUGHS'], ['#e39a3b', 'KEYBOARD CAT']],
  },
  {
    title: 'RAINBOW TOAST CAT (10 HOURS)', user: 'POPTARTFAN', views: '41,077,290', time: '10:00', stars: 5,
    paint: nyanFrame, count: 6, ms: 90,
    related: [['#0b2a5c', 'TOAST CAT REMIX'], ['#ff3090', 'TOAST CAT ORIGINAL'], ['#7fb6e6', 'DOUBLE RAINBOW']],
  },
  {
    title: 'BADGER BADGER BADGER', user: 'MUSHROOM_FAN', views: '5,811,036', time: '1:40', stars: 4,
    paint: badgerFrame, count: 8, ms: 170,
    related: [['#5aa63a', 'SNAAAKE'], ['#e04040', 'MUSHROOM 1 HOUR'], ['#ffd820', 'PBJ TIME']],
  },
  {
    title: 'PEANUT BUTTER JELLY TIME', user: 'BANANA_MAN', views: '7,420,881', time: '0:32', stars: 5,
    paint: bananaFrame, count: 6, ms: 150,
    related: [['#ffd820', 'BANANA PHONE'], ['#505050', 'BADGER BADGER'], ['#40d0ff', 'DANCING BABY']],
  },
  {
    title: 'NUMA NUMA DANCE', user: 'WEBCAMKING', views: '15,003,772', time: '1:42', stars: 5,
    paint: numaFrame, count: 6, ms: 170,
    related: [['#b8b09a', 'LIP SYNC FAIL'], ['#3a3a58', 'EVOLUTION OF DANCE'], ['#a04040', 'LEEROY!!!']],
  },
  {
    title: 'DOUBLE RAINBOW ALL THE WAY', user: 'YOSEMITE_DUDE', views: '23,118,604', time: '3:29', stars: 5,
    paint: rainbowFrame, count: 4, ms: 420,
    related: [['#7fb6e6', 'WHAT DOES IT MEAN'], ['#4a7a3a', 'TRIPLE RAINBOW?'], ['#ff9a20', 'SUNSET OMG']],
  },
];
export const VIDEO_COUNT = VIDEOS.length;

// Draws an image at screen-pixel scale from inside a page's `live` function.
function blit(ctx, img, x, y, scale = 1) {
  ctx.drawImage(img, x, y, img.width * scale * PX, img.height * scale * PX);
}

// The caption font on the game canvas, for text that changes.
function liveText(ctx, text, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(PX, PX);
  tinyText(ctx, text, 0, 0, color);
  ctx.restore();
}

function tubePage(w, h, v) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, `YOUTOOB - ${v.title}`.slice(0, 40), `HTTP://WWW.YOUTOOB.COM/WATCH?V=${v.user.slice(0, 6)}`);
  // Masthead.
  const you = textSprite('YOU', 8, '#000000', null);
  g.drawImage(you, p.x + 4, p.y + 1);
  k.fill(p.x + 24, p.y + 2, 30, 11, '#cc0000');
  g.drawImage(textSprite('TOOB', 8, '#ffffff', null), p.x + 26, p.y + 1);
  tinyText(g, 'BROADCAST YERSELF', p.x + 4, p.y + 15, '#666666');
  k.sunken(p.x + 100, p.y + 3, 100, 10, '#ffffff');
  k.raised(p.x + 203, p.y + 3, 34, 10);
  tinyText(g, 'SEARCH', p.x + 208, p.y + 6, '#000000');
  ['HOME', 'VIDEOS', 'CHANNELS', 'UPLOAD'].forEach((t, i) => {
    k.fill(p.x + 78 + i * 42, p.y + 15, 40, 7, i === 1 ? '#cc0000' : '#ffe9d6');
    tinyText(g, t, p.x + 80 + i * 42, p.y + 16, i === 1 ? '#ffffff' : '#c04000');
  });
  k.fill(p.x, p.y + 23, p.w, 1, '#cc0000');
  tinyText(g, v.title, p.x + 4, p.y + 27, '#000000');
  // Player.
  const vw = VIDEO.w * VIDEO.scale, vh = VIDEO.h * VIDEO.scale;
  const video = { x: p.x + 4, y: p.y + 35 };
  k.fill(video.x - 1, video.y - 1, vw + 2, vh + 15, '#000000');
  const barY = video.y + vh;
  k.fill(video.x, barY, vw, 13, '#d8d8d8');
  k.fill(video.x + 3, barY + 3, 7, 7, '#404040');
  k.fill(video.x + 14, barY + 5, vw - 60, 3, '#a0a0a0');
  tinyText(g, `0:12/${v.time}`, video.x + vw - 44, barY + 4, '#000000');
  // Stats under the video.
  const ty = barY + 16;
  tinyText(g, `FROM: ${v.user}`, video.x, ty, '#0033cc');
  tinyText(g, `VIEWS: ${v.views}`, video.x, ty + 7, '#000000');
  for (let i = 0; i < 5; i++) k.fill(video.x + 100 + i * 8, ty + 1, 6, 6, i < v.stars ? '#ffb400' : '#d0d0d0');
  // Related videos.
  const sx = video.x + vw + 8;
  tinyText(g, 'RELATED VIDEOS', sx, p.y + 27, '#c04000');
  v.related.forEach(([color, label], i) => {
    const y = p.y + 36 + i * 42;
    k.fill(sx, y, 44, 33, color);
    k.fill(sx + 16, y + 11, 12, 11, '#ffffff');
    k.fill(sx + 20, y + 13, 5, 7, color);
    const words = label.split(' ');
    tinyText(g, words.slice(0, 2).join(' '), sx + 48, y + 2, '#0033cc');
    tinyText(g, words.slice(2).join(' '), sx + 48, y + 9, '#0033cc');
    tinyText(g, `${(i + 2) * 3}:1${i}`, sx + 48, y + 22, '#666666');
  });
  const clips = frames(v.count, v.paint);
  return {
    c,
    live(ctx, x, y, a, now) {
      blit(ctx, clips[Math.floor(now / v.ms) % clips.length], x + video.x * PX, y + video.y * PX, VIDEO.scale);
      // The playhead creeps along.
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(x + (video.x + 14) * PX, y + (barY + 5) * PX, Math.min(1, a.age / 20) * (vw - 60) * PX, 3 * PX);
    },
  };
}

// Someone typing into a text box, one letter at a time.
function typeInto(ctx, query, x, y, age) {
  const shown = query.slice(0, Math.max(0, Math.floor((age - 0.8) * 8)));
  let end = x;
  if (shown) {
    const text = textSprite(shown, 8, '#000000', null);
    blit(ctx, text, x, y);
    end += (text.width - 1) * PX;
  }
  if (Math.floor(performance.now() / 400) % 2) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(end, y + 2 * PX, PX, 9 * PX);
  }
}

// ---- Doodle search ----

const SEARCHES = [
  'HOW TO DELETE SYSTEM32 SAFELY',
  'WHY IS MY MOUSE CURSOR ANGRY',
  'DOWNLOAD MORE RAM FREE NO VIRUS',
  'IS IT ILLEGAL TO SHOOT A POP-UP',
  'WILL Y2K EAT MY TAMAGOTCHI',
];

// The old rounded serif wordmark: bold letters in primary colors with a soft shadow, reduced to hard pixels.
function doodleLogo(g, cx, top) {
  const size = 46;
  const colors = ['#1b4fd8', '#d81e1e', '#efb60a', '#1b4fd8', '#1f9d36', '#d81e1e'];
  const word = 'Doodle';
  const t = canvas(260, 70);
  const m = t.getContext('2d', { willReadFrequently: true });
  m.font = `bold ${size}px "Times New Roman", Times, Georgia, serif`;
  m.textBaseline = 'top';
  const width = m.measureText(word).width;
  const paint = (shiftX, shiftY, fixed) => {
    let x = 130 - width / 2;
    [...word].forEach((ch, i) => {
      m.fillStyle = fixed || colors[i];
      m.fillText(ch, Math.round(x + shiftX), 8 + shiftY);
      x += m.measureText(ch).width;
    });
  };
  paint(3, 3, '#c0c0c0');
  paint(0, 0, null);
  const img = m.getImageData(0, 0, 260, 70);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  m.putImageData(img, 0, 0);
  g.drawImage(t, cx - 130, top);
}

function searchPage(w, h, variant) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, 'DOODLE', 'HTTP://WWW.DOODLE.COM/');
  const cx = p.x + p.w / 2;
  doodleLogo(g, cx, p.y + 2);
  tinyText(g, 'SEARCHING 3,083,324,652 WEB PAGES', cx - 66, p.y + 66, '#404040');
  const box = { x: cx - 112, y: p.y + 76, w: 224, h: 15 };
  k.sunken(box.x, box.y, box.w, box.h, '#ffffff');
  k.raised(cx - 80, box.y + 20, 76, 14);
  tinyText(g, 'DOODLE SEARCH', cx - 68, box.y + 25, '#000000');
  k.raised(cx + 4, box.y + 20, 80, 14);
  tinyText(g, "I'M FEELING CLICKY", cx + 8, box.y + 25, '#000000');
  tinyText(g, 'ADVERTISE - JOBS - ABOUT DOODLE', cx - 61, p.y + p.h - 12, '#0033cc');
  return {
    c,
    live: (ctx, x, y, a) => typeInto(ctx, SEARCHES[variant % SEARCHES.length], x + (box.x + 4) * PX, y + (box.y + 2) * PX, a.age),
  };
}

// ---- Hamster Jig: nothing but dancing rodents, the first viral page ----

function hamsterFrames() {
  return Array.from({ length: 4 }, (_, f) => {
    const c = canvas(30, 28);
    const g = c.getContext('2d');
    const hop = f % 2 ? 2 : 0, lean = [0, 2, 0, -2][f];
    g.fillStyle = '#d89a58';
    g.fillRect(7 + lean, 8 - hop, 16, 16);
    g.fillRect(5 + lean, 4 - hop, 6, 6);
    g.fillRect(19 + lean, 4 - hop, 6, 6);
    g.fillStyle = '#fff0dc';
    g.fillRect(10 + lean, 14 - hop, 10, 9);
    g.fillStyle = '#000000';
    g.fillRect(11 + lean, 10 - hop, 2, 2);
    g.fillRect(17 + lean, 10 - hop, 2, 2);
    g.fillStyle = '#ffffff';
    g.fillRect(14 + lean, 14 - hop, 1, 2);
    g.fillRect(16 + lean, 14 - hop, 1, 2);
    g.fillStyle = '#d89a58';
    g.fillRect(f % 2 ? 2 : 3, f < 2 ? 6 : 13, 5, 3);
    g.fillRect(f % 2 ? 23 : 22, f < 2 ? 13 : 6, 5, 3);
    g.fillRect(7, 24, 6, 3);
    g.fillRect(17, 24, 6, 3);
    return c;
  });
}

function hamsterPage(w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, 'HAMSTER JIG', 'HTTP://WWW.HAMSTERJIG.COM/');
  k.fill(p.x, p.y, p.w, p.h, '#ffe0ee');
  tinyText(g, 'WELCOME TO THE HAMSTER JIG!!! TURN YOUR SPEAKERS UP!', p.x + 50, p.y + 4, '#c00060');
  const dancers = hamsterFrames();
  const cols = 9, rows = 3, gx = p.x + 6, gy = p.y + 14, sx = (p.w - 12) / cols, sy = 31;
  return {
    c,
    live(ctx, x, y, a, now) {
      const beat = Math.floor(now / 130);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          blit(ctx, dancers[(beat + col + row * 2) % 4], x + (gx + col * sx) * PX, y + (gy + row * sy) * PX);
        }
      }
      if (beat % 2) liveText(ctx, 'DANCE DANCE DANCE DANCE DANCE', x + (p.x + 96) * PX, y + (p.y + p.h - 9) * PX, '#c00060');
    },
  };
}

// ---- GeoShacks: somebody's personal homepage, 1997 ----

function geoPage(w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, "~XX_DAVE_XX'S HOMEPAGE", 'HTTP://WWW.GEOSHACKS.COM/AREA51/VAULT/4417/');
  k.fill(p.x, p.y, p.w, p.h, '#000020');
  let seed = 7;
  for (let i = 0; i < 120; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    k.fill(p.x + (seed % p.w), p.y + ((seed >> 8) % p.h), 1, 1, i % 5 ? '#ffffff' : '#ffff66');
  }
  // Rainbow divider, the most important element of any homepage.
  ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#0099ff', '#cc00ff'].forEach((color, i) => {
    k.fill(p.x + 8 + (i * (p.w - 16)) / 6, p.y + 40, (p.w - 16) / 6 + 1, 2, color);
    k.fill(p.x + 8 + (i * (p.w - 16)) / 6, p.y + 98, (p.w - 16) / 6 + 1, 2, color);
  });
  // Under construction sign.
  const sx = p.x + 8, sy = p.y + 48;
  for (let i = 0; i < 90; i += 10) {
    k.fill(sx + i, sy, 5, 4, '#ffcc00');
    k.fill(sx + i + 5, sy, 5, 4, '#000000');
    k.fill(sx + i, sy + 38, 5, 4, '#000000');
    k.fill(sx + i + 5, sy + 38, 5, 4, '#ffcc00');
  }
  k.fill(sx, sy + 4, 90, 34, '#ffcc00');
  tinyText(g, 'UNDER', sx + 34, sy + 9, '#000000');
  tinyText(g, 'CONSTRUCTION', sx + 34, sy + 17, '#000000');
  tinyText(g, 'SINCE 1997!!', sx + 34, sy + 26, '#800000');
  // Links nobody ever clicked.
  const lx = p.x + 112;
  ['> MY CATS', '> MY OTHER CATS', '> COOL LINKS', '> SIGN MY GUESTBOOK', '> E-MAIL ME!!!'].forEach((t, i) => tinyText(g, t, lx, p.y + 48 + i * 9, '#66ffff'));
  tinyText(g, 'BEST VIEWED IN NETSCRAPE 4.0 AT 800X600', p.x + 8, p.y + p.h - 8, '#a0a0a0');
  tinyText(g, 'YOU ARE VISITOR NO.', p.x + 8, p.y + 104, '#ffffff');
  k.fill(p.x + 86, p.y + 102, 52, 9, '#000000');
  const headline = 'WELCOME 2 MY HOMEPAGE!!!';
  const line = '*** THIS SITE IS PART OF THE COOL DUDES WEBRING *** NEXT SITE >> *** ';
  return {
    c,
    live(ctx, x, y, a, now) {
      const colors = ['#ff4040', '#ffff40', '#40ff40', '#40ffff', '#ff40ff'];
      const flash = Math.floor(now / 220);
      [...headline].forEach((ch, i) => {
        const glyph = textSprite(ch, 8, colors[(i + flash) % colors.length], null);
        blit(ctx, glyph, x + (p.x + 66 + i * 8) * PX, y + (p.y + 8) * PX);
      });
      // A marquee, of course.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + (p.x + 4) * PX, y + (p.y + 24) * PX, (p.w - 8) * PX, 8 * PX);
      ctx.clip();
      const scroll = Math.floor(now / 30) % (line.length * 4);
      liveText(ctx, line + line + line, x + (p.x + 4 - scroll) * PX, y + (p.y + 26) * PX, '#ffff66');
      ctx.restore();
      liveText(ctx, String(14382 + Math.floor(a.age * 3)).padStart(8, '0'), x + (p.x + 88) * PX, y + (p.y + 104) * PX, '#00ff00');
      // The little digger only ever digs.
      const dig = Math.floor(now / 260) % 2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + (sx + 10) * PX, y + (sy + 10) * PX, 5 * PX, 12 * PX);
      ctx.fillRect(x + (sx + 11) * PX, y + (sy + 6) * PX, 3 * PX, 3 * PX);
      ctx.fillRect(x + (sx + 15) * PX, y + (sy + 12 + dig * 4) * PX, 11 * PX, 2 * PX);
      ctx.fillRect(x + (sx + 25) * PX, y + (sy + 12 + dig * 4) * PX, 2 * PX, 8 * PX);
    },
  };
}

// ---- MySplace: everyone's first friend was a guy in a white T-shirt ----

function face(k, x, y, skin, hair, size = 18) {
  k.fill(x, y, size, size, '#d0d0e0');
  k.fill(x + size / 4, y + size / 4, size / 2, size * 0.6, skin);
  k.fill(x + size / 4 - 1, y + size / 5, size / 2 + 2, size / 5, hair);
  k.fill(x + size * 0.15, y + size * 0.82, size * 0.7, size * 0.18, '#ffffff');
}

function myPage(w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, 'MYSPLACE.COM - XX_EMO_DAVE_XX', 'HTTP://WWW.MYSPLACE.COM/EMODAVE86');
  k.fill(p.x, p.y, p.w, p.h, '#1a1a1a');
  for (let y = 0; y < p.h; y += 12) {
    for (let x = (y / 12) % 2 ? 6 : 0; x < p.w; x += 12) k.fill(p.x + x, p.y + y, 2, 2, '#ff60b0');
  }
  k.fill(p.x, p.y, p.w, 12, '#003399');
  tinyText(g, 'MYSPLACE.COM', p.x + 4, p.y + 3, '#ffffff');
  tinyText(g, 'A PLACE FOR ACQUAINTANCES', p.x + 64, p.y + 3, '#99ccff');
  // Profile column.
  k.fill(p.x + 4, p.y + 15, 100, 128, '#ffffff');
  face(k, p.x + 8, p.y + 28, '#e8c0a0', '#101010', 44);
  tinyText(g, 'MOOD: EMO', p.x + 56, p.y + 30, '#000000');
  tinyText(g, 'AGE: 16', p.x + 56, p.y + 38, '#000000');
  tinyText(g, 'FROM: UR', p.x + 56, p.y + 46, '#000000');
  tinyText(g, 'HEART', p.x + 56, p.y + 54, '#000000');
  tinyText(g, 'DONT TRUST ANYONE', p.x + 8, p.y + 78, '#c00060');
  tinyText(g, 'EXCEPT MY TOP 8', p.x + 8, p.y + 86, '#c00060');
  k.fill(p.x + 8, p.y + 96, 92, 14, '#000000');
  tinyText(g, 'NOW PLAYING:', p.x + 10, p.y + 98, '#66ff66');
  tinyText(g, 'SAD EMO SONG #3', p.x + 10, p.y + 104, '#66ff66');
  // Top 8.
  k.fill(p.x + 110, p.y + 15, p.w - 114, 128, '#ffffff');
  tinyText(g, "TOD IS IN YOUR EXTENDED NETWORK", p.x + 113, p.y + 18, '#003399');
  tinyText(g, "EMODAVE'S TOP 8", p.x + 113, p.y + 28, '#c04000');
  const pals = [['TOD', '#e8c0a0', '#402010'], ['JESS', '#f0d0b0', '#c02060'], ['KYLE', '#c89070', '#101010'], ['BRI', '#e8c0a0', '#e0c040'], ['MOM', '#e8c0a0', '#808080'], ['DAN', '#a87050', '#101010'], ['ASH', '#f0d0b0', '#6020a0'], ['BOT', '#c0c0c0', '#404040']];
  pals.forEach(([name, skin, hair], i) => {
    const x = p.x + 114 + (i % 4) * 46, y = p.y + 37 + Math.floor(i / 4) * 40;
    face(k, x, y, skin, hair, 26);
    tinyText(g, name, x + 2, y + 29, '#0033cc');
  });
  const glitter = ['#ff40c0', '#30a0ff', '#c040ff', '#e0a000'];
  return {
    c,
    live(ctx, x, y, a, now) {
      const f = Math.floor(now / 120);
      [...'XX_EMO_DAVE_XX'].forEach((ch, i) => {
        blit(ctx, textSprite(ch, 8, glitter[(i + f) % 4], null), x + (p.x + 8 + i * 6.5) * PX, y + (p.y + 16) * PX);
      });
      if (f % 6 < 4) liveText(ctx, 'ONLINE NOW!', x + (p.x + 10) * PX, y + (p.y + 116) * PX, '#00a000');
      ctx.fillStyle = '#66ff66';
      ctx.fillRect(x + (p.x + 10) * PX, y + (p.y + 128) * PX, ((a.age * 6) % 88) * PX, 2 * PX);
    },
  };
}

// ---- eBuy: live auctions for things nobody needs ----

const LOTS = [
  ['TOAST THAT LOOKS LIKE ELVIS', 412.5, '#d8a050'],
  ['GHOST IN A JAR (SLIGHTLY USED)', 56, '#c0d8e0'],
  ['BEANIE BEAR, MINT, TAG INCLUDED', 1299, '#c04080'],
  ['BROKEN LASER POINTER', 14.83, '#404040'],
];

function buyPage(w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, 'EBUY - YOUR PERSONAL TRADING PLACE', 'HTTP://CGI.EBUY.COM/WS/EBUYISAPI.DLL');
  [['E', '#e53238'], ['B', '#0064d2'], ['U', '#f5af02'], ['Y', '#86b817']].forEach(([ch, color], i) => {
    const s = textSprite(ch, 16, color, null);
    g.drawImage(s, p.x + 4 + i * 14, p.y - 2);
  });
  k.sunken(p.x + 70, p.y + 3, 140, 11, '#ffffff');
  k.raised(p.x + 214, p.y + 3, 30, 11);
  tinyText(g, 'FIND', p.x + 221, p.y + 6, '#000000');
  k.fill(p.x, p.y + 20, p.w, 9, '#ffcc00');
  tinyText(g, 'ITEM', p.x + 40, p.y + 22, '#000000');
  tinyText(g, 'PRICE', p.x + 200, p.y + 22, '#000000');
  tinyText(g, 'ENDS IN', p.x + 256, p.y + 22, '#000000');
  LOTS.forEach(([name, , color], i) => {
    const y = p.y + 32 + i * 28;
    k.fill(p.x + 4, y, 30, 24, color);
    k.fill(p.x, y + 26, p.w, 1, '#d0d0d0');
    tinyText(g, name, p.x + 40, y + 3, '#0033cc');
    tinyText(g, `${(i * 3 + 7) % 11 + 1} BIDS`, p.x + 40, y + 12, '#606060');
  });
  return {
    c,
    live(ctx, x, y, a) {
      LOTS.forEach(([, price], i) => {
        const row = y + (p.y + 32 + i * 28 + 3) * PX;
        const rise = Math.floor(a.age / (2 + i)) * (1 + i * 3.25);
        liveText(ctx, `$${(price + rise).toFixed(2)}`, x + (p.x + 196) * PX, row, '#b00000');
        const left = Math.max(0, 47 + i * 73 - Math.floor(a.age));
        liveText(ctx, `0H ${Math.floor(left / 60)}M ${left % 60}S`, x + (p.x + 248) * PX, row, left < 60 ? '#ff0000' : '#000000');
      });
    },
  };
}

// ---- Ask Geeves: a butler who answers questions, supposedly ----

const QUESTIONS = ['WHERE DO POP-UPS COME FROM', 'WHY WONT MY MODEM STOP SCREAMING', 'WHO IS THE PAPERCLIP REALLY'];

function butlerFrames() {
  return Array.from({ length: 4 }, (_, f) => {
    const c = canvas(56, 84);
    const g = c.getContext('2d');
    const bow = [0, 3, 8, 3][f];
    g.fillStyle = '#101018';
    g.fillRect(14, 34 + bow / 2, 30, 50 - bow / 2);
    g.fillRect(8, 40 + bow, 8, 26);
    g.fillRect(42, 40 + bow, 8, 26);
    g.fillStyle = '#ffffff';
    g.fillRect(24, 34 + bow / 2, 10, 24);
    g.fillRect(8, 64 + bow, 8, 5);
    g.fillRect(42, 64 + bow, 8, 5);
    g.fillStyle = '#101018';
    g.fillRect(26, 34 + bow / 2, 6, 3);
    g.fillRect(28, 42 + bow / 2, 2, 2);
    g.fillRect(28, 50 + bow / 2, 2, 2);
    g.fillStyle = '#e8c0a0';
    g.fillRect(18, 8 + bow, 22, 26);
    g.fillStyle = '#505058';
    g.fillRect(16, 4 + bow, 26, 10);
    g.fillRect(16, 12 + bow, 4, 10);
    g.fillRect(38, 12 + bow, 4, 10);
    g.fillStyle = '#000000';
    g.fillRect(23, 18 + bow, 3, 2);
    g.fillRect(32, 18 + bow, 3, 2);
    g.fillRect(26, 27 + bow, 6, 1);
    return c;
  });
}

function askPage(w, h, variant) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const k = kit(g);
  const p = browser(k, g, w, h, 'ASK GEEVES', 'HTTP://WWW.ASKGEEVES.COM/');
  k.fill(p.x, p.y, p.w, 16, '#003a80');
  g.drawImage(textSprite('ASK GEEVES', 8, '#ffffff', null), p.x + 66, p.y + 2);
  tinyText(g, 'HAVE A QUESTION? JUST ASK!', p.x + 130, p.y + 6, '#ffcc00');
  tinyText(g, 'GOOD DAY. HOW MAY I BE OF SERVICE?', p.x + 66, p.y + 24, '#000000');
  const box = { x: p.x + 66, y: p.y + 34, w: 236, h: 15 };
  k.sunken(box.x, box.y, box.w, box.h, '#ffffff');
  k.raised(p.x + 66, p.y + 54, 40, 14);
  tinyText(g, 'ASK!', p.x + 78, p.y + 59, '#000000');
  tinyText(g, 'PEOPLE WITH QUESTIONS LIKE YOURS ASKED:', p.x + 66, p.y + 76, '#606060');
  ['IS THE INTERNET FULL YET?', 'CAN I PRINT A WEBSITE?', 'WHO WANTS TO BE A MILLIONAIRE?', 'WHAT IS A BLOG AND IS IT CONTAGIOUS?'].forEach((t, i) => tinyText(g, `> ${t}`, p.x + 66, p.y + 86 + i * 9, '#0033cc'));
  const butler = butlerFrames();
  return {
    c,
    live(ctx, x, y, a, now) {
      blit(ctx, butler[Math.floor(now / 340) % 4], x + (p.x + 4) * PX, y + (p.y + 40) * PX);
      typeInto(ctx, QUESTIONS[variant % QUESTIONS.length], x + (box.x + 3) * PX, y + (box.y + 2) * PX, a.age);
    },
  };
}

const PAGES = {
  tube: (w, h, v) => tubePage(w, h, VIDEOS[v % VIDEOS.length]),
  search: searchPage,
  hamster: hamsterPage,
  geo: geoPage,
  my: myPage,
  buy: buyPage,
  ask: askPage,
  ...DESK_PAGES,
};

const pages = {};

export function appArt(kind, variant, w, h) {
  const key = `${kind}:${variant}`;
  pages[key] ??= PAGES[kind](w, h, variant);
  return pages[key];
}
