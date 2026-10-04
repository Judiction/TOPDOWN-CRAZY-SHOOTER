import { ARENA } from './game.js';

// Keyboard + mouse. Uses physical key positions (e.code), so WASD works on any keyboard layout.

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

// Which way of each axis was pressed most recently. When both opposite keys are held (left + right,
// or up + down), the newest one wins, so you never get stuck standing still.
const DIRECTION_OF = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
};
const lastPressed = { x: null, y: null };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;                    // typing a name isn't moving or drawing
    if (e.code === 'Space') e.preventDefault(); // stop the page from scrolling
    const dir = DIRECTION_OF[e.code];
    if (dir && !e.repeat) lastPressed[dir === 'left' || dir === 'right' ? 'x' : 'y'] = dir;
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  // Tracked on the whole window (not just the canvas) so aiming keeps working over menu panels.
  window.addEventListener('mousemove', (e) => {
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

export function isTyping(e) {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
}

// If both directions of an axis are held, keep only the one pressed last.
function resolve(a, b, aName, bName, last) {
  if (a && b) return last === bName ? [false, true] : [true, false];
  return [a, b];
}

// Snapshot of the local player's controls. This is exactly what a client will send to the host.
export function readInput() {
  const [left, right] = resolve(
    keys.has('KeyA') || keys.has('ArrowLeft'), keys.has('KeyD') || keys.has('ArrowRight'), 'left', 'right', lastPressed.x,
  );
  const [up, down] = resolve(
    keys.has('KeyW') || keys.has('ArrowUp'), keys.has('KeyS') || keys.has('ArrowDown'), 'up', 'down', lastPressed.y,
  );
  return {
    up,
    down,
    left,
    right,
    mx: mouse.x,
    my: mouse.y,
    click: mouse.down,
    draw: keys.has('Space'),
    reload: keys.has('KeyR'),
  };
}
