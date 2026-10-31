// The living desktop: everything a stage adds on top of the core game. Pop-ups, viruses, the Start
// menu and other things you can shoot, and the events the computer sets off on its own. Pure rules
// like game.js: the host runs this, clients just mirror game.stage from snapshots.
//
// The stage's own content is plain data (see stages/win98.js); this file is the machinery that
// every stage shares.

import {
  ARENA, CELL, COLS, TASKBAR_H, PAINT_SLOT, DESK_SLOT, ROUND_START_POWERUPS,
  emit, hurtPlayer, healPlayer, breakWall, chip, paintBlob, blastPush, circleHitsWall, applyPowerup,
  playerRadius, findFreeSpot, spawnPowerup, randomPowerupType, placeDesktop, explode, fireFrom,
} from './game.js';
import { STAGES } from './stages/index.js';

export const VIRUS_RADIUS = 18;
export const VIRUS_HP = 3;
export const INFECT_TIME = 6;          // seconds from touching a virus to exploding
export const INFECT_BLAST = { radius: 190, damage: 6, push: 260 };
export const POPUP = { w: 208, h: 112 };
export const MINE_RADIUS = 16;
export const CLUTTER = { pitchX: 92, pitchY: 84, x: 12, y: 12, w: 72, h: 76 };
const MAX_POPUPS = 4;
export const POPUP_LIFE = 11;
const MAX_VIRUSES = 3;
const CLUTTER_HITS = 2;                // bullets it takes to delete a desktop icon
const MINE_LIFE = 24;
const MINE_COUNT = 8;
const CASCADE_TIME = 6;
const CARD_BLAST = { damage: 3, radius: 75 };
const MAX_APPS = 2;
const APP_MIN_LIFE = 10;               // desktop programs stay open at least this long
const APP_MAX_LIFE = 15;
export const CASCADE_CARDS = 13;
const PIPE_TIME = 5;
const SWEEP_TIME = 4;
const MODEM_TIME = 6;
const BSOD_TIME = 2;
export const BSOD_OUT = 0.6;           // the last part of a blue screen: it tears apart to reveal the level
const PRESS_COOLDOWN = 0.4;
// Never put clutter behind the largest possible score window (8 teams).
const WINDOW_ZONE = { x: 0, y: 0, w: 300, h: 240 };

// Things that barge in for a few seconds.
const CLIP_TIME = 6;
const CLIP_LINE_COUNT = 4;              // how many things the paperclip knows how to say
export const TOASTER_TIME = 7;
export const TOASTERS = 12;
const FORMAT_TIME = 9;
export const FORMAT_CANCEL = { x: 470, y: 84, w: 340, h: 132 };   // the dialog you shoot to stop it
const PRINTER_TIME = 5;
const APE_TIME = 7;
const CALC_TIME = 6;
const BALL_TIME = 8;
const TRAY_TIME = 2.2;
export const TRAY_LEN = 420;
const DISPLAY_TIME = 6;
const RUN_TIME = 2;

const rnd = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const barTop = () => ARENA.h - TASKBAR_H;

// Small seeded generator: host and clients must lay the clutter out identically.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Desktop icons end up scattered all over, the way they do when nobody ever tidies up.
export function buildClutter(def, seed) {
  const random = seeded(seed);
  const cols = Math.floor((ARENA.w - 84) / CLUTTER.pitchX), rows = Math.floor(barTop() / CLUTTER.pitchY);
  const spots = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = CLUTTER.x + col * CLUTTER.pitchX, y = CLUTTER.y + row * CLUTTER.pitchY;
      if (x < WINDOW_ZONE.w && y < WINDOW_ZONE.h) continue;
      spots.push({ col, row, x, y });
    }
  }
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  shuffle(spots);
  const icons = shuffle([...def.clutter]).slice(0, def.clutterCount);
  return spots.slice(0, icons.length).map((s, i) => ({ ...s, icon: icons[i][0], label: icons[i][1] }));
}

export function createStage(id, seed) {
  const def = STAGES[id];
  if (!def?.ready) return null;
  const clutter = buildClutter(def, seed);
  const grid = new Map(clutter.map((c, i) => [`${c.col},${c.row}`, i]));
  return {
    id,
    ready: false,                     // the desktop is up (false while the OS is booting)
    t: 0,
    clutter,
    grid,                             // "col,row" -> clutter index, for fast bullet checks
    gone: [],                         // clutter indices that have been deleted
    popups: [],
    nextPopupId: 1,
    popupTimer: rnd(2, 3),
    viruses: [],
    nextVirusId: 1,
    virusTimer: rnd(10, 14),
    mines: [],
    nextMineId: 1,
    menu: null,                       // { kind, t }
    cooldowns: {},                    // hotspot id -> seconds until it works again
    spent: [],                        // menus that have launched their one program this round
    eventTimer: rnd(10, 14),
    eventBag: [],                     // what the computer does next
    apps: [],                         // decorative program windows, under everything
    nextAppId: 1,
    appTimer: rnd(2, 4),
    cascade: null,                    // Solitaire win: { t, owner, team, dead: [card numbers that blew up] }
    pipes: null,                      // screensaver: { t, heads: [{ x, y, dir, run }] }
    sweep: null,                      // ScanDisk bar: { t, row }
    modem: 0,                         // seconds of dial-up left
    bsod: 0,                          // seconds of blue screen left
    fx: {},                           // whatever has barged in right now: name -> { t, dur, ... }
  };
}

export const stageDef = (game) => STAGES[game.stage?.id];

// The OS finished booting: the desktop appears, then the icons.
export function startDesktop(game, teams) {
  const s = game.stage;
  placeDesktop(game, teams);
  if (!s) return;
  s.ready = true;
  // The hand-placed set of powerups every round starts with, unless the host turned them off.
  if (game.rules.powerupInterval > 0) {
    for (let i = 0; i < ROUND_START_POWERUPS; i++) {
      const spot = findFreeSpot(game);
      spawnPowerup(game, randomPowerupType(), spot.x, spot.y, { silent: true });
    }
  }
}

// ---- things you shoot ----

// Called on the frame a player pulls the trigger. The gun fires as normal; this is the extra click.
export function pressAt(game, p) {
  const s = game.stage;
  if (!s?.ready || p.pressCd > 0) return;
  const def = stageDef(game);
  const inside = (r, x = 0, y = 0) => p.x >= r.x + x && p.x < r.x + x + r.w && p.y >= r.y + y && p.y < r.y + y + r.h;

  // The Format dialog's Cancel button.
  if (s.fx.format && inside(FORMAT_CANCEL)) {
    p.pressCd = PRESS_COOLDOWN;
    delete s.fx.format;
    emit(game, 'press', { x: p.x, y: p.y });
    emit(game, 'stageEvent', { name: 'formatStop' });
    return;
  }

  // An open menu sits on top of the desktop, so it gets the click first.
  if (s.menu) {
    const m = def.menus[s.menu.kind];
    if (inside(m)) {
      for (const [i, row] of menuTargets(m).entries()) {
        if (!inside(row)) continue;
        p.pressCd = PRESS_COOLDOWN;
        emit(game, 'press', { x: p.x, y: p.y });
        launch(game, p, m.rows ? m.rows[i].id : m.buttons[i].id);
        return;
      }
      return;
    }
  }
  for (const h of def.hotspots) {
    if (!inside(h)) continue;
    p.pressCd = PRESS_COOLDOWN;
    if (s.cooldowns[h.id] > 0) return;
    if (h.does === 'menu' && s.spent.includes(h.menu)) return emit(game, 'dry', { x: p.x, y: p.y });
    if (h.cooldown) s.cooldowns[h.id] = h.cooldown;
    emit(game, 'press', { x: p.x, y: p.y });
    if (h.does === 'menu') {
      const same = s.menu?.kind === h.menu;
      s.menu = same ? null : { kind: h.menu, t: 0 };
      emit(game, same ? 'menuClose' : 'menuOpen', { kind: h.menu });
    } else if (h.does === 'closeAll') closeEverything(game);
    else if (h.does === 'moreAds') {
      for (let i = 0; i < 2; i++) spawnPopup(game, { bad: i === 0 });
      emit(game, 'stageEvent', { name: 'ads' });
    } else if (h.does === 'loud') {
      blastPush(game, h.x, h.y, 320, 200);
      emit(game, 'stageEvent', { name: 'loud' });
    } else if (h.does === 'tray') {
      s.fx.tray = { t: 0, dur: TRAY_TIME, y: Math.round(rnd(60, barTop() - 200)) };
      emit(game, 'stageEvent', { name: 'tray' });
    } else if (h.does === 'display') {
      s.fx.display = { t: 0, dur: DISPLAY_TIME, mode: Math.random() < 0.5 ? 'colors' : 'lowres' };
      emit(game, 'stageEvent', { name: 'display' });
    } else if (h.does === 'empty') {
      const slot = breakWall(game, game.players[p.id].x, game.players[p.id].y, 240, p.id);
      chip(game, p.x, p.y, slot, true);
      emit(game, 'stageEvent', { name: 'recycle' });
    }
    return;
  }
}

// The clickable rows or buttons of a menu, in arena coordinates.
export function menuTargets(m) {
  if (m.rows) {
    const rowH = (m.h - 8) / m.rows.length;
    return m.rows.map((_, i) => ({ x: m.x + 40, y: m.y + 4 + i * rowH, w: m.w - 44, h: rowH }));
  }
  return m.buttons.map((b) => ({ x: m.x + b.x, y: m.y + b.y, w: b.w, h: b.h }));
}

function launch(game, p, id) {
  const s = game.stage;
  const from = s.menu?.kind;
  s.menu = null;
  if (id === 'close') return emit(game, 'menuClose', {});
  s.spent.push(from);                 // one program per menu per round: Start and the clock go dead now
  if (id === 'minesweeper') {
    for (let i = 0; i < MINE_COUNT; i++) {
      const spot = freeArea(game, 40, 40, 90);
      s.mines.push({ id: s.nextMineId++, x: spot.x + 20, y: spot.y + 20, owner: p.id, team: p.color, life: MINE_LIFE });
    }
  } else if (id === 'solitaire') {
    s.cascade = { t: 0, owner: p.id, team: p.color, dead: [] };
  } else if (id === 'pinball') {
    const a = rnd(0, Math.PI * 2);
    s.fx.ball = { t: 0, dur: BALL_TIME, x: p.x, y: Math.min(p.y, barTop() - 40), vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, owner: p.id, team: p.color };
  } else if (id === 'calculator') {
    s.fx.calc = { t: 0, dur: CALC_TIME, x: Math.round(Math.max(90, Math.min(ARENA.w - 90, p.x))), y: Math.round(Math.min(p.y, barTop() - 110)), owner: p.id, team: p.color, next: 0.5 };
  } else if (id === 'run') {
    s.fx.run = { t: 0, dur: RUN_TIME, typed: Math.random() < 0.6 ? 'FORMAT C:' : 'SURPRISE.EXE' };
  } else if (id === 'paint') {
    p.ink = game.rules.penCapacity;
    p.fat = 12;
  } else if (id === 'exploder') {
    for (let i = 0; i < 3; i++) spawnPopup(game, { bad: i < 2 });
  } else if (id === 'cleanup') {
    for (let i = 0; i < s.clutter.length; i++) deleteClutter(game, i);
    applyPowerup(game, p, 'eraser');
  } else if (id === 'shutdown') {
    applyPowerup(game, p, 'blackout');
  } else if (id === 'y2k') {
    // The clocks roll over: everyone's timed boosts and handicaps vanish and the walls crumble.
    for (const o of Object.values(game.players)) Object.assign(o, { speed: 0, fat: 0, small: 0, ghost: 0, slow: 0, jam: 0, invert: 0, immune: 0, freeAmmo: 0, rapid: 0 });
    applyPowerup(game, p, 'inkstorm');
  }
  emit(game, 'program', { id, pid: p.id });
}

function closeEverything(game) {
  const s = game.stage;
  s.popups.length = 0;
  s.menu = null;
  emit(game, 'stageEvent', { name: 'desktop' });
}

// ---- pop-ups ----

function freeArea(game, w, h, awayFromPlayers) {
  for (let i = 0; i < 60; i++) {
    const x = rnd(8, ARENA.w - w - 8), y = rnd(8, barTop() - h - 8);
    const near = Object.values(game.players).some((p) => p.alive && p.x > x - awayFromPlayers && p.x < x + w + awayFromPlayers && p.y > y - awayFromPlayers && p.y < y + h + awayFromPlayers);
    const over = game.stage.popups.some((u) => x < u.x + POPUP.w && x + w > u.x && y < u.y + POPUP.h && y + h > u.y);
    const win = game.desktop?.win;
    if (near || over || (win && x < win.x + win.w && y < win.y + win.h)) continue;
    return { x, y };
  }
  return { x: rnd(300, ARENA.w - w - 8), y: rnd(40, barTop() - h - 8) };
}

function spawnPopup(game, { bad = false, near = null } = {}) {
  const s = game.stage;
  const list = stageDef(game).popups.filter((p) => !bad || !p.good);
  const total = list.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total, kind = list[0];
  for (const p of list) {
    roll -= p.weight;
    if (roll <= 0) {
      kind = p;
      break;
    }
  }
  // A pop-up meant for someone lands right around them.
  const { x, y } = near
    ? { x: Math.max(8, Math.min(ARENA.w - POPUP.w - 8, near.x + rnd(-360, 150))), y: Math.max(8, Math.min(barTop() - POPUP.h - 8, near.y + rnd(-260, 150))) }
    : freeArea(game, POPUP.w, POPUP.h, 80);
  s.popups.push({ id: s.nextPopupId++, kind: kind.id, x: Math.round(x), y: Math.round(y), life: POPUP_LIFE });
  emit(game, 'popupOpen', { x, good: kind.good });
}

function triggerPopup(game, p, u) {
  const def = stageDef(game).popups.find((k) => k.id === u.kind);
  emit(game, 'popup', { pid: p.id, x: p.x, y: p.y, good: def.good, float: def.float, ux: u.x, uy: u.y });
  const dur = def.dur ?? 0;
  switch (def.effect) {
    case 'speed': p.speed = Math.max(p.speed, dur); break;
    case 'heal': healPlayer(game, p, def.value); break;
    case 'immune':
    case 'freeAmmo':
    case 'rapid':
    case 'slow':
    case 'invert':
    case 'jam':
    case 'frozen':
      p[def.effect] = Math.max(p[def.effect] || 0, dur);
      break;
    case 'ink': p.ink = Math.floor(p.ink * 0.35); break;
    case 'inkFull': p.ink = game.rules.penCapacity; break;
    case 'shields': applyPowerup(game, p, 'defense'); break;
    case 'scam':
      p.jam = Math.max(p.jam || 0, dur);
      for (let i = 0; i < 2; i++) spawnPopup(game, { bad: true });
      break;
  }
}

// ---- viruses ----

function spawnVirus(game) {
  const s = game.stage;
  const kind = pick(stageDef(game).viruses);
  const side = Math.floor(Math.random() * 3);
  const m = VIRUS_RADIUS + 12;
  const x = side === 0 ? m : side === 1 ? ARENA.w - m : rnd(320, ARENA.w - m);
  const y = side === 2 ? m : rnd(260, barTop() - m);
  const a = Math.atan2(rnd(200, 480) - y, rnd(300, 980) - x);
  s.viruses.push({ id: s.nextVirusId++, kind: kind.id, x, y, vx: Math.cos(a) * kind.speed, vy: Math.sin(a) * kind.speed, hp: VIRUS_HP, born: s.t });
  emit(game, 'virusSpawn', { x, y });
}

function killVirus(game, v) {
  const s = game.stage;
  s.viruses = s.viruses.filter((o) => o !== v);
  emit(game, 'virusDie', { x: Math.round(v.x), y: Math.round(v.y) });
}

function stepVirus(game, v, dt) {
  const s = game.stage;
  const kind = stageDef(game).viruses.find((k) => k.id === v.kind);
  if (kind.seek) {
    let best = null, bestD = Infinity;
    for (const p of Object.values(game.players)) {
      if (!p.alive || p.ghost > 0 || p.infected > 0) continue;
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      const want = Math.atan2(best.y - v.y, best.x - v.x), now = Math.atan2(v.vy, v.vx);
      const diff = Math.atan2(Math.sin(want - now), Math.cos(want - now));
      const a = now + Math.max(-kind.seek * dt, Math.min(kind.seek * dt, diff));
      v.vx = Math.cos(a) * kind.speed;
      v.vy = Math.sin(a) * kind.speed;
    }
  }
  const nx = v.x + v.vx * dt, ny = v.y + v.vy * dt;
  // Stays on the desktop, and walls stop it: that's what drawing a wall is for.
  if (nx < VIRUS_RADIUS || nx > ARENA.w - VIRUS_RADIUS || circleHitsWall(game, nx, v.y, VIRUS_RADIUS)) v.vx = -v.vx;
  else v.x = nx;
  if (ny < VIRUS_RADIUS || ny > barTop() - VIRUS_RADIUS || circleHitsWall(game, v.x, ny, VIRUS_RADIUS)) v.vy = -v.vy;
  else v.y = ny;

  if (s.t - v.born < 1) return;       // still materializing: harmless
  for (const p of Object.values(game.players)) {
    if (!p.alive || p.infected > 0 || p.ghost > 0) continue;
    if (Math.hypot(p.x - v.x, p.y - v.y) > VIRUS_RADIUS + playerRadius(p)) continue;
    killVirus(game, v);
    if (p.immune > 0) return;
    p.infected = INFECT_TIME;
    emit(game, 'infected', { pid: p.id, x: p.x, y: p.y });
    return;
  }
}

// Bullets, once per tick. They delete desktop icons on the way past and stop at viruses.
export function bulletHitsStage(game, b) {
  const s = game.stage;
  if (!s?.ready) return false;
  for (const v of s.viruses) {
    if (Math.hypot(b.x - v.x, b.y - v.y) > VIRUS_RADIUS + 4) continue;
    const big = b.kind === 'sniper' || b.kind === 'rocket';
    v.hp -= big ? VIRUS_HP : b.kind === 'flame' ? 0.4 : 1;
    emit(game, 'virusHit', { x: Math.round(b.x), y: Math.round(b.y) });
    if (v.hp <= 0) killVirus(game, v);
    if (b.kind === 'rocket') explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
    return b.kind !== 'sniper';
  }
  const col = Math.floor((b.x - CLUTTER.x) / CLUTTER.pitchX), row = Math.floor((b.y - CLUTTER.y) / CLUTTER.pitchY);
  const i = s.grid.get(`${col},${row}`);
  if (i !== undefined) {
    const c = s.clutter[i];
    // A bullet chips only the first icon it crosses, or a firefight would strip the desktop in seconds.
    if (b.x < c.x + CLUTTER.w && b.y < c.y + CLUTTER.h && !b.chipped) {
      b.chipped = true;
      c.hits = (c.hits || 0) + 1;
      if (c.hits >= CLUTTER_HITS) deleteClutter(game, i);
    }
  }
  return false;
}

function deleteClutter(game, i) {
  const s = game.stage;
  if (s.gone.includes(i)) return;
  s.gone.push(i);
  s.grid.delete(`${s.clutter[i].col},${s.clutter[i].row}`);
  const c = s.clutter[i];
  emit(game, 'clutter', { x: c.x + CLUTTER.w / 2, y: c.y + 24 });
}

// A blast deletes whatever desktop things it reaches.
function clearAround(game, x, y, r) {
  const s = game.stage;
  if (!s) return;
  s.popups = s.popups.filter((u) => Math.hypot(u.x + POPUP.w / 2 - x, u.y + POPUP.h / 2 - y) > r);
  s.clutter.forEach((c, i) => {
    if (Math.hypot(c.x + CLUTTER.w / 2 - x, c.y + 30 - y) < r) deleteClutter(game, i);
  });
  for (const v of [...s.viruses]) if (Math.hypot(v.x - x, v.y - y) < r) killVirus(game, v);
}

// An infected player's end: a huge green blast that wrecks everything around it.
export function infectionBlast(game, p) {
  const { radius, damage, push } = INFECT_BLAST;
  emit(game, 'virusBlast', { x: p.x, y: p.y, r: radius });
  chip(game, p.x, p.y, breakWall(game, p.x, p.y, radius), true);
  clearAround(game, p.x, p.y, radius);
  for (const o of Object.values(game.players)) {
    if (o === p || !o.alive) continue;
    if (Math.hypot(o.x - p.x, o.y - p.y) <= radius + playerRadius(o)) hurtPlayer(game, o, damage);
  }
  blastPush(game, p.x, p.y, radius, push, p);
}

export function blastClears(game, x, y, r) {
  clearAround(game, x, y, r);
}

// ---- things that barge in ----

const nearestEnemy = (game, e) => {
  let best = null, bestD = Infinity;
  for (const p of Object.values(game.players)) {
    if (!p.alive || p.ghost > 0 || p.id === e.owner || (e.team && p.color === e.team)) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const randomVictim = (game) => {
  const list = Object.values(game.players).filter((p) => p.alive);
  return list.length ? pick(list) : null;
};

// Where toaster i is at time t: a wave flapping down from the top right, like the old screen saver.
export function toasterAt(i, t) {
  const age = t - (i % 4) * 0.5 - Math.floor(i / 4) * 0.35;
  if (age < 0) return null;
  const x = ARENA.w + 60 + (i % 4) * 150 - age * 300 - Math.floor(i / 4) * 70;
  const y = -60 + Math.floor(i / 4) * 170 + (i % 4) * 34 + age * 150;
  return x < -80 || y > barTop() + 40 ? null : { x, y };
}

const FX_STEP = {
  // The paperclip attaches itself to one player and won't stop helping.
  clip(game, e) {
    const p = game.players[e.pid];
    if (!p?.alive) e.t = e.dur;
  },
  toasters(game, e) {
    for (let i = 0; i < TOASTERS; i++) {
      const at = toasterAt(i, e.t);
      if (!at) continue;
      for (const p of Object.values(game.players)) {
        const key = `${i}:${p.id}`;
        if (!p.alive || p.ghost > 0 || e.hit[key]) continue;
        if (Math.hypot(p.x - at.x, p.y - at.y) >= 30 + playerRadius(p)) continue;
        e.hit[key] = true;
        hurtPlayer(game, p, 2);
        emit(game, 'toasted', { pid: p.id, x: p.x, y: p.y });
      }
    }
  },
  // Horizontal stripes of the drive get wiped in a shuffled order, icons included.
  format(game, e) {
    const bands = e.bands, done = Math.floor((e.t / e.dur) * bands.length);
    let changed = false;
    while (e.next < done) {
      const top = bands[e.next++] * 8;
      for (let r = top; r < top + 8; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c, slot = game.walls[i];
          if (!slot || slot === DESK_SLOT) continue;
          game.walls[i] = 0;
          game.wallLog?.push(i, 0);
          changed = true;
        }
      }
      const y = top * CELL;
      game.stage.clutter.forEach((item, i) => {
        if (item.y + 30 >= y && item.y + 30 < y + 32) deleteClutter(game, i);
      });
    }
    if (changed) game.wallsVersion++;
  },
  printer(game, e, dt) {
    e.next -= dt;
    if (e.next > 0) return;
    e.next = 0.26;
    const victim = randomVictim(game);
    const aim = victim ? Math.atan2(victim.y - e.y, victim.x - e.x) : rnd(0, Math.PI * 2);
    fireFrom(game, { x: e.x, y: e.y, angle: aim + rnd(-0.4, 0.4), speed: 300, kind: 'paper', life: 3.5 });
    emit(game, 'printed', { x: e.x });
  },
  // The purple ape strolls up to someone, makes an offer, then the pop-ups start.
  ape(game, e, dt) {
    const p = game.players[e.pid];
    const leaving = e.t > APE_TIME - 2;
    const tx = leaving ? -80 : p ? p.x - 70 : e.x, ty = leaving ? e.y : p ? p.y : e.y;
    const d = Math.hypot(tx - e.x, ty - e.y);
    e.walking = d > 8 ? 1 : 0;
    if (d > 8) {
      const speed = leaving ? 360 : 240;
      e.x += ((tx - e.x) / d) * speed * dt;
      e.y += ((ty - e.y) / d) * speed * dt;
    } else if (!e.done && !leaving) {
      e.talk = (e.talk || 0) + dt;
      if (e.talk > 1.6) {
        e.done = 1;
        emit(game, 'popupOpen', { x: e.x, good: false });
        for (let i = 0; i < 4; i++) spawnPopup(game, { bad: true, near: p });
      }
    }
  },
  calc(game, e, dt) {
    e.next -= dt;
    if (e.next > 0) return;
    e.next = 0.34;
    const target = nearestEnemy(game, e);
    if (!target) return;
    fireFrom(game, { x: e.x, y: e.y, angle: Math.atan2(target.y - e.y, target.x - e.x), speed: 620, kind: 'key', owner: e.owner, team: e.team });
    emit(game, 'press', { x: e.x, y: e.y });
  },
  // A steel ball with no regard for anything: bounces off walls (breaking them) and crushes people.
  ball(game, e, dt) {
    const steps = 3, r = 20;
    for (let n = 0; n < steps; n++) {
      const nx = e.x + (e.vx * dt) / steps, ny = e.y + (e.vy * dt) / steps;
      if (nx < r || nx > ARENA.w - r) e.vx = -e.vx;
      else if (circleHitsWall(game, nx, e.y, r)) {
        e.vx = -e.vx;
        chip(game, nx, e.y, breakWall(game, nx, e.y, 26, e.owner));
        emit(game, 'bounce', { x: nx, y: e.y });
      } else e.x = nx;
      if (ny < r || ny > barTop() - r) e.vy = -e.vy;
      else if (circleHitsWall(game, e.x, ny, r)) {
        e.vy = -e.vy;
        chip(game, e.x, ny, breakWall(game, e.x, ny, 26, e.owner));
        emit(game, 'bounce', { x: e.x, y: ny });
      } else e.y = ny;
    }
    e.cool = Math.max(0, (e.cool || 0) - dt);
    for (const p of Object.values(game.players)) {
      if (e.cool > 0 || !p.alive || p.ghost > 0 || p.id === e.owner || (e.team && p.color === e.team)) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) >= r + playerRadius(p)) continue;
      e.cool = 0.5;
      hurtPlayer(game, p, 3, e.owner);
      blastPush(game, e.x, e.y, 90, 170);
      emit(game, 'bounce', { x: e.x, y: e.y });
    }
  },
  // The drive tray slides out of the side of the screen and shoves whoever's in the way.
  tray(game, e) {
    const reach = trayReach(e) * TRAY_LEN;
    const x = ARENA.w - reach, h = 140;
    for (let i = 0; i < 6; i++) breakWall(game, x + 8, e.y + (i * h) / 5, 14);
    for (const p of Object.values(game.players)) {
      if (!p.alive || p.ghost > 0 || p.x < x - playerRadius(p) || p.y < e.y || p.y > e.y + h) continue;
      p.x = Math.max(playerRadius(p), x - playerRadius(p));
      p.kvx = Math.min(p.kvx || 0, -900);
    }
  },
  run(game, e) {
    if (e.t + 0.02 < e.dur) return;
    if (e.typed === 'FORMAT C:') startEvent(game, 'format');
    else startEvent(game);
  },
};

// 0 (shut) to 1 (fully out) for the CD tray.
export function trayReach(e) {
  return Math.min(1, e.t / 0.35, (e.dur - e.t) / 0.35);
}

// ---- decorative programs ----

function openApp(game) {
  const s = game.stage;
  const list = stageDef(game).apps?.filter((k) => !s.apps.some((a) => a.kind === k.id));
  if (!list?.length) return;
  const kind = pick(list);
  for (let i = 0; i < 40; i++) {
    const x = rnd(8, ARENA.w - kind.w - 8), y = rnd(8, barTop() - kind.h - 8);
    // Windows may overlap, like real ones; they just can't sit almost exactly on top of each other.
    if (s.apps.some((a) => Math.abs(a.x - x) < 320 && Math.abs(a.y - y) < 160)) continue;
    s.apps.push({
      id: s.nextAppId++, kind: kind.id, variant: Math.floor(Math.random() * kind.variants),
      x: Math.round(x / 2) * 2, y: Math.round(y / 2) * 2, w: kind.w, h: kind.h, age: 0, life: rnd(APP_MIN_LIFE, APP_MAX_LIFE),
    });
    emit(game, 'appOpen', {});
    return;
  }
}

function stepApps(game, dt) {
  const s = game.stage;
  for (const a of s.apps) a.age += dt;
  s.apps = s.apps.filter((a) => a.age < a.life);
  if ((s.appTimer -= dt) <= 0) {
    s.appTimer = rnd(4, 8);
    if (s.apps.length < MAX_APPS) openApp(game);
  }
}

// ---- things the computer does on its own ----

// Every event comes up once before any repeats. Each round opens with the big two.
function nextEvents(def, firstBag) {
  const mixed = (list) => list.map((e) => [Math.random(), e]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  if (!firstBag) return mixed(def.events);
  return [...mixed(def.headliners), ...mixed(def.events.filter((e) => !def.headliners.includes(e)))];
}

function startEvent(game, forced = null) {
  const s = game.stage;
  const def = stageDef(game);
  if (!s.eventBag.length) s.eventBag = nextEvents(def, !s.started);
  s.started = true;
  const name = forced || s.eventBag.shift();
  const players = Object.values(game.players);
  if (name === 'bsod') {
    s.bsod = BSOD_TIME;
    for (const p of players) p.frozen = Math.max(p.frozen || 0, BSOD_TIME);
  } else if (name === 'dialup') {
    s.modem = MODEM_TIME;
    for (const p of players) p.slow = Math.max(p.slow || 0, MODEM_TIME);
  } else if (name === 'pipes') {
    s.pipes = { t: 0, heads: Array.from({ length: 3 }, () => ({ x: rnd(320, ARENA.w - 80), y: rnd(80, barTop() - 80), dir: Math.floor(Math.random() * 4), run: rnd(60, 220) })) };
  } else if (name === 'scandisk') {
    s.sweep = { t: 0, row: 0 };
  } else if (name === 'solitaire') {
    s.cascade = { t: 0, owner: null, team: null, dead: [] };  // nobody's safe when the computer wins
  } else if (name === 'clip') {
    const p = randomVictim(game);
    if (p) {
      s.fx.clip = { t: 0, dur: CLIP_TIME, pid: p.id, line: Math.floor(Math.random() * CLIP_LINE_COUNT) };
      p.invert = Math.max(p.invert || 0, 4);
    }
  } else if (name === 'toasters') {
    s.fx.toasters = { t: 0, dur: TOASTER_TIME, hit: {} };
  } else if (name === 'format') {
    const rows = Math.floor(barTop() / (8 * CELL));
    const bands = Array.from({ length: rows }, (_, i) => i).sort(() => Math.random() - 0.5);
    s.fx.format = { t: 0, dur: FORMAT_TIME, bands, next: 0 };
  } else if (name === 'printer') {
    const side = Math.random() < 0.5;
    s.fx.printer = { t: 0, dur: PRINTER_TIME, x: side ? 60 : ARENA.w - 60, y: Math.round(rnd(200, barTop() - 60)), next: 0.6 };
  } else if (name === 'ape') {
    const p = randomVictim(game);
    if (p) s.fx.ape = { t: 0, dur: APE_TIME, pid: p.id, x: -60, y: p.y };
  }
  emit(game, 'stageEvent', { name });
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function stepPipes(game, dt) {
  const s = game.stage, pipes = s.pipes;
  pipes.t += dt;
  if (pipes.t >= PIPE_TIME) {
    s.pipes = null;
    return;
  }
  for (const h of pipes.heads) {
    const step = 340 * dt;
    h.run -= step;
    h.x += DIRS[h.dir][0] * step;
    h.y += DIRS[h.dir][1] * step;
    const off = h.x < 30 || h.x > ARENA.w - 30 || h.y < 30 || h.y > barTop() - 30;
    if (off) {
      h.x = Math.max(30, Math.min(ARENA.w - 30, h.x));
      h.y = Math.max(30, Math.min(barTop() - 30, h.y));
    }
    if (h.run <= 0 || off) {
      h.dir = (h.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
      h.run = rnd(80, 260);
    }
    paintBlob(game, PAINT_SLOT, h.x, h.y, 9);
  }
  game.wallsVersion++;
}

function stepSweep(game, dt) {
  const s = game.stage, sweep = s.sweep;
  sweep.t += dt;
  const row = Math.floor((sweep.t / SWEEP_TIME) * (barTop() / CELL));
  let changed = false;
  for (let r = sweep.row; r < row; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c, slot = game.walls[i];
      if (!slot || slot === DESK_SLOT) continue;
      game.walls[i] = 0;
      game.wallLog?.push(i, 0);
      changed = true;
    }
  }
  sweep.row = row;
  if (changed) game.wallsVersion++;
  if (sweep.t >= SWEEP_TIME) s.sweep = null;
}

// Where card i of a Solitaire win is at time t, or null if it isn't flying yet / has left the screen.
export function cardAt(i, t) {
  const age = t - i * 0.4;
  if (age < 0) return null;
  const x = 1190 - (i % 4) * 40 - age * (120 + (i % 5) * 34);
  if (x < -40) return null;
  const floor = barTop() - 28;
  const y = floor - Math.abs(Math.cos(age * (2.1 + (i % 3) * 0.3))) * (floor - 30) * Math.exp(-age * 0.18);
  return { x, y };
}

function stepCascade(game, dt) {
  const s = game.stage, c = s.cascade;
  c.t += dt;
  if (c.t >= CASCADE_TIME + 3) {
    s.cascade = null;
    return;
  }
  for (let i = 0; i < CASCADE_CARDS; i++) {
    if (c.dead.includes(i)) continue;
    const at = cardAt(i, c.t);
    if (!at) continue;
    for (const p of Object.values(game.players)) {
      if (!p.alive || p.ghost > 0 || p.id === c.owner || (c.team && p.color === c.team)) continue;
      if (Math.hypot(p.x - at.x, p.y - at.y) >= 24 + playerRadius(p)) continue;
      // A card that touches someone blows up, hurting them and anyone standing around them.
      c.dead.push(i);
      explode(game, at.x, at.y, null, { ...CARD_BLAST, by: c.owner, team: c.team });
      break;
    }
  }
}

export function stepStage(game, dt) {
  const s = game.stage;
  if (!s?.ready) return;
  s.t += dt;
  for (const k of Object.keys(s.cooldowns)) s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
  if (s.bsod > 0) {                   // the whole machine is frozen
    const before = s.bsod;
    s.bsod = Math.max(0, s.bsod - dt);
    if (before > BSOD_OUT && s.bsod <= BSOD_OUT) emit(game, 'bsodOut', {});
    if (s.bsod === 0) emit(game, 'bsodEnd', {});
    return;
  }
  s.modem = Math.max(0, s.modem - dt);

  if (s.menu) {
    s.menu.t += dt;
    if (s.menu.t >= stageDef(game).menus[s.menu.kind].life) {
      s.menu = null;
      emit(game, 'menuClose', {});
    }
  }
  if (s.pipes) stepPipes(game, dt);
  if (s.sweep) stepSweep(game, dt);
  if (s.cascade) stepCascade(game, dt);
  for (const [name, e] of Object.entries(s.fx)) {
    e.t += dt;
    FX_STEP[name]?.(game, e, dt);
    if (e.t >= e.dur) delete s.fx[name];
  }
  stepApps(game, dt);

  // Pop-ups: walk on one to trigger it; ignored ones close by themselves.
  if (game.rules.popups) {
    if ((s.popupTimer -= dt) <= 0) {
      s.popupTimer = rnd(5, 6);
      if (s.popups.length < MAX_POPUPS) spawnPopup(game);
    }
  }
  for (const u of [...s.popups]) {
    u.life -= dt;
    let gone = u.life <= 0;
    for (const p of Object.values(game.players)) {
      if (gone || !p.alive) continue;
      if (p.x >= u.x && p.x < u.x + POPUP.w && p.y >= u.y && p.y < u.y + POPUP.h) {
        triggerPopup(game, p, u);
        gone = true;
      }
    }
    if (gone) s.popups = s.popups.filter((o) => o !== u);
  }

  if (game.rules.viruses) {
    if ((s.virusTimer -= dt) <= 0) {
      s.virusTimer = rnd(13, 20);
      if (s.viruses.length < MAX_VIRUSES) spawnVirus(game);
    }
  }
  for (const v of [...s.viruses]) stepVirus(game, v, dt);

  // Minesweeper mines: invisible to nobody, deadly to everyone but the team that laid them.
  for (const m of [...s.mines]) {
    m.life -= dt;
    let boom = false;
    for (const p of Object.values(game.players)) {
      if (!p.alive || p.ghost > 0 || p.id === m.owner || (m.team && p.color === m.team)) continue;
      if (Math.hypot(p.x - m.x, p.y - m.y) < MINE_RADIUS + playerRadius(p)) boom = true;
    }
    if (boom) explode(game, m.x, m.y, null, { damage: 3, radius: 70, by: m.owner, team: m.team });
    if (boom || m.life <= 0) s.mines = s.mines.filter((o) => o !== m);
  }

  if (game.rules.stageEvents && (s.eventTimer -= dt) <= 0) {
    s.eventTimer = rnd(13, 20);
    startEvent(game);
  }
}

// ---- network ----

// Only what the screen needs from each barged-in thing.
function encodeFx(fx) {
  const out = {};
  for (const [name, e] of Object.entries(fx)) {
    const { hit, bands, ...rest } = e;
    out[name] = { ...rest, t: Math.round(e.t * 10) / 10, ...(e.x !== undefined && { x: Math.round(e.x), y: Math.round(e.y) }) };
  }
  return out;
}

export function encodeStage(s) {
  if (!s) return null;
  return {
    fx: encodeFx(s.fx),
    rd: s.ready ? 1 : 0,
    t: Math.round(s.t * 10) / 10,
    pu: s.popups.map((u) => [u.id, u.kind, u.x, u.y, Math.round(u.life * 10) / 10]),
    v: s.viruses.map((v) => [v.id, v.kind, Math.round(v.x), Math.round(v.y), v.hp, v.born]),
    mi: s.mines.map((m) => [m.id, Math.round(m.x), Math.round(m.y)]),
    me: s.menu ? [s.menu.kind, Math.round(s.menu.t * 10) / 10] : 0,
    go: s.gone,
    sp: s.spent,
    ca: s.cascade ? [Math.round(s.cascade.t * 10) / 10, s.cascade.dead] : 0,
    ap: s.apps.map((a) => [a.id, a.kind, a.variant, a.x, a.y, a.w, a.h, Math.round(a.age * 10) / 10]),
    sw: s.sweep ? Math.round(s.sweep.t * 10) / 10 : -1,
    mo: Math.round(s.modem * 10) / 10,
    bs: Math.round(s.bsod * 10) / 10,
  };
}

export function applyStage(s, d) {
  if (!s || !d) return;
  s.ready = !!d.rd;
  s.t = d.t;
  s.popups = d.pu.map(([id, kind, x, y, life]) => ({ id, kind, x, y, life }));
  // Viruses glide between snapshots; everything else just lands where the host says.
  const old = new Map(s.viruses.map((v) => [v.id, v]));
  s.viruses = d.v.map(([id, kind, x, y, hp, born]) => {
    const v = old.get(id) || { id, kind, x, y, born };
    return Object.assign(v, { hp, tx: x, ty: y });
  });
  s.mines = d.mi.map(([id, x, y]) => ({ id, x, y }));
  s.menu = d.me ? { kind: d.me[0], t: d.me[1] } : null;
  s.gone = d.go;
  s.spent = d.sp;
  // Keep the smoothed clock of anything that's still running, so it doesn't stutter between snapshots.
  for (const [name, e] of Object.entries(d.fx)) {
    const was = s.fx[name];
    if (was && Math.abs(was.t - e.t) < 0.4) e.t = was.t;
  }
  s.fx = d.fx;
  s.cascade = d.ca ? { t: d.ca[0], dead: d.ca[1] } : null;
  s.apps = d.ap.map(([id, kind, variant, x, y, w, h, age]) => ({ id, kind, variant, x, y, w, h, age }));
  s.sweep = d.sw >= 0 ? { t: d.sw } : null;
  s.modem = d.mo;
  s.bsod = d.bs;
}

export function smoothStage(s, dt) {
  if (!s) return;
  const k = 1 - Math.exp(-dt * 14);
  for (const v of s.viruses) {
    v.x += (v.tx - v.x) * k;
    v.y += (v.ty - v.y) * k;
  }
  if (s.cascade) s.cascade.t += dt;
  if (s.sweep) s.sweep.t += dt;
  for (const a of s.apps) a.age += dt;
  for (const e of Object.values(s.fx)) {
    e.t += dt;
    if (e.vx) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }
  s.bsod = Math.max(0, s.bsod - dt);
}
