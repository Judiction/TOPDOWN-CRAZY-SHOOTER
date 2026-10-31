// A match = a series of rounds until a team reaches the host's rounds-to-win.
// Teams: everyone with the same color plays together (a solo player is a team of one). Scores, round
// wins and the game win all belong to teams, keyed by color.
// Pure logic like game.js: the host runs it, everyone else will just receive its state.
//
// Phases: boot (the OS loads: move but don't shoot) → playing → roundEnd (banner) → next boot ... → gameOver

import {
  ARENA, createGame, addPlayer, step, emptyInput, emit, hurtPlayer, TASKBAR_H, SCORE_WINDOW,
} from './game.js';
import { startDesktop } from './stage.js';
import { STAGES, DEFAULT_STAGE } from './stages/index.js';
import { gameRules, teamsOf } from './settings.js';

export const GO_SHOW = 0.8;            // how long "GO!" stays on screen
export const ROUND_END_DELAY = 3;      // seconds the round-winner banner shows before the next round
export const SUDDEN_DEATH_TICK = 1.5;  // once the round timer runs out, everyone loses 1 HP this often

// The 8 spawn spots (corners and edge midpoints) in clockwise order around the arena. Players take
// evenly spaced spots around this ring, teammates next to each other, so teams start grouped and
// solo players start spread out (2 players get opposite corners). They stay clear of the desktop
// set pieces: the top-left spot sits to the right of the score window, the bottom row above the taskbar.
const M = 70;
const { w: W, h: H } = ARENA;
const TOP_LEFT_X = SCORE_WINDOW.x + SCORE_WINDOW.w + 110;
const BOTTOM_Y = H - TASKBAR_H - M;
const MID_Y = (H - TASKBAR_H) / 2;
export const SPAWN_RING = [
  { x: TOP_LEFT_X, y: M }, { x: (TOP_LEFT_X + W - M) / 2, y: M }, { x: W - M, y: M }, { x: W - M, y: MID_Y },
  { x: W - M, y: BOTTOM_Y }, { x: W / 2, y: BOTTOM_Y }, { x: M, y: BOTTOM_Y }, { x: M, y: MID_Y },
];

// roster: [{ id, name, color }] in join order. firstEventId continues the lobby's event numbering.
export function createMatch(settings, roster, { firstEventId = 1 } = {}) {
  const match = {
    settings: { ...settings },
    roster: roster.map(({ id, name, color, cursor, isBot }) => ({ id, name, color, cursor, isBot: !!isBot })),
    scores: Object.fromEntries(teamsOf(roster).map((t) => [t.key, 0])),   // per team (color)
    round: 0,
    phase: 'boot',
    timer: 0,               // boot / banner time left
    bootTime: 0,            // how long this round's boot takes in total
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
    const p = addPlayer(game, r.id, { name: r.name, color: r.color, cursor: r.cursor, x: spot.x, y: spot.y });
    p.aim = Math.atan2(MID_Y - spot.y, W / 2 - spot.x);
  });
  // The first round is a cold boot; after that the machine just restarts.
  const stage = STAGES[match.settings.stage] || STAGES[DEFAULT_STAGE];
  const boot = match.round === 1 ? stage.bootFull : stage.bootQuick;
  Object.assign(match, {
    game,
    phase: 'boot',
    timer: boot,
    bootTime: boot,
    roundTime: 0,
    goTimer: 0,
    suddenDeath: false,
    suddenTimer: 0,
    lastCount: boot,
    roundWinner: null,
  });
  emit(game, 'boot', { full: match.round === 1 });
}

// While the OS boots players can walk around and aim, but not shoot or draw.
function bootInputs(inputs) {
  const out = {};
  for (const [id, input] of Object.entries(inputs)) out[id] = { ...input, click: false, draw: false, reload: false };
  return out;
}

export function stepMatch(match, inputs, dt) {
  const game = match.game;

  if (match.phase === 'boot') {
    step(game, bootInputs(inputs), dt);
    match.timer -= dt;
    const n = Math.ceil(match.timer);
    if (n < match.lastCount && n > 0) {
      match.lastCount = n;
      if (n <= 3) emit(game, 'countdown', { n });
    }
    if (match.timer <= 0) {
      match.phase = 'playing';
      match.goTimer = GO_SHOW;
      startDesktop(game, teamsOf(match.roster).length);
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
