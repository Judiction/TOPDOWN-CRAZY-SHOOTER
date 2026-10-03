// Shared definitions: player colors, host-adjustable match settings and their defaults.

// 32 player colors: 16 hues around the wheel, each in a vivid and a light tone.
export const COLORS = [];
for (let i = 0; i < 16; i++) COLORS.push(hslToHex(i * 22.5, 0.85, 0.58));
for (let i = 0; i < 16; i++) COLORS.push(hslToHex(i * 22.5 + 11, 0.9, 0.76));

export const MAX_PLAYERS = 8;
export const NAME_MAX = 12;

export const INK_AMOUNTS = { small: 650, normal: 1000, large: 1450 };

export const DEFAULT_SETTINGS = {
  roundsToWin: 5,
  roundTime: 90,          // seconds before sudden death; 0 = no limit
  maxHp: 10,
  ink: 'normal',
  powerupInterval: 30,    // seconds between powerup spawns; 0 = off
};

// What the host can change in the lobby, and the allowed values.
export const SETTING_DEFS = [
  { key: 'roundsToWin', label: 'ROUNDS TO WIN', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], format: (v) => `${v}` },
  { key: 'roundTime', label: 'ROUND TIME', options: [0, 45, 60, 90, 120, 180], format: (v) => (v ? `${v}S` : 'NO LIMIT') },
  { key: 'maxHp', label: 'HEALTH', options: [5, 10, 15, 20], format: (v) => `${v} HITS` },
  { key: 'ink', label: 'INK', options: ['small', 'normal', 'large'], format: (v) => v.toUpperCase() },
  { key: 'powerupInterval', label: 'POWERUPS', options: [0, 15, 30, 45, 60], format: (v) => (v ? `EVERY ${v}S` : 'OFF') },
];

// The subset of settings the simulation itself needs.
export function gameRules(settings) {
  return {
    maxHp: settings.maxHp,
    penCapacity: INK_AMOUNTS[settings.ink] ?? INK_AMOUNTS.normal,
    powerupInterval: settings.powerupInterval,
  };
}

export function cleanName(name) {
  const clean = String(name ?? '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, NAME_MAX);
  return clean || 'PLAYER';
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
