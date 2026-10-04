// The title logo: "DOODLE DUEL", pre-rendered once from the Pixelout font into assets/logo-mask.png
// (white text, hard pixels — the font file itself isn't shipped). Every frame each row of pixels is
// slid left/right along a sine wave (so the letters ripple like water), filled with a warm gradient,
// swept by a white highlight from top to bottom, and given a dark outline and drop shadow. All on a
// small canvas that CSS scales up crisply.

const W = 460, H = 170;               // logo size in game pixels (same as the mask image)
const PAD = 6;                        // room for the wave, outline and shadow

const maskImage = new Image();
maskImage.src = 'assets/logo-mask.png';
let mask = null;                      // the mask as a canvas, once loaded

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const wave = makeCanvas(W, H), waveCtx = wave.getContext('2d');
const color = makeCanvas(W, H), colorCtx = color.getContext('2d');
const dark = makeCanvas(W, H), darkCtx = dark.getContext('2d');

// Draws the logo into a W x H canvas for time t (seconds).
function drawLogo(ctx, t) {

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
  if (!mask) {
    try {
      await maskImage.decode();
    } catch {
      return;                         // image missing: leave the logo blank rather than break the menu
    }
    mask = makeCanvas(W, H);
    mask.getContext('2d').drawImage(maskImage, 0, 0);
  }
  const start = performance.now();
  const frame = (now) => {
    if (!canvas.isConnected) return;
    drawLogo(ctx, (now - start) / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export const LOGO_SIZE = { w: W, h: H };
