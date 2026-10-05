// Powerup icons in the style of old desktop icons (think Windows 98): chunky shapes, hard shading,
// the classic 16-color palette. Each is a text mask, one character per screen pixel; a 1-pixel black
// outline is added automatically and every icon is centered in a 24x24 box.
//
// On the map a powerup is a desktop shortcut: the icon (with the little shortcut arrow) hovering
// over a file-name caption — see powerupShortcut().

const PALETTE = {
  k: '#000000', w: '#ffffff', s: '#c0c0c0', d: '#808080', q: '#404040',
  r: '#ff0000', m: '#800000', y: '#ffff00', o: '#808000', g: '#00ff00', e: '#008000',
  c: '#00ffff', t: '#008080', b: '#0000ff', n: '#000080', p: '#ff00ff', u: '#800080',
  f: '#ff8000', h: '#804000', x: '#e8c890',
};

export const ICON_SIZE = 24;

const ICONS = {
  // ---- player effects ----
  fat: [                    // BRUSH.EXE: a fat paintbrush
    '..................hh',
    '.................hhh',
    '................hhh.',
    '...............hhh..',
    '..............hhh...',
    '.............hhh....',
    '............shh.....',
    '...........sws......',
    '..........sws.......',
    '.........dsd........',
    '......bbbdd.........',
    '.....bbbbbb.........',
    '....bbcbbbb.........',
    '...bbcbbbbb.........',
    '...bcbbbbb..........',
    '..bbbbbbb...........',
    '..bbbbbb............',
    '.bbbbb..............',
    '.bbb................',
    'bb..................',
  ],
  ricochet: [               // BOUNCE.EXE: a ball bouncing off the floor
    '................rrrr..',
    '...............rrwwrr.',
    'd..............rwrrrrm',
    '.d.............rrrrrrm',
    '..d............rrrrrmm',
    '...d..........d.rrmmm.',
    '....d........d...mm...',
    '.....d......d.........',
    '......d....d..........',
    '.......d..d...........',
    '........dd............',
    'ssssssssssssssssssssss',
    'dddddddddddddddddddddd',
  ],
  small: [                  // SHRINK.EXE: magnifier, zooming out
    '.....dddddd.........',
    '...ddsssssdd........',
    '..dsccccccccd.......',
    '.dsccwwccccccd......',
    '.dscwwcccccccd......',
    'dsccwccccccccsd.....',
    'dscccccccccccsd.....',
    'dccnnnnnnnnccsd.....',
    'dccnnnnnnnnccsd.....',
    'dccccccccccccsd.....',
    '.dccccccccccsd......',
    '.ddcccccccccsd......',
    '..ddcccccccsdhh.....',
    '...dddsssddd.hhh....',
    '.....dddddd...hhh...',
    '...............hhh..',
    '................hhh.',
    '.................hhh',
    '..................hh',
  ],
  defense: [                // FIREWALL: a brick wall on fire
    '...y........y.......',
    '..yfy......yfy....y.',
    '..yfry....yfrfy..yfy',
    '.yfrrfy..yfrrfy.yfrf',
    '.yfrrrfyyfrrrrfyfrrf',
    'yfrrrrrffrrrrrrffrrf',
    'mmmmmmmmmmmmmmmmmmmm',
    'rrrrrrmrrrrrrmrrrrrr',
    'rrrrrrmrrrrrrmrrrrrr',
    'ssssssssssssssssssss',
    'rrmrrrrrrmrrrrrrmrrr',
    'rrmrrrrrrmrrrrrrmrrr',
    'ssssssssssssssssssss',
    'rrrrrrmrrrrrrmrrrrrr',
    'rrrrrrmrrrrrrmrrrrrr',
    'ssssssssssssssssssss',
    'rrmrrrrrrmrrrrrrmrrr',
    'rrmrrrrrrmrrrrrrmrrr',
  ],
  ghost: [                  // HIDDEN.SYS: a see-through ghost of a file
    '......wwwwwww.......',
    '....wwwwwwwwwww.....',
    '...wwwwwwwwwwwws....',
    '..wwwwwwwwwwwwwws...',
    '..wwwkkwwwwkkwwws...',
    '..wwwkkwwwwkkwwss...',
    '..wwwwwwwwwwwwwss...',
    '..wwwwwwkkwwwwwss...',
    '..wwwwwkwwkwwwwss...',
    '..wwwwwwkkwwwwwss...',
    '..wwwwwwwwwwwwwss...',
    '..wwwwwwwwwwwwsss...',
    '..wwwwwwwwwwwssss...',
    '..wws.wwws.wwss.s...',
    '..ws...ws...ws..s...',
  ],
  speed: [                  // TURBO.EXE: a lightning bolt over a speed meter
    '..........yyyyy.....',
    '.........yyyyyo.....',
    '........yyyyyo......',
    '.......yyyyyo.......',
    '......yyyyyyyyyy....',
    '.....yyyyyyyyyyo....',
    '.........yyyyyo.....',
    '........yyyyyo......',
    '.......yyyyo........',
    '......yyyo..........',
    '.....yyo............',
    '....yo..............',
    '....................',
    '...dddddddddddddd...',
    '..dssssssssssssssd..',
    '..dsggggyyyyrrrrsd..',
    '..dsggggyyyyrrrrsd..',
    '..dssssssssssssssd..',
    '...dddddddddddddd...',
  ],
  inkrush: [                // INKJET.DRV: a printer pushing out fresh ink
    '.....wwwwwwwwww.....',
    '.....wddddddddw.....',
    '.....wwwwwwwwww.....',
    '.....wddddddw.w.....',
    '..ssssssssssssssss..',
    '.swwwwwwwwwwwwwwwwd.',
    '.swsssssssssssssgsd.',
    '.sssssssssssssssssd.',
    '.sdkkkkkkkkkkkkkkdd.',
    '.dddddddddddddddddd.',
    '.....wwwwwwwwww.....',
    '.....wbbbbbbbbw.....',
    '.....wbbbbbbbbw.....',
    '.....wwwwwwwwww.....',
    '.........bb.........',
    '........bbbb........',
    '.......bbcbbb.......',
    '.......bbbbbb.......',
    '........bbbb........',
  ],
  medkit: [                 // SCANDISK: a floppy that fixes you up
    'nnnnnnnnnnnnnnnnnnn.',
    'nnnnsssssssssssnnnnn',
    'nnnnsssssssqqssnnnnn',
    'nnnnsssssssqqssnnnnn',
    'nnnnsssssssqqssnnnnn',
    'nnnnsssssssssssnnnnn',
    'nnnnnnnnnnnnnnnnnnnn',
    'nnwwwwwwwwwwwwwwwwnn',
    'nnwwwwwwwrrwwwwwwwnn',
    'nnwwwwwwwrrwwwwwwwnn',
    'nnwwwwwrrrrrrwwwwwnn',
    'nnwwwwwrrrrrrwwwwwnn',
    'nnwwwwwwwrrwwwwwwwnn',
    'nnwwwwwwwrrwwwwwwwnn',
    'nnwwwwwwwwwwwwwwwwnn',
    'nnwwwwwwwwwwwwwwwwnn',
    'nnnnnnnnnnnnnnnnnnnn',
  ],

  // ---- weapons ----
  shotgun: [
    '...................kk.',
    '......dddddddddddddddd',
    '......wwwwwwwwwwwwwwwd',
    'hhhhhhssssssssssssssss',
    'hffffhddddhhhhhhhhh...',
    'hffffhh.k.hfffffffh...',
    '.hhffhh.kk.hhhhhhhh...',
    '..hhhhh...............',
  ],
  uzi: [
    '................k...',
    '..dddddddddddddddd..',
    'dddssssssssssssssddd',
    '..dwwwwwwwwwwwwwwd..',
    '..dssssssssssssssd..',
    '..dddddddddddddddd..',
    '....dqd...dsd.k.....',
    '....dqd...dsd.kk....',
    '....dqd...dsd.......',
    '....dqd...ddd.......',
    '....dqd.............',
    '....ddd.............',
  ],
  rocket: [
    '...mm.................',
    '..mrrm................',
    '..mrrrwwwwwwwwwwwwwrr.',
    'yfmrrswwwwwwwwwwwwwwrr',
    'fyfrrswwwwwwwwwwwwwwrr',
    'yfmrrsssssssssssssssrr',
    '..mrrrdddddddddddddrr.',
    '..mrrm................',
    '...mm.................',
  ],
  laser: [
    '................c...c.',
    '.....ttttttttt...c.c..',
    '...ttcccccccccttwwcc..',
    '..tcwwwwwwwwwcckkwwccc',
    '..tccccccccccctttwwc..',
    '...ttttttttttt...c.c..',
    '.....tdt........c...c.',
    '....tdt...............',
    '...tdt................',
    '...ttt................',
  ],
  sniper: [
    '......kkkkkkkk........',
    '.....kcwccccccck......',
    '......kkkkkkkk........',
    '........dd..dd........',
    'hhhhhhhddddddddddddddd',
    'hffffhhssssssssssssssd.',
    'hfffhhhdddddhhhhh.....',
    '.hhhhh..k.............',
    '..hhh...kk............',
  ],
  flamer: [
    '...............yy.f...',
    '.............ffyyyyf..',
    '..rrrr......ffyywyyyf.',
    '.rrwwrr...dfyywwwyyyf.',
    '.rwrrrrddddfyyywyyyf..',
    '.rrrrrrd....ffyyyyf...',
    '.rrrrrr.......ff..f...',
    '.rrrrrr...............',
    '.rrrrrr...............',
    '..rrrr................',
  ],
  grenade: [
    '.........sss.........',
    '........s...s........',
    '........s...s........',
    '.........ssdddd......',
    '.......qqqqqq.d......',
    '......eeeeeeee.......',
    '.....egeeeegeee......',
    '....eggeeggeegee.....',
    '....egeegeeegeee.....',
    '....eeeggeeggeee.....',
    '....egeegeegeeee.....',
    '....eggeeggeegee.....',
    '.....eeeegeeeee......',
    '......eeeeeeee.......',
  ],

  // ---- map events ----
  eraser: [                 // RECYCLE.BIN
    '...ssssssssssssss...',
    '..swwwwwwwwwwwwwwd..',
    '..dddddddddddddddd..',
    '...swsdsdsdsdsdsd...',
    '...swsdsegsdsdsd....',
    '...swsdeegesdsdd....',
    '...swsgsdsdgedsd....',
    '...swsesdsdsgsdd....',
    '...swsdgesegsdsd....',
    '...swsdsdgedsdsd....',
    '...swsdsdsdsdsdd....',
    '....wsdsdsdsdsdd....',
    '....wsdsdsdsdsdd....',
    '....dddddddddddd....',
  ],
  meteor: [                 // METEOR.SCR: a burning rock falling in
    '...................f',
    '.................ffy',
    '...............ffyf.',
    '.............ffyyf..',
    '...........ffyyyf...',
    '........hhfyyyf.....',
    '......hhdhhyyf......',
    '.....hddhdhhf.......',
    '....hdhhdddh........',
    '....hhdddhdh........',
    '....hdhdhhhh........',
    '.....hhhdhh.........',
    '......hhhh..........',
  ],
  blackout: [               // BLACKOUT.SCR: the monitor goes dark
    'ssssssssssssssssssss',
    'swwwwwwwwwwwwwwwwwwd',
    'swkkkkkkkkkkkkkkkksd',
    'swkdkkkkkkkkkkkkkksd',
    'swkkdkkkkkkkkkwkkksd',
    'swkkkkkkkkkkkkkkkksd',
    'swkkkkkkkwkkkkkkkksd',
    'swkkkkkkkkkkkkkkkksd',
    'swkkkkkkkkkkkkkkkksd',
    'swkkkkkkkkkkkkkkkksd',
    'sssssssssssssssssmsd',
    'dddddddddddddddddddd',
    '.......ssssss.......',
    '....ssssssssssss....',
    '....dddddddddddd....',
  ],
  gravity: [                // GRAVITY.EXE: a big magnet
    '.....rrrrrrrrrr.....',
    '...rrrrrrrrrrrrrr...',
    '..rrwwrrrrrrrrrrrm..',
    '.rrwrrrrmmmmrrrrrrm.',
    '.rwrrrm......mrrrrm.',
    'rrwrrm........mrrrrm',
    'rrrrm..........mrrrm',
    'rrrrm..........mrrrm',
    'rrrrm..........mrrrm',
    'sssss..........sssss',
    'swwss..........swwss',
    'sssss..........sssss',
    'ddddd..........ddddd',
  ],
  paintbomb: [              // PAINT.EXE: a palette loaded with every color
    '......hhhhhhhh........',
    '....hhxxxxxxxxhh......',
    '...hxxrrxxbbxxxxh.....',
    '..hxxxrrxxbbxxyyxh....',
    '..hxggxxxxxxxxyyxh....',
    '.hxxggxxx..xxxxxxxh...',
    '.hxxxxxx....xxppxxh...',
    '.hxxccxxx..xxxppxh....',
    '..hxccxxxxxxxxxxh.....',
    '...hhxxxxhhhhhhh......',
    '.....hhhh.............',
  ],
  mirror: [                 // FLIP.EXE: a window being flipped
    'nnnnnnnnnnnnnnnnnnnn',
    'nwwnnnnnnnnnnnnswswn',
    'ssssssssssssssssssss',
    'swwwwwwwwwwwwwwwwwwd',
    'swwwwkwwwwwwwwkwwwwd',
    'swwwkkwwwwwwwwkkwwwd',
    'swwkkkkkkkkkkkkkkwwd',
    'swwwkkwwwwwwwwkkwwwd',
    'swwwwkwwwwwwwwkwwwwd',
    'swwwwwwwwwwwwwwwwwwd',
    'dddddddddddddddddddd',
  ],
  inkstorm: [               // STORM.SCR: a thundercloud
    '.......sssss..........',
    '.....sswwwwss.sss.....',
    '....swwwwwwwwswwws....',
    '..sswwwwwwwwwwwwwwss..',
    '.swwwwwwwwwwwwwwwwwws.',
    '.sdddddddddddddddddds.',
    '..dddddddyyddddddddd..',
    '........yy.....b......',
    '..b....yyyy...b...b...',
    '.b.......yy..........b',
    '........yy..b...b.....',
    '.......y..............',
  ],
};

// The file name under each shortcut on the map.
export const ICON_LABELS = {
  fat: 'BRUSH.EXE', ricochet: 'BOUNCE.EXE', small: 'SHRINK.EXE', defense: 'FIREWALL', ghost: 'HIDDEN.SYS',
  speed: 'TURBO.EXE', inkrush: 'INKJET.DRV', medkit: 'SCANDISK', shotgun: 'SHOTGUN.EXE', uzi: 'UZI.EXE',
  rocket: 'ROCKET.EXE', laser: 'LASER.EXE', sniper: 'SNIPER.EXE', flamer: 'FLAMER.EXE', grenade: 'GRENADE.EXE',
  eraser: 'RECYCLE.BIN', meteor: 'METEOR.SCR', blackout: 'BLACKOUT.SCR', gravity: 'GRAVITY.EXE',
  paintbomb: 'PAINT.EXE', mirror: 'FLIP.EXE', inkstorm: 'STORM.SCR',
};

// The little "this is a shortcut" arrow in the corner of desktop icons.
const SHORTCUT_ARROW = [
  'kkkkkkkk',
  'kwwwwwwk',
  'kwwkkkwk',
  'kwwwkkwk',
  'kwwkwkwk',
  'kwkwwwwk',
  'kwwwwwwk',
  'kkkkkkkk',
];

// A tiny 3x5 pixel font for captions (like the 8-pixel system font under desktop icons).
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '.': '000000000000010', '+': '000010111010000',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
};

const cache = {};

// Writes `text` in the tiny caption font straight onto a canvas context, 1 px per font pixel.
// Each character is 4 px wide (3 + 1 space), 5 px tall.
export function tinyText(g, text, x, y, color) {
  g.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    for (let p = 0; p < 15; p++) if (glyph[p] === '1') g.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// The icon alone: a 24x24 canvas, 1 px per icon pixel.
export function powerupIcon(type) {
  if (!ICONS[type]) return null;
  const key = 'i:' + type;
  if (cache[key]) return cache[key];
  const rows = ICONS[type];
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const at = (x, y) => y >= 0 && y < h && x >= 0 && rows[y][x] && rows[y][x] !== '.';
  const c = makeCanvas(ICON_SIZE, ICON_SIZE);
  const g = c.getContext('2d');
  const ox = Math.floor((ICON_SIZE - w) / 2), oy = Math.floor((ICON_SIZE - h) / 2);
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (at(x, y)) g.fillStyle = PALETTE[rows[y][x]] || '#ff00ff';
      else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) g.fillStyle = '#000000';
      else continue;
      g.fillRect(x + ox, y + oy, 1, 1);
    }
  }
  cache[key] = c;
  return c;
}

// The icon with the shortcut arrow stamped in its bottom-left corner.
export function shortcutIcon(type) {
  const key = 's:' + type;
  if (cache[key]) return cache[key];
  const icon = powerupIcon(type);
  if (!icon) return null;
  const c = makeCanvas(ICON_SIZE, ICON_SIZE);
  const g = c.getContext('2d');
  g.drawImage(icon, 0, 0);
  const top = ICON_SIZE - SHORTCUT_ARROW.length;
  SHORTCUT_ARROW.forEach((row, y) => [...row].forEach((ch, x) => {
    g.fillStyle = PALETTE[ch];
    g.fillRect(x, top + y, 1, 1);
  }));
  cache[key] = c;
  return c;
}

// The caption: white file name on the blue "selected" highlight.
export function iconCaption(type) {
  const key = 'c:' + type;
  if (cache[key]) return cache[key];
  const text = ICON_LABELS[type] || type.toUpperCase();
  const w = text.length * 4 + 1, h = 7;
  const c = makeCanvas(w + 2, h + 2);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';               // thin dark edge so it reads on any background
  g.fillRect(0, 0, w + 2, h + 2);
  g.fillStyle = PALETTE.n;
  g.fillRect(1, 1, w, h);
  g.fillStyle = '#ffffff';
  [...text].forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    for (let p = 0; p < 15; p++) if (glyph[p] === '1') g.fillRect(2 + i * 4 + (p % 3), 2 + Math.floor(p / 3), 1, 1);
  });
  cache[key] = c;
  return c;
}
