// A match = a series of rounds until a team reaches the host's rounds-to-win.
// Teams: everyone with the same color plays together (a solo player is a team of one). Scores, round
// wins and the game win all belong to teams, keyed by color.
// Pure logic like game.js: the host runs it, everyone else will just receive its state.
//
// Phases: countdown (3, 2, 1, frozen) → playing → roundEnd (banner) → next countdown ... → gameOver

import {
  ARENA, createGame, addPlayer, step, emptyInput, emit, hurtPlayer,
  findFreeSpot, spawnPowerup, randomPowerupType, ROUND_START_POWERUPS,
} from './game.js';
import { gameRules, teamsOf } from './settings.js';

export const COUNTDOWN = 5;            // seconds of "5, 4, 3, 2, 1"
export const GO_SHOW = 0.8;            // how long "GO!" stays on screen
export const ROUND_END_DELAY = 3;      // seconds the round-winner banner shows before the next round
export const SUDDEN_DEATH_TICK = 1.5;  // once the round timer runs out, everyone loses 1 HP this often

// The 8 spawn spots (corners and edge midpoints) in clockwise order around the arena. Players take
// evenly spaced spots around this ring, teammates next to each other, so teams start grouped and
// solo players start spread out (2 players get opposite corners).
const M = 70;
const { w: W, h: H } = ARENA;
export const SPAWN_RING = [
  { x: M, y: M }, { x: W / 2, y: M }, { x: W - M, y: M }, { x: W - M, y: H / 2 },
  { x: W - M, y: H - M }, { x: W / 2, y: H - M }, { x: M, y: H - M }, { x: M, y: H / 2 },
];

// roster: [{ id, name, color }] in join order. firstEventId continues the lobby's event numbering.
export function createMatch(settings, roster, { firstEventId = 1 } = {}) {
  const match = {
    settings: { ...settings },
    roster: roster.map(({ id, name, color, isBot }) => ({ id, name, color, isBot: !!isBot })),
    scores: Object.fromEntries(teamsOf(roster).map((t) => [t.key, 0])),   // per team (color)
    round: 0,
    phase: 'countdown',
    timer: 0,               // countdown / banner time left
    roundTime: 0,           // seconds since GO
    goTimer: 0,             // > 0 while "GO!" is showing
    suddenDeath: false,
    suddenTimer: 0,
    lastCount: 0,
    roundWinner: null,      // team key (color), or null for a draw
    winner: null,           // team key
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
  // Teammates take neighboring spots; the whole layout rotates every round so nobody keeps a corner.
  const order = teamsOf(match.roster).flatMap((t) => t.members);
  const n = order.length;
  const turn = ((match.round - 1) * 2) % SPAWN_RING.length;
  order.forEach((r, i) => {
    const spot = SPAWN_RING[(turn + Math.floor((i * SPAWN_RING.length) / n)) % SPAWN_RING.length];
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

    // The round ends when at most one team has anyone left standing. That team scores; if the last
    // players all went down at the same moment, nobody does.
    const aliveTeams = new Set(Object.values(game.players).filter((p) => p.alive).map((p) => p.color));
    if (aliveTeams.size <= 1) {
      match.roundWinner = aliveTeams.size ? [...aliveTeams][0] : null;
      if (match.roundWinner) match.scores[match.roundWinner] = (match.scores[match.roundWinner] ?? 0) + 1;
      match.phase = 'roundEnd';
      match.timer = ROUND_END_DELAY;
      emit(game, 'roundEnd', { winner: match.roundWinner });
    }
    return;
  }

  if (match.phase === 'roundEnd') {
    match.timer -= dt;
    if (match.timer > 0) return;
    const champ = teamsOf(match.roster).find((t) => match.scores[t.key] >= match.settings.roundsToWin);
    if (champ) {
      match.phase = 'gameOver';
      match.winner = champ.key;
      emit(game, 'gameOver', { winner: champ.key });
    } else {
      startRound(match);
    }
  }
}

// A player left mid-match: they vanish (their walls stay, in gray) and the round goes on.
export function dropPlayer(match, id) {
  delete match.game.players[id];
  match.roster = match.roster.filter((r) => r.id !== id);
  // Everyone else left: the last team standing takes the game.
  const teams = teamsOf(match.roster);
  if (teams.length === 1 && match.phase !== 'gameOver') {
    match.phase = 'gameOver';
    match.winner = teams[0].key;
    emit(match.game, 'gameOver', { winner: match.winner });
  }
}

export function rosterEntry(match, id) {
  return match.roster.find((r) => r.id === id);
}
