// The title logo: "DOODLE DUEL" in the Pixelout font, rendered once to hard pixels, then every frame
// each row of pixels is slid left/right along a sine wave (so the letters ripple like water), filled
// with a warm gradient, swept by a white highlight from top to bottom, and given a dark outline and
// drop shadow. All on a small canvas that CSS scales up crisply.

const FONT = 'Pixelout';
const W = 460, H = 170;               // logo size in game pixels
const LINES = [
  { text: 'DOODLE', size: 78, y: 4 },
  { text: 'DUEL', size: 78, y: 84 },
];
const PAD = 6;                        // room for the wave, outline and shadow

let mask = null;                      // white text, hard pixels

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildMask() {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const line of LINES) {
    g.font = `${line.size}px ${FONT}`;
    g.fillText(line.text, W / 2, line.y + PAD);
  }
  // Threshold to on/off pixels so the font stays crisp and aliased.
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] >= 110;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = on ? 255 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const wave = makeCanvas(W, H), waveCtx = wave.getContext('2d');
const color = makeCanvas(W, H), colorCtx = color.getContext('2d');
const dark = makeCanvas(W, H), darkCtx = dark.getContext('2d');

// Draws the logo into `canvas` (W x H) for time t (seconds).
function drawLogo(ctx, t) {
  if (!mask) mask = buildMask();

  // 1) Ripple: shift every row along a travelling sine wave.
  waveCtx.clearRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const dx = Math.round(Math.sin(y * 0.11 - t * 3.2) * 3 + Math.sin(y * 0.031 + t * 1.3) * 2);
    waveCtx.drawImage(mask, 0, y, W, 1, dx, y, W, 1);
  }

  // 2) Color: warm vertical gradient + a bright band sweeping top → bottom.
  colorCtx.globalCompositeOperation = 'copy';
  colorCtx.drawImage(wave, 0, 0);
  colorCtx.globalCompositeOperation = 'source-atop';
  const base = colorCtx.createLinearGradient(0, PAD, 0, H - PAD);
  base.addColorStop(0, '#ff5ea8');
  base.addColorStop(0.45, '#ff9f45');
  base.addColorStop(0.55, '#5ee7ff');
  base.addColorStop(1, '#b388ff');
  colorCtx.fillStyle = base;
  colorCtx.fillRect(0, 0, W, H);
  const k = (t * 0.45) % 1;
  const band = -40 + k * (H + 80);
  const shine = colorCtx.createLinearGradient(0, band - 22, 0, band + 22);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  colorCtx.fillStyle = shine;
  colorCtx.fillRect(0, band - 22, W, 44);

  // 3) A dark copy for the outline and drop shadow.
  darkCtx.globalCompositeOperation = 'copy';
  darkCtx.drawImage(wave, 0, 0);
  darkCtx.globalCompositeOperation = 'source-in';
  darkCtx.fillStyle = '#12051f';
  darkCtx.fillRect(0, 0, W, H);

  ctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(dark, 0, 5);                                    // drop shadow
  ctx.globalAlpha = 1;
  for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.drawImage(dark, ox, oy);
  ctx.drawImage(color, 0, 0);
}

// Runs the logo animation on a <canvas> until it's removed from the page.
export async function mountLogo(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  try {
    await document.fonts.load(`78px ${FONT}`);
  } catch {}
  const start = performance.now();
  const frame = (now) => {
    if (!canvas.isConnected) return;
    drawLogo(ctx, (now - start) / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export const LOGO_SIZE = { w: W, h: H };
