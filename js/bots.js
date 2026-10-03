// Simple bots, run by the host. Each tick a bot looks at the world and produces the same kind of
// input a human sends (keys + cursor + buttons), so the rules treat bots and players identically.
//
// Behavior: chase the nearest enemy (preferring ones in sight) and strafe around them at mid range,
// grab nearby powerups, fire in bursts with a little aim wobble, chew through walls that block the
// shot, sometimes paint a cover wall between itself and the target, and wiggle free when stuck.

import { ARENA, emptyInput, lineOfSight, POWERUP_RADIUS } from './game.js';

const TAU = Math.PI * 2;

export function createBrain() {
  return {
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    wander: Math.random() * TAU,
    wanderTimer: 0,
    stuck: 0,
    unstick: 0,
    unstickDir: 0,
    lastX: null,
    lastY: null,
    aimErr: 0,
    aimErrTimer: 0,
    burst: -Math.random(),          // > 0 while firing, counts down; negative = pause between bursts
    drawCooldown: 3 + Math.random() * 6,
    stroke: null,                   // cover wall being painted: { x1, y1, x2, y2, t, dur }
  };
}

export function botInput(game, id, brain, dt) {
  const input = emptyInput();
  const p = game.players[id];
  if (!p || !p.alive) return input;

  // Pick a target: nearest enemy, with ones behind walls counted as farther away.
  let target = null, targetVisible = false, targetDist = Infinity, bestScore = Infinity;
  for (const o of Object.values(game.players)) {
    if (o.id === id || !o.alive) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    const visible = lineOfSight(game, p.x, p.y, o.x, o.y);
    const score = visible ? d : d * 1.6;
    if (score < bestScore) {
      bestScore = score;
      target = o;
      targetVisible = visible;
      targetDist = d;
    }
  }

  // ---- movement ----
  let mx = 0, my = 0;
  const powerup = nearestPowerup(game, p, 260);
  if (brain.unstick > 0) {
    brain.unstick -= dt;
    mx = Math.cos(brain.unstickDir);
    my = Math.sin(brain.unstickDir);
  } else if (powerup) {
    mx = powerup.x - p.x;
    my = powerup.y - p.y;
  } else if (target) {
    const ux = (target.x - p.x) / (targetDist || 1), uy = (target.y - p.y) / (targetDist || 1);
    brain.strafeTimer -= dt;
    if (brain.strafeTimer <= 0) {
      brain.strafe = Math.random() < 0.5 ? 1 : -1;
      brain.strafeTimer = 1 + Math.random() * 2;
    }
    const approach = targetDist > 380 ? 1 : targetDist < 200 ? -1 : 0;
    mx = ux * approach - uy * brain.strafe * 0.9;
    my = uy * approach + ux * brain.strafe * 0.9;
  } else {
    brain.wanderTimer -= dt;
    if (brain.wanderTimer <= 0) {
      brain.wander = Math.random() * TAU;
      brain.wanderTimer = 1 + Math.random() * 2;
    }
    mx = Math.cos(brain.wander);
    my = Math.sin(brain.wander);
  }
  // Don't hug the arena edges.
  const edge = 60;
  if (p.x < edge) mx += 1;
  if (p.x > ARENA.w - edge) mx -= 1;
  if (p.y < edge) my += 1;
  if (p.y > ARENA.h - edge) my -= 1;

  input.left = mx < -0.35;
  input.right = mx > 0.35;
  input.up = my < -0.35;
  input.down = my > 0.35;

  // Stuck against a wall? Pick a random direction for a moment.
  const moving = input.left || input.right || input.up || input.down;
  if (moving && brain.lastX != null && Math.hypot(p.x - brain.lastX, p.y - brain.lastY) < 0.5) {
    brain.stuck += dt;
    if (brain.stuck > 0.25) {
      brain.stuck = 0;
      brain.unstick = 0.4 + Math.random() * 0.4;
      brain.unstickDir = Math.random() * TAU;
    }
  } else brain.stuck = 0;
  brain.lastX = p.x;
  brain.lastY = p.y;

  // ---- painting a cover wall ----
  if (brain.stroke) {
    const s = brain.stroke;
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    input.draw = true;
    input.click = true;
    input.mx = s.x1 + (s.x2 - s.x1) * k;
    input.my = s.y1 + (s.y2 - s.y1) * k;
    if (k >= 1) brain.stroke = null;
    return input;
  }

  if (!target) {
    input.mx = p.x + mx * 100;
    input.my = p.y + my * 100;
    return input;
  }

  brain.drawCooldown -= dt;
  if (brain.drawCooldown <= 0 && targetVisible && targetDist < 600 && p.ink > game.rules.penCapacity * 0.25) {
    // A short wall across the line of fire, a little way in front of the bot.
    brain.drawCooldown = 5 + Math.random() * 8;
    const ux = (target.x - p.x) / targetDist, uy = (target.y - p.y) / targetDist;
    const cx = p.x + ux * 75, cy = p.y + uy * 75, half = 60;
    brain.stroke = { x1: cx + uy * half, y1: cy - ux * half, x2: cx - uy * half, y2: cy + ux * half, t: 0, dur: 0.35 };
  }

  // ---- aim and shoot ----
  brain.aimErrTimer -= dt;
  if (brain.aimErrTimer <= 0) {
    brain.aimErr = (Math.random() - 0.5) * 0.25;
    brain.aimErrTimer = 0.3 + Math.random() * 0.5;
  }
  const angle = Math.atan2(target.y - p.y, target.x - p.x) + brain.aimErr;
  input.mx = p.x + Math.cos(angle) * 200;
  input.my = p.y + Math.sin(angle) * 200;

  brain.burst -= dt;
  if (brain.burst < -0.5) brain.burst = 0.5 + Math.random() * 1;
  // Fire at visible targets; when a wall is in the way and the target is close, shoot through it.
  input.click = brain.burst > 0 && (targetVisible || targetDist < 450);
  return input;
}

function nearestPowerup(game, p, range) {
  let best = null, bestD = range;
  for (const u of game.powerups) {
    const d = Math.hypot(u.x - p.x, u.y - p.y) - POWERUP_RADIUS;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}
