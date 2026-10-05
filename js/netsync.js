// Turning the host's match into compact network messages, and rebuilding it on clients.
//
// Every snapshot carries players, bullets, powerups, new events and wall changes since the last one.
// A "full" snapshot (first of each round, then every few seconds) also carries everything that rarely
// changes: settings, roster, names/colors, and the entire wall grid, run-length encoded.

import { createGame, addPlayer, clearPaintedWalls } from './game.js';

const MAX_EVENTS = 128;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const ri = Math.round;

// ---- inputs (client → host) ----

const BITS = ['up', 'down', 'left', 'right', 'click', 'draw', 'reload'];
const BULLET_KINDS = ['pistol', 'pellet', 'uzi', 'rocket', 'sniper', 'flame', 'grenade'];

export function encodeInput(input) {
  let k = 0;
  BITS.forEach((b, i) => {
    if (input[b]) k |= 1 << i;
  });
  return [k, ri(input.mx), ri(input.my)];
}

export function decodeInput([k, mx, my]) {
  const input = { mx: Number(mx) || 0, my: Number(my) || 0 };
  BITS.forEach((b, i) => (input[b] = !!(k & (1 << i))));
  return input;
}

// ---- walls ----

export function encodeWalls(walls) {
  const runs = [];
  let value = walls[0], count = 0;
  for (let i = 0; i < walls.length; i++) {
    if (walls[i] === value) count++;
    else {
      runs.push(value, count);
      value = walls[i];
      count = 1;
    }
  }
  runs.push(value, count);
  return runs;
}

function decodeWalls(runs, walls) {
  let i = 0;
  for (let k = 0; k < runs.length; k += 2) {
    walls.fill(runs[k], i, Math.min(walls.length, i + runs[k + 1]));
    i += runs[k + 1];
  }
}

// ---- snapshots (host → clients) ----

export function encodeSnapshot(match, { full, events, wallOps, acks }) {
  const g = match.game;
  const snap = {
    t: 'snap',
    lob: g.lobby ? 1 : 0,
    gt: r1(g.time),
    r: match.round,
    ph: match.phase,
    tm: r2(match.timer),
    go: r2(match.goTimer),
    sd: match.suddenDeath ? 1 : 0,
    rt: r1(match.roundTime),
    rw: match.roundWinner,
    w: match.winner,
    sc: match.scores,
    p: Object.values(g.players).map((p) => [
      p.id, ri(p.x), ri(p.y), r2(p.aim), p.hp, p.alive ? 1 : 0, p.ammo, r1(p.reloading), p.ink,
      r1(p.fat), r1(p.small), p.ricochet, p.shields, r2(p.orbit), p.hitCount,
      p.pen ? [ri(p.pen.x), ri(p.pen.y)] : 0, acks[p.id] ?? 0, p.weapon, p.weaponAmmo,
      r1(p.ghost), r1(p.speed), r2(p.charging), ri(p.kvx || 0), ri(p.kvy || 0),
    ]),
    b: g.bullets.map((b) => [ri(b.x), ri(b.y), ri(b.vx), ri(b.vy), b.ricochet ? 1 : 0, BULLET_KINDS.indexOf(b.kind), ri(b.travel)]),
    m: g.meteors.map((m) => [m.id, ri(m.x), ri(m.y), m.r, r2(m.t), m.dur]),
    // Map events in progress (null when inactive).
    fx: { blackout: g.blackout, gravity: g.gravity, mirror: g.mirror },
    u: g.powerups.map((u) => [u.id, u.type, ri(u.x), ri(u.y)]),
    e: events,
    wo: wallOps,
  };
  if (full) {
    snap.full = {
      settings: match.settings,
      roster: match.roster,
      rules: g.rules,
      bg: g.bgSeed,
      meta: Object.values(g.players).map((p) => [p.id, p.slot, p.name, p.color]),
      walls: encodeWalls(g.walls),
      desk: g.desktop || null,
    };
  }
  return snap;
}

// Applies a snapshot to the client's copy of the match. `view` is { match, game } (initially empty).
// Returns the server's state for `myId` (or null), so the caller can reconcile its prediction.
export function applySnapshot(view, snap, myId) {
  const newRound = !view.match || view.match.round !== snap.r;
  if (newRound && !snap.full) return null;          // wait for the round's first full snapshot

  if (newRound) {
    const game = createGame(snap.full.rules, { lobby: !!snap.lob });
    game.bgSeed = snap.full.bg;
    view.game = game;
    view.match = { round: snap.r, settings: snap.full.settings, roster: snap.full.roster, scores: {}, game };
  }
  const { game, match } = view;

  if (snap.full) {
    match.settings = snap.full.settings;
    match.roster = snap.full.roster;
    game.rules = snap.full.rules;
    for (const [id, slot, name, color] of snap.full.meta) {
      const p = game.players[id] || addPlayer(game, id, { name, color, x: 0, y: 0 });
      Object.assign(p, { slot, name, color });
    }
    decodeWalls(snap.full.walls, game.walls);
    game.desktop = snap.full.desk || null;
    if (game.wallTimes) {
      // Lobby walls fade by age; walls we hadn't seen before start their clock now.
      for (let i = 0; i < game.walls.length; i++) {
        if (!game.walls[i]) game.wallTimes[i] = 0;
        else if (!game.wallTimes[i]) game.wallTimes[i] = snap.gt;
      }
    }
    game.wallsVersion++;
  }

  if (snap.wo?.length) {
    for (let i = 0; i < snap.wo.length; i += 2) {
      if (snap.wo[i] === -1) clearPaintedWalls(game.walls);   // eraser
      else {
        game.walls[snap.wo[i]] = snap.wo[i + 1];
        if (game.wallTimes) game.wallTimes[snap.wo[i]] = snap.wo[i + 1] ? snap.gt : 0;
      }
    }
    game.wallsVersion++;
  }

  game.time = snap.gt;
  Object.assign(match, {
    phase: snap.ph, timer: snap.tm, goTimer: snap.go, suddenDeath: !!snap.sd, roundTime: snap.rt,
    roundWinner: snap.rw, winner: snap.w, scores: snap.sc,
  });

  let mine = null;
  const seen = new Set();
  for (const a of snap.p) {
    const [id, x, y, aim, hp, alive, ammo, reloading, ink, fat, small, ricochet, shields, orbit, hitCount, pen, ack, weapon, weaponAmmo, ghost, speed, charging, kvx, kvy] = a;
    const p = game.players[id];
    if (!p) continue;                                // names/colors not known yet; next full snapshot fixes it
    seen.add(id);
    if (id === myId) mine = { x, y, ack, kvx, kvy };
    else {
      // Remote players glide toward where the host says they are (see smoothRemotes).
      if (p.tx === undefined || newRound) {
        p.x = x;
        p.y = y;
      }
      p.tx = x;
      p.ty = y;
      p.aim = aim;
    }
    Object.assign(p, {
      hp, alive: !!alive, ammo, reloading, ink, fat, small, ricochet, shields, orbit, hitCount, weapon, weaponAmmo, ghost, speed, charging,
      pen: pen ? { x: pen[0], y: pen[1] } : null,
    });
  }
  for (const id of Object.keys(game.players)) if (!seen.has(id)) delete game.players[id];

  game.bullets = snap.b.map(([x, y, vx, vy, ric, kind, travel], i) => ({ id: i, x, y, vx, vy, ricochet: !!ric, kind: BULLET_KINDS[kind] ?? 'pistol', travel }));
  game.meteors = snap.m.map(([id, x, y, r, t, dur]) => ({ id, x, y, r, t, dur }));
  game.blackout = snap.fx.blackout;
  game.gravity = snap.fx.gravity;
  game.mirror = snap.fx.mirror;
  game.powerups = snap.u.map(([id, type, x, y]) => ({ id, type, x, y }));

  for (const e of snap.e) game.events.push(e);
  if (game.events.length > MAX_EVENTS) game.events.splice(0, game.events.length - MAX_EVENTS);

  return mine;
}

// Called every frame on clients: remote players ease toward their latest position, bullets fly on.
export function smoothRemotes(game, myId, dt) {
  const k = 1 - Math.exp(-dt * 18);
  for (const p of Object.values(game.players)) {
    if (p.id === myId || p.tx === undefined) continue;
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  }
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travel += Math.hypot(b.vx, b.vy) * dt;
  }
  game.time += dt;
  for (const m of game.meteors) m.t = Math.min(m.dur, m.t + dt);   // keep the warning flashing smoothly
  for (const e of [game.blackout, game.gravity, game.mirror]) if (e) e.t = Math.min(e.dur, e.t + dt);
}
