// App flow: title → lobby → match (rounds) → winner screen → back to lobby or title.
// Plus: How to Play (a private practice arena) and a live lobby playground.
//
// Networking model (host-authoritative, peer-to-peer via PeerJS):
//   - The host's browser owns the room and runs the real simulation (plus any bots).
//   - Clients send their controls every tick and receive snapshots ~20 times a second.
//   - Clients predict their own movement so it feels instant; everyone else is smoothed.
// The same machinery runs the lobby playground (a harmless game everyone can mess around in while
// waiting) and then the match. If matchmaking is unreachable, hosting still works offline with bots.

import { ARENA, emptyInput, newBackgroundSeed, applyMovement, mirrorScale, createGame, addPlayer, step, PEN_CAPACITY } from './game.js';
import { createMatch, stepMatch, dropPlayer } from './match.js';
import { createBrain, botInput } from './bots.js';
import { createRoom, applyAction, canStart, addMember, removeMember } from './room.js';
import { cleanName, MAX_PLAYERS, COLORS } from './settings.js';
import { initInput, readInput, isTyping } from './input.js';
import { initCanvas, render, renderBackdrop, renderMatchHud } from './render.js';
import { FONT, clearSpriteCache } from './pixel.js';
import { initAudio, updateAudio, playUi } from './audio.js';
import { createUI } from './ui.js';
import { PROTOCOL, makeCode, cleanCode, openHost, joinHost, keepAlive, errorMessage } from './net.js';
import { encodeInput, decodeInput, encodeSnapshot, applySnapshot, smoothRemotes } from './netsync.js';

// Wait (briefly) for the pixel font so text isn't first drawn in a fallback font.
try {
  await Promise.race([document.fonts.load(`8px ${FONT}`), new Promise((r) => setTimeout(r, 3000))]);
} catch {}
document.fonts.ready.then(clearSpriteCache);

const TICK = 1 / 60;
const HOST_ID = 'host';               // the host is always 'host'; clients use their PeerJS id
const PRACTICE_ID = 'you';
const SNAPSHOT_EVERY = 3;             // ticks between snapshots (60 / 3 = 20 per second)
const FULL_SNAPSHOT_EVERY = 180;      // ticks between full resyncs (every 3 s)
const PING_MS = 2000;
const TIMEOUT_MS = 10000;             // no message for this long = connection is gone
const MAX_QUEUED_INPUTS = 6;
const WINNER_SCREEN_DELAY = 1500;     // ms between the final kill and the winner screen
const LOBBY_PATTERN = 0.22;           // spinning-cursor pattern opacity behind the lobby playground

const canvas = document.getElementById('game');
const ctx = initCanvas(canvas);
initInput(canvas);
initAudio();

// Name and color are remembered between visits.
const prefs = loadPrefs();
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('ccbp.prefs')) || {};
  } catch {
    return {};
  }
}
function savePrefs() {
  try {
    localStorage.setItem('ccbp.prefs', JSON.stringify(prefs));
  } catch {}
}

const app = {
  screen: 'title',                    // 'title' | 'howto' | 'lobby' | 'match'
  role: null,                         // 'host' | 'client'
  myId: HOST_ID,
  room: null,
  match: null,                        // host: the real match
  practice: null,                     // How to Play: { game }
  menuOpen: false,
  winnerShownAt: null,
  lastInput: emptyInput(),
};

// Host-side networking state.
const host = {
  peer: null,
  conns: new Map(),                   // client id -> PeerJS connection
  lastSeen: new Map(),
  queues: new Map(),                  // client id -> inputs waiting to be simulated
  lastInputs: new Map(),
  acks: {},                           // client id -> seq of the last input simulated
  brains: {},                         // bot id -> AI state
  lobby: null,                        // the lobby playground, shaped like a match for the snapshot code
  ticks: 0,
  sentEventId: 0,
  wallOps: [],
  snapGame: null,
  forceFull: false,                   // next snapshot must be full (someone joined, changed color...)
};

// Client-side networking state.
const client = {
  peer: null,
  conn: null,
  lastHeard: 0,
  seq: 0,
  pending: [],                        // inputs sent but not yet confirmed by the host
  view: { match: null, game: null },  // the match, rebuilt from snapshots
  lobby: { match: null, game: null }, // the lobby playground, rebuilt from snapshots
};

// What plays behind the title: just background art + music.
const menuScene = { events: [], players: {}, bgSeed: newBackgroundSeed() };

const ui = createUI(document.getElementById('ui'), {
  onClick: playUi,
  onHost: startHosting,
  onJoin: joinGame,
  onHowTo: showHowTo,
  onBack: () => goTitle(),
  onAction(action) {
    if (app.role === 'client') return send(client.conn, { t: 'act', action });
    if (!applyAction(app.room, app.myId, action)) return;
    rememberMe();
    roomChanged();
  },
  onStart: hostStartMatch,
  onCopy() {
    const link = `${location.origin}${location.pathname}?room=${app.room.code}`;
    navigator.clipboard?.writeText(link).then(
      () => ui.flashStatus('INVITE LINK COPIED!'),
      () => ui.flashStatus(link),
    );
  },
  onLeave: () => goTitle(),
  onResume: closeMenu,
  onEndMatch: () => (app.role === 'host' ? hostBackToLobby() : goTitle()),
  onPlayAgain: hostBackToLobby,
  onMenu: () => goTitle(),
});

function rememberMe() {
  const me = app.room?.players.find((p) => p.id === app.myId);
  if (!me) return;
  prefs.name = me.name;
  prefs.color = me.color;
  savePrefs();
}

function send(conn, msg) {
  try {
    if (conn?.open) conn.send(msg);
  } catch {}
}

// ---------------------------------------------------------------- screens

function goTitle(message = '') {
  disconnect();
  app.screen = 'title';
  app.role = null;
  app.room = null;
  app.match = null;
  app.practice = null;
  app.menuOpen = false;
  host.lobby = null;
  document.body.classList.remove('in-match');
  const code = cleanCode(new URLSearchParams(location.search).get('room'));
  ui.showTitle({ name: prefs.name || '', code, message });
}

// How to Play: instructions + a private arena with just your cursor (no enemies, no powerups).
function showHowTo() {
  const game = createGame({ powerupInterval: 0 });
  game.bgSeed = menuScene.bgSeed;
  addPlayer(game, PRACTICE_ID, { name: prefs.name || 'YOU', color: COLORS.includes(prefs.color) ? prefs.color : '#60a5fa', x: 400, y: 360 });
  app.practice = { game };
  app.screen = 'howto';
  ui.showHowTo();
}

function showLobby() {
  if (app.role === 'host') startLobbyPlayground();   // (before dropping the match: it continues its event ids)
  app.screen = 'lobby';
  app.match = null;
  app.menuOpen = false;
  document.body.classList.remove('in-match');
  client.lobby = { match: null, game: null };
  client.pending = [];
  ui.showLobby(app.room, app.myId);
}

function showMatch() {
  app.screen = 'match';
  app.menuOpen = false;
  app.winnerShownAt = null;
  ui.hide();
  document.body.classList.add('in-match');
}

function openMenu() {
  app.menuOpen = true;
  ui.showPause(app.role === 'host');
}

function closeMenu() {
  app.menuOpen = false;
  ui.hide();
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || isTyping(e)) return;
  if (app.screen === 'howto') return goTitle();
  const phase = app.role === 'host' ? app.match?.phase : client.view.match?.phase;
  if (app.screen !== 'match' || phase === 'gameOver') return;
  if (app.menuOpen) closeMenu();
  else openMenu();
});

// ---------------------------------------------------------------- hosting

function startHosting(name) {
  prefs.name = cleanName(name);
  savePrefs();
  app.role = 'host';
  app.myId = HOST_ID;
  app.room = createRoom({ id: HOST_ID, name: prefs.name, color: prefs.color });
  showLobby();
  openRoom(3);
}

function openRoom(attempts) {
  const code = makeCode();
  openHost(code).then(
    (peer) => {
      if (app.role !== 'host') return peer.destroy();     // left the lobby while connecting
      host.peer = peer;
      keepAlive(peer);
      peer.on('connection', onClientConnection);
      app.room.code = code;
      roomChanged();
    },
    (err) => {
      if (app.role !== 'host') return;
      if (err.type === 'unavailable-id' && attempts > 1) return openRoom(attempts - 1);
      // No matchmaking: keep going offline, bots only.
      app.room.code = 'OFFLINE';
      roomChanged();
      ui.flashStatus(`${errorMessage(err)} PLAYING OFFLINE.`);
    },
  );
}

function onClientConnection(conn) {
  conn.on('data', (msg) => onClientMessage(conn, msg));
  conn.on('close', () => dropClient(conn.peer));
  conn.on('error', () => dropClient(conn.peer));
}

function onClientMessage(conn, msg) {
  if (!msg || typeof msg !== 'object') return;
  const id = conn.peer;
  host.lastSeen.set(id, performance.now());

  if (msg.t === 'hello') {
    if (host.conns.has(id)) return;
    const reject = (reason) => {
      send(conn, { t: 'reject', reason });
      setTimeout(() => conn.close(), 500);
    };
    if (msg.v !== PROTOCOL) return reject('VERSION MISMATCH. REFRESH THE PAGE!');
    if (app.room.players.length >= MAX_PLAYERS) return reject('THAT ROOM IS FULL.');
    addMember(app.room, { id, name: msg.name, color: msg.color });
    host.conns.set(id, conn);
    host.queues.set(id, []);
    send(conn, { t: 'welcome', id });
    roomChanged();
    return;
  }
  if (!host.conns.has(id)) return;

  if (msg.t === 'act') {
    if (applyAction(app.room, id, msg.action)) roomChanged();
  } else if (msg.t === 'in' && Array.isArray(msg.i)) {
    const q = host.queues.get(id);
    q.push({ seq: msg.s, input: decodeInput(msg.i) });
    // If inputs pile up (lag spike), skip ahead rather than falling further behind.
    if (q.length > MAX_QUEUED_INPUTS) q.splice(0, q.length - 2);
  }
}

function dropClient(id) {
  if (!host.conns.has(id)) return;
  host.conns.get(id).close();
  host.conns.delete(id);
  host.queues.delete(id);
  host.lastInputs.delete(id);
  host.lastSeen.delete(id);
  delete host.acks[id];
  removeMember(app.room, id);
  if (app.match?.roster.some((r) => r.id === id)) dropPlayer(app.match, id);
  roomChanged();
}

// Share the lobby with everyone, keep the playground's cursors in sync with it, refresh our screen.
function roomChanged() {
  if (!app.room) return;
  for (const conn of host.conns.values()) send(conn, { t: 'room', room: app.room });
  if (host.lobby) syncLobbyPlayers();
  if (app.screen === 'lobby') ui.updateLobby(app.room, app.myId);
}

// ---- lobby playground (host) ----

function startLobbyPlayground() {
  const game = createGame({ penCapacity: PEN_CAPACITY, powerupInterval: 0 }, {
    lobby: true,
    firstEventId: (host.lobby?.game.nextEventId ?? app.match?.game.nextEventId ?? 0) + 1,
  });
  game.bgSeed = menuScene.bgSeed;
  host.lobby = {
    round: -1, phase: 'lobby', timer: 0, goTimer: 0, suddenDeath: false, roundTime: 0,
    roundWinner: null, winner: null, scores: {}, settings: app.room.settings, roster: [], game,
  };
  host.ticks = 0;
  host.sentEventId = game.nextEventId - 1;
  host.wallOps = [];
  host.snapGame = null;
  for (const q of host.queues.values()) q.length = 0;
  syncLobbyPlayers();
}

// Real players (not bots) get a cursor in the playground, in the color they've picked.
function syncLobbyPlayers() {
  const lobby = host.lobby, game = lobby.game;
  const humans = app.room.players.filter((p) => !p.isBot);
  for (const id of Object.keys(game.players)) if (!humans.some((p) => p.id === id)) delete game.players[id];
  for (const m of humans) {
    let p = game.players[m.id];
    if (!p) {
      // Spawn on the open right-hand side of the screen (the lobby panel covers the left).
      const x = 700 + Math.random() * 480, y = 120 + Math.random() * 480;
      p = addPlayer(game, m.id, { name: m.name, color: m.color, x, y });
    }
    if (p.color !== m.color) game.wallsVersion++;   // repaint their walls in the new color
    p.name = m.name;
    p.color = m.color;
  }
  lobby.roster = humans.map(({ id, name, color }) => ({ id, name, color }));
  lobby.settings = app.room.settings;
  host.forceFull = true;
}

function hostStartMatch() {
  const room = app.room;
  if (!canStart(room)) return;
  room.inMatch = true;
  const firstEventId = (host.lobby?.game.nextEventId ?? 0) + 1;
  host.lobby = null;                  // the playground is over
  app.match = createMatch(room.settings, room.players, { firstEventId });
  host.brains = Object.fromEntries(room.players.filter((p) => p.isBot).map((p) => [p.id, createBrain()]));
  host.ticks = 0;
  host.sentEventId = firstEventId - 1;
  host.wallOps = [];
  host.snapGame = null;
  for (const q of host.queues.values()) q.length = 0;
  for (const p of room.players) p.waiting = false;
  roomChanged();
  for (const r of app.match.roster) send(host.conns.get(r.id), { t: 'start' });
  showMatch();
}

// End of a game (or the host ended it early): everyone back to the lobby, same players.
function hostBackToLobby() {
  if (app.match) menuScene.bgSeed = app.match.game.bgSeed;   // keep the current art + music going
  app.room.inMatch = false;
  for (const p of app.room.players) p.waiting = false;
  for (const conn of host.conns.values()) send(conn, { t: 'lobby' });
  showLobby();
  roomChanged();
}

// One host tick of whatever is running: the match, or the lobby playground.
function hostTick(input) {
  const sim = app.screen === 'match' ? app.match : host.lobby;
  if (!sim) return;
  const inputs = { [HOST_ID]: input };
  if (sim === app.match) for (const id of Object.keys(host.brains)) inputs[id] = botInput(sim.game, id, host.brains[id], TICK);
  for (const [id, q] of host.queues) {
    const next = q.shift();
    if (next) {
      host.lastInputs.set(id, next.input);
      host.acks[id] = next.seq;
    }
    inputs[id] = host.lastInputs.get(id) || emptyInput();
  }

  const before = sim.game;
  if (!before.wallLog) before.wallLog = [];
  if (sim === app.match) stepMatch(sim, inputs, TICK);
  else step(sim.game, inputs, TICK);
  // Collect wall changes for the next snapshot (a new round starts from a full snapshot instead).
  if (sim.game === before) {
    host.wallOps.push(...before.wallLog);
    before.wallLog.length = 0;
  }

  host.ticks++;
  if (host.ticks % SNAPSHOT_EVERY === 0 && host.conns.size) sendSnapshot(sim);
}

function sendSnapshot(sim) {
  const g = sim.game;
  const full = g !== host.snapGame || host.ticks % FULL_SNAPSHOT_EVERY === 0 || host.forceFull;
  host.forceFull = false;
  if (g !== host.snapGame) {
    host.snapGame = g;
    host.wallOps = [];                // the full snapshot carries the walls
  }
  const events = g.events.filter((e) => e.id > host.sentEventId);
  if (events.length) host.sentEventId = events[events.length - 1].id;
  const snap = encodeSnapshot(sim, { full, events, wallOps: host.wallOps, acks: host.acks });
  host.wallOps = [];
  // The match goes to its players; the playground goes to everyone in the lobby.
  const targets = sim === app.match ? sim.roster.map((r) => host.conns.get(r.id)) : [...host.conns.values()];
  for (const conn of targets) send(conn, snap);
}

// ---------------------------------------------------------------- joining

function joinGame(name, rawCode) {
  prefs.name = cleanName(name);
  savePrefs();
  const code = cleanCode(rawCode);
  if (code.length !== 4) return ui.setMessage('ENTER THE 4-LETTER ROOM CODE.');
  ui.setMessage('CONNECTING...');
  joinHost(code).then(
    ({ peer, conn }) => {
      if (app.screen !== 'title') return peer.destroy();
      client.peer = peer;
      client.conn = conn;
      client.lastHeard = performance.now();
      app.role = 'client';
      conn.on('data', onHostMessage);
      conn.on('close', () => app.role === 'client' && goTitle('THE HOST LEFT THE GAME.'));
      send(conn, { t: 'hello', v: PROTOCOL, name: prefs.name, color: prefs.color });
    },
    (err) => app.screen === 'title' && ui.setMessage(errorMessage(err)),
  );
}

function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  client.lastHeard = performance.now();
  switch (msg.t) {
    case 'welcome':
      app.myId = msg.id;
      break;
    case 'reject':
      goTitle(msg.reason);
      break;
    case 'room':
      app.room = msg.room;
      rememberMe();
      if (app.screen === 'title') showLobby();
      else if (app.screen === 'lobby') ui.updateLobby(app.room, app.myId);
      break;
    case 'start':
      client.view = { match: null, game: null };
      client.pending = [];
      showMatch();
      break;
    case 'snap':
      onSnapshot(msg);
      break;
    case 'lobby':
      if (app.screen === 'match') showLobby();
      break;
    case 'bye':
      goTitle('THE HOST LEFT THE GAME.');
      break;
  }
}

function canMove(match) {
  return match && match.phase !== 'countdown';
}

// The view a client is currently looking at: the match or the lobby playground.
function clientView() {
  return app.screen === 'match' ? client.view : app.screen === 'lobby' ? client.lobby : null;
}

function onSnapshot(snap) {
  // Lobby snapshots only matter in the lobby, match snapshots only in the match.
  if ((snap.ph === 'lobby') !== (app.screen === 'lobby') || (app.screen !== 'lobby' && app.screen !== 'match')) return;
  const view = clientView();
  const mine = applySnapshot(view, snap, app.myId);
  const me = view.game?.players[app.myId];
  if (!mine || !me) return;
  // Reconcile: start from where the host says we are, then replay inputs it hasn't simulated yet.
  client.pending = client.pending.filter((q) => q.seq > mine.ack);
  me.x = mine.x;
  me.y = mine.y;
  if (me.alive && canMove(view.match)) for (const q of client.pending) applyMovement(view.game, me, q.input, TICK);
}

function clientTick(input) {
  client.seq++;
  send(client.conn, { t: 'in', s: client.seq, i: encodeInput(input) });
  const view = clientView();
  const me = view?.game?.players[app.myId];
  if (!me) return;
  client.pending.push({ seq: client.seq, input });
  if (client.pending.length > 120) client.pending.shift();
  if (me.alive && canMove(view.match)) applyMovement(view.game, me, input, TICK);
}

// ---------------------------------------------------------------- connection housekeeping

function disconnect() {
  if (app.role === 'host') {
    for (const conn of host.conns.values()) {
      send(conn, { t: 'bye' });
      setTimeout(() => conn.close(), 200);
    }
    host.conns.clear();
    host.queues.clear();
    host.lastInputs.clear();
    host.lastSeen.clear();
    host.acks = {};
    const peer = host.peer;
    host.peer = null;
    if (peer) setTimeout(() => peer.destroy(), 300);
  }
  if (app.role === 'client') {
    client.conn?.close();
    client.peer?.destroy();
    client.conn = client.peer = null;
  }
}

window.addEventListener('beforeunload', disconnect);

setInterval(() => {
  const now = performance.now();
  if (app.role === 'host') {
    for (const conn of host.conns.values()) send(conn, { t: 'ping' });
    for (const [id, seen] of host.lastSeen) if (now - seen > TIMEOUT_MS) dropClient(id);
  } else if (app.role === 'client') {
    send(client.conn, { t: 'ping' });
    if (now - client.lastHeard > TIMEOUT_MS) goTitle('LOST CONNECTION TO THE HOST.');
  }
}, PING_MS);

// ---------------------------------------------------------------- main loop

// The simulation is pumped from two places: animation frames (smooth when visible) and a worker
// timer, because browsers stop animation frames in background tabs — a host that switches tabs
// would otherwise freeze the game for everyone.
let last = performance.now();
let acc = 0;

// What (if anything) this browser should be simulating right now.
function simMode() {
  if (app.screen === 'howto') return app.practice && 'practice';
  if (app.screen !== 'match' && app.screen !== 'lobby') return null;
  if (app.role === 'host') return (app.screen === 'match' ? app.match : host.lobby) && 'host';
  if (app.role === 'client') return client.conn && 'client';
  return null;
}

// The game shown on screen (and its match-like wrapper for the HUD), or null for plain menus.
function activeView() {
  if (app.screen === 'howto') return app.practice && { match: null, game: app.practice.game };
  if (app.role === 'host') {
    if (app.screen === 'match') return app.match && { match: app.match, game: app.match.game };
    if (app.screen === 'lobby') return host.lobby && { match: host.lobby, game: host.lobby.game };
    return null;
  }
  return clientView();
}

function localId() {
  return app.screen === 'howto' ? PRACTICE_ID : app.myId;
}

function currentInput() {
  if (app.menuOpen) return { ...emptyInput(), mx: app.lastInput.mx, my: app.lastInput.my };
  const input = readInput();
  // Mirror World flips the picture, so flip the mouse too: you still aim where you point on screen.
  // (WASD keeps moving you in world directions — that's the disorienting part.)
  const m = activeView()?.game?.mirror;
  if (m && mirrorScale(m) < 0) {
    if (m.axis === 'x') input.mx = ARENA.w - input.mx;
    else input.my = ARENA.h - input.my;
  }
  return input;
}

function pump() {
  const now = performance.now();
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  const mode = simMode();
  if (!mode) {
    acc = 0;
    return;
  }
  const input = currentInput();
  app.lastInput = input;
  while (acc >= TICK) {
    if (mode === 'host') hostTick(input);
    else if (mode === 'client') clientTick(input);
    else step(app.practice.game, { [PRACTICE_ID]: input }, TICK);
    acc -= TICK;
  }
}

try {
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 1000 / 60);'], { type: 'text/javascript' })));
  ticker.onmessage = pump;
} catch {}

let lastFrame = performance.now();

function frame(now) {
  // Always schedule the next frame first, so one bad frame can never freeze the game.
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  pump();

  const view = activeView();
  if (view?.game) {
    const { match, game } = view;
    const input = app.lastInput;
    const id = localId();
    if (app.role === 'client' && app.screen !== 'howto') {
      smoothRemotes(game, app.myId, dt);
      if (match?.phase === 'countdown') match.timer = Math.max(0, match.timer - dt);
      if (match) match.goTimer = Math.max(0, (match.goTimer || 0) - dt);
      const me = game.players[app.myId];
      if (me?.alive) me.aim = Math.atan2(input.my - me.y, input.mx - me.x);   // aim feels instant
    }
    const inLobby = app.screen === 'lobby';
    render(ctx, game, id, input, { hud: !inLobby, pattern: inLobby ? LOBBY_PATTERN : 0 });
    if (app.screen === 'match') renderMatchHud(ctx, match, id);
    updateAudio(game);

    if (app.screen === 'match' && match.phase === 'gameOver') {
      app.winnerShownAt ??= now + WINNER_SCREEN_DELAY;
      if (now >= app.winnerShownAt && ui.screen !== 'gameover') {
        app.menuOpen = false;
        document.body.classList.remove('in-match');
        ui.showGameOver(match, app.role === 'host');
      }
    }
  } else {
    renderBackdrop(ctx, menuScene.bgSeed);
    updateAudio(menuScene);
  }
}

// Handy for poking at the game from the browser console.
window.ccbp = { app, host, client };

goTitle();
requestAnimationFrame(frame);
