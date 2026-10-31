// WINDERS 98: everything about this stage that isn't drawing. Coordinates are arena units; the
// taskbar sits along the bottom at y = 684..720. Pure data, no DOM.

const BAR_Y = 684;

export const WIN98 = {
  id: 'win98',
  name: 'WINDERS 98',
  year: 1998,
  ready: true,
  bootFull: 8,
  bootQuick: 3,

  // Stand here and shoot.
  hotspots: [
    { id: 'start', x: 4, y: BAR_Y, w: 104, h: 36, does: 'menu', menu: 'start' },
    { id: 'desktop', x: 122, y: BAR_Y, w: 24, h: 36, does: 'closeAll', cooldown: 10 },
    { id: 'web', x: 148, y: BAR_Y, w: 24, h: 36, does: 'moreAds', cooldown: 14 },
    { id: 'speaker', x: 1092, y: BAR_Y, w: 26, h: 36, does: 'loud', cooldown: 8 },
    { id: 'display', x: 1120, y: BAR_Y, w: 28, h: 36, does: 'display', cooldown: 25 },
    { id: 'clock', x: 1150, y: BAR_Y, w: 128, h: 36, does: 'menu', menu: 'calendar' },
    { id: 'recycle', x: 1200, y: 150, w: 64, h: 76, does: 'empty', cooldown: 25 },
    { id: 'cdrom', x: 1200, y: 256, w: 64, h: 76, does: 'tray', cooldown: 18 },
  ],

  // Menus open on the map for everyone. Walk onto a row and shoot it.
  menus: {
    start: {
      x: 4, y: BAR_Y - 356, w: 288, h: 356, life: 10,
      rows: [
        { id: 'minesweeper', label: 'MINESWEEPER' },
        { id: 'solitaire', label: 'SOLITAIRE' },
        { id: 'paint', label: 'PAINT' },
        { id: 'pinball', label: '3D PINBALL' },
        { id: 'calculator', label: 'CALCULATOR' },
        { id: 'exploder', label: 'INTERNET EXPLODER' },
        { id: 'cleanup', label: 'DISK CLEANUP' },
        { id: 'run', label: 'RUN...' },
        { id: 'shutdown', label: 'SHUT DOWN...' },
      ],
    },
    calendar: {
      x: 936, y: BAR_Y - 252, w: 340, h: 252, life: 9,
      buttons: [
        { id: 'y2k', label: 'SET TO 01/01/2000', x: 16, y: 204, w: 216, h: 36 },
        { id: 'close', label: 'OK', x: 244, y: 204, w: 80, h: 36 },
      ],
    },
  },

  // Walk onto a pop-up to trigger it. `weight` = how often it shows up. Scams are bad ones that look
  // like prizes; everything else is honest about what it is.
  popups: [
    { id: 'defrag', good: true, weight: 3, icon: 'info', title: 'DISK DEFRAGMENTER', lines: ['DEFRAG COMPLETE!', 'YOUR PC IS FASTER.'], effect: 'speed', dur: 7, float: 'DEFRAGGED!' },
    { id: 'scandisk', good: true, weight: 3, icon: 'info', title: 'SCANDISK', lines: ['0 BAD SECTORS.', 'SYSTEM REPAIRED.'], effect: 'heal', value: 4, float: '+4 HP' },
    { id: 'antivirus', good: true, weight: 2, icon: 'info', title: 'NORTON ANTI-ICKY', lines: ['VIRUS DEFINITIONS', 'UP TO DATE.'], effect: 'immune', dur: 10, float: 'PROTECTED!' },
    { id: 'ramdoubler', good: true, weight: 2, icon: 'info', title: 'RAM DOUBLER 98', lines: ['MEMORY DOUBLED!', 'UNLIMITED AMMO.'], effect: 'freeAmmo', dur: 6, float: 'FREE AMMO!' },
    { id: 'turbo', good: true, weight: 2, icon: 'info', title: 'TURBO BUTTON', lines: ['CPU OVERCLOCKED', 'TO 266 MHZ.'], effect: 'rapid', dur: 6, float: 'RAPID FIRE!' },
    { id: 'memory', good: false, weight: 3, icon: 'warn', title: 'LOW ON MEMORY', lines: ['CLOSE SOME APPS', 'TO CONTINUE.'], effect: 'slow', dur: 5, float: 'LOW MEMORY!' },
    { id: 'illegal', good: false, weight: 3, icon: 'error', title: 'ILLEGAL OPERATION', lines: ['THIS PROGRAM WILL', 'BE SHUT DOWN.'], effect: 'jam', dur: 4, float: 'GUN CRASHED!' },
    { id: 'mouse', good: false, weight: 2, icon: 'warn', title: 'MOUSE PROPERTIES', lines: ['BUTTONS SWAPPED.', 'DIRECTIONS TOO.'], effect: 'invert', dur: 5, float: 'INVERTED!' },
    { id: 'install', good: false, weight: 2, icon: 'question', title: 'SETUP WIZARD', lines: ['INSTALLING...', 'DO NOT TURN OFF.'], effect: 'frozen', dur: 2.5, float: 'INSTALLING...' },
    { id: 'printer', good: false, weight: 2, icon: 'error', title: 'PRINTER ERROR', lines: ['OUT OF INK.', 'PC LOAD LETTER.'], effect: 'ink', float: 'OUT OF INK!' },
    { id: 'backup', good: true, weight: 2, icon: 'info', title: 'BACKUP COMPLETE', lines: ['FILES ARE SAFE.', 'INK RESTORED!'], effect: 'inkFull', float: 'FULL INK!' },
    { id: 'update', good: true, weight: 2, icon: 'info', title: 'WINDERS UPDATE', lines: ['CRITICAL UPDATE', 'SHIELDS ACTIVE!'], effect: 'shields', float: 'SHIELDS UP!' },
    { id: 'toolbar', good: false, weight: 2, icon: 'warn', title: 'INSTALLING TOOLBAR', lines: ['SEARCHBAR 3000', 'NOW SLOWING YOU.'], effect: 'slow', dur: 4, float: 'TOOLBAR!' },
    { id: 'prize', good: false, scam: true, weight: 3, icon: 'star', title: '!!! YOU WON !!!', lines: ['VISITOR 1,000,000!', 'FREE IPOD! CLICK!'], effect: 'scam', dur: 4, float: 'SCAMMED!' },
    { id: 'monkey', good: false, scam: true, weight: 3, icon: 'star', title: 'PUNCH THE MONKEY!!', lines: ['HIT HIM, WIN $20!', 'CLICK CLICK CLICK!'], effect: 'scam', dur: 3, float: 'SCAMMED!' },
    { id: 'infected47', good: false, scam: true, weight: 2, icon: 'error', title: 'WARNING! WARNING!', lines: ['47 VIRUSES FOUND!', 'CLEAN NOW, FREE!'], effect: 'frozen', dur: 2, float: 'SCAREWARE!' },
    { id: 'smileys', good: false, scam: true, weight: 2, icon: 'star', title: 'FREE SMILEYS!!!', lines: ['1000S OF SMILEYS', 'FOR YOUR E-MAIL!'], effect: 'invert', dur: 5, float: 'SPYWARE!' },
  ],

  // Moving hazards. `seek` = how hard it steers toward the nearest player (0 = just bounces around).
  viruses: [
    { id: 'loveletter', label: 'LOVE-LETTER.VBS', speed: 170, seek: 0 },
    { id: 'trojan', label: 'TROJAN.EXE', speed: 105, seek: 1.1 },
    { id: 'worm', label: 'WORM.COM', speed: 150, seek: 0.35 },
    { id: 'dialer', label: 'DIALER.EXE', speed: 130, seek: 0 },
  ],

  // Programs that open on the desktop just for show (see apps-art.js). Sizes in arena units.
  apps: [
    { id: 'tube', w: 640, h: 500, variants: 10 },    // old viral videos
    { id: 'search', w: 640, h: 420, variants: 5 },
    { id: 'hamster', w: 640, h: 420, variants: 1 },
    { id: 'geo', w: 640, h: 420, variants: 1 },
    { id: 'my', w: 640, h: 440, variants: 1 },
    { id: 'buy', w: 640, h: 450, variants: 1 },
    { id: 'ask', w: 640, h: 420, variants: 3 },
    { id: 'msn', w: 560, h: 400, variants: 4 },
    { id: 'dial', w: 400, h: 200, variants: 1 },
    { id: 'aol', w: 460, h: 260, variants: 1 },
    { id: 'amp', w: 340, h: 130, variants: 4 },
    { id: 'nap', w: 560, h: 290, variants: 1 },
    { id: 'copy', w: 420, h: 220, variants: 1 },
    { id: 'defrag', w: 480, h: 340, variants: 1 },
    { id: 'task', w: 420, h: 270, variants: 1 },
    { id: 'note', w: 420, h: 300, variants: 3 },
    { id: 'mines', w: 260, h: 340, variants: 1 },
    { id: 'sol', w: 400, h: 340, variants: 1 },
    { id: 'ball', w: 260, h: 380, variants: 1 },
    { id: 'paint', w: 420, h: 340, variants: 3 },
  ],

  // Things the computer does on its own.
  events: ['bsod', 'solitaire', 'dialup', 'pipes', 'scandisk', 'clip', 'toasters', 'format', 'printer', 'ape'],
  headliners: ['bsod', 'solitaire'],    // these two come first every round, in random order

  // Decorative desktop clutter: [icon, caption]. Each round uses a random handful of these.
  clutterCount: 26,
  clutter: [
    ['mycomputer', 'MY COMPUTER'], ['documents', 'MY DOCS'], ['network', 'NETWORK'],
    ['exploder', 'EXPLODER'], ['folder', 'DRIVERS'], ['folder', 'ONLINE'], ['folder', 'NEW FOLDER'],
    ['doc', 'HOMEWORK'], ['doc', 'README.TXT'], ['zip', 'WINZIPPY'], ['tunes', 'WINAMPLE'],
    ['game', 'QUACK III'], ['game', 'HALF-LOAF'], ['game', 'TOMB RAISIN'], ['game', 'GRAND THEFT'],
    ['chat', 'ICU'], ['disc', 'CD PLAYER'], ['joystick', 'PINBALL'], ['joystick', 'FROGGER-ISH'],
    ['doc', 'TAXES98.XLS'], ['zip', 'SETUP.ZIP'], ['exe', 'SETUP.EXE'], ['exe', 'BOWLING'], ['chat', 'OUTBOX'],
    ['game', 'DOOMISH 2'], ['game', 'STAR WHIFF'], ['game', 'AGE OF PIES'], ['game', 'ROLLERCOAST'], ['game', 'SIM TOWN'],
    ['joystick', 'SNAKE'], ['joystick', 'TETRIMINO'], ['disc', 'MUSIC CD'], ['disc', 'BURN ME'], ['tunes', 'NAPSTIR'],
    ['tunes', 'REALPLAYA'], ['folder', 'MP3S'], ['folder', 'PICS'], ['folder', 'OLD STUFF'], ['folder', 'DO NOT OPEN'],
    ['doc', 'RESUME.DOC'], ['doc', 'LETTER.DOC'], ['doc', 'CHEATS.TXT'], ['zip', 'BACKUP.ZIP'], ['exe', 'INSTALL.EXE'],
    ['exe', 'UNINSTALL'], ['chat', 'CHATROOM'], ['exploder', 'NETSCRAPE'], ['network', 'DIAL-UP'], ['mycomputer', 'MY OLD PC'],
  ],
};
