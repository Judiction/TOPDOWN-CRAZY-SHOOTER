// Pure game rules. No DOM, no networking — the host runs this; clients only mirror its results.

export const ARENA = { w: 1280, h: 720 };

// Walls live on a grid of small cells. One filled cell = one unit of ink.
// Each cell holds 0 (empty) or the slot number of the player who drew it.
export const CELL = 4;                // 2x2 screen pixels per cell at the game's pixel scale
export const COLS = ARENA.w / CELL;
export const ROWS = ARENA.h / CELL;

export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 260;      // px per second
export const MAX_HP = 10;             // default hits to die (host can change it: game.rules.maxHp)

export const BULLET_SPEED = 700;      // pistol bullet speed, px per second
export const BULLET_RADIUS = 4;
export const FIRE_COOLDOWN = 0.1;     // pistol: seconds between shots (10/sec)
export const MAG_SIZE = 60;
export const RELOAD_TIME = 2.4;       // seconds

export const PEN_CAPACITY = 1000;     // default ink (cells of 4x4) — about 1.5 walls across the arena
export const BRUSH_RADIUS = 7;        // px; walls are ~14px thick
export const BREAK_RADIUS = 10;       // px of wall a bullet knocks out on impact
const PAINT_CLEARANCE = 2;            // px kept free around every player and powerup

// ---- weapons ----
// The pistol is everyone's starting gun (magazine + reload). Weapon powerups replace it until their
// ammo runs out, then you're back to the pistol with the magazine you had.
export const WEAPONS = {
  pistol: { cooldown: FIRE_COOLDOWN },
  shotgun: { ammo: 60, perShot: 6, cooldown: 0.45, speed: BULLET_SPEED, pellets: 6, spread: 0.52 },  // 10 shots, 30° arc
  uzi: { ammo: 60, perShot: 1, cooldown: 0.06, speed: BULLET_SPEED * 2, range: 380, spread: 0.06 },
  rocket: { ammo: 3, perShot: 1, cooldown: 0.6, speed: BULLET_SPEED * 0.75 },
  laser: { ammo: 1, perShot: 1, cooldown: 0, charge: 0.45 },               // one huge beam after a short charge
  sniper: { ammo: 10, perShot: 1, cooldown: 0.8, speed: BULLET_SPEED * 3 },
  flamer: { ammo: 150, perShot: 1, cooldown: 0.03, speed: 600, spread: 0.25, life: 0.3 },
  grenade: { ammo: 10, perShot: 1, cooldown: 0.7, speed: 520, fuse: 1.5 },
};
export const WEAPON_TYPES = ['shotgun', 'uzi', 'rocket', 'laser', 'sniper', 'flamer', 'grenade'];
export const LASER_DAMAGE = 7;
export const LASER_WIDTH = 14;        // half-width of the beam, px
export const SNIPER_DAMAGE = 4;       // and it punches through painted walls
export const FLAME_BURN = 0.15;       // a player can be burned at most once per this many seconds
export const GRENADE_DAMAGE = 3;
export const GRENADE_RADIUS = 75;
const GRENADE_FRICTION = 0.9;         // grenades slow down as they roll
export const ROCKET_TURN = 3.2;       // radians per second a rocket can turn toward its target
export const ROCKET_LIFE = 5;         // seconds before a rocket that hit nothing blows up anyway
export const ROCKET_HIT_DAMAGE = 3;   // direct hit
export const EXPLOSION_DAMAGE = 2;    // everyone else caught in the blast (including the shooter!)
export const EXPLOSION_RADIUS = 60;
export const EXPLOSION_WALL_RADIUS = 30;

// ---- powerups ----
export const POWERUP_TYPES = [
  'fat', 'ricochet', 'small', 'defense', 'ghost', 'speed', 'inkrush', 'medkit',              // player effects
  'shotgun', 'uzi', 'rocket', 'laser', 'sniper', 'flamer', 'grenade',                        // weapons
  'eraser', 'meteor', 'blackout', 'gravity', 'paintbomb', 'mirror', 'inkstorm',             // map events
];
export const MAP_EVENTS = ['eraser', 'meteor', 'blackout', 'gravity', 'paintbomb', 'mirror', 'inkstorm'];
// Relative spawn chances; the map-wide events are rarer.
export const POWERUP_WEIGHTS = Object.fromEntries(POWERUP_TYPES.map((t) => [t, MAP_EVENTS.includes(t) ? 0.5 : 1]));
export const ROUND_START_POWERUPS = 4;
export const POWERUP_RADIUS = 20;
export const POWERUP_INTERVAL = 30;   // default seconds between random spawns (0 = powerups off)
export const MAX_POWERUPS = 6;        // no new spawns while this many are on the map
export const FAT_DURATION = 15;       // seconds of 2x brush
export const SMALL_DURATION = 15;     // seconds at half size
export const RICOCHET_SHOTS = 30;     // trigger pulls that ricochet (any gun except rockets)
export const RICOCHET_BOUNCES = 3;
export const SHIELD_COUNT = 12;
export const SHIELD_HITS = 2;         // hits each sphere takes before breaking
export const SHIELD_RADIUS = 5;
export const SHIELD_ORBIT = 14;       // px beyond the player's edge
export const SHIELD_SPIN = 4;         // radians per second
export const METEOR_COUNT = 6;        // strikes per METEORS pickup, one at a time
export const METEOR_FIRST = 0.4;      // seconds after pickup before the first warning circle
export const METEOR_GAP = 2;          // seconds between warnings (all six land within ~12 s)
export const METEOR_GROW = 1.8;       // seconds a warning circle grows before impact
export const METEOR_RADIUS = 80;
export const METEOR_DAMAGE = 5;
export const GHOST_DURATION = 8;      // invisible to others + walk through walls
export const SPEED_DURATION = 10;
export const SPEED_MULT = 1.68;
export const MEDKIT_HEAL = 5;
export const KILL_HEAL = 5;          // eliminating someone heals you this much
export const DEATH_BLAST_RADIUS = 90;  // every player explodes when they die...
export const DEATH_BLAST_DAMAGE = 2;  // ...hurting everyone caught in it and destroying walls

// Lobby playground: nobody takes damage, ink never runs out, and walls fade away on their own.
export const LOBBY_WALL_LIFE = 7;     // seconds a lobby wall lasts...
export const LOBBY_WALL_FADE = 3;     // ...the last few of which it spends fading out
export const BLACKOUT_DURATION = 8;
export const GRAVITY_DURATION = 6;
const GRAVITY_PULL = 40000;           // pull speed = GRAVITY_PULL / distance (px/s), capped below
const GRAVITY_MAX_PULL = 230;
export const MIRROR_DURATION = 8;
export const MIRROR_FLIP_TIME = 0.5;  // seconds of the flip animation at each end
export const PAINT_SPLATS = 30;
export const PAINT_SLOT = 255;        // wall cells from the paint bomb: nobody's, rainbow, ink for whoever breaks them
export const MAP_EVENT_MIN = 20;      // "random map events" setting: one fires every 20-30 s
export const MAP_EVENT_MAX = 30;
export const INK_STORM_FRACTION = 0.3;

// rules: the host's settings that change the simulation. firstEventId lets event ids keep rising
// across rounds, so listeners never mistake a new round's events for ones they already handled.
// lobby: the harmless playground players mess around in while waiting for the host.
export function createGame(rules = {}, { firstEventId = 1, lobby = false } = {}) {
  const r = {
    maxHp: rules.maxHp ?? MAX_HP,
    penCapacity: rules.penCapacity ?? PEN_CAPACITY,
    powerupInterval: rules.powerupInterval ?? POWERUP_INTERVAL,
    mapEvents: !!rules.mapEvents,
  };
  return {
    rules: r,
    lobby,
    wallTimes: lobby ? new Float32Array(COLS * ROWS) : null,   // lobby only: when each wall cell was drawn
    fadeTimer: 0,
    time: 0,                          // seconds since the round's game started
    players: {},
    bullets: [],
    nextBulletId: 1,
    walls: new Uint8Array(COLS * ROWS),
    wallsVersion: 0,                  // bumped on every wall change, so renderers know to redraw
    wallLog: null,                    // host sets this to an array to record [cell, value] changes for syncing
    powerups: [],
    nextPowerupId: 1,
    powerupTimer: r.powerupInterval,
    mapEventTimer: nextMapEventDelay(),
    meteors: [],                      // warning circles: { id, x, y, r, t, dur }
    blackout: null,                   // map events in progress: { t, dur } (+ x, y for gravity, axis for mirror)
    gravity: null,
    mirror: null,
    meteorQueue: [],                  // game times at which the next warnings appear
    nextMeteorId: 1,
    // Recent things that happened (shots, hits, pickups...), for sounds and effects. Each has a
    // rising id so listeners (and remote players) can tell which ones they've already handled.
    events: [],
    nextEventId: firstEventId,
    bgSeed: newBackgroundSeed(),      // picks this round's background art; the host sends it to everyone
  };
}

function nextMapEventDelay() {
  return MAP_EVENT_MIN + Math.random() * (MAP_EVENT_MAX - MAP_EVENT_MIN);
}

export function newBackgroundSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}

export function addPlayer(game, id, { name, color, x, y }) {
  // Slot = small number (1–255) stored in wall cells to remember who drew them.
  const used = new Set(Object.values(game.players).map((p) => p.slot));
  let slot = 1;
  while (used.has(slot)) slot++;
  // hitCount only ever goes up; renderers watch it to trigger the hit flash.
  game.players[id] = { id, slot, name, color, x, y, hitCount: 0 };
  respawnPlayer(game, id, x, y);
  return game.players[id];
}

export function respawnPlayer(game, id, x, y) {
  const p = game.players[id];
  if (!p) return;
  Object.assign(p, {
    x, y,
    aim: 0,
    hp: game.rules.maxHp,
    alive: true,
    cooldown: 0,
    ammo: MAG_SIZE,                   // pistol magazine
    reloading: 0,                     // seconds left; 0 = not reloading
    weapon: 'pistol',
    weaponAmmo: 0,                    // ammo left in a powerup weapon
    ink: game.rules.penCapacity,
    pen: null,                        // last pen point while a stroke is in progress
    fat: 0,                           // seconds of FAT WALLS left
    small: 0,                         // seconds of GET SMALL left
    ricochet: 0,                      // ricochet shots left
    ghost: 0,                         // seconds of GHOST left
    speed: 0,                         // seconds of SPEED BOOTS left
    charging: 0,                      // laser charge-up seconds left
    trigger: false,                   // was the shoot button already held last tick (for dry-fire clicks)
    burnUntil: 0,                     // game time before which flames can't burn this player again
    shields: null,                    // DEFENSE BALLS: hits left per sphere (0 = broken)
    orbit: 0,                         // current rotation of the shields
  });
}

export function playerRadius(p) {
  return p.small > 0 ? PLAYER_RADIUS / 2 : PLAYER_RADIUS;
}

export function brushRadius(p) {
  return p.fat > 0 ? BRUSH_RADIUS * 2 : BRUSH_RADIUS;
}

// Where each unbroken shield sphere currently is, and how many hits it has left.
export function shieldPositions(p) {
  if (!p.shields) return [];
  const orbit = playerRadius(p) + SHIELD_ORBIT;
  const out = [];
  p.shields.forEach((hits, i) => {
    if (hits <= 0) return;
    const a = p.orbit + (i / SHIELD_COUNT) * Math.PI * 2;
    out.push({ i, hits, x: p.x + Math.cos(a) * orbit, y: p.y + Math.sin(a) * orbit });
  });
  return out;
}

// A meteor warning circle grows from small to full size, then the meteor lands.
export function meteorRadius(m) {
  return m.r * (0.15 + 0.85 * Math.min(1, m.t / m.dur));
}

// How many times the warning has flashed so far: it starts at 2 flashes/s and speeds up to 14/s.
// Renderer and audio both use this, so the beeps line up with the flashes.
export function meteorFlashes(m) {
  const t = Math.min(m.t, m.dur);
  return Math.floor(2 * t + (6 * t * t) / m.dur);
}

// Mirror World: the current flip of the screen, from 1 (normal) through 0 to -1 (flipped) and back.
export function mirrorScale(m) {
  if (!m) return 1;
  const k = Math.min(1, m.t / MIRROR_FLIP_TIME, (m.dur - m.t) / MIRROR_FLIP_TIME);
  return Math.cos(Math.PI * Math.max(0, k));
}

// mx/my = cursor position in arena coordinates. click = left mouse held.
export function emptyInput() {
  return { up: false, down: false, left: false, right: false, mx: 0, my: 0, click: false, draw: false, reload: false };
}

const MAX_EVENTS = 128;

export function emit(game, type, data) {
  game.events.push({ id: game.nextEventId++, type, ...data });
}

// WASD movement with wall collision (+ speed boots and the gravity well's pull).
// Exported so clients can predict their own movement locally.
export function applyMovement(game, p, input, dt) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  const speed = PLAYER_SPEED * (p.speed > 0 ? SPEED_MULT : 1);
  const pull = gravityPull(game, p.x, p.y);
  movePlayer(game, p, (dx * speed + pull.x) * dt, (dy * speed + pull.y) * dt);
}

// Velocity the gravity well drags things at, toward its center.
function gravityPull(game, x, y) {
  const g = game.gravity;
  if (!g) return { x: 0, y: 0 };
  const d = Math.hypot(g.x - x, g.y - y) || 1;
  const v = Math.min(GRAVITY_MAX_PULL, GRAVITY_PULL / d);
  return { x: ((g.x - x) / d) * v, y: ((g.y - y) / d) * v };
}

export function step(game, inputs, dt) {
  if (game.events.length > MAX_EVENTS) game.events.splice(0, game.events.length - MAX_EVENTS);
  game.time += dt;

  for (const p of Object.values(game.players)) {
    if (!p.alive) continue;
    const input = inputs[p.id] || emptyInput();

    p.fat = Math.max(0, p.fat - dt);
    p.small = Math.max(0, p.small - dt);
    p.ghost = Math.max(0, p.ghost - dt);
    p.speed = Math.max(0, p.speed - dt);
    if (p.shields) p.orbit = (p.orbit + SHIELD_SPIN * dt) % (Math.PI * 2);

    applyMovement(game, p, input, dt);
    p.aim = Math.atan2(input.my - p.y, input.mx - p.x);
    collectPowerups(game, p);
    if (!p.alive) continue;

    // The pistol magazine reloads in the background even while holding a powerup weapon.
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) {
        p.reloading = 0;
        p.ammo = MAG_SIZE;
        emit(game, 'reloaded', { x: p.x, y: p.y });
      }
    } else if (input.reload && p.weapon === 'pistol' && p.ammo < MAG_SIZE) {
      p.reloading = RELOAD_TIME;
      emit(game, 'reload', { x: p.x, y: p.y });
    }

    if (input.draw) {
      if (input.click) paintStroke(game, p, input.mx, input.my);
      else p.pen = null;
    } else {
      p.pen = null;
      // Small epsilon: repeated float subtraction leaves crumbs like 1e-17 that would cost an extra tick.
      const ready = input.click && p.cooldown < 1e-6 && p.charging === 0;
      if (ready && (p.weapon !== 'pistol' || (p.reloading === 0 && p.ammo > 0))) shoot(game, p);
      // Pulling the trigger with an empty, reloading pistol: dry-fire click (once per pull).
      else if (input.click && !p.trigger && p.weapon === 'pistol' && (p.reloading > 0 || p.ammo === 0)) {
        emit(game, 'dry', { x: p.x, y: p.y });
      }
    }
    p.trigger = !!input.click;

    // Laser charge-up: the beam fires where you're aiming when the charge completes.
    if (p.charging > 0) {
      p.charging = Math.max(0, p.charging - dt);
      if (p.charging === 0) fireLaser(game, p);
    }
  }

  stepBullets(game, dt);
  stepMeteors(game, dt);
  if (game.lobby) stepLobby(game, dt);
  for (const key of ['blackout', 'gravity', 'mirror']) {
    const e = game[key];
    if (e && (e.t += dt) >= e.dur) game[key] = null;
  }

  if (game.rules.powerupInterval > 0) game.powerupTimer -= dt;
  if (game.rules.powerupInterval > 0 && game.powerupTimer <= 0) {
    game.powerupTimer += game.rules.powerupInterval;
    if (game.powerups.length < MAX_POWERUPS) {
      const spot = findFreeSpot(game);
      spawnPowerup(game, randomPowerupType(), spot.x, spot.y);
    }
  }

  // Random map events: every 20-30 s one goes off by itself, as if someone had grabbed it.
  if (game.rules.mapEvents && !game.lobby && (game.mapEventTimer -= dt) <= 0) {
    game.mapEventTimer = nextMapEventDelay();
    const kind = MAP_EVENTS[Math.floor(Math.random() * MAP_EVENTS.length)];
    emit(game, 'pickup', { kind, x: ARENA.w / 2, y: ARENA.h / 2, random: true });
    applyPowerup(game, null, kind);
  }
}

// Picks a random spot that isn't inside a wall, a player or a powerup.
export function findFreeSpot(game) {
  const m = PLAYER_RADIUS + 10;
  for (let i = 0; i < 200; i++) {
    const x = m + Math.random() * (ARENA.w - 2 * m);
    const y = m + Math.random() * (ARENA.h - 2 * m);
    const crowded =
      Object.values(game.players).some((p) => p.alive && Math.hypot(p.x - x, p.y - y) < PLAYER_RADIUS * 3) ||
      game.powerups.some((u) => Math.hypot(u.x - x, u.y - y) < POWERUP_RADIUS * 3);
    if (!crowded && !circleHitsWall(game, x, y, PLAYER_RADIUS + PAINT_CLEARANCE)) return { x, y };
  }
  return { x: ARENA.w / 2, y: ARENA.h / 2 };
}

// ---- powerups ----

export function randomPowerupType() {
  const total = POWERUP_TYPES.reduce((s, t) => s + POWERUP_WEIGHTS[t], 0);
  let roll = Math.random() * total;
  for (const t of POWERUP_TYPES) {
    roll -= POWERUP_WEIGHTS[t];
    if (roll <= 0) return t;
  }
  return POWERUP_TYPES[0];
}

export function spawnPowerup(game, type, x, y, { silent = false } = {}) {
  const u = { id: game.nextPowerupId++, type, x, y };
  game.powerups.push(u);
  if (!silent) emit(game, 'spawn', { kind: type, x, y });
  return u;
}

function collectPowerups(game, p) {
  const reach = playerRadius(p) + POWERUP_RADIUS;
  const grabbed = [];
  game.powerups = game.powerups.filter((u) => {
    if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 > reach * reach) return true;
    grabbed.push(u);
    return false;
  });
  for (const u of grabbed) {
    emit(game, 'pickup', { kind: u.type, x: u.x, y: u.y, pid: p.id });
    applyPowerup(game, p, u.type);
  }
}

// Picking up a powerup you already have refreshes it.
function applyPowerup(game, p, type) {
  if (type === 'fat') p.fat = FAT_DURATION;
  else if (type === 'small') p.small = SMALL_DURATION;
  else if (type === 'ricochet') {
    p.ammo = MAG_SIZE;
    p.reloading = 0;
    p.ricochet = RICOCHET_SHOTS;
  } else if (type === 'defense') p.shields = new Array(SHIELD_COUNT).fill(SHIELD_HITS);
  else if (WEAPONS[type]) {
    p.weapon = type;
    p.weaponAmmo = WEAPONS[type].ammo;
    p.cooldown = 0;
  } else if (type === 'ghost') p.ghost = GHOST_DURATION;
  else if (type === 'speed') p.speed = SPEED_DURATION;
  else if (type === 'medkit') {
    healPlayer(game, p, MEDKIT_HEAL);
  } else if (type === 'inkrush') {
    // Pen refills; your walls stay. Ink coming back from them later is still capped by the pen size.
    p.ink = game.rules.penCapacity;
    emit(game, 'inkRush', { pid: p.id, x: p.x, y: p.y });
  } else if (type === 'blackout') {
    game.blackout = { t: 0, dur: BLACKOUT_DURATION };
    emit(game, 'blackout', {});
  } else if (type === 'gravity') {
    game.gravity = { x: ARENA.w / 2, y: ARENA.h / 2, t: 0, dur: GRAVITY_DURATION };
    emit(game, 'gravity', {});
  } else if (type === 'mirror') {
    game.mirror = { axis: Math.random() < 0.5 ? 'x' : 'y', t: 0, dur: MIRROR_DURATION };
    emit(game, 'mirror', { axis: game.mirror.axis });
  } else if (type === 'paintbomb') paintBomb(game);
  else if (type === 'inkstorm') inkStorm(game);
  else if (type === 'eraser') eraseWalls(game);
  else if (type === 'meteor') {
    // Queue up the strikes after any that are already coming.
    let at = Math.max(game.time + METEOR_FIRST, ...game.meteorQueue.map((t) => t + METEOR_GAP));
    for (let i = 0; i < METEOR_COUNT; i++, at += METEOR_GAP) game.meteorQueue.push(at);
  }
}

// ERASER: every wall vanishes and every pen refills.
function eraseWalls(game) {
  game.walls.fill(0);
  game.wallsVersion++;
  game.wallLog?.push(-1, 0);          // "-1" = clear everything (see netsync)
  for (const p of Object.values(game.players)) p.ink = game.rules.penCapacity;
  emit(game, 'erase', {});
}

// Lobby: pens never run dry, and walls older than LOBBY_WALL_LIFE disappear (the renderer fades
// them out beforehand). Checked a few times a second, which is plenty.
function stepLobby(game, dt) {
  for (const p of Object.values(game.players)) p.ink = game.rules.penCapacity;
  if ((game.fadeTimer += dt) < 0.25) return;
  game.fadeTimer = 0;
  let changed = false;
  for (let i = 0; i < game.walls.length; i++) {
    if (!game.walls[i] || game.time - game.wallTimes[i] < LOBBY_WALL_LIFE) continue;
    game.walls[i] = 0;
    game.wallTimes[i] = 0;
    game.wallLog?.push(i, 0);
    changed = true;
  }
  if (changed) game.wallsVersion++;
}

// PAINT BOMB: rainbow splats all over the map. They belong to nobody: whoever breaks them gets the ink.
// Splats are spread out on a jittered grid so they cover the whole arena instead of clumping.
function paintBomb(game) {
  const cols = 6, rows = Math.ceil(PAINT_SPLATS / cols);
  const cw = (ARENA.w - 80) / cols, ch = (ARENA.h - 80) / rows;
  for (let i = 0; i < PAINT_SPLATS; i++) {
    const x = 40 + ((i % cols) + Math.random()) * cw, y = 40 + (Math.floor(i / cols) + Math.random()) * ch;
    const r = 12 + Math.random() * 22;
    paintBlob(game, PAINT_SLOT, x, y, r);
    // Droplets around each splat.
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, d = r + 5 + Math.random() * 24;
      paintBlob(game, PAINT_SLOT, x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + Math.random() * 6);
    }
  }
  game.wallsVersion++;
  emit(game, 'paintbomb', {});
}

function paintBlob(game, slot, x, y, radius) {
  const keepClear = clearZones(game);
  forCellsAround(x, y, radius, (c, r, idx) => {
    if (game.walls[idx]) return;
    if (((c + 0.5) * CELL - x) ** 2 + ((r + 0.5) * CELL - y) ** 2 > radius * radius) return;
    if (keepClear.some((k) => circleOverlapsCell(k.x, k.y, k.r + PAINT_CLEARANCE, c, r))) return;
    game.walls[idx] = slot;
    game.wallLog?.push(idx, slot);
    if (game.wallTimes) game.wallTimes[idx] = game.time;   // lobby: fades like any other wall
  });
}

// INK STORM: every wall loses a random chunk of its cells (ink goes back to the drawers, capped).
function inkStorm(game) {
  const owners = playersBySlot(game);
  for (let i = 0; i < game.walls.length; i++) {
    const slot = game.walls[i];
    if (!slot || Math.random() >= INK_STORM_FRACTION) continue;
    game.walls[i] = 0;
    game.wallLog?.push(i, 0);
    const drawer = owners[slot];
    if (drawer) returnInk(game, drawer);
  }
  game.wallsVersion++;
  emit(game, 'inkstorm', {});
}

// ---- meteors ----

function stepMeteors(game, dt) {
  while (game.meteorQueue.length && game.meteorQueue[0] <= game.time) {
    game.meteorQueue.shift();
    const m = METEOR_RADIUS * 0.5;
    game.meteors.push({
      id: game.nextMeteorId++,
      x: m + Math.random() * (ARENA.w - 2 * m),
      y: m + Math.random() * (ARENA.h - 2 * m),
      r: METEOR_RADIUS,
      t: 0,
      dur: METEOR_GROW,
    });
  }
  game.meteors = game.meteors.filter((m) => {
    m.t += dt;
    if (m.t < m.dur) return true;
    // Impact: anyone inside or touching the circle takes heavy damage; walls inside are blasted.
    for (const p of Object.values(game.players)) {
      if (p.alive && Math.hypot(p.x - m.x, p.y - m.y) <= m.r + playerRadius(p)) hurtPlayer(game, p, METEOR_DAMAGE);
    }
    chip(game, m.x, m.y, breakWall(game, m.x, m.y, m.r), true);
    emit(game, 'meteor', { x: m.x, y: m.y, r: m.r });
    return false;
  });
}

// ---- shooting ----

function shoot(game, p) {
  const kind = p.weapon;
  const def = WEAPONS[kind];
  p.cooldown = def.cooldown;
  const ricochet = kind !== 'rocket' && p.ricochet > 0;
  if (ricochet) p.ricochet -= 1;
  emit(game, 'shoot', { x: p.x, y: p.y, w: kind, ricochet, pid: p.id, a: Math.round(p.aim * 100) / 100 });

  if (kind === 'pistol') {
    p.ammo -= 1;
    if (p.ammo === 0) {
      p.reloading = RELOAD_TIME;
      emit(game, 'dry', { x: p.x, y: p.y });          // click: that was the last round
      emit(game, 'reload', { x: p.x, y: p.y });
    }
    fire(game, p, p.aim, BULLET_SPEED, { ricochet });
    return;
  }

  if (kind === 'shotgun') {
    for (let i = 0; i < def.pellets; i++) {
      fire(game, p, p.aim + (i / (def.pellets - 1) - 0.5) * def.spread, def.speed, { kind: 'pellet', ricochet });
    }
  } else if (kind === 'uzi') {
    fire(game, p, p.aim + (Math.random() * 2 - 1) * def.spread, def.speed, { kind: 'uzi', ricochet, range: def.range });
  } else if (kind === 'rocket') {
    fire(game, p, p.aim, def.speed, { kind: 'rocket' });
  } else if (kind === 'sniper') {
    fire(game, p, p.aim, def.speed, { kind: 'sniper' });
  } else if (kind === 'flamer') {
    const speed = def.speed * (0.8 + Math.random() * 0.4);
    fire(game, p, p.aim + (Math.random() * 2 - 1) * def.spread, speed, { kind: 'flame', ricochet, life: def.life });
  } else if (kind === 'grenade') {
    fire(game, p, p.aim, def.speed, { kind: 'grenade', life: def.fuse });
  } else if (kind === 'laser') {
    p.charging = def.charge;          // the beam fires when the charge completes (see step)
    emit(game, 'laserCharge', { x: p.x, y: p.y });
  }
  p.weaponAmmo -= def.perShot;
  if (p.weaponAmmo <= 0 && kind !== 'laser') {
    p.weapon = 'pistol';
    p.weaponAmmo = 0;
    emit(game, 'dry', { x: p.x, y: p.y });            // click: the powerup weapon is empty
  }
}

// LASER: an instant beam from the shooter to the arena edge. It cuts every wall on its path and
// hits every player on the line (not the shooter). Shields don't stop it.
function fireLaser(game, p) {
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  const tx = dx > 0 ? (ARENA.w - p.x) / dx : dx < 0 ? -p.x / dx : Infinity;
  const ty = dy > 0 ? (ARENA.h - p.y) / dy : dy < 0 ? -p.y / dy : Infinity;
  const len = Math.min(tx, ty);
  const x2 = p.x + dx * len, y2 = p.y + dy * len;
  let lastChip = -Infinity;
  for (let d = 0; d <= len; d += CELL * 2) {
    const slot = breakWall(game, p.x + dx * d, p.y + dy * d, LASER_WIDTH, p.id);
    if (slot && d - lastChip > 40) {
      chip(game, p.x + dx * d, p.y + dy * d, slot);
      lastChip = d;
    }
  }
  for (const o of Object.values(game.players)) {
    if (!o.alive || o.id === p.id || (p.color && o.color === p.color)) continue;    // not the shooter's team
    const along = Math.max(0, Math.min(len, (o.x - p.x) * dx + (o.y - p.y) * dy));
    const miss = Math.hypot(o.x - (p.x + dx * along), o.y - (p.y + dy * along));
    if (miss <= LASER_WIDTH + playerRadius(o)) hurtPlayer(game, o, LASER_DAMAGE, p.id);
  }
  emit(game, 'laser', { x: p.x, y: p.y, x2, y2, color: p.color });
  p.weapon = 'pistol';
  p.weaponAmmo = 0;
}

// Bullets start at the player's center (never inside a wall) and travel out from there.
function fire(game, p, angle, speed, { kind = 'pistol', ricochet = false, range = Infinity, life = Infinity } = {}) {
  game.bullets.push({
    id: game.nextBulletId++,
    owner: p.id,
    team: p.color,                    // same color = same team: teammates can't hurt each other
    kind,
    x: p.x,
    y: p.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ricochet,
    bounces: ricochet ? RICOCHET_BOUNCES : 0,
    bounced: false,                   // a ricochet bullet can hurt its own shooter once it has bounced
    range,                            // px left before it fizzles (uzi)
    travel: 0,                        // px flown so far (bullets fade yellow → red with distance)
    life: kind === 'rocket' ? ROCKET_LIFE : life,     // seconds left: rocket timeout, flame burnout, grenade fuse
  });
}

function canHurt(b, p) {
  return p.alive && (p.id !== b.owner || b.bounced);
}

// A teammate of whoever fired/caused something (but not that player themselves).
function isTeammate(p, team, ownerId) {
  return !!team && p.color === team && p.id !== ownerId;
}

// Rockets turn (at a limited rate) toward the nearest living enemy.
function steerRocket(game, b, dt) {
  let target = null, best = Infinity;
  for (const p of Object.values(game.players)) {
    if (!p.alive || p.id === b.owner || p.ghost > 0 || isTeammate(p, b.team, b.owner)) continue;   // not teammates, not ghosts
    const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
    if (d < best) {
      best = d;
      target = p;
    }
  }
  if (!target) return;
  const speed = Math.hypot(b.vx, b.vy);
  const heading = Math.atan2(b.vy, b.vx);
  let diff = Math.atan2(target.y - b.y, target.x - b.x) - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));                  // wrap to -π..π
  const turn = Math.max(-ROCKET_TURN * dt, Math.min(ROCKET_TURN * dt, diff));
  b.vx = Math.cos(heading + turn) * speed;
  b.vy = Math.sin(heading + turn) * speed;
}

function stepBullets(game, dt) {
  const players = Object.values(game.players);
  game.bullets = game.bullets.filter((b) => {
    const kind = b.kind;
    if (kind === 'rocket') steerRocket(game, b, dt);
    if (kind === 'grenade') {
      const f = Math.exp(-GRENADE_FRICTION * dt);
      b.vx *= f;
      b.vy *= f;
    }
    if (game.gravity) {
      // The gravity well bends everything that flies.
      const pull = gravityPull(game, b.x, b.y);
      b.vx += pull.x * 4 * dt;
      b.vy += pull.y * 4 * dt;
    }
    if (b.life !== Infinity) {
      b.life -= dt;
      if (b.life <= 0) {
        if (kind === 'rocket') explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
        else if (kind === 'grenade') explode(game, b.x, b.y, null, { damage: GRENADE_DAMAGE, radius: GRENADE_RADIUS, by: b.owner, team: b.team });
        return false;                 // flames just burn out
      }
    }
    // Bullets move faster than a cell per tick, so march them in small sub-steps to avoid skipping through walls.
    const speed = Math.hypot(b.vx, b.vy);
    const sub = Math.max(1, Math.ceil((speed * dt) / (CELL / 2)));
    for (let i = 0; i < sub; i++) {
      const px = b.x, py = b.y;
      b.x += (b.vx * dt) / sub;
      b.y += (b.vy * dt) / sub;
      b.travel += (speed * dt) / sub;
      if (b.range !== Infinity) {
        b.range -= (speed * dt) / sub;
        if (b.range <= 0) return false;
      }

      // Arena edge: rockets blow up, grenades and ricochet rounds bounce, everything else vanishes.
      const outX = b.x < 0 || b.x >= ARENA.w;
      const outY = b.y < 0 || b.y >= ARENA.h;
      if (outX || outY) {
        if (kind === 'rocket') {
          explode(game, clamp(b.x, 0, ARENA.w - 1), clamp(b.y, 0, ARENA.h - 1), null, { by: b.owner, team: b.team });
          return false;
        }
        if (kind === 'grenade') {
          if (outX) b.vx = -b.vx;
          if (outY) b.vy = -b.vy;
          b.x = px;
          b.y = py;
          emit(game, 'bounce', { x: b.x, y: b.y });
          continue;
        }
        if (b.bounces <= 0) return false;
        if (outX) b.vx = -b.vx;
        if (outY) b.vy = -b.vy;
        bounce(b, px, py);
        emit(game, 'bounce', { x: b.x, y: b.y });
        continue;
      }

      if (wallAt(game, b.x, b.y)) {
        if (kind === 'rocket') {
          explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
          return false;
        }
        if (kind === 'sniper') {
          chip(game, b.x, b.y, breakWall(game, b.x, b.y, 6, b.owner));   // punches straight through, leaving a small hole
          continue;
        }
        if (kind === 'flame') {
          chip(game, b.x, b.y, breakWall(game, b.x, b.y, 7, b.owner));   // flames eat walls fast
          return false;
        }
        // Work out which side was hit (before breaking it), so we know which way to reflect.
        const sideX = wallAt(game, b.x, py);
        const sideY = wallAt(game, px, b.y);
        if (kind === 'grenade') {
          reflect(b, sideX, sideY);
          b.x = px;
          b.y = py;
          emit(game, 'bounce', { x: b.x, y: b.y });
          continue;
        }
        const slot = breakWall(game, b.x, b.y, BREAK_RADIUS, b.owner);
        emit(game, 'wall', { x: b.x, y: b.y });
        chip(game, b.x, b.y, slot);
        if (b.bounces <= 0) return false;
        reflect(b, sideX, sideY);
        bounce(b, px, py);
        continue;
      }

      for (const p of players) {
        if (!canHurt(b, p)) continue;
        // Teammates block each other's shots without taking damage (flames and grenades pass through).
        const friendly = isTeammate(p, b.team, b.owner);
        if (friendly && (kind === 'flame' || kind === 'grenade')) continue;

        // Shield spheres catch bullets before they reach the player. Each sphere stops SHIELD_HITS bullets.
        const sr = SHIELD_RADIUS + BULLET_RADIUS;
        const sphere = shieldPositions(p).find((s) => (s.x - b.x) ** 2 + (s.y - b.y) ** 2 <= sr * sr);
        if (sphere && friendly) {
          if (kind === 'rocket') explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
          return false;
        }
        if (sphere) {
          p.shields[sphere.i] -= 1;
          emit(game, 'shield', { x: b.x, y: b.y, broke: p.shields[sphere.i] <= 0 });
          if (p.shields.every((hits) => hits <= 0)) p.shields = null;
          if (kind === 'rocket') explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
          if (kind === 'grenade') explode(game, b.x, b.y, null, { damage: GRENADE_DAMAGE, radius: GRENADE_RADIUS, by: b.owner, team: b.team });
          return false;
        }

        // Bullets never ricochet off players — they just hit.
        const r = playerRadius(p) + BULLET_RADIUS;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 > r * r) continue;
        if (friendly) {
          if (kind === 'rocket') explode(game, b.x, b.y, null, { by: b.owner, team: b.team });
          return false;
        }
        if (kind === 'flame') {
          // Flames pass through players, burning them at a limited rate.
          if (game.time >= p.burnUntil) {
            p.burnUntil = game.time + FLAME_BURN;
            hurtPlayer(game, p, 1, b.owner);
          }
          continue;
        }
        if (kind === 'rocket') {
          hurtPlayer(game, p, ROCKET_HIT_DAMAGE, b.owner);
          explode(game, b.x, b.y, p, { by: b.owner, team: b.team });
        } else if (kind === 'grenade') {
          explode(game, b.x, b.y, null, { damage: GRENADE_DAMAGE, radius: GRENADE_RADIUS, by: b.owner, team: b.team });
        } else {
          hurtPlayer(game, p, kind === 'sniper' ? SNIPER_DAMAGE : 1, b.owner);
        }
        return false;
      }
    }
    return true;
  });
}

function reflect(b, sideX, sideY) {
  if (sideX) b.vx = -b.vx;
  if (sideY) b.vy = -b.vy;
  if (!sideX && !sideY) {
    // Hit a corner head-on.
    b.vx = -b.vx;
    b.vy = -b.vy;
  }
}

// Blast (rockets, grenades): chews a big hole in walls and hurts everyone nearby — the shooter too.
// `direct` already took the direct-hit damage, so the blast skips them.
function explode(game, x, y, direct, { damage = EXPLOSION_DAMAGE, radius = EXPLOSION_RADIUS, by = null, team = null } = {}) {
  chip(game, x, y, breakWall(game, x, y, EXPLOSION_WALL_RADIUS * (radius / EXPLOSION_RADIUS), by), true);
  for (const p of Object.values(game.players)) {
    if (!p.alive || p === direct || isTeammate(p, team, by)) continue;
    if (Math.hypot(p.x - x, p.y - y) <= radius + playerRadius(p)) hurtPlayer(game, p, damage, by);
  }
  emit(game, 'explode', { x, y, r: radius });
}

// Takes hit points away (bullets, explosions, meteors, sudden death). `by` = who did it, if anyone:
// eliminating another player heals you.
export function hurtPlayer(game, p, amount = 1, by = null) {
  if (!p.alive) return;
  if (game.lobby) {
    // Lobby: hits flash and make noise, but nobody gets hurt.
    p.hitCount += 1;
    emit(game, 'hit', { x: p.x, y: p.y });
    return;
  }
  p.hp -= amount;
  p.hitCount += 1;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    emit(game, 'death', { x: p.x, y: p.y, by });
    const killer = by && by !== p.id ? game.players[by] : null;
    if (killer?.alive) healPlayer(game, killer, KILL_HEAL);
    deathBlast(game, p, by);
  } else {
    emit(game, 'hit', { x: p.x, y: p.y });
  }
}

// A dying player blows up: walls in the circle are destroyed and everyone else inside or touching it
// takes damage. Kills it causes (chain reactions!) count for whoever got the original kill.
function deathBlast(game, p, by) {
  const r = DEATH_BLAST_RADIUS;
  emit(game, 'deathBlast', { x: p.x, y: p.y, r, color: p.color });
  chip(game, p.x, p.y, breakWall(game, p.x, p.y, r, by), true);
  for (const o of Object.values(game.players)) {
    if (o === p || !o.alive || (p.color && o.color === p.color)) continue;          // teammates are spared
    if (Math.hypot(o.x - p.x, o.y - p.y) <= r + playerRadius(o)) hurtPlayer(game, o, DEATH_BLAST_DAMAGE, by);
  }
}

export function healPlayer(game, p, amount) {
  const gained = Math.min(game.rules.maxHp - p.hp, amount);
  if (gained <= 0) return;
  p.hp += gained;
  emit(game, 'heal', { pid: p.id, x: p.x, y: p.y, amount: gained });
}

// True if nothing painted blocks the straight line between two points (used by bots).
export function lineOfSight(game, x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / CELL);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (wallAt(game, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

function bounce(b, px, py) {
  b.x = px;
  b.y = py;
  b.bounces -= 1;
  b.bounced = true;
}

// Knocks out wall cells around the impact. Anyone can break any wall, but each broken cell's ink
// goes back to the player who drew it (or their team, see returnInk). Ink from a player who left is lost.
// Paint bomb cells belong to nobody: their ink goes to `by`, whoever broke them (if anyone).
// Returns the slot of a wall it broke (for the chip particles), or 0 if there was nothing to break.
function breakWall(game, x, y, radius = BREAK_RADIUS, by = null) {
  const owners = playersBySlot(game);
  if (by != null && game.players[by]) owners[PAINT_SLOT] = game.players[by];
  let changed = false, hitSlot = 0;
  forCellsAround(x, y, radius, (c, r, idx) => {
    const slot = game.walls[idx];
    if (!slot) return;
    if (((c + 0.5) * CELL - x) ** 2 + ((r + 0.5) * CELL - y) ** 2 > radius * radius) return;
    game.walls[idx] = 0;
    game.wallLog?.push(idx, 0);
    const drawer = owners[slot];
    if (drawer) returnInk(game, drawer);
    changed = true;
    hitSlot = slot;
  });
  if (changed) game.wallsVersion++;
  return hitSlot;
}

// Little pixel chips flying off a wall that just got hit (purely visual; `big` for blasts).
function chip(game, x, y, slot, big = false) {
  if (slot) emit(game, 'chip', { x: Math.round(x), y: Math.round(y), slot, big });
}

// One cell of a broken wall's ink goes back to whoever drew it. If their pen is full (or they're out
// of the round), it flows to the living teammate with the emptiest pen instead, so a team never
// wastes ink. It's only lost when the whole team is full.
function returnInk(game, drawer) {
  const cap = game.rules.penCapacity;
  if (drawer.alive && drawer.ink < cap) {
    drawer.ink += 1;
    return;
  }
  if (!drawer.color) return;
  let best = null;
  for (const p of Object.values(game.players)) {
    if (p === drawer || !p.alive || p.color !== drawer.color || p.ink >= cap) continue;
    if (!best || p.ink < best.ink) best = p;
  }
  if (best) best.ink += 1;
}

function playersBySlot(game) {
  const bySlot = {};
  for (const p of Object.values(game.players)) bySlot[p.slot] = p;
  return bySlot;
}

// ---- drawing walls ----

function paintStroke(game, p, x, y) {
  x = clamp(x, 0, ARENA.w - 1);
  y = clamp(y, 0, ARENA.h - 1);
  // Fill the gap between this tick's cursor and last tick's, so fast mouse moves still make a solid line.
  const from = p.pen || { x, y };
  const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (CELL / 2)));
  for (let i = 0; i <= steps && p.ink > 0; i++) {
    const t = i / steps;
    paintDot(game, p, from.x + (x - from.x) * t, from.y + (y - from.y) * t);
  }
  p.pen = { x, y };
}

// Never paint on top of a player or a powerup — the wall flows around them instead.
function clearZones(game) {
  return [
    ...Object.values(game.players).filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, r: playerRadius(p) })),
    ...game.powerups.map((u) => ({ x: u.x, y: u.y, r: POWERUP_RADIUS })),
  ];
}

function paintDot(game, painter, x, y) {
  const keepClear = clearZones(game);
  const brush = brushRadius(painter);
  let changed = false;
  forCellsAround(x, y, brush, (c, r, idx) => {
    if (painter.ink <= 0 || game.walls[idx]) return;
    if (((c + 0.5) * CELL - x) ** 2 + ((r + 0.5) * CELL - y) ** 2 > brush * brush) return;
    if (keepClear.some((k) => circleOverlapsCell(k.x, k.y, k.r + PAINT_CLEARANCE, c, r))) return;
    game.walls[idx] = painter.slot;
    game.wallLog?.push(idx, painter.slot);
    if (game.wallTimes) game.wallTimes[idx] = game.time;
    painter.ink -= 1;
    changed = true;
  });
  if (changed) game.wallsVersion++;
}

// ---- movement + collision ----

function movePlayer(game, p, dx, dy) {
  const R = playerRadius(p);
  if (p.ghost > 0) {
    // Ghosts drift straight through walls.
    p.x = clamp(p.x + dx, R, ARENA.w - R);
    p.y = clamp(p.y + dy, R, ARENA.h - R);
    return;
  }
  // Safety valve: if a player ends up overlapping a wall (e.g. growing back from GET SMALL next to one),
  // let them move freely until they're out.
  const stuck = circleHitsWall(game, p.x, p.y, R);
  // Move one axis at a time so players slide along walls instead of sticking.
  const nx = clamp(p.x + dx, R, ARENA.w - R);
  if (stuck || !circleHitsWall(game, nx, p.y, R)) p.x = nx;
  const ny = clamp(p.y + dy, R, ARENA.h - R);
  if (stuck || !circleHitsWall(game, p.x, ny, R)) p.y = ny;
}

function circleHitsWall(game, x, y, radius) {
  let hit = false;
  forCellsAround(x, y, radius, (c, r, idx) => {
    if (!hit && game.walls[idx] && circleOverlapsCell(x, y, radius, c, r)) hit = true;
  });
  return hit;
}

function wallAt(game, x, y) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && game.walls[r * COLS + c] !== 0;
}

function circleOverlapsCell(x, y, radius, c, r) {
  const nx = clamp(x, c * CELL, (c + 1) * CELL);
  const ny = clamp(y, r * CELL, (r + 1) * CELL);
  return (x - nx) ** 2 + (y - ny) ** 2 < radius * radius;
}

function forCellsAround(x, y, radius, fn) {
  const c0 = Math.max(0, Math.floor((x - radius) / CELL));
  const c1 = Math.min(COLS - 1, Math.floor((x + radius) / CELL));
  const r0 = Math.max(0, Math.floor((y - radius) / CELL));
  const r1 = Math.min(ROWS - 1, Math.floor((y + radius) / CELL));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) fn(c, r, r * COLS + c);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
