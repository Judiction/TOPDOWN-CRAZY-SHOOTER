// 8-bit sound synthesis, modeled on the NES sound chip (2A03):
//   - pulse waves with 12.5% / 25% / 50% duty (thin → hollow → full square)
//   - a 4-bit stepped triangle (kicks, bass, soft blips)
//   - a noise channel from a 15-bit LFSR: "long" mode = hiss/crunch, "short" mode = metallic buzz
//   - 16-step volume envelopes and fast pitch sweeps
// Everything is rendered ahead of time into plain sample arrays, so playing a sound costs almost nothing.
// No DOM or Web Audio here, so it can be tested in Node.

export const SR = 22050;              // low sample rate on purpose: a bit of lo-fi grit, and half the work
const TAU = Math.PI * 2;

// ---- building blocks ----

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const vol4 = (v) => Math.round(clamp01(v) * 15) / 15;                 // NES volume: 16 steps
const fn = (v) => (typeof v === 'function' ? v : () => v);

export const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Envelope: 1 → 0 over dur. curve > 1 drops faster at the start (punchier).
export const decay = (dur, curve = 1, peak = 1) => (t) => peak * Math.max(0, 1 - t / dur) ** curve;
// Exponential pitch sweep, the classic "pew" / "boom" move.
export const sweep = (from, to, dur) => (t) => from * (to / from) ** Math.min(1, t / dur);

export const samples = (seconds) => new Float32Array(Math.ceil(seconds * SR));

// NES noise: a 15-bit shift register. Short mode taps bit 6 instead of bit 1, giving a short,
// repeating, metallic sequence.
function lfsr(short) {
  let reg = 1;
  return () => {
    const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1;
    reg = (reg >> 1) | (bit << 14);
    return reg & 1 ? -1 : 1;
  };
}

// Mixes a tone into `out`. freq/vol may be numbers or functions of t (seconds since the note started).
// wrap = write past the end back onto the start (for seamless music loops).
export function tone(out, { t0 = 0, dur, wave = 'pulse', duty = 0.5, freq, vol, wrap = false }) {
  const f = fn(freq), v = fn(vol);
  const start = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    const t = i / SR;
    phase = (phase + f(t) / SR) % 1;
    let s;
    if (wave === 'pulse') s = phase < duty ? 1 : -1;
    else s = Math.round((1 - 4 * Math.abs(phase - 0.5)) * 7.5) / 7.5;  // 4-bit staircase triangle
    out[idx] += s * vol4(v(t));
  }
}

// rate = how many times per second the shift register is clocked (higher = brighter hiss).
export function noise(out, { t0 = 0, dur, short = false, rate, vol, wrap = false }) {
  const r = fn(rate), v = fn(vol), next = lfsr(short);
  const start = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  let acc = 0, s = next();
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    const t = i / SR;
    acc += r(t) / SR;
    while (acc >= 1) {
      acc -= 1;
      s = next();
    }
    out[idx] += s * vol4(v(t));
  }
}

// ---- sound effects ----

function pickup(root) {
  // Fast rising arpeggio over two octaves, alternating duty for sparkle, last note held with vibrato.
  const notes = [0, 4, 7, 12, 16, 19, 24];
  const stepDur = 0.036;
  const out = samples(notes.length * stepDur + 0.2);
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    const f = midi(root + n);
    tone(out, {
      t0: i * stepDur,
      dur: last ? 0.16 : stepDur,
      duty: i % 2 ? 0.25 : 0.5,
      freq: last ? (t) => f * (1 + 0.012 * Math.sin(t * TAU * 14)) : f,
      vol: last ? decay(0.16, 1, 0.38) : 0.38,
    });
    // Quiet thin "echo" a step behind, the classic NES fake-reverb trick.
    tone(out, { t0: (i + 1.5) * stepDur, dur: stepDur, duty: 0.125, freq: f, vol: 0.12 });
  });
  return out;
}

export const SFX = {
  // Very short, low "thup": pulse sweeping down, with a tiny noise transient on top.
  shoot() {
    const out = samples(0.08);
    tone(out, { dur: 0.07, duty: 0.25, freq: sweep(220, 70, 0.07), vol: decay(0.07, 1.5, 0.5) });
    noise(out, { dur: 0.015, rate: 7000, vol: decay(0.015, 1, 0.35) });
    return out;
  },
  // Ricochet rounds: thinner (12.5% duty) and higher, so they're recognizable.
  shootRicochet() {
    const out = samples(0.08);
    tone(out, { dur: 0.07, duty: 0.125, freq: sweep(440, 150, 0.07), vol: decay(0.07, 1.5, 0.45) });
    noise(out, { dur: 0.012, short: true, rate: 12000, vol: decay(0.012, 1, 0.25) });
    return out;
  },
  // Impact: metallic short-mode noise crack + a square "blip" dropping in pitch.
  hit() {
    const out = samples(0.11);
    noise(out, { dur: 0.08, short: true, rate: 11000, vol: decay(0.08, 1.3, 0.5) });
    tone(out, { dur: 0.1, duty: 0.5, freq: sweep(620, 160, 0.1), vol: decay(0.1, 1.2, 0.4) });
    return out;
  },
  // Elimination: falling noise rumble + triangle dive.
  death() {
    const out = samples(0.35);
    noise(out, { dur: 0.35, rate: sweep(5000, 300, 0.35), vol: decay(0.35, 1.3, 0.5) });
    tone(out, { dur: 0.32, wave: 'triangle', freq: sweep(330, 40, 0.32), vol: decay(0.32, 1, 0.45) });
    return out;
  },
  pickup_fat: () => pickup(72),        // C5
  pickup_ricochet: () => pickup(74),   // D5
  pickup_small: () => pickup(77),      // F5
  pickup_defense: () => pickup(79),    // G5
  // A powerup appeared: soft two-note triangle "ding".
  spawn() {
    const out = samples(0.18);
    tone(out, { dur: 0.06, wave: 'triangle', freq: midi(79), vol: 0.4 });
    tone(out, { t0: 0.06, dur: 0.11, wave: 'triangle', freq: midi(84), vol: decay(0.11, 1, 0.4) });
    return out;
  },
  // Bullet chewing into a wall: low, dull noise crunch.
  wall() {
    const out = samples(0.045);
    noise(out, { dur: 0.04, rate: 2600, vol: decay(0.04, 2, 0.45) });
    return out;
  },
  // Ricochet off the arena edge: tiny rising triangle "tink".
  bounce() {
    const out = samples(0.04);
    tone(out, { dur: 0.035, wave: 'triangle', freq: sweep(1300, 2000, 0.035), vol: decay(0.035, 1, 0.4) });
    return out;
  },
  // Defense sphere deflects a bullet: bright thin ping.
  shield() {
    const out = samples(0.07);
    tone(out, { dur: 0.06, duty: 0.125, freq: sweep(1900, 1500, 0.06), vol: decay(0.06, 1, 0.3) });
    return out;
  },
  shieldBreak() {
    const out = samples(0.09);
    tone(out, { dur: 0.05, duty: 0.125, freq: sweep(1600, 900, 0.05), vol: decay(0.05, 1, 0.3) });
    noise(out, { dur: 0.08, short: true, rate: 9000, vol: decay(0.08, 1.5, 0.35) });
    return out;
  },
  // Magazine out: two mechanical clicks.
  reload() {
    const out = samples(0.1);
    for (const t0 of [0, 0.07]) {
      noise(out, { t0, dur: 0.012, rate: 16000, vol: decay(0.012, 1, 0.35) });
      tone(out, { t0, dur: 0.02, duty: 0.5, freq: 180, vol: decay(0.02, 1, 0.2) });
    }
    return out;
  },
  // Magazine in: quick rising two-note confirm.
  reloaded() {
    const out = samples(0.09);
    tone(out, { dur: 0.035, duty: 0.25, freq: midi(76), vol: 0.28 });
    tone(out, { t0: 0.035, dur: 0.05, duty: 0.25, freq: midi(83), vol: decay(0.05, 1, 0.28) });
    return out;
  },
  // Pencil scratch "shrrrr", played as a loop while someone draws: bright hiss with random grain
  // bursts (the paper's texture), high-passed so it's papery rather than rumbly.
  pen() {
    const out = samples(0.5);
    const rand = mulberry32(7);
    const next = lfsr(false);
    let acc = 0, s = 0, prevIn = 0, prevOut = 0;
    let grainLeft = 0, grainLen = 1, amp = 0;
    for (let i = 0; i < out.length; i++) {
      acc += 16000 / SR;
      while (acc >= 1) {
        acc -= 1;
        s = next();
      }
      if (grainLeft <= 0) {
        grainLen = grainLeft = Math.floor((0.006 + rand() * 0.02) * SR);
        amp = 0.25 + rand() * 0.75;
      }
      const env = amp * (0.55 + 0.45 * (grainLeft / grainLen));
      grainLeft--;
      const hp = 0.65 * (prevOut + s - prevIn);  // one-pole high-pass
      prevIn = s;
      prevOut = hp;
      out[i] = hp * env * 0.5;
    }
    return out;
  },
};

// ---- music: seeded 8-bit acid techno loop ----

const SCALES = [
  [0, 3, 5, 7, 10],           // minor pentatonic
  [0, 1, 3, 5, 7, 8, 10],     // phrygian — dark, very acid
  [0, 3, 7, 10, 12],          // minor 7th arpeggio
  [0, 2, 3, 5, 7, 8, 10],     // natural minor
];

// Renders an 8-bar loop from a seed (same seed = same track for everyone). Takes a few tens of ms,
// done once per round. Returns the samples and the tempo.
export function renderMusic(seed) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const bpm = 140 + Math.floor(rng() * 13);
  const stepDur = 60 / bpm / 4;                 // 16th notes
  const BARS = 8, STEPS = BARS * 16;
  const loopDur = STEPS * stepDur;
  const out = new Float32Array(Math.round(loopDur * SR));

  const scale = pick(SCALES);
  const root = 33 + Math.floor(rng() * 8);      // A1..E2
  const transpose = pick([5, 7, 3, -2]);        // bars 5–6 shift up/down for movement

  // One 16-step acid pattern: notes, accents and slides, like programming a TB-303.
  const pattern = Array.from({ length: 16 }, (_, i) => ({
    on: i % 4 === 0 || rng() < 0.65,
    note: (rng() < 0.4 ? 0 : pick(scale)) + (rng() < 0.22 ? 12 : 0),
    accent: rng() < 0.3,
    slide: rng() < 0.2,
  }));

  // --- drums (NES style: triangle kick, noise snare and hats) ---
  for (let k = 0; k < STEPS; k++) {
    const t0 = k * stepDur, s = k % 16, bar = Math.floor(k / 16);
    if (s % 4 === 0) {
      tone(out, { t0, dur: 0.16, wave: 'triangle', freq: sweep(170, 42, 0.11), vol: decay(0.16, 1, 0.95), wrap: true });
      noise(out, { t0, dur: 0.008, rate: 9000, vol: 0.35, wrap: true });
    }
    const roll = bar === BARS - 1 && s >= 12;    // snare roll into the loop point
    if (s === 4 || s === 12 || roll) {
      noise(out, { t0, dur: 0.13, rate: 8000, vol: decay(0.13, 1.6, roll ? 0.35 : 0.45), wrap: true });
      tone(out, { t0, dur: 0.05, wave: 'triangle', freq: sweep(220, 160, 0.05), vol: decay(0.05, 1, 0.3), wrap: true });
    }
    if (s % 4 === 2) noise(out, { t0, dur: 0.06, short: true, rate: 15000, vol: decay(0.06, 1, 0.2), wrap: true });
    if (s % 2 === 1) noise(out, { t0, dur: 0.015, short: true, rate: 17000, vol: decay(0.015, 1, 0.11), wrap: true });
  }

  // --- chiptune arpeggio lead, second half only ---
  // NES-style "fake chord": one voice flipping between chord notes 60 times a second.
  for (let half = 8; half < 16; half++) {
    const degree = pick(scale);
    const chord = [0, scale.includes(4) ? 4 : 3, 7].map((iv) => root + 36 + degree + iv);
    tone(out, {
      t0: half * 8 * stepDur,
      dur: 7 * stepDur,
      duty: 0.125,
      freq: (t) => midi(chord[Math.floor(t * 60) % 3]),
      vol: decay(7 * stepDur, 0.7, 0.16),
    });
  }

  // --- acid bass: pulse wave through a resonant low-pass whose cutoff squelches on every note ---
  const stepLen = stepDur * SR;
  let phase = 0, freq = midi(root), amp = 0;
  let low = 0, band = 0;                        // state-variable filter
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const k = Math.floor(i / stepLen) % STEPS;
    const pos = (i - k * stepLen) / stepLen;     // 0..1 through the current 16th
    const bar = Math.floor(k / 16);
    const cur = pattern[k % 16], prev = pattern[(k + 15) % 16];
    const shift = bar === 4 || bar === 5 ? transpose : 0;
    const target = midi(root + cur.note + shift);

    // Slide (portamento) into this note if the previous one was flagged, otherwise jump.
    freq = prev.slide && prev.on ? freq + (target - freq) * 0.004 : target;
    const gate = cur.on && (pos < 0.7 || cur.slide);
    amp += ((gate ? (cur.accent ? 1 : 0.7) : 0) - amp) * 0.02;   // tiny smoothing = no clicks

    // Cutoff: slow sweep across the whole loop (the "knob twist") + per-note envelope, bigger on accents.
    const sweepPos = 0.5 - 0.5 * Math.cos((TAU * t) / loopDur);
    const env = Math.exp(-(pos * stepDur) / (cur.accent ? 0.09 : 0.05));
    const cutoff = Math.min(2600, 220 + 1500 * sweepPos + env * (cur.accent ? 1700 : 900));

    phase = (phase + freq / SR) % 1;
    const duty = 0.25 + 0.12 * Math.sin((TAU * t * 4) / loopDur);  // slow pulse-width wobble
    const x = (phase < duty ? 1 : -1) * amp;

    const f = 2 * Math.sin((Math.PI * cutoff) / SR);
    const q = 0.18;                             // low damping = strong resonance (the squelch)
    low += f * band;
    const high = x - low - q * band;
    band += f * high;

    const driven = Math.tanh(low * 1.8) * 0.55;
    out[i] += Math.round(driven * 16) / 16;      // crush to ~5 bits for chip grit
  }

  // Normalize.
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= g;

  return { samples: out, bpm, duration: loopDur };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
