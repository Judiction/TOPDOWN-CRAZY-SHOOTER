// Pure game rules. No DOM, no networking — the host will run this same code later.

export const ARENA = { w: 1280, h: 720 };

// Walls live on a grid of small cells. One filled cell = one unit of ink.
// Each cell holds 0 (empty) or the slot number of the player who drew it.
export const CELL = 4;                // 2x2 screen pixels per cell at the game's pixel scale
export const COLS = ARENA.w / CELL;
export const ROWS = ARENA.h / CELL;

export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 260;      // px per second
export const MAX_HP = 10;             // default hits to die (host can change it: game.rules.maxHp)

export const BULLET_SPEED = 700;      // px per second
export const BULLET_RADIUS = 4;
export const FIRE_COOLDOWN = 0.1;     // seconds between shots (10/sec)
export const MAG_SIZE = 60;
export const RELOAD_TIME = 3;         // seconds

export const PEN_CAPACITY = 625;      // default ink (cells of 4x4) — roughly half a wall across the arena
export const BRUSH_RADIUS = 7;        // px; walls are ~14px thick
export const BREAK_RADIUS = 10;       // px of wall a bullet knocks out on impact
const PAINT_CLEARANCE = 2;            // px kept free around every player and powerup

// ---- powerups ----
export const POWERUP_TYPES = ['fat', 'ricochet', 'small', 'defense'];
export const POWERUP_RADIUS = 20;
export const POWERUP_INTERVAL = 30;   // default seconds between random spawns (0 = powerups off)
export const MAX_POWERUPS = 6;        // no new spawns while this many are on the map
export const FAT_DURATION = 15;       // seconds of 2x brush
export const SMALL_DURATION = 15;     // seconds at half size
export const RICOCHET_SHOTS = 30;     // ricochet bullets granted (the first 30 shots of the refilled magazine)
export const RICOCHET_BOUNCES = 3;
export const SHIELD_COUNT = 12;
export const SHIELD_HITS = 2;         // hits each sphere takes before breaking
export const SHIELD_RADIUS = 5;
export const SHIELD_ORBIT = 14;       // px beyond the player's edge
export const SHIELD_SPIN = 4;         // radians per second

// rules: the host's settings that change the simulation. firstEventId lets event ids keep rising
// across rounds, so listeners never mistake a new round's events for ones they already handled.
export function createGame(rules = {}, { firstEventId = 1 } = {}) {
  const r = {
    maxHp: rules.maxHp ?? MAX_HP,
    penCapacity: rules.penCapacity ?? PEN_CAPACITY,
    powerupInterval: rules.powerupInterval ?? POWERUP_INTERVAL,
  };
  return {
    rules: r,
    players: {},
    bullets: [],
    nextBulletId: 1,
    walls: new Uint8Array(COLS * ROWS),
    wallsVersion: 0,                  // bumped on every wall change, so renderers know to redraw
    wallLog: null,                    // host sets this to an array to record [cell, value] changes for syncing
    powerups: [],
    nextPowerupId: 1,
    powerupTimer: r.powerupInterval,
    // Recent things that happened (shots, hits, pickups...), for sounds. Each has a rising id so
    // listeners (and later, remote players) can tell which ones they've already handled.
    events: [],
    nextEventId: firstEventId,
    bgSeed: newBackgroundSeed(),      // picks this round's background art; the host will send it to everyone
  };
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
    ammo: MAG_SIZE,
    reloading: 0,                     // seconds left; 0 = not reloading
    ink: game.rules.penCapacity,
    pen: null,                        // last pen point while a stroke is in progress
    fat: 0,                           // seconds of FAT WALLS left
    small: 0,                         // seconds of GET SMALL left
    ricochet: 0,                      // ricochet bullets left
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

// mx/my = cursor position in arena coordinates. click = left mouse held.
export function emptyInput() {
  return { up: false, down: false, left: false, right: false, mx: 0, my: 0, click: false, draw: false, reload: false };
}

const MAX_EVENTS = 128;

export function emit(game, type, data) {
  game.events.push({ id: game.nextEventId++, type, ...data });
}

// WASD movement with wall collision. Exported so clients can predict their own movement locally.
export function applyMovement(game, p, input, dt) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  movePlayer(game, p, dx * PLAYER_SPEED * dt, dy * PLAYER_SPEED * dt);
}

export function step(game, inputs, dt) {
  if (game.events.length > MAX_EVENTS) game.events.splice(0, game.events.length - MAX_EVENTS);

  for (const p of Object.values(game.players)) {
    if (!p.alive) continue;
    const input = inputs[p.id] || emptyInput();

    p.fat = Math.max(0, p.fat - dt);
    p.small = Math.max(0, p.small - dt);
    if (p.shields) p.orbit = (p.orbit + SHIELD_SPIN * dt) % (Math.PI * 2);

    applyMovement(game, p, input, dt);
    p.aim = Math.atan2(input.my - p.y, input.mx - p.x);
    collectPowerups(game, p);

    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) {
        p.reloading = 0;
        p.ammo = MAG_SIZE;
        emit(game, 'reloaded', { x: p.x, y: p.y });
      }
    } else if (input.reload && p.ammo < MAG_SIZE) {
      p.reloading = RELOAD_TIME;
      emit(game, 'reload', { x: p.x, y: p.y });
    }

    if (input.draw) {
      if (input.click) paintStroke(game, p, input.mx, input.my);
      else p.pen = null;
    } else {
      p.pen = null;
      // Small epsilon: repeated float subtraction leaves crumbs like 1e-17 that would cost an extra tick.
      if (input.click && p.cooldown < 1e-6 && p.reloading === 0 && p.ammo > 0) shoot(game, p);
    }
  }

  stepBullets(game, dt);

  if (game.rules.powerupInterval > 0) game.powerupTimer -= dt;
  if (game.rules.powerupInterval > 0 && game.powerupTimer <= 0) {
    game.powerupTimer += game.rules.powerupInterval;
    if (game.powerups.length < MAX_POWERUPS) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      const spot = findFreeSpot(game);
      spawnPowerup(game, type, spot.x, spot.y);
    }
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

export function spawnPowerup(game, type, x, y) {
  const u = { id: game.nextPowerupId++, type, x, y };
  game.powerups.push(u);
  emit(game, 'spawn', { kind: type, x, y });
  return u;
}

function collectPowerups(game, p) {
  const reach = playerRadius(p) + POWERUP_RADIUS;
  game.powerups = game.powerups.filter((u) => {
    if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 > reach * reach) return true;
    applyPowerup(p, u.type);
    emit(game, 'pickup', { kind: u.type, x: u.x, y: u.y });
    return false;
  });
}

// Picking up a powerup you already have refreshes it.
function applyPowerup(p, type) {
  if (type === 'fat') p.fat = FAT_DURATION;
  else if (type === 'small') p.small = SMALL_DURATION;
  else if (type === 'ricochet') {
    p.ammo = MAG_SIZE;
    p.reloading = 0;
    p.ricochet = RICOCHET_SHOTS;
  } else if (type === 'defense') p.shields = new Array(SHIELD_COUNT).fill(SHIELD_HITS);
}

// ---- shooting ----

function shoot(game, p) {
  p.cooldown = FIRE_COOLDOWN;
  p.ammo -= 1;
  const ricochet = p.ricochet > 0;
  if (ricochet) p.ricochet -= 1;
  emit(game, 'shoot', { x: p.x, y: p.y, ricochet });
  if (p.ammo === 0) {
    p.reloading = RELOAD_TIME;
    emit(game, 'reload', { x: p.x, y: p.y });
  }
  // Bullets start at the player's center (never inside a wall) and travel out from there.
  game.bullets.push({
    id: game.nextBulletId++,
    owner: p.id,
    x: p.x,
    y: p.y,
    vx: Math.cos(p.aim) * BULLET_SPEED,
    vy: Math.sin(p.aim) * BULLET_SPEED,
    ricochet,
    bounces: ricochet ? RICOCHET_BOUNCES : 0,
    bounced: false,                   // a ricochet bullet can hurt its own shooter once it has bounced
  });
}

function canHurt(b, p) {
  return p.alive && (p.id !== b.owner || b.bounced);
}

function stepBullets(game, dt) {
  // Bullets move faster than a cell per tick, so march them in small sub-steps to avoid skipping through walls.
  const sub = Math.ceil((BULLET_SPEED * dt) / (CELL / 2));
  const players = Object.values(game.players);
  game.bullets = game.bullets.filter((b) => {
    for (let i = 0; i < sub; i++) {
      const px = b.x, py = b.y;
      b.x += (b.vx * dt) / sub;
      b.y += (b.vy * dt) / sub;

      // Arena edge: ricochet bullets bounce, normal ones vanish.
      const outX = b.x < 0 || b.x >= ARENA.w;
      const outY = b.y < 0 || b.y >= ARENA.h;
      if (outX || outY) {
        if (b.bounces <= 0) return false;
        if (outX) b.vx = -b.vx;
        if (outY) b.vy = -b.vy;
        bounce(b, px, py);
        emit(game, 'bounce', { x: b.x, y: b.y });
        continue;
      }

      if (wallAt(game, b.x, b.y)) {
        // Work out which side was hit (before breaking it), so we know which way to reflect.
        const sideX = wallAt(game, b.x, py);
        const sideY = wallAt(game, px, b.y);
        breakWall(game, b.x, b.y);
        emit(game, 'wall', { x: b.x, y: b.y });
        if (b.bounces <= 0) return false;
        if (sideX) b.vx = -b.vx;
        if (sideY) b.vy = -b.vy;
        if (!sideX && !sideY) {
          // Hit a corner head-on.
          b.vx = -b.vx;
          b.vy = -b.vy;
        }
        bounce(b, px, py);
        continue;
      }

      for (const p of players) {
        if (!canHurt(b, p)) continue;

        // Shield spheres catch bullets before they reach the player. Each sphere stops SHIELD_HITS bullets.
        const sr = SHIELD_RADIUS + BULLET_RADIUS;
        const sphere = shieldPositions(p).find((s) => (s.x - b.x) ** 2 + (s.y - b.y) ** 2 <= sr * sr);
        if (sphere) {
          p.shields[sphere.i] -= 1;
          emit(game, 'shield', { x: b.x, y: b.y, broke: p.shields[sphere.i] <= 0 });
          if (p.shields.every((hits) => hits <= 0)) p.shields = null;
          return false;
        }

        // Bullets never ricochet off players — they just hit.
        const r = playerRadius(p) + BULLET_RADIUS;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= r * r) {
          hurtPlayer(game, p);
          return false;
        }
      }
    }
    return true;
  });
}

// Takes one hit point away (bullets, sudden death).
export function hurtPlayer(game, p) {
  if (!p.alive) return;
  p.hp -= 1;
  p.hitCount += 1;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    emit(game, 'death', { x: p.x, y: p.y });
  } else {
    emit(game, 'hit', { x: p.x, y: p.y });
  }
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
// always goes back to the player who drew it. A drawer's ink + their cells on the map never exceeds
// their pen capacity, so there's always room; the cap is just a safety net. Ink from a player who left is lost.
function breakWall(game, x, y) {
  const owners = playersBySlot(game);
  let changed = false;
  forCellsAround(x, y, BREAK_RADIUS, (c, r, idx) => {
    const slot = game.walls[idx];
    if (!slot) return;
    if (((c + 0.5) * CELL - x) ** 2 + ((r + 0.5) * CELL - y) ** 2 > BREAK_RADIUS * BREAK_RADIUS) return;
    game.walls[idx] = 0;
    game.wallLog?.push(idx, 0);
    const drawer = owners[slot];
    if (drawer) drawer.ink = Math.min(game.rules.penCapacity, drawer.ink + 1);
    changed = true;
  });
  if (changed) game.wallsVersion++;
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

function paintDot(game, painter, x, y) {
  // Never paint on top of a player or a powerup — the wall flows around them instead.
  const keepClear = [
    ...Object.values(game.players).filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, r: playerRadius(p) })),
    ...game.powerups.map((u) => ({ x: u.x, y: u.y, r: POWERUP_RADIUS })),
  ];
  const brush = brushRadius(painter);
  let changed = false;
  forCellsAround(x, y, brush, (c, r, idx) => {
    if (painter.ink <= 0 || game.walls[idx]) return;
    if (((c + 0.5) * CELL - x) ** 2 + ((r + 0.5) * CELL - y) ** 2 > brush * brush) return;
    if (keepClear.some((k) => circleOverlapsCell(k.x, k.y, k.r + PAINT_CLEARANCE, c, r))) return;
    game.walls[idx] = painter.slot;
    game.wallLog?.push(idx, painter.slot);
    painter.ink -= 1;
    changed = true;
  });
  if (changed) game.wallsVersion++;
}

// ---- movement + collision ----

function movePlayer(game, p, dx, dy) {
  const R = playerRadius(p);
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
