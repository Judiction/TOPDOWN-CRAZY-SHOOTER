import { ARENA } from './game.js';

// Keyboard + mouse. Uses physical key positions (e.code), so WASD works on any keyboard layout.

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault(); // stop the page from scrolling
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    // Convert screen pixels to arena coordinates (the canvas is scaled to fit the window).
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * ARENA.w;
    mouse.y = ((e.clientY - rect.top) / rect.height) * ARENA.h;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Snapshot of the local player's controls. This is exactly what a client will send to the host.
export function readInput() {
  return {
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    mx: mouse.x,
    my: mouse.y,
    click: mouse.down,
    draw: keys.has('Space'),
    reload: keys.has('KeyR'),
  };
}
