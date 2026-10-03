// The lobby ("room"): who's in, their names and colors, and the host's settings.
// Changes arrive as small actions, applied by the host — exactly how remote players' requests will
// be handled once networking is in (the host applies them, then shares the updated room).

import { COLORS, MAX_PLAYERS, DEFAULT_SETTINGS, SETTING_DEFS, cleanName } from './settings.js';

const BOT_NAMES = ['BLIP', 'ZORP', 'KLONK', 'BEEPO', 'GLITCH', 'PIXL', 'SPROCKET', 'NIBBLE', 'WIDGET', 'CHONK', 'ZAPP', 'BONK'];

export function createRoom(host) {
  const room = { hostId: host.id, code: null, players: [], settings: { ...DEFAULT_SETTINGS }, inMatch: false, nextBot: 1 };
  addMember(room, host);
  return room;
}

export function takenColors(room, exceptId) {
  return new Set(room.players.filter((p) => p.id !== exceptId).map((p) => p.color));
}

// Adds a player with their preferred color if it's free, otherwise the first free one.
// Returns null when the room is full. People joining mid-match wait for the next game.
export function addMember(room, { id, name, color, isBot = false }) {
  if (room.players.length >= MAX_PLAYERS) return null;
  const taken = takenColors(room);
  const free = COLORS.filter((c) => !taken.has(c));
  const pick = COLORS.includes(color) && !taken.has(color) ? color : isBot ? mostDistinct(free, taken) : free[0];
  const member = { id, name: cleanName(name), color: pick, isBot, waiting: room.inMatch };
  room.players.push(member);
  return member;
}

export function removeMember(room, id) {
  room.players = room.players.filter((p) => p.id !== id);
}

export function canStart(room) {
  return !room.inMatch && room.players.length >= 2;
}

// Returns true if the action changed the room.
export function applyAction(room, fromId, action) {
  const me = room.players.find((p) => p.id === fromId);
  if (!me) return false;
  const isHost = fromId === room.hostId;

  switch (action.type) {
    case 'name': {
      const name = cleanName(action.name);
      if (name === me.name) return false;
      me.name = name;
      return true;
    }
    case 'color': {
      if (!COLORS.includes(action.color) || takenColors(room, fromId).has(action.color)) return false;
      me.color = action.color;
      return true;
    }
    case 'setting': {
      const def = SETTING_DEFS.find((d) => d.key === action.key);
      if (!isHost || !def || !def.options.includes(action.value)) return false;
      room.settings[action.key] = action.value;
      return true;
    }
    case 'addBot': {
      if (!isHost || room.inMatch || room.players.length >= MAX_PLAYERS) return false;
      const used = new Set(room.players.map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) || `BOT ${room.nextBot}`;
      addMember(room, { id: `bot${room.nextBot++}`, name, isBot: true });
      return true;
    }
    case 'removeBot': {
      const bot = room.players.find((p) => p.id === action.id && p.isBot);
      if (!isHost || room.inMatch || !bot) return false;
      removeMember(room, bot.id);
      return true;
    }
  }
  return false;
}

// The free color farthest from every color already in use, so bots are easy to tell apart.
function mostDistinct(free, taken) {
  if (!taken.size) return free[Math.floor(Math.random() * free.length)];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const used = [...taken].map(rgb);
  let best = free[0], bestScore = -1;
  for (const c of free) {
    const [r, g, b] = rgb(c);
    const score = Math.min(...used.map(([r2, g2, b2]) => (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
