// Sandbox: you plus a target dummy that respawns. Replaced by real players in step 2.

import {
  createGame, addPlayer, respawnPlayer, findFreeSpot, step, emptyInput, spawnPowerup, newBackgroundSeed,
} from './game.js';
import { initInput, readInput } from './input.js';
import { initCanvas, render } from './render.js';
import { FONT, clearSpriteCache } from './pixel.js';
import { initAudio, updateAudio } from './audio.js';

// Wait (briefly) for the pixel font so text isn't first drawn in a fallback font.
try {
  await Promise.race([document.fonts.load(`8px ${FONT}`), new Promise((r) => setTimeout(r, 3000))]);
} catch {}
document.fonts.ready.then(clearSpriteCache);

const TICK = 1 / 60;
const DUMMY_RESPAWN_DELAY = 2;

// Sandbox only: one of each powerup next to you, re-placed a few seconds after you grab it.
const TEST_POWERUPS = [
  { type: 'fat', x: 200, y: 200 },
  { type: 'ricochet', x: 300, y: 200 },
  { type: 'small', x: 200, y: 520 },
  { type: 'defense', x: 300, y: 520 },
];
const TEST_POWERUP_RESPAWN = 5;

const canvas = document.getElementById('game');
const ctx = initCanvas(canvas);
initInput(canvas);
initAudio();

const game = createGame();
addPlayer(game, 'me', { name: 'You', color: '#60a5fa', x: 250, y: 360 });
addPlayer(game, 'dummy', { name: 'Dummy', color: '#f472b6', x: 900, y: 360 });

// The dummy paints a wall at startup so there's someone else's (pink) wall to shoot at.
for (let y = 200; y <= 520; y += 4) {
  step(game, { dummy: { ...emptyInput(), draw: true, click: true, mx: 700, my: y } }, TICK);
}

// Sandbox only: B rolls a new background so you can flip through styles. (Later: a new one each round.)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') game.bgSeed = newBackgroundSeed();
});

const testSlots = TEST_POWERUPS.map((t) => ({ ...t, id: spawnPowerup(game, t.type, t.x, t.y).id, emptyFor: 0 }));

let dummyDeadFor = 0;
let last = performance.now();
let acc = 0;

function sandboxTick() {
  const dummy = game.players.dummy;
  if (!dummy.alive && (dummyDeadFor += TICK) >= DUMMY_RESPAWN_DELAY) {
    dummyDeadFor = 0;
    const spot = findFreeSpot(game);
    respawnPlayer(game, 'dummy', spot.x, spot.y);
  }

  for (const s of testSlots) {
    if (game.powerups.some((u) => u.id === s.id)) continue;
    if ((s.emptyFor += TICK) >= TEST_POWERUP_RESPAWN) {
      s.emptyFor = 0;
      s.id = spawnPowerup(game, s.type, s.x, s.y).id;
    }
  }
}

function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;

  const input = readInput();
  // Fixed-rate simulation, so the game runs the same on every machine.
  while (acc >= TICK) {
    step(game, { me: input }, TICK);
    sandboxTick();
    acc -= TICK;
  }

  render(ctx, game, 'me', input);
  updateAudio(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
