// Player sprites: the pointing-hand cursor (and, later, the hand holding each weapon), drawn from
// text pixel masks — one character per pixel — so they all share one pixel grid and one style.
//
//   .  empty           X  outline (a darker shade of the player's color)
//   o  player color    other letters: fixed colors from PALETTE (weapon metal, wood, glow...)
//
// Every sprite points UP (toward row 0). Each has a pivot (the palm: where the player's position
// is, so switching sprites never shifts the hand) and a tip (where shots come out). Drawing rotates
// the sprite so the tip lies on the aim line, rasterized straight onto the screen's pixel grid so the
// edges stay jagged and aliased at any angle.

import { PX } from './pixel.js';

const PALETTE = {
  w: '#ffffff', k: '#111111', g: '#9ca3af', d: '#4b5563', s: '#d1d5db', b: '#7c4a1e', n: '#a16207',
  r: '#ef4444', y: '#fde047', c: '#22d3ee', t: '#0e7490', m: '#65a30d', l: '#3f6212', u: '#f97316',
};

// Inside any closed outline, '.' becomes 'o' (player color): pixels the outside can't reach.
function fillInside(lines) {
  const h = lines.length, w = Math.max(...lines.map((l) => l.length));
  const grid = lines.map((l) => [...l.padEnd(w, '.')]);
  const outside = grid.map((row) => row.map(() => false));
  const stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || outside[y][x] || grid[y][x] !== '.') continue;
    outside[y][x] = true;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return grid.map((row, y) => row.map((ch, x) => (ch === '.' && !outside[y][x] ? 'o' : ch)).join(''));
}

function makeSprite(lines, { pivot, tip, fill = true }) {
  const rows = fill ? fillInside(lines) : lines;
  const h = rows.length, w = Math.max(...rows.map((l) => l.length));
  return {
    rows: rows.map((l) => l.padEnd(w, '.')),
    w,
    h,
    pivot,
    tip,
    tipAngle: Math.atan2(tip.y - pivot.y, tip.x - pivot.x),
    muzzle: Math.hypot(tip.x - pivot.x, tip.y - pivot.y),     // pivot → tip, in cells
  };
}

// The classic pointing-hand cursor, traced pixel for pixel (17 x 22).
const HAND = makeSprite([
  '.....XX..........',
  '....X..X.........',
  '....X..X.........',
  '....X..X.........',
  '....X..X.........',
  '....X..XXX.......',
  '....X..X..XXX....',
  '....X..X..X..XX..',
  '....X..X..X..X.X.',
  'XXX.X..X..X..X..X',
  'X..XX........X..X',
  'X...X...........X',
  '.X..X...........X',
  '..X.............X',
  '..X.............X',
  '...X............X',
  '...X...........X.',
  '....X..........X.',
  '....X..........X.',
  '.....X........X..',
  '.....X........X..',
  '.....XXXXXXXXXX..',
], { pivot: { x: 10, y: 14 }, tip: { x: 6, y: 0 } });

// The same hand with the index finger curled in: a fist that grips the weapons.
const FIST_ROWS = [
  '....XXXXXX.......',
  '....X..X..XXX....',
  '....X..X..X..XX..',
  '....X..X..X..X.X.',
  'XXX.X..X..X..X..X',
  'X..XX........X..X',
  'X...X...........X',
  '.X..X...........X',
  '..X.............X',
  '..X.............X',
  '...X............X',
  '...X...........X.',
  '....X..........X.',
  '....X..........X.',
  '.....X........X..',
  '.....X........X..',
  '.....XXXXXXXXXX..',
];
const FIST_PIVOT = { x: 10, y: 9 };   // same palm spot as the pointing hand (its row 14)

// A weapon held in the fist: the weapon art is stamped over the fist with its column `atX` and its
// last row resting `sink` rows down into the fist. `muzzle` is where shots leave, in weapon coords.
// ',' inside weapon art = see-through (never filled with the player color).
function holding(weapon, { atX, sink, muzzle }) {
  const fist = fillInside(FIST_ROWS);
  const top = weapon.length - sink;                           // weapon rows above the fist
  const w = Math.max(17, atX + Math.max(...weapon.map((l) => l.length)));
  const grid = [...Array(top).fill('.'.repeat(w)), ...fist.map((l) => l.padEnd(w, '.'))].map((l) => [...l]);
  weapon.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch !== '.') grid[r][atX + c] = ch;
  }));
  const rows = grid.map((r) => r.join(''));
  const sprite = makeSprite(rows, {
    pivot: { x: FIST_PIVOT.x, y: FIST_PIVOT.y + top },
    tip: { x: atX + muzzle.x, y: muzzle.y },
    fill: false,
  });
  // The same gun on its own, for cursors that have no fist to hold it (see gunSprite).
  sprite.gun = makeSprite(weapon, {
    pivot: { x: muzzle.x, y: weapon.length - 1 },
    tip: muzzle,
    fill: false,
  });
  return sprite;
}

const SHOTGUN = holding([
  '.kkkk.',
  '.kdsk.',
  '.kdsk.',
  '.kdsk.',
  '.kdsk.',
  '.kdsk.',
  '.kdsk.',
  'kbbbbk',
  'kbnnbk',
  'kbnnbk',
  'kbbbbk',
  '.kdsk.',
  '.kdsk.',
  '.kddk.',
  '.kkkk.',
], { atX: 3, sink: 4, muzzle: { x: 3, y: 0 } });

const UZI = holding([
  '..kk..',
  '..ds..',
  '.kkkk.',
  'kdddsk',
  'kdsssk',
  'kdddsk',
  'kdddsk',
  'kkddkk',
  '.kddk.',
], { atX: 3, sink: 3, muzzle: { x: 3, y: 0 } });

const ROCKET = holding([
  '.kkkkk.',
  'kryyyrk',
  'kruuurk',
  'kggggsk',
  'kgdggsk',
  'kgdggsk',
  'kgdggsk',
  'kgdggsk',
  'kgdggsk',
  'kgdggsk',
  'kgdggsk',
  'kggggsk',
  '.kkkkk.',
  '..kdk..',
  '..kdk..',
], { atX: 2, sink: 4, muzzle: { x: 3.5, y: 0 } });

const LASER = holding([
  '..cc..',
  '.cwwc.',
  '.kcck.',
  '.ktsk.',
  'kttssk',
  'kwwwwk',
  'ktcctk',
  'ktcctk',
  'kttttk',
  '.kttk.',
], { atX: 3, sink: 3, muzzle: { x: 3, y: 0 } });

const SNIPER = holding([
  '..k....',
  '..d....',
  '..d....',
  '..d....',
  '..d....',
  '..d....',
  '.kdk...',
  '.kdk...',
  '.kdkkk.',
  '.kdkgk.',
  '.kdkgk.',
  '.kdkkk.',
  '.kdk...',
  'kbbbk..',
  'kbnbk..',
  'kbnbk..',
  'kbbbk..',
], { atX: 3, sink: 4, muzzle: { x: 2.5, y: 0 } });

const FLAMER = holding([
  '..uy..',
  '..ku..',
  '.kddk.',
  '.kdsk.',
  '.kdsk.',
  'krrrrk',
  'krrrsk',
  'krrrsk',
  'krrrsk',
  'kkddkk',
  '.kddk.',
], { atX: 3, sink: 3, muzzle: { x: 3, y: 0 } });

const GRENADE = holding([
  '..kk...',
  '.kd,dk.',
  '..kdk..',
  '.kmmmk.',
  'kmmlmmk',
  'kmlmmmk',
  'kmmmmmk',
  '.kmmmk.',
], { atX: 2, sink: 3, muzzle: { x: 3.5, y: 0 } });

// ---- the cursors players can pick ----
// Each has a clear tip, drawn at the same scale as the hand. All cosmetic: same hitbox for everyone.
const cursor = (rows, tip, pivot) => makeSprite(rows, { pivot, tip, fill: false });

const CURSOR_ART = {
  // The classic arrow, tilted the way every desktop has drawn it since the 80s.
  arrow: cursor([
    'X...........',
    'XX..........',
    'XoX.........',
    'XooX........',
    'XoooX.......',
    'XooooX......',
    'XoooooX.....',
    'XooooooX....',
    'XoooooooX...',
    'XooooooooX..',
    'XoooooXXXXX.',
    'XooXooX.....',
    'XoX.XooX....',
    'XX..XooX....',
    'X....XooX...',
    '.....XooX...',
    '......XX....',
  ], { x: 0, y: 0 }, { x: 4, y: 9 }),
  // Bright outline, like the big arrows on modern systems.
  modern: cursor([
    'w.............',
    'ww............',
    'wow...........',
    'woow..........',
    'wooow.........',
    'woooow........',
    'wooooow.......',
    'woooooow......',
    'wooooooow.....',
    'woooooooow....',
    'wooooooooow...',
    'woooooowwwww..',
    'woowooow......',
    'wowwoooow.....',
    'ww..wooow.....',
    'w...wooow.....',
    '.....wooow....',
    '.....www......',
  ], { x: 0, y: 0 }, { x: 5, y: 10 }),
  // Glossy, with a shine down one side.
  glossy: cursor([
    'X............',
    'XX...........',
    'XwX..........',
    'XwoX.........',
    'XwooX........',
    'XwoooX.......',
    'XwooooX......',
    'XwoooooX.....',
    'XwooooooX....',
    'XwoooooooX...',
    'XwooooooooX..',
    'XwooooXXXXXX.',
    'XwoXoooX.....',
    'XwX.XoooX....',
    'XX..XoooX....',
    'X....XoooX...',
    '.....XoooX...',
    '......XXX....',
  ], { x: 0, y: 0 }, { x: 4, y: 10 }),
  // A chunky pixel arrow pointing straight ahead.
  block: cursor([
    '.....XX.....',
    '....XooX....',
    '...XooooX...',
    '..XooooooX..',
    '.XooooooooX.',
    'XooooooooooX',
    'XXXXooooXXXX',
    '...XooooX...',
    '...XooooX...',
    '...XooooX...',
    '...XooooX...',
    '...XooooX...',
    '...XooooX...',
    '...XXXXXX...',
  ], { x: 5.5, y: 0 }, { x: 5.5, y: 8 }),
  // The navigation chevron from map apps.
  nav: cursor([
    '.......XX.......',
    '......XooX......',
    '......XooX......',
    '.....XooooX.....',
    '.....XooooX.....',
    '....XooooooX....',
    '....XooooooX....',
    '...XooooooooX...',
    '...XooooooooX...',
    '..XooooooooooX..',
    '..XooooXXooooX..',
    '.XoooXX..XXoooX.',
    '.XoXX......XXoX.',
    'XXX..........XXX',
  ], { x: 7.5, y: 0 }, { x: 7.5, y: 8 }),
  // The pencil from every paint program.
  pencil: cursor([
    '...XX...',
    '...kk...',
    '..XkkX..',
    '..XnnX..',
    '.XnnnnX.',
    '.XoooXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XowoXX.',
    '.XsssXX.',
    '.XsgsXX.',
    '.XrrrXX.',
    '.XrrrXX.',
    '..XXXX..',
  ], { x: 3.5, y: 0 }, { x: 3.5, y: 12 }),
  // A sword: the cursor of choice in a hundred 90s games.
  sword: cursor([
    '....XX....',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    '...XwsX...',
    'XXXXwsXXXX',
    'XooooooooX',
    'XXXXooXXXX',
    '...XooX...',
    '...XooX...',
    '...XooX...',
    '...XooX...',
    '...XXXX...',
  ], { x: 4.5, y: 0 }, { x: 4.5, y: 12 }),
  // A folded paper plane.
  plane: cursor([
    '.......XX.......',
    '.......XwX......',
    '......XwoX......',
    '......XwooX.....',
    '.....XwwooX.....',
    '.....XwwoooX....',
    '....XwwwoooX....',
    '....XwwwooooX...',
    '...XwwwwooooX...',
    '...XwwwwoooooX..',
    '..XwwwwwoooooX..',
    '..XwwwwXXoooooX.',
    '.XwwXXX..XXoooX.',
    '.XXX......XXXXX.',
  ], { x: 7.5, y: 0 }, { x: 7.5, y: 8 }),
  // A dart with feathers.
  dart: cursor([
    '....XX....',
    '....XX....',
    '...XssX...',
    '...XssX...',
    '...XssX...',
    '...XggX...',
    '...XggX...',
    '...XggX...',
    '...XggX...',
    '...XggX...',
    '...XooX...',
    '...XooX...',
    '..XooooX..',
    '.XooXXooX.',
    'XooX..XooX',
    'XXX....XXX',
  ], { x: 4.5, y: 0 }, { x: 4.5, y: 9 }),
  // A magic wand: the "selection" tool.
  wand: cursor([
    '....y....',
    '....y....',
    '..y.y.y..',
    '...yyy...',
    'yyyywyyyy',
    '...yyy...',
    '..y.y.y..',
    '....y....',
    '....X....',
    '...XoX...',
    '...XoX...',
    '...XwX...',
    '...XwX...',
    '...XoX...',
    '...XoX...',
    '...XwX...',
    '...XwX...',
    '...XoX...',
    '...XoX...',
    '...XXX...',
  ], { x: 4, y: 0 }, { x: 4, y: 11 }),
  // The old "up" scroll arrow as a spike: for people who like it sharp.
  spike: cursor([
    '......XX......',
    '......XX......',
    '.....XooX.....',
    '.....XooX.....',
    '....XooooX....',
    '....XooooX....',
    '...XooooooX...',
    '...XooooooX...',
    '..XooooooooX..',
    '..XooXooXooX..',
    '.XooX.XX.XooX.',
    '.XoX..XX..XoX.',
    'XXX...XX...XXX',
    '......XX......',
    '......XX......',
    '......XX......',
  ], { x: 6.5, y: 0 }, { x: 6.5, y: 8 }),
};

export const CURSORS = [
  { id: 'hand', name: 'HAND' }, { id: 'arrow', name: 'CLASSIC' }, { id: 'glossy', name: 'GLOSSY' }, { id: 'modern', name: 'MODERN' },
  { id: 'block', name: 'BLOCK' }, { id: 'nav', name: 'NAV' }, { id: 'pencil', name: 'PENCIL' }, { id: 'sword', name: 'SWORD' },
  { id: 'plane', name: 'PLANE' }, { id: 'dart', name: 'DART' }, { id: 'wand', name: 'WAND' }, { id: 'spike', name: 'SPIKE' },
];
export const CURSOR_IDS = CURSORS.map((c) => c.id);

export const SPRITES = {
  hand: HAND, shotgun: SHOTGUN, uzi: UZI, rocket: ROCKET, laser: LASER, sniper: SNIPER, flamer: FLAMER, grenade: GRENADE,
  ...CURSOR_ART,
};
for (const weapon of ['shotgun', 'uzi', 'rocket', 'laser', 'sniper', 'flamer', 'grenade']) SPRITES[`gun_${weapon}`] = SPRITES[weapon].gun;

// What a player looks like: the hand grips its gun directly; other cursors carry it at their tip.
// Returns { body, gun } sprite names (gun may be null).
export function lookFor(cursorId, weapon) {
  if (!cursorId || cursorId === 'hand' || !CURSOR_ART[cursorId]) return { body: spriteFor(weapon), gun: null };
  return { body: cursorId, gun: weapon && weapon !== 'pistol' && SPRITES[`gun_${weapon}`] ? `gun_${weapon}` : null };
}

// Flat preview of a sprite (1 canvas pixel per sprite pixel), for review sheets.
export function spritePreview(name, color) {
  const sp = SPRITES[name] || HAND;
  const c = document.createElement('canvas');
  c.width = sp.w;
  c.height = sp.h;
  const g = c.getContext('2d');
  sp.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ',') return;
    g.fillStyle = ch === 'X' ? darken(color) : ch === 'o' ? color : PALETTE[ch] || color;
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

// Base pixel size: the hand is as tall as the old arrow cursor was (2.4 player radii).
const HAND_HEIGHT = 2.4;
export function cellSize(radius) {
  return (radius * HAND_HEIGHT) / HAND.h;
}

// How far from the player's position shots appear to leave the sprite (arena units).
export function muzzleDistance(name, radius) {
  return (SPRITES[name] || HAND).muzzle * cellSize(radius);
}

// Which sprite a player shows for the weapon they hold (the plain hand for the pistol).
export function spriteFor(weapon) {
  return weapon && weapon !== 'pistol' && SPRITES[weapon] ? weapon : 'hand';
}

// Which weapon (sprite) each bullet kind comes out of.
export const BULLET_SPRITE = { pistol: 'hand', pellet: 'shotgun', uzi: 'uzi', rocket: 'rocket', sniper: 'sniper', flame: 'flamer', grenade: 'grenade' };

const darkColors = {};
export function darken(hex) {
  if (!darkColors[hex]) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * 0.55));
    darkColors[hex] = `rgb(${r}, ${g}, ${b})`;
  }
  return darkColors[hex];
}

// Draws sprite `name` for a player at (x, y), rotated so its tip points along `angle`.
// A few hundred samples per player per frame — trivial.
export function drawPlayerSprite(ctx, name, x, y, angle, radius, color) {
  const sp = SPRITES[name] || HAND;
  const scale = cellSize(radius);
  const rot = angle - sp.tipAngle;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const reach = Math.hypot(Math.max(sp.pivot.x, sp.w - sp.pivot.x), Math.max(sp.pivot.y, sp.h - sp.pivot.y)) * scale + PX;
  const x0 = Math.floor((x - reach) / PX) * PX, x1 = x + reach;
  const y0 = Math.floor((y - reach) / PX) * PX, y1 = y + reach;

  const paths = new Map();
  for (let sy = y0; sy < y1; sy += PX) {
    for (let sx = x0; sx < x1; sx += PX) {
      const dx = sx + PX / 2 - x, dy = sy + PX / 2 - y;
      const c = Math.floor((dx * cos - dy * sin) / scale + sp.pivot.x);
      const r = Math.floor((dx * sin + dy * cos) / scale + sp.pivot.y);
      if (c < 0 || c >= sp.w || r < 0 || r >= sp.h) continue;
      const ch = sp.rows[r][c];
      if (ch === '.' || ch === ',') continue;
      const fill = ch === 'X' ? darken(color) : ch === 'o' ? color : PALETTE[ch] || color;
      let path = paths.get(fill);
      if (!path) paths.set(fill, (path = new Path2D()));
      path.rect(sx, sy, PX, PX);
    }
  }
  for (const [fill, path] of paths) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
}

export { PALETTE };
