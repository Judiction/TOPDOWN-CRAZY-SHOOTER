// Period programs that open on the desktop for show: chat, dial-up, music, file sharing, housekeeping
// and games playing themselves. Same deal as the web pages in apps-art.js: a page is built once, and
// its `live` function draws only what moves. Sizes are in screen pixels.

import { PX, textSprite } from '../pixel.js';
import { tinyText, powerupIcon } from '../icons.js';
import { kit, W98 } from './win98-art.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const setup = (w, h) => {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  return { c, g, k: kit(g) };
};

// The caption font, written live onto the game canvas.
function say(ctx, text, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(PX, PX);
  tinyText(ctx, text, 0, 0, color);
  ctx.restore();
}

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
}

// Live drawing helper: everything inside is in the window's own screen pixels.
function inWindow(ctx, ax, ay, draw) {
  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(PX, PX);
  draw();
  ctx.restore();
}

function icon(g, name, x, y, size = 24) {
  const art = powerupIcon(name);
  if (art) g.drawImage(art, 0, 0, 24, 24, x, y, size, size);
}

// ---- MSM Messenger ----

const CHATS = [
  ['KEV', [['KEV', 'U THERE'], ['ME', 'YEAH WHATS UP'], ['KEV', 'CAN U SEE MY'], ['KEV', 'CURSOR'], ['ME', 'WE ARE AT WAR KEV'], ['KEV', 'OK BRB'], ['KEV', 'MOM NEEDS PHONE']]],
  ['JESS<3', [['JESS<3', 'WHY DID U CHANGE'], ['JESS<3', 'UR TOP 8'], ['ME', 'IT WAS AN ACCIDENT'], ['JESS<3', 'U PUT THE CAT'], ['JESS<3', 'ABOVE ME'], ['ME', 'HES A GOOD CAT'], ['JESS<3', '*SIGNS OUT*']]],
  ['XX_SK8R_XX', [['XX_SK8R_XX', 'DUDE'], ['XX_SK8R_XX', 'DUDE'], ['XX_SK8R_XX', 'DUDE'], ['ME', 'WHAT'], ['XX_SK8R_XX', 'NOTHING LOL'], ['ME', 'I HATE U'], ['XX_SK8R_XX', 'DUDE']]],
  ['MOM', [['MOM', 'THIS IS YOUR MOTHER'], ['ME', 'I KNOW MOM'], ['MOM', 'HOW DO I LOG OFF'], ['ME', 'CLICK SIGN OUT'], ['MOM', 'WHERE'], ['ME', 'TOP LEFT'], ['MOM', 'WHAT IS TOP LEFT']]],
];
const BUDDIES = [['KEV', 1], ['JESS<3', 1], ['XX_SK8R_XX', 1], ['MOM', 1], ['DAVE_EMO86', 0], ['UNCLE RON', 0], ['SMARTERCHILD', 0]];

function msnPage(w, h, variant) {
  const { c, g, k } = setup(w, h);
  const [buddy, lines] = CHATS[variant % CHATS.length];
  k.frame(0, 0, w, h, 'MSM MESSENGER', { buttons: ['close', 'max', 'min'] });
  tinyText(g, 'FILE  ACTIONS  TOOLS  HELP', 6, 17, '#000000');
  // Buddy list.
  k.sunken(3, 24, 92, h - 28, '#ffffff');
  k.gradient(4, 25, 90, 10, [40, 90, 190], [120, 180, 240]);
  tinyText(g, 'DOODLE@HOTMALE.COM', 6, 28, '#ffffff');
  tinyText(g, 'ONLINE', 6, 40, '#006000');
  tinyText(g, 'NOT ONLINE', 6, 92, '#800000');
  let on = 0, off = 0;
  for (const [name, online] of BUDDIES) {
    const y = online ? 48 + on++ * 10 : 100 + off++ * 10;
    k.fill(7, y, 4, 5, online ? '#20c020' : '#a0a0a0');
    k.fill(7, y - 2, 3, 2, online ? '#60e060' : '#c0c0c0');
    tinyText(g, name, 14, y, online ? '#000000' : '#808080');
  }
  // Conversation.
  k.sunken(99, 24, w - 103, h - 56, '#ffffff');
  k.fill(100, 25, w - 105, 9, '#dde8ff');
  tinyText(g, `TO: ${buddy}`, 102, 27, '#003399');
  k.sunken(99, h - 30, w - 140, 26, '#ffffff');
  k.raised(w - 38, h - 30, 34, 26);
  tinyText(g, 'SEND', w - 30, h - 20, '#808080');
  const start = 0.8, gap = 1.25, left = 102, top = 37;
  return {
    c,
    live(ctx, x, y, a, now) {
      const shown = Math.min(lines.length, Math.floor((a.age - start) / gap) + 1);
      inWindow(ctx, x, y, () => {
        lines.slice(Math.max(0, shown - 8), shown).forEach(([who, text], i) => {
          tinyText(ctx, `${who}:`, left, top + i * 9, who === 'ME' ? '#800000' : '#0033cc');
          tinyText(ctx, text, left + (who.length + 2) * 4, top + i * 9, '#000000');
        });
        if (shown < lines.length && Math.floor(now / 400) % 2) tinyText(ctx, `${lines[shown][0] === 'ME' ? 'YOU ARE' : `${buddy} IS`} TYPING...`, 102, h - 38, '#808080');
        // The little "has just signed in" toast.
        if (a.age % 7 > 4 && a.age % 7 < 6.5) {
          box(ctx, 0, 0, 0, 0, '#000000');
          ctx.fillStyle = '#ffffe1';
          ctx.fillRect(w - 94, h - 62, 88, 26);
          ctx.fillStyle = '#000000';
          ctx.fillRect(w - 94, h - 62, 88, 1);
          ctx.fillRect(w - 94, h - 37, 88, 1);
          ctx.fillRect(w - 94, h - 62, 1, 26);
          ctx.fillRect(w - 7, h - 62, 1, 26);
          tinyText(ctx, 'SMARTERCHILD', w - 90, h - 58, '#003399');
          tinyText(ctx, 'HAS JUST SIGNED IN', w - 91, h - 49, '#000000');
        }
      });
    },
  };
}

// ---- dial-up ----

const DIAL_STEPS = ['DIALING 555-0199...', 'LINE IS BUSY. RETRYING', 'DIALING 555-0199...', 'VERIFYING USER NAME...', 'LOGGING ON TO NETWORK...', 'CONNECTION LOST. REDIAL'];

function dialPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'CONNECTING TO DOODLENET', { buttons: ['close'] });
  icon(g, 'dialer', 8, 22, 24);
  tinyText(g, 'USER NAME: BIGDAVE86', 40, 44, '#000000');
  tinyText(g, 'PASSWORD:  ********', 40, 53, '#000000');
  k.raised(w - 52, h - 19, 44, 14);
  tinyText(g, 'CANCEL', w - 42, h - 14, '#000000');
  return {
    c,
    live(ctx, x, y, a, now) {
      const step = Math.floor(a.age / 2.2) % DIAL_STEPS.length;
      inWindow(ctx, x, y, () => {
        tinyText(ctx, DIAL_STEPS[step], 40, 24, '#000000');
        tinyText(ctx, `ATTEMPT ${Math.floor(a.age / 13) + 2} OF 99`, 40, 33, '#606060');
        // Modem lights.
        ['HS', 'AA', 'CD', 'OH', 'RD', 'SD'].forEach((label, i) => {
          const lit = (Math.floor(now / (70 + i * 45)) + i) % 3 !== 0;
          ctx.fillStyle = lit ? '#30ff30' : '#104010';
          ctx.fillRect(10 + i * 22, h - 16, 5, 3);
          tinyText(ctx, label, 8 + i * 22, h - 11, '#000000');
        });
      });
    },
  };
}

// ---- America Offline ----

function aolPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'AMERICA OFFLINE 4.0', { buttons: ['close', 'max', 'min'] });
  k.fill(3, 15, w - 6, h - 18, '#ffffff');
  k.fill(3, 15, w - 6, 26, '#0a2a7a');
  g.drawImage(textSprite('AMERICA OFFLINE', 8, '#ffffff', null), 12, 19);
  // The triangle logo, near enough.
  for (let i = 0; i < 18; i++) k.fill(w - 34 + (i >> 1), 34 - i, 18 - i, 1, '#ffcc00');
  tinyText(g, 'NOW WITH 1000 FREE HOURS!', 12, 32, '#ffcc00');
  return {
    c,
    live(ctx, x, y, a, now) {
      inWindow(ctx, x, y, () => {
        const step = Math.min(3, Math.floor(a.age / 2));
        ['DIAL', 'CONNECT', 'CHECK'].forEach((label, i) => {
          const done = step > i;
          ctx.fillStyle = done ? '#2070e0' : '#d8d8d8';
          ctx.fillRect(24 + i * 56, 52, 40, 30);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(38 + i * 56, 60, 12, 14);
          tinyText(ctx, label, 26 + i * 56, 86, done ? '#000000' : '#a0a0a0');
        });
        if (a.age < 6) {
          tinyText(ctx, ['STEP 1: DIALING...', 'STEP 2: CONNECTING...', 'STEP 3: CHECKING PASSWORD...'][step] || '', 24, 100, '#000000');
          return;
        }
        // The mailbox flag pops up.
        const up = Math.floor(now / 350) % 2;
        ctx.fillStyle = '#404040';
        ctx.fillRect(w - 66, 72, 40, 22);
        ctx.fillStyle = '#808080';
        ctx.fillRect(w - 64, 74, 36, 12);
        ctx.fillStyle = '#ff2020';
        ctx.fillRect(w - 28, up ? 58 : 66, 3, 16);
        ctx.fillRect(w - 28, up ? 58 : 66, 9, 6);
        tinyText(ctx, "WELCOME, BIGDAVE86!", 24, 100, '#000000');
        tinyText(ctx, "YOU'VE GOT MAIL!!!", 24, 110, up ? '#d00000' : '#0033cc');
      });
    },
  };
}

// ---- Winample ----

const TRACKS = ['1. DJ NOT-REALLY - SANDSTORM-ISH', '2. EIFFEL 56K - BLUE (DA BA DEE-ISH)', '3. LOU BAGEL - MAMBO NO. 6', '4. SMASH MOUTHFUL - ALL STAR-ISH'];

function ampPage(w, h, variant) {
  const { c, g, k } = setup(w, h);
  k.fill(0, 0, w, h, '#20203a');
  k.fill(0, 0, w, 1, '#6060a0');
  k.fill(0, 0, 1, h, '#6060a0');
  k.fill(0, h - 1, w, 1, '#000000');
  k.fill(w - 1, 0, 1, h, '#000000');
  k.fill(2, 2, w - 4, 9, '#30305a');
  tinyText(g, 'WINAMPLE', 6, 4, '#c0c0ff');
  k.fill(4, 13, 60, 30, '#000000');
  k.fill(68, 13, w - 72, 11, '#000000');
  ['|<', '>', '||', '[]', '>|'].forEach((t, i) => {
    k.fill(6 + i * 18, h - 16, 16, 12, '#505080');
    tinyText(g, t, 10 + i * 18, h - 13, '#ffffff');
  });
  tinyText(g, '128 KBPS  44 KHZ  STEREO', 70, 28, '#30ff30');
  const line = `${TRACKS[variant % TRACKS.length]}  ***  `;
  return {
    c,
    live(ctx, x, y, a, now) {
      inWindow(ctx, x, y, () => {
        const shift = Math.floor(now / 160) % line.length;
        tinyText(ctx, (line.slice(shift) + line).slice(0, Math.floor((w - 76) / 4)), 70, 16, '#30ff30');
        const secs = Math.floor(a.age);
        tinyText(ctx, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 8, 16, '#30ff30');
        // The spectrum: everyone just watched this instead of listening.
        for (let i = 0; i < 16; i++) {
          const v = Math.abs(Math.sin(now / (120 + i * 19) + i * 1.7)) * 16;
          ctx.fillStyle = v > 11 ? '#ff4030' : v > 7 ? '#ffe030' : '#30e030';
          ctx.fillRect(7 + i * 3.4, 42 - v, 2, v);
        }
        ctx.fillStyle = '#30ff30';
        ctx.fillRect(100, h - 12, ((a.age * 2) % 50) + 4, 3);
      });
    },
  };
}

// ---- Napstir ----

const SONGS = [
  ['METALICKA - ENTER SANDMAN (LIVE).MP3', '4.1MB', 'BIGDAVE86'],
  ['DEFINITELY_REAL_NEW_ALBUM.MP3', '3.0MB', 'XX_N3O_XX'],
  ['SPICE GIRLZ - TRACK 01 (BAD RIP).MP3', '2.7MB', 'COLLEGE_DORM'],
  ['NOT_A_VIRUS.MP3.EXE', '0.1MB', 'TRUSTME99'],
  ['BARENAKED CACTUS - ONE WEEK.WMA', '3.4MB', 'KEV1985'],
];

function napPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'NAPSTIR - MUSIC COMMUNITY', { buttons: ['close', 'max', 'min'] });
  ['CHAT', 'LIBRARY', 'SEARCH', 'TRANSFER', 'HOT LIST'].forEach((t, i) => {
    k.raised(4 + i * 46, 15, 44, 11);
    tinyText(g, t, 7 + i * 46, 18, i === 2 ? '#000080' : '#000000');
  });
  k.sunken(3, 28, w - 6, 66, '#ffffff');
  k.fill(4, 29, w - 8, 8, W98.face);
  tinyText(g, 'FILENAME', 6, 31, '#000000');
  tinyText(g, 'SIZE', w - 88, 31, '#000000');
  tinyText(g, 'USER', w - 60, 31, '#000000');
  SONGS.forEach(([name, size, user], i) => {
    tinyText(g, name.slice(0, 34), 6, 39 + i * 11, '#000000');
    tinyText(g, size, w - 88, 39 + i * 11, '#606060');
    tinyText(g, user.slice(0, 11), w - 60, 39 + i * 11, '#606060');
  });
  tinyText(g, 'DOWNLOADS', 6, 98, '#000080');
  k.sunken(3, 105, w - 6, h - 109, '#ffffff');
  tinyText(g, 'DEFINITELY_REAL_NEW_ALBUM.MP3', 6, 108, '#000000');
  k.sunken(6, 116, w - 12, 8, W98.face);
  return {
    c,
    live(ctx, x, y, a) {
      inWindow(ctx, x, y, () => {
        ctx.fillStyle = '#000080';
        ctx.fillRect(7, 117, Math.min(w - 14, 8 + a.age * 2.2), 6);
        const days = 3 - Math.floor(a.age / 6) % 2;
        tinyText(ctx, `${(0.8 + (Math.sin(a.age) + 1) * 0.6).toFixed(1)} KB/S`, 6, 128, '#606060');
        tinyText(ctx, `${days} DAYS LEFT`, 60, 128, '#800000');
      });
    },
  };
}

// ---- Copying... ----

function copyPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'COPYING...', { buttons: ['close'] });
  icon(g, 'folder', 12, 20, 24);
  icon(g, 'folder', w - 38, 20, 24);
  tinyText(g, 'SETUP.CAB', 12, 48, '#000000');
  tinyText(g, 'FROM C:\\WINDERS TO C:\\OTHER WINDERS', 12, 56, '#000000');
  k.sunken(12, 64, w - 24, 10, '#ffffff');
  k.raised(w / 2 - 22, h - 18, 44, 14);
  tinyText(g, 'CANCEL', w / 2 - 12, h - 13, '#000000');
  const estimates = ['2 MINUTES', '4 DAYS', '11 SECONDS', '7 YEARS', '1 MINUTE', '53 HOURS'];
  return {
    c,
    live(ctx, x, y, a, now) {
      inWindow(ctx, x, y, () => {
        // A sheet of paper flying between the folders.
        const t = (now / 900) % 1;
        const px = 34 + t * (w - 78), py = 30 - Math.sin(t * Math.PI) * 12;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, 9, 11);
        ctx.fillStyle = '#808080';
        ctx.fillRect(px + 2, py + 3, 5, 1);
        ctx.fillRect(px + 2, py + 6, 5, 1);
        const blocks = Math.min(Math.floor((w - 28) / 8), Math.floor(a.age * 1.6));
        ctx.fillStyle = '#000080';
        for (let i = 0; i < blocks; i++) ctx.fillRect(14 + i * 8, 66, 7, 6);
        tinyText(ctx, `TIME LEFT: ${estimates[Math.floor(a.age / 1.7) % estimates.length]}`, 12, 78, '#000000');
      });
    },
  };
}

// ---- Disk Defragmenter ----

function defragPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'DEFRAGMENTING DRIVE C', { buttons: ['close', 'max', 'min'] });
  k.sunken(4, 16, w - 8, h - 42, '#ffffff');
  k.raised(w - 90, h - 18, 40, 14);
  tinyText(g, 'STOP', w - 80, h - 13, '#000000');
  k.raised(w - 46, h - 18, 40, 14);
  tinyText(g, 'PAUSE', w - 37, h - 13, '#000000');
  const cols = Math.floor((w - 12) / 6), rows = Math.floor((h - 46) / 6);
  const start = Array.from({ length: cols * rows }, (_, i) => ((i * 2654435761) >>> 0) % 7);
  const shades = ['#ff4040', '#2040ff', '#2040ff', '#40e0ff', '#40e0ff', '#ffffff', '#20c020'];
  return {
    c,
    live(ctx, x, y, a) {
      inWindow(ctx, x, y, () => {
        const sorted = Math.floor(a.age * 5);
        for (let i = 0; i < start.length; i++) {
          const r = Math.floor(i / cols), c2 = i % cols;
          ctx.fillStyle = i < sorted ? '#2040ff' : i === sorted ? '#ffff00' : shades[start[i]];
          ctx.fillRect(7 + c2 * 6, 19 + r * 6, 5, 5);
        }
        tinyText(ctx, `${Math.min(99, Math.floor((sorted / start.length) * 100))}% COMPLETE`, 8, h - 13, '#000000');
      });
    },
  };
}

// ---- Close Program ----

const TASKS = ['EXPLORER', 'SYSTRAY', 'WINAMPLE', 'DOODLE DUEL', 'MSM MESSENGER', 'NOTEPADDLE', 'INTERNET EXPLODER (NOT RESPONDING)', 'MSTASK'];

function taskPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'CLOSE PROGRAM', { buttons: ['close'] });
  k.sunken(5, 17, w - 10, TASKS.length * 9 + 4, '#ffffff');
  TASKS.forEach((t, i) => tinyText(g, t, 8, 20 + i * 9, '#000000'));
  const y = 26 + TASKS.length * 9;
  tinyText(g, 'PRESSING CTRL+ALT+DEL AGAIN WILL RESTART', 6, y, '#000000');
  tinyText(g, 'YOUR COMPUTER. YOU WILL LOSE EVERYTHING.', 6, y + 8, '#000000');
  ['END TASK', 'SHUT DOWN', 'CANCEL'].forEach((t, i) => {
    k.raised(6 + i * 58, h - 18, 54, 14);
    tinyText(g, t, 12 + i * 58, h - 13, '#000000');
  });
  return {
    c,
    live(ctx, x, y2, a, now) {
      inWindow(ctx, x, y2, () => {
        const pick = [6, 6, 3, 6, 1][Math.floor(now / 1100) % 5];
        ctx.fillStyle = '#000080';
        ctx.fillRect(7, 19 + pick * 9, w - 14, 8);
        tinyText(ctx, TASKS[pick], 8, 20 + pick * 9, '#ffffff');
      });
    },
  };
}

// ---- Notepaddle ----

const NOTES = [
  ['DEAR DIARY,', 'TODAY I DEFRAGGED THE C DRIVE.', 'I FEEL NOTHING.', '', 'THE PAPERCLIP WATCHES ME.', 'IT KNOWS I AM WRITING A LETTER.'],
  ['TODO LIST', '1. BACK UP FILES', '2. BACK UP THE BACKUPS', '3. BUY Y2K GENERATOR', '4. 400 CANS OF BEANS', '5. TELL NOBODY ABOUT THE BEANS'],
  ['MY PASSWORDS', 'HOTMALE: PASSWORD1', 'BANK: PASSWORD2', 'AOL: I FORGOT', '', 'DO NOT LET ANYONE READ THIS'],
];

function notePage(w, h, variant) {
  const { c, g, k } = setup(w, h);
  const lines = NOTES[variant % NOTES.length];
  k.frame(0, 0, w, h, 'UNTITLED - NOTEPADDLE', { buttons: ['close', 'max', 'min'] });
  tinyText(g, 'FILE  EDIT  SEARCH  HELP', 6, 17, '#000000');
  k.sunken(3, 24, w - 6, h - 27, '#ffffff');
  return {
    c,
    live(ctx, x, y, a, now) {
      let left = Math.max(0, Math.floor((a.age - 0.5) * 11));
      inWindow(ctx, x, y, () => {
        let cx = 7, cy = 28;
        for (const [i, line] of lines.entries()) {
          if (left <= 0) break;
          const part = line.slice(0, left);
          tinyText(ctx, part, 7, 28 + i * 9, '#000000');
          left -= line.length + 1;
          cx = 7 + part.length * 4;
          cy = 28 + i * 9;
        }
        if (Math.floor(now / 400) % 2) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(cx, cy - 1, 1, 7);
        }
      });
    },
  };
}

// ---- Minesweeper, badly ----

function minesPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'MINESWEEPER', { buttons: ['close', 'min'] });
  k.sunken(8, 16, w - 16, 18, W98.face);
  k.fill(12, 19, 22, 12, '#000000');
  k.fill(w - 34, 19, 22, 12, '#000000');
  const size = 11, n = Math.min(10, Math.floor((w - 20) / size)), ox = (w - n * size) / 2, oy = 38;
  const tile = (x, y) => k.raised(x, y, size, size);
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) tile(ox + q * size, oy + r * size);
  const order = Array.from({ length: n * n }, (_, i) => i).sort((a, b) => ((a * 2654435761) >>> 3) % 97 - ((b * 2654435761) >>> 3) % 97);
  const numbers = ['#0000ff', '#008000', '#ff0000', '#000080'];
  const REVEAL = 0.34;
  return {
    c,
    live(ctx, x, y, a) {
      inWindow(ctx, x, y, () => {
        // Clicks tiles at random until it hits a mine, then the smiley dies and it starts over.
        const cycle = a.age % (REVEAL * 16 + 2);
        const shown = Math.min(16, Math.floor(cycle / REVEAL));
        const dead = shown >= 16;
        for (let i = 0; i < shown; i++) {
          const q = order[i] % n, r = Math.floor(order[i] / n);
          ctx.fillStyle = '#c0c0c0';
          ctx.fillRect(ox + q * size, oy + r * size, size, size);
          ctx.fillStyle = '#808080';
          ctx.fillRect(ox + q * size, oy + r * size, size, 1);
          ctx.fillRect(ox + q * size, oy + r * size, 1, size);
          if (i % 3) tinyText(ctx, `${(i % 3) + (i % 2)}`, ox + q * size + 4, oy + r * size + 3, numbers[i % 4]);
        }
        if (dead) {
          const q = order[16] % n, r = Math.floor(order[16] / n);
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(ox + q * size, oy + r * size, size, size);
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + q * size + 3, oy + r * size + 3, 5, 5);
        }
        tinyText(ctx, '010', 14, 22, '#ff0000');
        tinyText(ctx, String(Math.floor(a.age)).padStart(3, '0'), w - 32, 22, '#ff0000');
        const fx = w / 2 - 6;
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(fx, 19, 12, 12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(fx + 3, 22, 2, dead ? 1 : 2);
        ctx.fillRect(fx + 7, 22, 2, dead ? 1 : 2);
        ctx.fillRect(fx + 3, dead ? 28 : 27, 6, 1);
      });
    },
  };
}

// ---- Solitaire, also badly ----

function solPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, 'SOLITAIRE', { buttons: ['close', 'max', 'min'] });
  tinyText(g, 'GAME  HELP', 6, 17, '#000000');
  k.fill(3, 24, w - 6, h - 27, '#008040');
  const card = (x, y, face, label, red) => {
    k.fill(x, y, 22, 30, '#000000');
    k.fill(x + 1, y + 1, 20, 28, face ? '#ffffff' : '#000090');
    if (face) tinyText(g, label, x + 3, y + 3, red ? '#ff0000' : '#000000');
    else for (let i = 0; i < 6; i++) k.fill(x + 3, y + 3 + i * 4, 16, 2, '#4040d0');
  };
  card(8, 30, false);
  for (let i = 0; i < 4; i++) {
    k.fill(68 + i * 28, 30, 22, 30, '#006030');
    k.fill(69 + i * 28, 31, 20, 28, '#008040');
  }
  for (let q = 0; q < 7; q++) {
    for (let r = 0; r <= q && r < 4; r++) card(8 + q * 27, 68 + r * 8, r === Math.min(q, 3), 'A234567'[q], q % 2);
  }
  return {
    c,
    live(ctx, x, y, a, now) {
      inWindow(ctx, x, y, () => {
        // Someone dragging a card back and forth, unable to find a move.
        const t = (now / 1500) % 2, k2 = t < 1 ? t : 2 - t;
        const px = 62 + k2 * 120, py = 104 - Math.sin(k2 * Math.PI) * 60;
        ctx.fillStyle = '#000000';
        ctx.fillRect(px, py, 22, 30);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + 1, py + 1, 20, 28);
        tinyText(ctx, 'K', px + 3, py + 3, '#ff0000');
      });
    },
  };
}

// ---- Pinball ----

function ballPage(w, h) {
  const { c, g, k } = setup(w, h);
  k.frame(0, 0, w, h, '3D PINBALL', { buttons: ['close', 'min'] });
  k.fill(3, 15, w - 6, h - 18, '#101838');
  for (let i = 0; i < 5; i++) k.fill(14 + i * 26, 22, 8, 8, ['#ff4040', '#ffc040', '#40ff40', '#40c0ff', '#c060ff'][i]);
  for (const [x, y, r] of [[36, 62, 11], [92, 58, 11], [64, 90, 11]]) {
    g.fillStyle = '#e04080';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe0f0';
    g.fillRect(x - 3, y - 3, 6, 6);
  }
  const H2 = h - 24;
  return {
    c,
    live(ctx, x, y, a, now) {
      inWindow(ctx, x, y, () => {
        const t = now / 1000;
        const bx = 64 + Math.sin(t * 2.3) * 44 + Math.sin(t * 5.1) * 10;
        const by = 80 + Math.abs(Math.sin(t * 1.7)) * (H2 - 104) * -0.6 + Math.sin(t * 3.7) * 18 + 22;
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(bx - 3, by - 3, 7, 7);
        const flip = Math.floor(now / 340) % 3 === 0;
        ctx.fillStyle = '#ffc040';
        ctx.fillRect(40, h - 34 - (flip ? 5 : 0), 22, 4);
        ctx.fillRect(68, h - 34 - (flip ? 0 : 5), 22, 4);
        tinyText(ctx, `SCORE ${String(Math.floor(a.age * 1375) + 10000).padStart(8, '0')}`, 12, h - 13, '#ffff60');
      });
    },
  };
}

// ---- Paint: someone with a mouse and no talent ----

const DOODLES = [
  // A house.
  [[[60, 120], [60, 70], [120, 70], [120, 120], [60, 120]], [[52, 72], [90, 40], [128, 72]], [[82, 120], [82, 92], [98, 92], [98, 120]], [[140, 118], [146, 96], [152, 118]], [[132, 50], [146, 36], [160, 50], [146, 64], [132, 50]]],
  // A cat, supposedly.
  [[[70, 110], [66, 70], [78, 48], [88, 62], [110, 62], [120, 48], [132, 70], [128, 110], [70, 110]], [[84, 80], [86, 82]], [[112, 80], [114, 82]], [[92, 94], [98, 98], [106, 94]], [[128, 104], [156, 92], [150, 70]]],
  // A stick person being shot by a cursor.
  [[[80, 62], [92, 52], [104, 62], [92, 72], [80, 62]], [[92, 72], [92, 104]], [[92, 80], [74, 92]], [[92, 80], [110, 92]], [[92, 104], [78, 124]], [[92, 104], [106, 124]], [[160, 60], [130, 74], [150, 78], [160, 60]]],
];

function paintPage(w, h, variant) {
  const { c, g, k } = setup(w, h);
  const strokes = DOODLES[variant % DOODLES.length];
  k.frame(0, 0, w, h, 'UNTITLED - PAINT', { buttons: ['close', 'max', 'min'] });
  tinyText(g, 'FILE  EDIT  VIEW  IMAGE  COLORS  HELP', 6, 17, '#000000');
  for (let i = 0; i < 16; i++) k.raised(4 + (i % 2) * 12, 26 + Math.floor(i / 2) * 12, 11, 11);
  k.sunken(30, 26, w - 34, h - 50, '#808080');
  k.fill(31, 27, w - 44, h - 62, '#ffffff');
  ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'].forEach((color, i) => {
    k.fill(30 + (i % 8) * 11, h - 22 + Math.floor(i / 8) * 9, 10, 8, color);
  });
  return {
    c,
    live(ctx, x, y, a) {
      inWindow(ctx, x, y, () => {
        // Line by line, in shaky hand-drawn dots.
        let budget = Math.floor((a.age - 0.5) * 34);
        ctx.fillStyle = '#000000';
        let tip = null;
        for (const stroke of strokes) {
          for (let i = 1; i < stroke.length && budget > 0; i++) {
            const [x0, y0] = stroke[i - 1], [x1, y1] = stroke[i];
            const len = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
            for (let d = 0; d <= len && budget > 0; d++, budget--) {
              const t = d / len;
              const px = Math.round(x0 + (x1 - x0) * t + Math.sin(d * 1.3) * 0.7);
              const py = Math.round(y0 + (y1 - y0) * t + Math.cos(d * 1.1) * 0.7);
              ctx.fillRect(px, py, 2, 2);
              tip = [px, py];
            }
          }
        }
        if (tip) {
          ctx.fillStyle = '#404040';
          ctx.fillRect(tip[0] + 2, tip[1] - 6, 2, 7);
        }
      });
    },
  };
}

export const DESK_PAGES = {
  msn: msnPage,
  dial: dialPage,
  aol: aolPage,
  amp: ampPage,
  nap: napPage,
  copy: copyPage,
  defrag: defragPage,
  task: taskPage,
  note: notePage,
  mines: minesPage,
  sol: solPage,
  ball: ballPage,
  paint: paintPage,
};
