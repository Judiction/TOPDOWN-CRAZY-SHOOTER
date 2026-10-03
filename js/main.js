// App flow: title → lobby → match (rounds) → winner screen → back to lobby or title.
//
// Networking model (host-authoritative, peer-to-peer via PeerJS):
//   - The host's browser owns the room and runs the real match (plus any bots).
//   - Clients send their controls every tick and receive snapshots ~20 times a second.
//   - Clients predict their own movement so it feels instant; everyone else is smoothed.
// If the matchmaking server can't be reached, hosting still works offline with bots.

import { ARENA, emptyInput, newBackgroundSeed, applyMovement, mirrorScale } from './game.js';
import { createMatch, stepMatch, dropPlayer } from './match.js';
import { createBrain, botInput } from './bots.js';
import { createRoom, applyAction, canStart, addMember, removeMember } from './room.js';
import { cleanName, MAX_PLAYERS } from './settings.js';
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
const SNAPSHOT_EVERY = 3;             // ticks between snapshots (60 / 3 = 20 per second)
const FULL_SNAPSHOT_EVERY = 180;      // ticks between full resyncs (every 3 s)
const PING_MS = 2000;
const TIMEOUT_MS = 10000;             // no message for this long = connection is gone
const MAX_QUEUED_INPUTS = 6;
const WINNER_SCREEN_DELAY = 1500;     // ms between the final kill and the winner screen

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
  screen: 'title',                    // 'title' | 'lobby' | 'match'
  role: null,                         // 'host' | 'client'
  myId: HOST_ID,
  room: null,
  match: null,                        // host: the real match. client: { match, game } rebuilt from snapshots
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
  ticks: 0,
  sentEventId: 0,
  wallOps: [],
  snapGame: null,
};

// Client-side networking state.
const client = {
  peer: null,
  conn: null,
  lastHeard: 0,
  seq: 0,
  pending: [],                        // inputs sent but not yet confirmed by the host
  view: { match: null, game: null },
};

// What plays behind the menus: just background art + music.
const menuScene = { events: [], players: {}, bgSeed: newBackgroundSeed() };

const ui = createUI(document.getElementById('ui'), {
  onClick: playUi,
  onHost: startHosting,
  onJoin: joinGame,
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
  app.menuOpen = false;
  document.body.classList.remove('in-match');
  const code = cleanCode(new URLSearchParams(location.search).get('room'));
  ui.showTitle({ name: prefs.name || '', code, message });
}

function showLobby() {
  app.screen = 'lobby';
  app.match = null;
  app.menuOpen = false;
  document.body.classList.remove('in-match');
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
  const phase = app.role === 'host' ? app.match?.phase : client.view.match?.phase;
  if (e.code !== 'Escape' || isTyping(e) || app.screen !== 'match' || phase === 'gameOver') return;
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

// Share the lobby with everyone and refresh our own lobby screen.
function roomChanged() {
  if (!app.room) return;
  for (const conn of host.conns.values()) send(conn, { t: 'room', room: app.room });
  if (app.screen === 'lobby') ui.updateLobby(app.room, app.myId);
}

function hostStartMatch() {
  const room = app.room;
  if (!canStart(room)) return;
  room.inMatch = true;
  app.match = createMatch(room.settings, room.players);
  host.brains = Object.fromEntries(room.players.filter((p) => p.isBot).map((p) => [p.id, createBrain()]));
  host.ticks = 0;
  host.sentEventId = 0;
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
  roomChanged();
  showLobby();
}

function hostTick(input) {
  const m = app.match;
  const inputs = { [HOST_ID]: input };
  for (const id of Object.keys(host.brains)) inputs[id] = botInput(m.game, id, host.brains[id], TICK);
  for (const [id, q] of host.queues) {
    const next = q.shift();
    if (next) {
      host.lastInputs.set(id, next.input);
      host.acks[id] = next.seq;
    }
    inputs[id] = host.lastInputs.get(id) || emptyInput();
  }

  const before = m.game;
  if (!before.wallLog) before.wallLog = [];
  stepMatch(m, inputs, TICK);
  // Collect wall changes for the next snapshot (a new round starts from a full snapshot instead).
  if (m.game === before) {
    host.wallOps.push(...before.wallLog);
    before.wallLog.length = 0;
  }

  host.ticks++;
  if (host.ticks % SNAPSHOT_EVERY === 0 && host.conns.size) sendSnapshot();
}

function sendSnapshot() {
  const m = app.match;
  const g = m.game;
  const full = g !== host.snapGame || host.ticks % FULL_SNAPSHOT_EVERY === 0;
  if (g !== host.snapGame) {
    host.snapGame = g;
    host.wallOps = [];                // the full snapshot carries the walls
  }
  const events = g.events.filter((e) => e.id > host.sentEventId);
  if (events.length) host.sentEventId = events[events.length - 1].id;
  const snap = encodeSnapshot(m, { full, events, wallOps: host.wallOps, acks: host.acks });
  host.wallOps = [];
  for (const r of m.roster) send(host.conns.get(r.id), snap);
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
      if (app.screen === 'match') onSnapshot(msg);
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

function onSnapshot(snap) {
  const view = client.view;
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
  const { game, match } = client.view;
  const me = game?.players[app.myId];
  if (!me) return;
  client.pending.push({ seq: client.seq, input });
  if (client.pending.length > 120) client.pending.shift();
  if (me.alive && canMove(match)) applyMovement(game, me, input, TICK);
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

function inMatch() {
  return app.screen === 'match' && (app.role === 'host' ? app.match : client.conn);
}

function currentInput() {
  if (app.menuOpen) return { ...emptyInput(), mx: app.lastInput.mx, my: app.lastInput.my };
  const input = readInput();
  // Mirror World flips the picture, so flip the mouse too: you still aim where you point on screen.
  // (WASD keeps moving you in world directions — that's the disorienting part.)
  const game = app.role === 'host' ? app.match?.game : client.view.game;
  const m = game?.mirror;
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
  if (!inMatch()) {
    acc = 0;
    return;
  }
  const input = currentInput();
  app.lastInput = input;
  while (acc >= TICK) {
    if (app.role === 'host') hostTick(input);
    else clientTick(input);
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

  const view = app.role === 'host' ? app.match && { match: app.match, game: app.match.game } : client.view;
  if (app.screen === 'match' && view?.game) {
    const { match, game } = view;
    const input = app.lastInput;
    if (app.role === 'client') {
      smoothRemotes(game, app.myId, dt);
      const me = game.players[app.myId];
      if (me?.alive) me.aim = Math.atan2(input.my - me.y, input.mx - me.x);   // aim feels instant
    }
    render(ctx, game, app.myId, input);
    renderMatchHud(ctx, match, app.myId);
    updateAudio(game);

    if (match.phase === 'gameOver') {
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
