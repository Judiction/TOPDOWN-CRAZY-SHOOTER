// App flow: title → lobby → match (rounds) → winner screen → back to lobby or title.
// For now this browser is always the host and runs the match itself; bots fill the other seats.
// Networking plugs in at the "NET:" notes: the host will share room/match state, clients send input.

import { emptyInput, newBackgroundSeed } from './game.js';
import { createMatch, stepMatch } from './match.js';
import { createBrain, botInput } from './bots.js';
import { createRoom, applyAction, canStart } from './room.js';
import { cleanName } from './settings.js';
import { initInput, readInput, isTyping } from './input.js';
import { initCanvas, render, renderBackdrop, renderMatchHud } from './render.js';
import { FONT, clearSpriteCache } from './pixel.js';
import { initAudio, updateAudio, playUi } from './audio.js';
import { createUI } from './ui.js';

// Wait (briefly) for the pixel font so text isn't first drawn in a fallback font.
try {
  await Promise.race([document.fonts.load(`8px ${FONT}`), new Promise((r) => setTimeout(r, 3000))]);
} catch {}
document.fonts.ready.then(clearSpriteCache);

const TICK = 1 / 60;
const LOCAL_ID = 'local';             // NET: becomes this browser's peer id
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
  room: null,
  match: null,
  brains: {},                         // bot id -> AI state
  menuOpen: false,
  winnerShownAt: null,
  lastInput: emptyInput(),
};
// What plays behind the menus: just background art + music.
const menuScene = { events: [], players: {}, bgSeed: newBackgroundSeed() };

const ui = createUI(document.getElementById('ui'), {
  onClick: playUi,
  onHost(name) {
    prefs.name = cleanName(name);
    savePrefs();
    app.room = createRoom({ id: LOCAL_ID, name: prefs.name, color: prefs.color });
    goLobby();
  },
  onJoin(name) {
    prefs.name = cleanName(name);
    savePrefs();
    // NET: connect to the host's room here.
    ui.setMessage('ONLINE PLAY ARRIVES IN THE NEXT UPDATE. HOST A GAME AND ADD BOTS FOR NOW!');
  },
  onAction(action) {
    if (!applyAction(app.room, LOCAL_ID, action)) return;
    const me = app.room.players.find((p) => p.id === LOCAL_ID);
    prefs.name = me.name;
    prefs.color = me.color;
    savePrefs();
    ui.updateLobby(app.room, LOCAL_ID);
  },
  onStart: startMatch,
  onLeave: goTitle,
  onResume: closeMenu,
  onEndMatch: endMatch,
  onPlayAgain: endMatch,
  onMenu: goTitle,
});

function goTitle() {
  app.screen = 'title';
  app.room = null;
  app.match = null;
  document.body.classList.remove('in-match');
  const code = new URLSearchParams(location.search).get('room') || '';
  ui.showTitle({ name: prefs.name || '', code });
}

function goLobby() {
  app.screen = 'lobby';
  app.room.inMatch = false;
  for (const p of app.room.players) p.waiting = false;
  document.body.classList.remove('in-match');
  ui.showLobby(app.room, LOCAL_ID);
}

function startMatch() {
  const room = app.room;
  if (!canStart(room)) return;
  room.inMatch = true;
  app.match = createMatch(room.settings, room.players);
  app.brains = Object.fromEntries(room.players.filter((p) => p.isBot).map((p) => [p.id, createBrain()]));
  app.screen = 'match';
  app.menuOpen = false;
  app.winnerShownAt = null;
  ui.hide();
  document.body.classList.add('in-match');
}

// Host ends the match (from the ESC menu, or "play again"): everyone returns to the lobby.
function endMatch() {
  if (app.match) menuScene.bgSeed = app.match.game.bgSeed;   // keep the current art + music going
  app.match = null;
  app.menuOpen = false;
  goLobby();
}

function openMenu() {
  app.menuOpen = true;
  ui.showPause(true);
}

function closeMenu() {
  app.menuOpen = false;
  ui.hide();
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || isTyping(e) || app.screen !== 'match' || app.match?.phase === 'gameOver') return;
  if (app.menuOpen) closeMenu();
  else openMenu();
});

let last = performance.now();
let acc = 0;

function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;

  const m = app.screen === 'match' ? app.match : null;
  if (m) {
    // While the ESC menu is open you stand still but keep aiming where you were.
    const input = app.menuOpen ? { ...emptyInput(), mx: app.lastInput.mx, my: app.lastInput.my } : readInput();
    app.lastInput = input;
    // Fixed-rate simulation, so the game runs the same on every machine.
    while (acc >= TICK) {
      const inputs = { [LOCAL_ID]: input };    // NET: plus the latest input from each remote player
      for (const id of Object.keys(app.brains)) inputs[id] = botInput(m.game, id, app.brains[id], TICK);
      stepMatch(m, inputs, TICK);
      acc -= TICK;
    }
    render(ctx, m.game, LOCAL_ID, input);
    renderMatchHud(ctx, m, LOCAL_ID);
    updateAudio(m.game);

    if (m.phase === 'gameOver') {
      app.winnerShownAt ??= now + WINNER_SCREEN_DELAY;
      if (now >= app.winnerShownAt && ui.screen !== 'gameover') {
        app.menuOpen = false;
        document.body.classList.remove('in-match');
        ui.showGameOver(m, true);
      }
    }
  } else {
    acc = 0;
    renderBackdrop(ctx, menuScene.bgSeed);
    updateAudio(menuScene);
  }

  requestAnimationFrame(frame);
}

goTitle();
requestAnimationFrame(frame);
