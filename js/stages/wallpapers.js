// Desktop wallpapers, all painted in code and dithered down the way a 256-color screen showed them.
// Each one is built once into a canvas when a round starts. Sizes are in screen pixels.

import { VIEW_W as W, VIEW_H as H } from '../pixel.js';

function canvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth random values on a tiling grid, summed at several scales: soft shapes for very little code.
function noiseField(seed, size) {
  const next = seeded(seed);
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = next();
  const shift = Math.log2(size), m = size - 1;
  const smooth = (v) => v * v * (3 - 2 * v);
  const v = (i, j) => table[((j & m) << shift) + (i & m)];
  const at = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx;
    const bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
    return top + (bot - top) * fy;
  };
  return (x, y) => (at(x, y) * 8 + at(x * 2, y * 2) * 4 + at(x * 4, y * 4) * 2 + at(x * 8, y * 8)) / 15;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Runs `shade(x, y) -> [r, g, b]` over the canvas, then dithers it down to a small palette.
function paint(g, w, h, shade, step = 12) {
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, gr, b] = shade(x, y);
      const o = (y * w + x) * 4;
      const dither = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 14;
      d[o] = Math.round(Math.max(0, Math.min(255, r + dither)) / step) * step;
      d[o + 1] = Math.round(Math.max(0, Math.min(255, gr + dither)) / step) * step;
      d[o + 2] = Math.round(Math.max(0, Math.min(255, b + dither)) / step) * step;
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

const mix = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Blue sky and big soft clouds.
export function cloudsInto(g, w, h, seed, { sky = [46, 104, 200], top = [24, 72, 170], brightness = 1 } = {}) {
  const noise = noiseField(seed, 64);
  paint(g, w, h, (x, y) => {
    const k = y / h;
    const n = noise(x / 90, y / 60);
    const c = clamp01((n - 0.42) * 4.2) * brightness;
    const shade = 1 - Math.max(0, (noise(x / 90 + 0.2, y / 60 + 0.25) - n) * 2.2);
    const base = [0, 1, 2].map((i) => mix(top[i], sky[i], k));
    return [mix(base[0], 244 * shade, c), mix(base[1], 244 * shade, c), mix(base[2], 255 * shade, c)];
  });
}

function space(g, seed) {
  const noise = noiseField(seed, 64), glow = noiseField(seed + 9, 64);
  paint(g, W, H, (x, y) => {
    const n = clamp01((noise(x / 120, y / 90) - 0.45) * 3.4);
    const m = clamp01((glow(x / 80 + 3, y / 70) - 0.5) * 3.6);
    return [8 + n * 90 + m * 120, 6 + n * 26 + m * 30, 24 + n * 130 + m * 60];
  });
  const random = seeded(seed);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ['#ffffff', '#c0c0ff', '#ffe0a0'][Math.floor(random() * 3)];
    const s = random() < 0.12 ? 2 : 1;
    g.fillRect(Math.floor(random() * W), Math.floor(random() * H), s, s);
  }
  // A ringed planet, lit from one side.
  const px = 470, py = 110, r = 52;
  const img = g.getImageData(0, 0, W, H);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const light = clamp01(0.95 - ((x + r) / (2 * r)) * 0.25 - ((y + r) / (2 * r)) * 0.9 + (x * -0.002));
      const band = Math.sin(y * 0.28 + x * 0.05) * 0.12;
      const k = clamp01(light + band - (BAYER[((y + 64) & 3) * 4 + ((x + 64) & 3)] / 16) * 0.14);
      const o = ((py + y) * W + px + x) * 4;
      img.data[o] = 210 * k;
      img.data[o + 1] = 150 * k;
      img.data[o + 2] = 90 * k;
    }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#e0c8a0';
  for (let a = 0; a < Math.PI * 2; a += 0.012) {
    const x = px + Math.cos(a) * 84, y = py + Math.sin(a) * 18 - Math.cos(a) * 12;
    if (Math.sin(a) > -0.1 || Math.abs(Math.cos(a)) > 0.65) g.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
}

function underwater(g, seed) {
  const noise = noiseField(seed, 64);
  paint(g, W, H, (x, y) => {
    const k = y / H;
    const ray = Math.max(0, Math.sin((x + y * 0.45) / 34 + noise(x / 200, 0) * 7)) ** 6 * (1 - k) * 90;
    const sand = H - 62 + noise(x / 70, 3) * 46;
    if (y > sand) {
      const s = 160 + noise(x / 12, y / 9) * 70;
      return [s, s * 0.84, s * 0.54];
    }
    return [ray * 0.5 + mix(40, 2, k), ray + mix(150, 30, k), ray * 0.7 + mix(210, 90, k)];
  });
  const random = seeded(seed);
  const fish = (x, y, size, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, size * 3, size * 2);
    g.fillRect(x + size, y - Math.round(size / 2), size, size * 3);
    g.fillRect(x - size, y - Math.round(size / 2), size, size * 3);
    g.fillStyle = '#000000';
    g.fillRect(x + size * 2 + 1, y + 1, 1, 1);
  };
  for (let i = 0; i < 16; i++) fish(Math.floor(random() * W), 30 + Math.floor(random() * 230), 3 + Math.floor(random() * 3), ['#ffa020', '#ffe040', '#ff5050', '#60e0a0'][i % 4]);
  // Coral.
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(random() * W), tall = 16 + Math.floor(random() * 34);
    g.fillStyle = ['#c02860', '#e06030', '#8030a0'][i % 3];
    for (let t = 0; t < tall; t++) g.fillRect(x + Math.round(Math.sin(t * 0.3 + i) * 4), H - 40 - t, 4, 1);
  }
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.floor(random() * W), Math.floor(random() * 260), 2, 2);
}

function jungle(g, seed) {
  const noise = noiseField(seed, 64);
  const layers = [
    { base: 170, rise: 170, scale: 70, tone: [40, 120, 70] },
    { base: 220, rise: 150, scale: 46, tone: [24, 90, 46] },
    { base: 280, rise: 130, scale: 30, tone: [12, 60, 30] },
  ];
  paint(g, W, H, (x, y) => {
    const k = y / H;
    let color = [mix(150, 200, k), mix(220, 230, k), mix(190, 130, k)];
    layers.forEach((l, i) => {
      const edge = l.base - noise(x / l.scale + i * 7, i * 3.1) * l.rise;
      if (y > edge) {
        const leaf = noise(x / 8 + i, y / 8) - 0.45;
        color = l.tone.map((v) => v + leaf * 90);
      }
    });
    return color;
  });
  const random = seeded(seed);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(random() * W), top = Math.floor(random() * 60);
    g.fillStyle = '#0a2a14';
    for (let t = top; t < H; t++) g.fillRect(x + Math.round(Math.sin(t * 0.03 + i) * 9), t, 4, 1);
    g.fillStyle = '#1e5a30';
    for (let t = top; t < H; t += 11) g.fillRect(x + Math.round(Math.sin(t * 0.03 + i) * 9) - 5, t, 8, 3);
  }
  // Parrots, because every jungle theme had them.
  for (const [x, y, color] of [[160, 120, '#ff3030'], [420, 80, '#30a0ff']]) {
    g.fillStyle = color;
    g.fillRect(x, y, 5, 10);
    g.fillRect(x + 1, y - 3, 4, 4);
    g.fillRect(x + 1, y + 10, 3, 7);
    g.fillStyle = '#ffd030';
    g.fillRect(x + 5, y - 2, 2, 2);
  }
}

function sunset(g, seed) {
  const noise = noiseField(seed, 64);
  const horizon = 216, sunX = 320, sunY = 176, sunR = 54;
  paint(g, W, H, (x, y) => {
    if (y < horizon) {
      const k = y / horizon;
      const band = Math.sin(y * 0.12 + noise(x / 90, y / 40) * 6) * 8;
      const sky = [mix(70, 255, k) + band, mix(20, 130, k * k) + band, mix(110, 60, k)];
      const d = Math.hypot(x - sunX, y - sunY);
      if (d < sunR && (y < sunY + 8 || Math.floor(y / 5) % 2 === 0)) return [255, mix(240, 130, (y - (sunY - sunR)) / (sunR * 2)), 60];
      const glow = clamp01(1 - d / 190) ** 2;
      return [sky[0] + glow * 40, sky[1] + glow * 60, sky[2] + glow * 10];
    }
    const k = (y - horizon) / (H - horizon);
    const ripple = Math.sin(y * y * 0.012 + x * 0.05) * 16;
    const shine = clamp01(1 - Math.abs(x - sunX) / (50 + k * 90)) * (Math.floor(y / 3) % 2 ? 1 : 0.4);
    return [mix(120, 24, k) + ripple + shine * 150, mix(40, 12, k) + shine * 110, mix(90, 60, k) + ripple * 0.5];
  });
  // A palm tree.
  g.fillStyle = '#100810';
  for (let t = 0; t < 180; t++) g.fillRect(Math.round(86 + t * 0.2 + Math.sin(t * 0.03) * 7), 340 - t, 5, 1);
  const fx = 124, fy = 160;
  [-2.9, -2.3, -1.6, -0.9, -0.2, 0.3].forEach((a) => {
    for (let d = 0; d < 62; d++) {
      const x = fx + Math.cos(a) * d, y = fy + Math.sin(a) * d + d * d * 0.012;
      g.fillRect(Math.round(x), Math.round(y), 3, 2);
      if (d % 4 === 0) g.fillRect(Math.round(x), Math.round(y), 1, 7);
    }
  });
}

// Tiled patterns: one small image repeated, like the ones in Display Properties.
function tiled(g, size, draw) {
  const tile = canvas(size, size), t = tile.getContext('2d');
  draw(t, (x, y, w, h, color) => {
    t.fillStyle = color;
    t.fillRect(x, y, w, h);
  });
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, W, H);
}

function zigzag(g) {
  tiled(g, 32, (t, f) => {
    f(0, 0, 32, 32, '#5a3a8a');
    for (let i = 0; i < 8; i++) {
      f(i * 2, i * 2, 16 - i * 2, 2, '#7b52b8');
      f(16 + i * 2, 16 + i * 2, 16 - i * 2, 2, '#7b52b8');
    }
    f(16, 0, 16, 2, '#3e2868');
    f(0, 16, 16, 2, '#3e2868');
  });
}

function bricks(g) {
  tiled(g, 48, (t, f) => {
    f(0, 0, 48, 48, '#b0b0a8');
    for (const [x, y, w] of [[1, 1, 22], [25, 1, 22], [-11, 13, 22], [13, 13, 22], [37, 13, 22], [1, 25, 22], [25, 25, 22], [-11, 37, 22], [13, 37, 22], [37, 37, 22]]) {
      f(x, y, w, 10, '#a83a2a');
      f(x, y, w, 2, '#c85a40');
      f(x, y + 8, w, 2, '#7a2418');
      f(x + 7, y + 4, 2, 2, '#c85a40');
      f(x + 15, y + 6, 2, 1, '#7a2418');
    }
  });
}

function stone(g, seed) {
  const noise = noiseField(seed, 64);
  paint(g, W, H, (x, y) => {
    const n = noise(x / 16, y / 16);
    const crack = Math.abs(noise(x / 44 + 5, y / 44) - 0.5) < 0.012 ? -70 : 0;
    const v = 96 + n * 96 + crack;
    return [v * 0.92, v * 0.9, v * 0.82];
  });
}

function rivets(g) {
  tiled(g, 40, (t, f) => {
    f(0, 0, 40, 40, '#1c3a70');
    f(0, 0, 40, 1, '#2c5aa0');
    f(0, 0, 1, 40, '#2c5aa0');
    f(0, 39, 40, 1, '#0c1a38');
    f(39, 0, 1, 40, '#0c1a38');
    for (const [x, y] of [[6, 6], [30, 6], [6, 30], [30, 30]]) {
      f(x, y, 4, 4, '#90b0e0');
      f(x + 1, y + 1, 3, 3, '#3060a0');
      f(x + 2, y + 2, 2, 2, '#0c1a38');
    }
  });
}

function circuit(g) {
  tiled(g, 64, (t, f) => {
    f(0, 0, 64, 64, '#0a4a2a');
    const trace = '#30a060';
    f(4, 8, 40, 2, trace);
    f(44, 8, 2, 30, trace);
    f(44, 38, 20, 2, trace);
    f(0, 50, 22, 2, trace);
    f(20, 26, 2, 26, trace);
    f(20, 24, 14, 2, trace);
    f(0, 20, 8, 2, trace);
    for (const [x, y] of [[3, 7], [43, 37], [19, 49], [33, 23], [52, 50], [8, 34]]) {
      f(x, y, 5, 5, '#d0c040');
      f(x + 2, y + 2, 1, 1, '#0a4a2a');
    }
    f(24, 40, 14, 10, '#101010');
    for (let i = 0; i < 4; i++) {
      f(25 + i * 3, 38, 1, 2, '#c0c0c0');
      f(25 + i * 3, 50, 1, 2, '#c0c0c0');
    }
    f(52, 12, 8, 4, '#a06030');
  });
}

function teal(g) {
  g.fillStyle = '#008080';
  g.fillRect(0, 0, W, H);
}

export const WALLPAPERS = [
  { id: 'teal', name: 'WINDERS TEAL', paint: teal },
  { id: 'clouds', name: 'CLOUDS', paint: (g, seed) => cloudsInto(g, W, H, seed) },
  { id: 'space', name: 'DEEP SPACE', paint: space },
  { id: 'underwater', name: 'UNDERWATER', paint: underwater },
  { id: 'jungle', name: 'JUNGLE', paint: jungle },
  { id: 'sunset', name: 'SUNSET', paint: sunset },
  { id: 'bricks', name: 'RED BRICKS', paint: bricks },
  { id: 'stone', name: 'CARVED STONE', paint: stone },
  { id: 'rivets', name: 'BLUE RIVETS', paint: rivets },
  { id: 'circuit', name: 'CIRCUIT BOARD', paint: circuit },
  { id: 'zigzag', name: 'PURPLE ZIGZAG', paint: zigzag },
];

// `choice` is a wallpaper id, or 'random' to let the seed pick one.
export function drawWallpaper(seed, choice = 'random') {
  const c = canvas();
  const g = c.getContext('2d', { willReadFrequently: true });
  const wall = WALLPAPERS.find((w) => w.id === choice) || WALLPAPERS[seed % WALLPAPERS.length];
  wall.paint(g, seed);
  return c;
}
