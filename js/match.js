// A match = a series of rounds until someone reaches the host's rounds-to-win.
// Pure logic like game.js: the host runs it, everyone else will just receive its state.
//
// Phases: countdown (3, 2, 1, frozen) → playing → roundEnd (banner) → next countdown ... → gameOver

import {
  ARENA, createGame, addPlayer, step, emptyInput, emit, hurtPlayer,
  findFreeSpot, spawnPowerup, randomPowerupType, ROUND_START_POWERUPS,
} from './game.js';
import { gameRules } from './settings.js';

export const COUNTDOWN = 5;            // seconds of "5, 4, 3, 2, 1"
export const GO_SHOW = 0.8;            // how long "GO!" stays on screen
export const ROUND_END_DELAY = 3;      // seconds the round-winner banner shows before the next round
export const SUDDEN_DEATH_TICK = 1.5;  // once the round timer runs out, everyone loses 1 HP this often

// Corners and edge midpoints, ordered so any number of players is spread out: 2 players get
// opposite corners, 4 get all corners, and so on.
const M = 70;
const { w: W, h: H } = ARENA;
export const SPAWNS = [
  { x: M, y: M }, { x: W - M, y: H - M }, { x: W - M, y: M }, { x: M, y: H - M },
  { x: W / 2, y: M }, { x: W / 2, y: H - M }, { x: M, y: H / 2 }, { x: W - M, y: H / 2 },
];

// roster: [{ id, name, color }] in join order. firstEventId continues the lobby's event numbering.
export function createMatch(settings, roster, { firstEventId = 1 } = {}) {
  const match = {
    settings: { ...settings },
    roster: roster.map(({ id, name, color, isBot }) => ({ id, name, color, isBot: !!isBot })),
    scores: Object.fromEntries(roster.map((r) => [r.id, 0])),
    round: 0,
    phase: 'countdown',
    timer: 0,               // countdown / banner time left
    roundTime: 0,           // seconds since GO
    goTimer: 0,             // > 0 while "GO!" is showing
    suddenDeath: false,
    suddenTimer: 0,
    lastCount: 0,
    roundWinner: null,      // id, or null for a draw
    winner: null,
    game: null,
    firstEventId,
  };
  startRound(match);
  return match;
}

function startRound(match) {
  match.round += 1;
  const game = createGame(gameRules(match.settings), {
    firstEventId: match.game ? match.game.nextEventId : match.firstEventId,
  });
  // Rotate spawn spots every round so nobody keeps the same corner.
  const n = match.roster.length;
  match.roster.forEach((r, i) => {
    const spot = SPAWNS[(i + match.round - 1) % n];
    const p = addPlayer(game, r.id, { name: r.name, color: r.color, x: spot.x, y: spot.y });
    p.aim = Math.atan2(H / 2 - spot.y, W / 2 - spot.x);
  });
  // Every round starts with a few random powerups already on the map (unless the host turned them off).
  if (game.rules.powerupInterval > 0) {
    for (let i = 0; i < ROUND_START_POWERUPS; i++) {
      const spot = findFreeSpot(game);
      spawnPowerup(game, randomPowerupType(), spot.x, spot.y, { silent: true });
    }
  }
  Object.assign(match, {
    game,
    phase: 'countdown',
    timer: COUNTDOWN,
    roundTime: 0,
    goTimer: 0,
    suddenDeath: false,
    suddenTimer: 0,
    lastCount: COUNTDOWN,
    roundWinner: null,
  });
  emit(game, 'countdown', { n: COUNTDOWN });
}

// During the countdown players can look around but not move, shoot or draw.
function aimOnly(inputs) {
  const out = {};
  for (const [id, input] of Object.entries(inputs)) out[id] = { ...emptyInput(), mx: input.mx, my: input.my };
  return out;
}

export function stepMatch(match, inputs, dt) {
  const game = match.game;

  if (match.phase === 'countdown') {
    step(game, aimOnly(inputs), dt);
    match.timer -= dt;
    const n = Math.ceil(match.timer);
    if (n < match.lastCount && n > 0) {
      match.lastCount = n;
      emit(game, 'countdown', { n });
    }
    if (match.timer <= 0) {
      match.phase = 'playing';
      match.goTimer = GO_SHOW;
      emit(game, 'go', {});
    }
    return;
  }

  // The world keeps running during the banner and the winner screen — the survivor can show off.
  step(game, inputs, dt);
  match.goTimer = Math.max(0, match.goTimer - dt);

  if (match.phase === 'playing') {
    match.roundTime += dt;
    const limit = match.settings.roundTime;
    if (limit > 0 && !match.suddenDeath && match.roundTime >= limit) {
      match.suddenDeath = true;
      emit(game, 'suddenDeath', {});
    }
    if (match.suddenDeath) {
      match.suddenTimer += dt;
      while (match.suddenTimer >= SUDDEN_DEATH_TICK) {
        match.suddenTimer -= SUDDEN_DEATH_TICK;
        for (const p of Object.values(game.players)) hurtPlayer(game, p);
      }
    }

    const alive = Object.values(game.players).filter((p) => p.alive);
    if (alive.length <= 1) {
      // Last one standing wins. If the last players died at the same moment, nobody scores.
      match.roundWinner = alive.length ? alive[0].id : null;
      if (match.roundWinner) match.scores[match.roundWinner] += 1;
      match.phase = 'roundEnd';
      match.timer = ROUND_END_DELAY;
      emit(game, 'roundEnd', { winner: match.roundWinner });
    }
    return;
  }

  if (match.phase === 'roundEnd') {
    match.timer -= dt;
    if (match.timer > 0) return;
    const champ = match.roster.find((r) => match.scores[r.id] >= match.settings.roundsToWin);
    if (champ) {
      match.phase = 'gameOver';
      match.winner = champ.id;
      emit(game, 'gameOver', { winner: champ.id });
    } else {
      startRound(match);
    }
  }
}

// A player left mid-match: they vanish (their walls stay, in gray) and the round goes on.
export function dropPlayer(match, id) {
  delete match.game.players[id];
  match.roster = match.roster.filter((r) => r.id !== id);
  // Everyone else left: the last player standing takes the game.
  if (match.roster.length === 1 && match.phase !== 'gameOver') {
    match.phase = 'gameOver';
    match.winner = match.roster[0].id;
    emit(match.game, 'gameOver', { winner: match.winner });
  }
}

export function rosterEntry(match, id) {
  return match.roster.find((r) => r.id === id);
}
