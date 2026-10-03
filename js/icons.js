// Tiny pixel-art icons for powerups, drawn from text masks (one character = one screen pixel).
// A 1-pixel black outline is added automatically so they read on any background.

const PALETTE = {
  w: '#ffffff', g: '#a1a1aa', d: '#52525b', b: '#92400e', r: '#ef4444',
  o: '#fb923c', y: '#fde047', p: '#f9a8d4', t: '#5eead4', c: '#22d3ee',
  m: '#4d7c0f', u: '#3b82f6', v: '#c4b5fd', k: '#111111', n: '#1e3a8a',
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
  laser: [
    '..ccccc......',
    '.cwwwwwc.yyyy',
    '..ccccc......',
    '...cc........',
    '...cc........',
  ],
  sniper: [
    '....ddd........',
    '...ddddd.......',
    'bbbggggggggggggg',
    'bbbb.b.........',
    'bb.............',
  ],
  flamer: [
    '........o..',
    'ggggggg.yo.',
    'gggggggyyoo',
    'ggg.g...yo.',
    'ggg.....o..',
  ],
  grenade: [
    '...dd..',
    '..d..d.',
    '.mmmmm.',
    'mwmmmmm',
    'mmmmmmm',
    'mmmmmmm',
    '.mmmmm.',
  ],
  ghost: [
    '..wwwww..',
    '.wwwwwww.',
    'wwkwwwkww',
    'wwwwwwwww',
    'wwwwwwwww',
    'wwwwwwwww',
    'w.ww.ww.w',
  ],
  speed: [
    '...yy',
    '..yy.',
    '.yy..',
    'yyyyy',
    '..yy.',
    '.yy..',
    'yy...',
  ],
  inkrush: [
    '...u...',
    '..uuu..',
    '.uuuuu.',
    'uuwuuuu',
    'uwuuuuu',
    'uuuuuuu',
    '.uuuuu.',
  ],
  medkit: [
    'wwwwwwwww',
    'wwwwrwwww',
    'wwwwrwwww',
    'wwrrrrrww',
    'wwwwrwwww',
    'wwwwrwwww',
    'wwwwwwwww',
  ],
  blackout: [
    '..yyy..',
    '.yy....',
    'yy.....',
    'yy.....',
    'yy.....',
    '.yy....',
    '..yyy..',
  ],
  gravity: [
    'vvvvvvvv.',
    'v......v.',
    'v.vvvv.v.',
    'v.v..v.v.',
    'v.v.vv.v.',
    'v.v....v.',
    'v.vvvvvv.',
    'v........',
    'vvvvvvvvv',
  ],
  paintbomb: [
    '......y.',
    '.....o..',
    '...pp...',
    '..ppppp.',
    '.pwpuppp',
    '.pppppu.',
    '.puppppp',
    '..pppp..',
  ],
  mirror: [
    '.n.....n.',
    'nn.....nn',
    'nnnnnnnnn',
    'nn.....nn',
    '.n.....n.',
  ],
  inkstorm: [
    '..www....',
    '.wwwwww..',
    'wwwwwwwww',
    '.wwwwwww.',
    '....y....',
    '...yy....',
    '....y....',
    '...y.....',
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
