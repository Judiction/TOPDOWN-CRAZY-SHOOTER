// Sound playback. All sounds are pre-rendered by synth.js; here we just fire tiny buffer players.
// Sounds are driven by game.events, which every player will receive from the host, so everyone
// hears the same things. Kept cheap for 8 players spamming: per-type voice limits, throttling for
// noisy sounds, and a cap on how many new sounds can start per frame.

import { SFX, SR, renderMusic } from './synth.js';
import { ARENA, meteorFlashes } from './game.js';

const VOLUME = { master: 0.8, music: 0.3, sfx: 0.55 };
const PEN_VOLUME = 0.5;
const PAN_WIDTH = 0.6;                // how far left/right sounds pan with their x position (0 = mono)
const MAX_NEW_SOUNDS_PER_FRAME = 12;

// Group name → max overlapping voices (oldest is cut when full) and min seconds between starts.
const LIMITS = { shoot: 10, hit: 6, wall: 4, bounce: 4, shield: 4, pickup: 3, death: 3, explode: 4, meteorTick: 3 };
const DEFAULT_LIMIT = 3;
const MIN_GAP = { shoot: 0.012, wall: 0.025, bounce: 0.03, shield: 0.03, flame: 0.05 };
const GROUP = { shootRicochet: 'shoot', shotgun: 'shoot', uzi: 'shoot', rocket: 'shoot', sniper: 'shoot', grenade: 'shoot', laser: 'shoot', shieldBreak: 'shield', meteorBoom: 'explode' };
const groupOf = (name) => GROUP[name] || name.split('_')[0];

let ctx = null;
let master, musicBus, sfxBus;
const buffers = {};
const voices = {};                    // group -> [{ src, end }]
const lastStart = {};                 // group -> ctx time
let lastEventId = 0;
let muted = false;

const pens = {};                      // player id -> looping scratch voice
let musicSeed = null;
let music = null;                     // { src, gain }
let worker = null;

export function initAudio() {
  // Browsers only allow audio after a user gesture, so start on the first click or key press.
  const unlock = () => {
    if (!ctx) start();
    else if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement)) setMuted(!muted);
  });
}

export function setMuted(value) {
  muted = value;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME.master, ctx.currentTime, 0.02);
}

function start() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME.master;
  // Light limiter so a pile-up of shots and hits never clips.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  musicBus = ctx.createGain();
  musicBus.gain.value = VOLUME.music;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = VOLUME.sfx;
  sfxBus.connect(master);

  for (const [name, build] of Object.entries(SFX)) buffers[name] = toBuffer(limitPeak(build()));

  try {
    worker = new Worker(new URL('./music-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (e.data.seed === musicSeed) startMusic(e.data.samples);
    };
  } catch {
    worker = null;                    // very old browser: render on the main thread instead
  }
}

// Layered sounds can sum past full scale; scale those down so nothing clips.
function limitPeak(samples, max = 0.95) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak > max) for (let i = 0; i < samples.length; i++) samples[i] *= max / peak;
  return samples;
}

function toBuffer(samples) {
  const buf = ctx.createBuffer(1, samples.length, SR);
  buf.getChannelData(0).set(samples);
  return buf;
}

function panner(x) {
  if (!ctx.createStereoPanner || x == null) return null;
  const pan = ctx.createStereoPanner();
  pan.pan.value = (Math.max(0, Math.min(1, x / ARENA.w)) * 2 - 1) * PAN_WIDTH;
  return pan;
}

function play(name, x, { rate = 1, gain = 1 } = {}) {
  const buf = buffers[name];
  if (!buf) return;
  const now = ctx.currentTime;
  const group = groupOf(name);
  if (MIN_GAP[group] && now - (lastStart[group] ?? -Infinity) < MIN_GAP[group]) return;
  lastStart[group] = now;

  const list = (voices[group] ||= []);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].end <= now) list.splice(i, 1);
  if (list.length >= (LIMITS[group] ?? DEFAULT_LIMIT)) {
    try {
      list.shift().src.stop();
    } catch {}
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  const pan = panner(x);
  if (pan) {
    g.connect(pan);
    pan.connect(sfxBus);
  } else g.connect(sfxBus);
  src.start(now);
  list.push({ src, end: now + buf.duration / rate });
}

// Small random pitch wobble so rapid-fire repeats don't sound like a machine gun of identical clips.
const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

function onEvent(e) {
  switch (e.type) {
    case 'shoot': {
      if (e.w === 'laser') break;                              // the laser has its own charge + beam sounds
      const name = e.w === 'flamer' ? 'flame' : e.w && e.w !== 'pistol' ? e.w : e.ricochet ? 'shootRicochet' : 'shoot';
      play(name, e.x, { rate: jitter(0.04), gain: e.w === 'sniper' ? 0.95 : e.w === 'shotgun' ? 0.55 : 0.45 });
      break;
    }
    case 'explode': play('explode', e.x, { rate: jitter(0.06), gain: 0.7 }); break;
    case 'meteor': play('meteorBoom', e.x, { gain: 0.9 }); break;
    case 'erase': play('erase', null, { gain: 0.7 }); break;
    case 'laserCharge': play('laserCharge', e.x, { gain: 0.6 }); break;
    case 'laser': play('laser', e.x, { gain: 0.8 }); break;
    case 'heal': play('heal', e.x, { gain: 0.6 }); break;
    case 'inkRush': play('inkRush', e.x, { gain: 0.6 }); break;
    case 'blackout':
    case 'gravity':
    case 'paintbomb':
    case 'mirror':
    case 'inkstorm': play(e.type, null, { gain: 0.75 }); break;
    case 'hit': play('hit', e.x, { rate: jitter(0.05), gain: 0.4 }); break;
    case 'death': play('death', e.x, { gain: 1 }); break;
    case 'pickup': play(`pickup_${e.kind}`, e.x, { gain: 0.6 }); break;
    case 'spawn': play('spawn', e.x, { gain: 0.6 }); break;
    case 'wall': play('wall', e.x, { rate: jitter(0.12), gain: 0.55 }); break;
    case 'bounce': play('bounce', e.x, { rate: jitter(0.06), gain: 0.5 }); break;
    case 'shield': play(e.broke ? 'shieldBreak' : 'shield', e.x, { rate: jitter(0.05), gain: 0.7 }); break;
    case 'reload': play('reload', e.x, { gain: 0.5 }); break;
    case 'reloaded': play('reloaded', e.x, { gain: 0.5 }); break;
    case 'countdown': play('count', null, { gain: 0.6 }); break;
    case 'go': play('go', null, { gain: 0.6 }); break;
    case 'suddenDeath': play('suddenDeath', null, { gain: 0.6 }); break;
    case 'roundEnd': play('roundEnd', null, { gain: 0.6 }); break;
    case 'gameOver': play('gameOver', null, { gain: 0.6 }); break;
  }
}

// Call once per frame.
// Menu button blip.
export function playUi() {
  if (ctx && ctx.state === 'running') play('ui', null, { gain: 0.5 });
}

export function updateAudio(game) {
  const events = game.events;
  const newest = events.length ? events[events.length - 1].id : 0;
  if (newest < lastEventId) lastEventId = newest;            // a new game started; ids reset
  if (!ctx || ctx.state !== 'running') {
    lastEventId = newest;                                     // don't replay a backlog once sound unlocks
    return;
  }

  let budget = MAX_NEW_SOUNDS_PER_FRAME;
  for (const e of events) {
    if (e.id <= lastEventId) continue;
    lastEventId = e.id;
    if (budget-- > 0) onEvent(e);
  }

  updatePens(game);
  updateMeteorBeeps(game);
  updateMusic(game.bgSeed);
}

// ---- meteor warning beeps, in step with the flashing circle ----

const meteorBeeps = new Map();        // meteor id -> flashes already beeped

function updateMeteorBeeps(game) {
  const live = new Set();
  for (const m of game.meteors || []) {
    live.add(m.id);
    const n = meteorFlashes(m);
    const prev = meteorBeeps.get(m.id) ?? n;
    // Every second flash is the "white" one; beep on those, rising in pitch as impact nears.
    if (n > prev && n % 2 === 1) play('meteorTick', m.x, { rate: 1 + Math.min(1, m.t / m.dur) * 0.6, gain: 0.5 });
    meteorBeeps.set(m.id, n);
  }
  for (const id of meteorBeeps.keys()) if (!live.has(id)) meteorBeeps.delete(id);
}

// ---- pencil scratch: one looping voice per drawing player, volume follows pen speed ----

function updatePens(game) {
  const now = ctx.currentTime;
  for (const p of Object.values(game.players)) {
    const drawing = p.alive && p.pen && p.ink > 0;
    let pen = pens[p.id];
    if (!drawing && !pen) continue;
    if (!pen) {
      const src = ctx.createBufferSource();
      src.buffer = buffers.pen;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      const pan = panner(p.x);
      if (pan) {
        gain.connect(pan);
        pan.connect(sfxBus);
      } else gain.connect(sfxBus);
      src.start(now, Math.random() * buffers.pen.duration);
      pen = pens[p.id] = { src, gain, pan, lastX: null, lastY: null, idle: 0 };
    }

    let target = 0;
    if (drawing) {
      const speed = pen.lastX == null ? 0 : Math.hypot(p.pen.x - pen.lastX, p.pen.y - pen.lastY);
      target = Math.min(1, speed / 10) * PEN_VOLUME;            // a still pen is silent
      pen.src.playbackRate.setTargetAtTime(0.8 + Math.min(0.5, speed / 40), now, 0.03);
      if (pen.pan) pen.pan.pan.setTargetAtTime((p.pen.x / ARENA.w * 2 - 1) * PAN_WIDTH, now, 0.05);
      pen.lastX = p.pen.x;
      pen.lastY = p.pen.y;
      pen.idle = 0;
    } else {
      pen.lastX = pen.lastY = null;
      pen.idle++;
    }
    pen.gain.gain.setTargetAtTime(target, now, 0.025);

    // Stop voices that have been silent for a while (~1s), so idle players cost nothing.
    if (pen.idle > 60) {
      pen.src.stop();
      delete pens[p.id];
    }
  }
  for (const id of Object.keys(pens)) {
    if (!game.players[id]) {
      pens[id].src.stop();
      delete pens[id];
    }
  }
}

// ---- music: a new seeded loop whenever the background seed changes (every round) ----

function updateMusic(seed) {
  if (seed === musicSeed) return;
  musicSeed = seed;
  if (worker) worker.postMessage({ seed });
  else startMusic(renderMusic(seed).samples);
}

function startMusic(samples) {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = toBuffer(samples);
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + 0.5);
  src.connect(gain);
  gain.connect(musicBus);
  src.start(now);

  if (music) {
    const old = music;
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + 0.5);
    old.src.stop(now + 0.6);
  }
  music = { src, gain };
}

// For debugging: what the engine is doing right now.
export function audioStatus() {
  return {
    state: ctx ? ctx.state : 'not started',
    music: !!music,
    voices: Object.fromEntries(Object.entries(voices).map(([g, l]) => [g, l.length])),
    pens: Object.keys(pens).length,
  };
}
