// Generative background: a seed picks a random combo of retro effects (plasma waves, rings, spirals,
// moiré circles, domain warps) seen through an optional rotating kaleidoscope, colored with a
// banded, dithered, cycling, very saturated palette. Same seed = same art on every machine.
//
// Cheap by design: it renders at 160x90 (scaled up 8x for the pixelated look), uses a sine lookup
// table instead of Math.sin, and only redraws at ~30fps. No DOM here, so it can be tested in Node.

export const BG_W = 160;
export const BG_H = 90;

const TAU = Math.PI * 2;
const LUT_SIZE = 4096;
const LUT_K = LUT_SIZE / TAU;
const SIN = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) SIN[i] = Math.sin(i / LUT_K);
const sin = (x) => SIN[((x * LUT_K) | 0) & (LUT_SIZE - 1)];
const cos = (x) => sin(x + Math.PI / 2);

// Per-pixel polar coordinates around the center, computed once.
const N = BG_W * BG_H;
const RADIUS = new Float32Array(N);
const ANGLE = new Float32Array(N);
for (let y = 0; y < BG_H; y++) {
  for (let x = 0; x < BG_W; x++) {
    const dx = (x - BG_W / 2 + 0.5) / BG_H;
    const dy = (y - BG_H / 2 + 0.5) / BG_H;
    RADIUS[y * BG_W + x] = Math.hypot(dx, dy);
    ANGLE[y * BG_W + x] = Math.atan2(dy, dx);
  }
}

// 4x4 ordered (Bayer) dither, centered on 0 — gives the banded colors that retro crosshatch look.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

// ---- effect layers: each returns a function (u, v, r, a, t) -> roughly -1..1 ----

const LAYERS = {
  waves(rng) {
    const f1 = range(rng, 4, 14), f2 = range(rng, 4, 14);
    const s1 = range(rng, 0.3, 1.2) * sign(rng), s2 = range(rng, 0.3, 1.2) * sign(rng);
    return (u, v, r, a, t) => 0.5 * sin(u * f1 + t * s1) + 0.5 * sin(v * f2 + t * s2);
  },
  rings(rng) {
    const f = range(rng, 10, 32), s = range(rng, 0.8, 2.5) * sign(rng);
    return (u, v, r, a, t) => sin(r * f - t * s);
  },
  spiral(rng) {
    const k = 1 + Math.floor(rng() * 5), f = range(rng, 6, 22), s = range(rng, 0.5, 2) * sign(rng);
    return (u, v, r, a, t) => sin(a * k + r * f - t * s);
  },
  moire(rng) {
    // Interfering circles around a few drifting centers — classic screensaver stuff.
    const centers = [0, 1, 2].map(() => ({
      sx: range(rng, 0.1, 0.4), sy: range(rng, 0.1, 0.4), px: rng() * TAU, py: rng() * TAU,
    }));
    const f = range(rng, 18, 45);
    return (u, v, r, a, t) => {
      let sum = 0;
      for (const c of centers) {
        const cx = 0.45 * sin(t * c.sx + c.px), cy = 0.35 * sin(t * c.sy + c.py);
        sum += sin(Math.sqrt((u - cx) ** 2 + (v - cy) ** 2) * f);
      }
      return sum / 3;
    };
  },
  diamonds(rng) {
    const f = range(rng, 8, 24), s = range(rng, 0.5, 2) * sign(rng);
    return (u, v, r, a, t) => sin((Math.abs(u) + Math.abs(v)) * f - t * s);
  },
  warp(rng) {
    const f1 = range(rng, 3, 10), f2 = range(rng, 3, 10), s = range(rng, 0.3, 1);
    return (u, v, r, a, t) => sin(u * f1 + 2 * sin(v * f2 + t * s) + t * s * 0.5);
  },
  checker(rng) {
    const f = range(rng, 6, 18), s = range(rng, 0.2, 0.8);
    return (u, v, r, a, t) => sin(u * f + t * s) * sin(v * f - t * s);
  },
};
const LAYER_NAMES = Object.keys(LAYERS);

export function createBackground(seed) {
  const rng = mulberry32(seed);

  // Kaleidoscope: 0 = off, otherwise number of mirrored slices.
  const slices = pick(rng, [0, 0, 3, 4, 5, 6, 6, 8, 10, 12]);
  const spin = range(rng, 0.03, 0.15) * sign(rng);
  const zoomSpeed = range(rng, 0.1, 0.4);
  const zoomAmount = range(rng, 0, 0.25);

  const count = 2 + Math.floor(rng() * 2);
  const layers = [];
  for (let i = 0; i < count; i++) {
    layers.push({ fn: LAYERS[pick(rng, LAYER_NAMES)](rng), weight: range(rng, 0.5, 1) });
  }
  const totalWeight = layers.reduce((s, l) => s + l.weight, 0);

  const bands = 6 + Math.floor(rng() * 9);          // how many color steps
  const contrast = range(rng, 0.6, 1.6);
  const cycle = range(rng, 0.02, 0.12) * sign(rng); // palette cycling speed
  const palette = makePalette(rng, bands);

  const sliceAngle = slices ? TAU / slices : 0;

  // Writes one frame into a Uint32Array of BG_W * BG_H RGBA pixels (little-endian ABGR).
  function draw(pixels, t) {
    const rot = t * spin;
    const zoom = 1 + zoomAmount * sin(t * zoomSpeed);
    for (let i = 0; i < N; i++) {
      const r = RADIUS[i] * zoom;
      let a = ANGLE[i] + rot;
      if (slices) {
        // Fold the angle into one slice, mirrored, so the pattern repeats around the center.
        a -= sliceAngle * Math.floor(a / sliceAngle);
        if (a > sliceAngle / 2) a = sliceAngle - a;
      }
      const u = r * cos(a), v = r * sin(a);

      let value = 0;
      for (let l = 0; l < layers.length; l++) value += layers[l].fn(u, v, r, a, t) * layers[l].weight;
      value /= totalWeight;

      const x = i % BG_W, y = (i / BG_W) | 0;
      const p = (value * 0.5 + 0.5) * contrast + t * cycle + BAYER[(y & 3) * 4 + (x & 3)] / bands;
      let band = Math.floor(p * bands) % bands;
      if (band < 0) band += bands;
      pixels[i] = palette[band];
    }
  }

  return { draw };
}

// Cosine palette (a + b·cos(2π(c·t + d))), with whole-number c so it loops seamlessly while cycling.
// Saturation pushed well past natural, brightness held at 50–60% so walls, players and bullets read clearly.
const SATURATION_BOOST = 1.8;

function makePalette(rng, bands) {
  const a = [0, 1, 2].map(() => range(rng, 0.45, 0.6));
  const b = [0, 1, 2].map(() => range(rng, 0.45, 0.6));
  const c = [0, 1, 2].map(() => pick(rng, [1, 1, 1, 2]));
  const d = [0, 1, 2].map(() => rng());
  const brightness = range(rng, 0.5, 0.6);  // dimmed so the game on top stays readable
  const out = new Uint32Array(bands);
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const rgb = [0, 1, 2].map((k) => a[k] + b[k] * Math.cos(TAU * (c[k] * t + d[k])));
    const gray = (rgb[0] + rgb[1] + rgb[2]) / 3;
    // Saturate first, then dim, so no channel ends up brighter than `brightness`.
    const ch = rgb.map((v) => Math.round(Math.max(0, Math.min(1, gray + (v - gray) * SATURATION_BOOST)) * brightness * 255));
    out[i] = (255 << 24) | (ch[2] << 16) | (ch[1] << 8) | ch[0];
  }
  return out;
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

function range(rng, min, max) {
  return min + rng() * (max - min);
}

function sign(rng) {
  return rng() < 0.5 ? -1 : 1;
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
