// Generative background: a seed picks a "recipe" — 1 to 3 effect layers (flowing noise, plasma, waves,
// Voronoi cells, metaballs, fading shapes, copper bars, moving gradients, ripples, checkerboards...),
// a way to blend them, an optional (rare) kaleidoscope, and a palette style — then animates it.
// Same seed = same art on every machine.
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

// Per-pixel coordinates, computed once: x in about -0.9..0.9, y in -0.5..0.5.
const N = BG_W * BG_H;
const PX_X = new Float32Array(N);
const PX_Y = new Float32Array(N);
for (let y = 0; y < BG_H; y++) {
  for (let x = 0; x < BG_W; x++) {
    PX_X[y * BG_W + x] = (x - BG_W / 2 + 0.5) / BG_H;
    PX_Y[y * BG_W + x] = (y - BG_H / 2 + 0.5) / BG_H;
  }
}

// 4x4 ordered (Bayer) dither, centered on 0 — gives banded colors that retro crosshatch look.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

// Smooth, tileable value noise from a seeded 64x64 grid.
function makeNoise(rng) {
  const grid = new Float32Array(64 * 64);
  for (let i = 0; i < grid.length; i++) grid[i] = rng() * 2 - 1;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) * 64, y1 = ((yi + 1) & 63) * 64;
    const a = grid[y0 + x0], b = grid[y0 + x1], c = grid[y1 + x0], d = grid[y1 + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// A point drifting around on a Lissajous path.
function drifter(rng, ax = 0.7, ay = 0.4) {
  const sx = range(rng, 0.1, 0.5), sy = range(rng, 0.1, 0.5), px = rng() * TAU, py = rng() * TAU;
  return (t) => [ax * sin(t * sx + px), ay * sin(t * sy + py)];
}

// ---- effect layers: build(rng) returns { frame(t), at(u, v) -> roughly -1..1 } ----
// frame() runs once per frame (move points around); at() runs per pixel, so it must stay cheap.

const LAYERS = {
  // Soft clouds of value noise drifting along.
  noise: { weight: 3, build(rng) {
    const n = makeNoise(rng), f = range(rng, 3, 8), vx = range(rng, -0.6, 0.6), vy = range(rng, -0.6, 0.6);
    const octaves = rng() < 0.6 ? 2 : 1;
    let ox = 0, oy = 0, tt = 0;
    return {
      frame(t) { ox = t * vx; oy = t * vy; tt = t; },
      at(u, v) {
        let s = n(u * f + ox, v * f + oy);
        if (octaves > 1) s = s * 0.65 + n(u * f * 2.1 - oy + 17, v * f * 2.1 + ox + tt * 0.2) * 0.35;
        return s * 1.4;
      },
    };
  } },
  // Noise pushed around by more noise: liquid, marbled flows.
  flow: { weight: 3, build(rng) {
    const n = makeNoise(rng), f = range(rng, 2, 5), amp = range(rng, 0.6, 1.6), sp = range(rng, 0.1, 0.4);
    let tt = 0;
    return {
      frame(t) { tt = t * sp; },
      at(u, v) {
        const wx = n(u * f + tt, v * f) * amp, wy = n(u * f + 40, v * f - tt) * amp;
        return n(u * f + wx + 9, v * f + wy + 9) * 1.5;
      },
    };
  } },
  // Classic demoscene plasma.
  plasma: { weight: 2, build(rng) {
    const f1 = range(rng, 3, 9), f2 = range(rng, 3, 9), f3 = range(rng, 2, 7), f4 = range(rng, 4, 12);
    const c = drifter(rng);
    let cx = 0, cy = 0, tt = 0;
    return {
      frame(t) { [cx, cy] = c(t); tt = t; },
      at(u, v) {
        return (sin(u * f1 + tt) + sin(v * f2 + tt * 1.3) + sin((u + v) * f3 + tt * 0.7) + sin(Math.sqrt((u - cx) ** 2 + (v - cy) ** 2) * f4 + tt)) / 3;
      },
    };
  } },
  // Interfering sine waves.
  waves: { weight: 2, build(rng) {
    const f1 = range(rng, 4, 14), f2 = range(rng, 4, 14);
    const s1 = range(rng, 0.3, 1.2) * sign(rng), s2 = range(rng, 0.3, 1.2) * sign(rng);
    let tt = 0;
    return { frame(t) { tt = t; }, at: (u, v) => 0.5 * sin(u * f1 + tt * s1) + 0.5 * sin(v * f2 + tt * s2) };
  } },
  // Stripes whose angle slowly turns.
  stripes: { weight: 2, build(rng) {
    const f = range(rng, 6, 22), s = range(rng, 0.5, 2) * sign(rng), a0 = rng() * TAU, rot = range(rng, 0.02, 0.12) * sign(rng);
    let ca = 1, sa = 0, tt = 0;
    return {
      frame(t) { ca = cos(a0 + t * rot); sa = sin(a0 + t * rot); tt = t; },
      at: (u, v) => sin((u * ca + v * sa) * f + tt * s),
    };
  } },
  // A big, slow gradient sweeping across the screen.
  gradient: { weight: 2, build(rng) {
    const f = range(rng, 1.2, 3.5), s = range(rng, 0.2, 0.7) * sign(rng), a0 = rng() * TAU, rot = range(rng, 0.02, 0.1) * sign(rng);
    let ca = 1, sa = 0, tt = 0;
    return {
      frame(t) { ca = cos(a0 + t * rot); sa = sin(a0 + t * rot); tt = t; },
      at: (u, v) => sin((u * ca + v * sa) * f + tt * s),
    };
  } },
  // Domain-warped sine bands.
  warp: { weight: 2, build(rng) {
    const f1 = range(rng, 3, 10), f2 = range(rng, 3, 10), s = range(rng, 0.3, 1);
    let tt = 0;
    return { frame(t) { tt = t; }, at: (u, v) => sin(u * f1 + 2 * sin(v * f2 + tt * s) + tt * s * 0.5) };
  } },
  // Voronoi cells drifting around: stained glass / cracked tiles.
  voronoi: { weight: 2, build(rng) {
    const k = 5 + Math.floor(rng() * 5);
    const pts = Array.from({ length: k }, () => drifter(rng, 0.95, 0.55));
    const shades = Array.from({ length: k }, () => rng() * 2 - 1);
    const edges = rng() < 0.5;
    const cur = new Float32Array(k * 2);
    return {
      frame(t) { pts.forEach((p, i) => { const [x, y] = p(t); cur[i * 2] = x; cur[i * 2 + 1] = y; }); },
      at(u, v) {
        let d1 = 9, d2 = 9, best = 0;
        for (let i = 0; i < k; i++) {
          const d = (u - cur[i * 2]) ** 2 + (v - cur[i * 2 + 1]) ** 2;
          if (d < d1) { d2 = d1; d1 = d; best = i; } else if (d < d2) d2 = d;
        }
        if (edges) return Math.sqrt(d2) - Math.sqrt(d1) < 0.03 ? 1 : shades[best] * 0.8;
        return shades[best] * 0.6 + 0.4 * sin(Math.sqrt(d1) * 30);
      },
    };
  } },
  // Gooey metaballs.
  blobs: { weight: 2, build(rng) {
    const k = 3 + Math.floor(rng() * 4);
    const pts = Array.from({ length: k }, () => drifter(rng, 0.8, 0.45));
    const size = range(rng, 0.012, 0.03);
    const cur = new Float32Array(k * 2);
    return {
      frame(t) { pts.forEach((p, i) => { const [x, y] = p(t); cur[i * 2] = x; cur[i * 2 + 1] = y; }); },
      at(u, v) {
        let f = 0;
        for (let i = 0; i < k; i++) f += size / ((u - cur[i * 2]) ** 2 + (v - cur[i * 2 + 1]) ** 2 + 0.002);
        return Math.min(1, f - 1);
      },
    };
  } },
  // Circles, squares and diamonds fading in and out across the screen.
  shapes: { weight: 3, build(rng) {
    const k = 6 + Math.floor(rng() * 7);
    const kind = Math.floor(rng() * 3);           // 0 circles, 1 squares, 2 diamonds (one kind per recipe)
    const list = Array.from({ length: k }, () => ({
      x: range(rng, -0.85, 0.85), y: range(rng, -0.45, 0.45), r: range(rng, 0.06, 0.25),
      sp: range(rng, 0.3, 1.1), ph: rng() * TAU, drift: range(rng, -0.08, 0.08),
    }));
    const alpha = new Float32Array(k), xs = new Float32Array(k);
    return {
      frame(t) {
        list.forEach((s, i) => {
          const a = sin(t * s.sp + s.ph);
          alpha[i] = a > 0 ? a * a : 0;
          xs[i] = ((s.x + t * s.drift + 0.9) % 1.8 + 1.8) % 1.8 - 0.9;
        });
      },
      at(u, v) {
        let best = 0;
        for (let i = 0; i < k; i++) {
          if (alpha[i] <= best) continue;
          const s = list[i], dx = Math.abs(u - xs[i]), dy = Math.abs(v - s.y);
          const d = kind === 0 ? Math.sqrt(dx * dx + dy * dy) : kind === 1 ? Math.max(dx, dy) : dx + dy;
          if (d < s.r) best = alpha[i] * (d > s.r * 0.8 ? 1 : 0.7);
        }
        return best * 2 - 1;
      },
    };
  } },
  // Copper bars sliding up and down (or left and right), like an old demo.
  bars: { weight: 2, build(rng) {
    const k = 3 + Math.floor(rng() * 3), vertical = rng() < 0.4, sharp = range(rng, 6, 14);
    const bars = Array.from({ length: k }, () => ({ s: range(rng, 0.4, 1.4), p: rng() * TAU }));
    const pos = new Float32Array(k);
    return {
      frame(t) { bars.forEach((b, i) => (pos[i] = 0.42 * sin(t * b.s + b.p) * (vertical ? 2 : 1))); },
      at(u, v) {
        const c = vertical ? u : v;
        let best = 0;
        for (let i = 0; i < k; i++) best = Math.max(best, 1 - Math.min(1, Math.abs(c - pos[i]) * sharp));
        return best * 2 - 1;
      },
    };
  } },
  // Ripples spreading from a point that wanders around (not always the middle).
  ripple: { weight: 1, build(rng) {
    const f = range(rng, 14, 34), s = range(rng, 1, 3), c = drifter(rng);
    let cx = 0, cy = 0, tt = 0;
    return { frame(t) { [cx, cy] = c(t); tt = t; }, at: (u, v) => sin(Math.sqrt((u - cx) ** 2 + (v - cy) ** 2) * f - tt * s) };
  } },
  // Interfering circles around a few drifting centers — classic screensaver stuff.
  moire: { weight: 1, build(rng) {
    const pts = [0, 1, 2].map(() => drifter(rng, 0.45, 0.35));
    const f = range(rng, 18, 45);
    const cur = new Float32Array(6);
    return {
      frame(t) { pts.forEach((p, i) => { const [x, y] = p(t); cur[i * 2] = x; cur[i * 2 + 1] = y; }); },
      at(u, v) {
        let s = 0;
        for (let i = 0; i < 3; i++) s += sin(Math.sqrt((u - cur[i * 2]) ** 2 + (v - cur[i * 2 + 1]) ** 2) * f);
        return s / 3;
      },
    };
  } },
  // A rotating, breathing checkerboard.
  checker: { weight: 1, build(rng) {
    const f = range(rng, 6, 16), rot = range(rng, 0.05, 0.2) * sign(rng), zoom = range(rng, 0.1, 0.35);
    let ca = 1, sa = 0, z = 1;
    return {
      frame(t) { ca = cos(t * rot); sa = sin(t * rot); z = f * (1 + zoom * sin(t * 0.4)); },
      at: (u, v) => sin((u * ca - v * sa) * z) * sin((u * sa + v * ca) * z) * 2,
    };
  } },
  // Diamond rings around a wandering point.
  diamonds: { weight: 1, build(rng) {
    const f = range(rng, 8, 24), s = range(rng, 0.5, 2) * sign(rng), c = drifter(rng);
    let cx = 0, cy = 0, tt = 0;
    return { frame(t) { [cx, cy] = c(t); tt = t; }, at: (u, v) => sin((Math.abs(u - cx) + Math.abs(v - cy)) * f - tt * s) };
  } },
};
const LAYER_POOL = Object.entries(LAYERS).flatMap(([name, l]) => Array(l.weight).fill(name));

export function createBackground(seed) {
  const rng = mulberry32(seed);

  // Kaleidoscope is now the exception, not the rule.
  const slices = rng() < 0.2 ? pick(rng, [3, 4, 5, 6, 8, 10]) : 0;
  const spin = range(rng, 0.03, 0.15) * sign(rng);
  const zoomSpeed = range(rng, 0.1, 0.4);
  const zoomAmount = range(rng, 0, 0.2);
  const driftX = range(rng, -0.05, 0.05), driftY = range(rng, -0.03, 0.03);

  const count = pick(rng, [1, 1, 2, 2, 2, 3]);
  const names = [];
  while (names.length < count) {
    const name = pick(rng, LAYER_POOL);
    if (!names.includes(name)) names.push(name);
  }
  // Sparse layers (a few shapes on a flat field) always get a moving backdrop, so no recipe is boring.
  const SPARSE = ['shapes', 'blobs', 'bars'];
  const sparse = names.some((n) => SPARSE.includes(n));
  if (sparse && names.every((n) => SPARSE.includes(n))) names.push(pick(rng, ['noise', 'flow', 'gradient', 'plasma']));
  const layers = names.map((name) => ({ ...LAYERS[name].build(rng), weight: range(rng, 0.5, 1) }));
  const totalWeight = layers.reduce((s, l) => s + l.weight, 0);
  const blend = layers.length === 1 ? 'mix' : sparse ? pick(rng, ['mix', 'max']) : pick(rng, ['mix', 'mix', 'multiply', 'max']);

  const bands = pick(rng, [4, 5, 6, 8, 10, 12, 16]);
  const dither = rng() < 0.75 ? 1 : 0;
  const contrast = range(rng, 0.9, 1.8);
  const cycle = range(rng, 0.01, 0.12) * sign(rng);
  const palette = makePalette(rng, bands);

  const sliceAngle = slices ? TAU / slices : 0;
  // Running range of the pattern's values, used to stretch every recipe over the whole palette
  // (otherwise some come out as one flat color).
  let lo = -1, hi = 1;

  // Writes one frame into a Uint32Array of BG_W * BG_H RGBA pixels (little-endian ABGR).
  function draw(pixels, t) {
    for (const l of layers) l.frame(t);
    const zoom = 1 + zoomAmount * sin(t * zoomSpeed);
    const rot = t * spin, ox = t * driftX, oy = t * driftY;
    const span = Math.max(0.05, hi - lo), mid = lo;
    let frameLo = Infinity, frameHi = -Infinity;
    for (let i = 0; i < N; i++) {
      let u, v;
      if (slices) {
        // Fold the angle into one mirrored slice so the pattern repeats around the center.
        const x = PX_X[i], y = PX_Y[i];
        const r = Math.sqrt(x * x + y * y) * zoom;
        let a = Math.atan2(y, x) + rot;
        a -= sliceAngle * Math.floor(a / sliceAngle);
        if (a > sliceAngle / 2) a = sliceAngle - a;
        u = r * cos(a);
        v = r * sin(a);
      } else {
        u = PX_X[i] * zoom + ox;
        v = PX_Y[i] * zoom + oy;
      }

      let value;
      if (blend === 'mix') {
        value = 0;
        for (let l = 0; l < layers.length; l++) value += layers[l].at(u, v) * layers[l].weight;
        value /= totalWeight;
      } else if (blend === 'multiply') {
        value = 1;
        for (let l = 0; l < layers.length; l++) value *= layers[l].at(u, v);
      } else {
        value = -1;
        for (let l = 0; l < layers.length; l++) value = Math.max(value, layers[l].at(u, v));
      }

      if (value < frameLo) frameLo = value;
      if (value > frameHi) frameHi = value;
      const x = i % BG_W, y = (i / BG_W) | 0;
      const p = ((value - mid) / span) * contrast + t * cycle + (dither * BAYER[(y & 3) * 4 + (x & 3)]) / bands;
      let band = Math.floor(p * bands) % bands;
      if (band < 0) band += bands;
      pixels[i] = palette[band];
    }
    // Ease toward this frame's range so the colors don't jump around.
    const ease = t === 0 ? 1 : 0.15;
    lo += (frameLo - lo) * ease;
    hi += (frameHi - hi) * ease;
  }

  return { draw };
}

// ---- palettes ----
// Colors are pushed past natural saturation, then held at 50–60% brightness so walls, players and
// bullets read clearly on top.
const SATURATION_BOOST = 1.8;

function makePalette(rng, bands) {
  const style = pick(rng, ['cosine', 'cosine', 'duotone', 'tritone', 'mono', 'rainbow']);
  const brightness = range(rng, 0.5, 0.6);
  const hueA = rng(), hueB = (hueA + range(rng, 0.25, 0.6)) % 1, hueC = (hueB + range(rng, 0.2, 0.5)) % 1;
  const a = [0, 1, 2].map(() => range(rng, 0.45, 0.6));
  const b = [0, 1, 2].map(() => range(rng, 0.45, 0.6));
  const c = [0, 1, 2].map(() => pick(rng, [1, 1, 1, 2]));
  const d = [0, 1, 2].map(() => rng());

  const out = new Uint32Array(bands);
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    // Cyclic shapes (so palette cycling has no seam): go out and back.
    const tri = 1 - Math.abs(2 * t - 1);
    let rgb;
    if (style === 'cosine') rgb = [0, 1, 2].map((k) => a[k] + b[k] * Math.cos(TAU * (c[k] * t + d[k])));
    else if (style === 'duotone') rgb = mixRgb(hsv(hueA, 1, 0.35), hsv(hueB, 1, 1), tri);
    else if (style === 'tritone') rgb = tri < 0.5 ? mixRgb(hsv(hueA, 1, 0.3), hsv(hueB, 1, 0.9), tri * 2) : mixRgb(hsv(hueB, 1, 0.9), hsv(hueC, 0.8, 1), tri * 2 - 1);
    else if (style === 'mono') rgb = hsv(hueA + 0.08 * tri, 1 - 0.4 * tri, 0.25 + 0.75 * tri);
    else rgb = hsv(hueA + t, 1, 1);
    const gray = (rgb[0] + rgb[1] + rgb[2]) / 3;
    // Saturate first, then dim, so no channel ends up brighter than `brightness`.
    const ch = rgb.map((v) => Math.round(Math.max(0, Math.min(1, gray + (v - gray) * SATURATION_BOOST)) * brightness * 255));
    out[i] = (255 << 24) | (ch[2] << 16) | (ch[1] << 8) | ch[0];
  }
  return out;
}

function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

function mixRgb(x, y, t) {
  return x.map((v, i) => v + (y[i] - v) * t);
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
