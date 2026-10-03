// Tiny pixel-art icons for powerups, drawn from text masks (one character = one screen pixel).
// A 1-pixel black outline is added automatically so they read on any background.

const PALETTE = {
  w: '#ffffff', g: '#a1a1aa', d: '#52525b', b: '#92400e', r: '#ef4444',
  o: '#fb923c', y: '#fde047', p: '#f9a8d4', t: '#5eead4',
};

const ICONS = {
  shotgun: [
    '....ggggggggggg',
    'bbbbggggggggggg',
    'bbbbbb.bbb.....',
    'bbb...b.b......',
    '.bb............',
  ],
  uzi: [
    '..ggggggggg',
    'gggggggggg.',
    '...dd.gg...',
    '...dd..g...',
    '...dd......',
    '...dd......',
  ],
  rocket: [
    '.r..........',
    'rrwwwwwwwwr.',
    'oowwwwwwwwrr',
    'rrwwwwwwwwr.',
    '.r..........',
  ],
  eraser: [
    '..ppppppp',
    '.ppppppp.',
    'ppppppp..',
    'wwwwwww..',
    'ggggggg..',
    'ggggggg..',
  ],
  meteor: [
    'y..........',
    '.yo........',
    '..oo.......',
    '...oo......',
    '....oggg...',
    '....ggggg..',
    '...gwgggdg.',
    '...ggggggg.',
    '...gggggdg.',
    '....ggggg..',
    '.....ggg...',
  ],
};

const cache = {};

// Returns a small canvas (1 px per icon pixel), or null if this powerup uses a text label instead.
export function powerupIcon(type) {
  if (!ICONS[type]) return null;
  if (cache[type]) return cache[type];
  const rows = ICONS[type];
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const at = (x, y) => y >= 0 && y < h && x >= 0 && rows[y][x] && rows[y][x] !== '.';
  const c = document.createElement('canvas');
  c.width = w + 2;
  c.height = h + 2;
  const g = c.getContext('2d');
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (at(x, y)) g.fillStyle = PALETTE[rows[y][x]] || '#ffffff';
      else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) g.fillStyle = '#000000';
      else continue;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  cache[type] = c;
  return c;
}
