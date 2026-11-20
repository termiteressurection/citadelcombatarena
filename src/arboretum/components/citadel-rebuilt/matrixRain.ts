/**
 * matrixRain — imperative canvas-backed Termitesse “rain” (lodge display glyph
 * stream; not a claim that the Latin-range atlas is English or any language).
 *
 * Lives entirely outside the React tree; mounts onto the sibling
 * `<canvas id="matrix-rain">` declared in index.html. Replaces the CSS
 * animated rain on the main menu when the master visual kill switch is on.
 *
 * Architectural notes:
 *
 * - Glyph atlas is generated ONCE at app boot from the Termitesse webfont.
 *   Dimensions: 512×256 source px (2× DPR headroom), 16 cols × 8 rows, each
 *   cell 32 source px. At the shipped glyph count (39) we use 39/128 cells,
 *   leaving 3× headroom for later Termitesse expansion. Cells render at
 *   ~24 CSS px in the scene (larger, slower “strand” read than 16px).
 *   for crisp output; at DPR 1 the downsample is free.
 *
 * - Column state is a single Float32Array of length columnCount * STRIDE.
 *   No per-frame allocation. Resizes re-init in place.
 *
 * - Hidden-tab resume clamps dt to avoid a teleporting-column flash on the
 *   first frame after visibilitychange.
 *
 * - Kill switches: `citadel.visuals.next !== '1'` OR `visuals.rain === '0'`
 *   OR `visuals.termiteFont === '0'` makes init a no-op. The CSS rain in
 *   RebuiltMainMenu remains as the default fallback.
 *
 * - The rain is menu-only. The menu calls showMatrixRain() on mount and
 *   hideMatrixRain() on unmount. The in-game canvas does not need this
 *   visual and would compete with the 3D scene for attention.
 */

import { visualFlags } from './visualFlags';
import { getQualityProfile } from './qualityTier';

const CANVAS_ID = 'matrix-rain';
const FONT_FAMILY = 'Termitesse';

// Subset derived from the existing TERMITE_MATRIX_HAIKUS + digits + a few
// structural glyphs. Fits well under the 128-cell atlas capacity.
const GLYPH_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.:';
const GLYPH_COUNT = GLYPH_SET.length; // 39

const ATLAS_W = 512;
const ATLAS_H = 256;
const ATLAS_COLS = 16;
const ATLAS_CAPACITY = 128; // 16 × 8
const CELL_SRC = 32; // source px per cell in the atlas
const CELL_DST = 24; // rendered CSS px per glyph in the scene (bigger per letter)

// Float32Array layout: [y, speedPxPerSec, headGlyphIndex, brightness, depth01]
const STRIDE = 5;
const OFFS_Y = 0;
const OFFS_SPEED = 1;
const OFFS_HEAD = 2;
const OFFS_BRIGHT = 3;
const OFFS_DEPTH = 4;

let atlas: HTMLCanvasElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let columns = new Float32Array(0);
let columnCount = 0;
let rafId: number | null = null;
let lastT = 0;
let active = false;
let initialized = false;
let resizeListener: (() => void) | null = null;
let visListener: (() => void) | null = null;

/** Layout viewport size used for buffer + column math (matches fixed inset-0 canvas). */
function readViewportCss(): { w: number; h: number } {
  const w = window.innerWidth || document.documentElement.clientWidth || 1;
  const h = window.innerHeight || document.documentElement.clientHeight || 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

async function buildAtlas(): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  try {
    // Gate on the font actually being available. If fonts API is missing
    // or load rejects, the atlas still builds with the fallback monospace,
    // which is acceptable for kill-switch-off machines.
    await document.fonts.load(`1em "${FONT_FAMILY}"`);
  } catch { /* fonts API unavailable; fallback monospace is fine */ }

  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const cc = c.getContext('2d');
  if (!cc) return null;

  cc.clearRect(0, 0, ATLAS_W, ATLAS_H);
  cc.textAlign = 'center';
  cc.textBaseline = 'middle';
  // Size chosen to fit inside CELL_SRC with breathing room for descenders.
  cc.font = `30px "${FONT_FAMILY}", monospace`;
  cc.fillStyle = '#e9d5ff'; // violet-100; per-frame compositing tints.

  const n = Math.min(GLYPH_COUNT, ATLAS_CAPACITY);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / ATLAS_COLS);
    const col = i % ATLAS_COLS;
    const cx = col * CELL_SRC + CELL_SRC / 2;
    const cy = row * CELL_SRC + CELL_SRC / 2;
    cc.fillText(GLYPH_SET[i], cx, cy);
  }
  return c;
}

function resizeCanvas(): void {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = readViewportCss();
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rebuildColumns();
}

function initColumnAt(i: number, h: number): void {
  const base = i * STRIDE;
  columns[base + OFFS_Y] = -Math.random() * h;
  // Slower, calmer menu rain; actual motion also scaled by depth in frame()
  columns[base + OFFS_SPEED] = 2.2 + Math.random() * 4.8;
  columns[base + OFFS_HEAD] = Math.floor(Math.random() * GLYPH_COUNT);
  columns[base + OFFS_BRIGHT] = 0.2 + Math.random() * 0.42;
  columns[base + OFFS_DEPTH] = Math.random();
}

function rebuildColumns(): void {
  const { w, h } = readViewportCss();
  const { visuals } = getQualityProfile();
  const byWidth = Math.floor(w / visuals.rainColumnSpacing);
  const next = Math.max(10, Math.min(visuals.rainColumnCap, byWidth));
  if (next === columnCount && columns.length === next * STRIDE) return;

  const prev = columns;
  columns = new Float32Array(next * STRIDE);
  if (prev.length === next * STRIDE) {
    columns.set(prev);
  } else {
    for (let i = 0; i < next; i++) {
      initColumnAt(i, h);
    }
  }
  columnCount = next;
}

function frame(now: number): void {
  if (!active || !canvas || !ctx || !atlas) {
    rafId = null;
    return;
  }
  // dt in seconds, clamped. 0.1s cap absorbs tab-resume and long GC pauses.
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (!(dt > 0) || dt > 0.1) dt = 0.016;

  const { w, h } = readViewportCss();
  const colSpacing = w / columnCount;

  // Trail fade: a translucent dark rect per frame leaves fading tails.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(4, 3, 18, 0.11)';
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < columnCount; i++) {
    const base = i * STRIDE;
    const depth = columns[base + OFFS_DEPTH];
    // Parallax: “far” strands drift slower and read dimmer
    const speedMul = 0.55 + depth * 0.48;
    let y = columns[base + OFFS_Y] + columns[base + OFFS_SPEED] * speedMul * dt;
    if (y > h + 48) {
      y = -40 - Math.random() * 220;
      columns[base + OFFS_HEAD] = Math.floor(Math.random() * GLYPH_COUNT);
      columns[base + OFFS_SPEED] = 2.2 + Math.random() * 4.8;
    }
    columns[base + OFFS_Y] = y;

    const head = columns[base + OFFS_HEAD] | 0;
    const row = Math.floor(head / ATLAS_COLS);
    const col = head % ATLAS_COLS;
    const sx = col * CELL_SRC;
    const sy = row * CELL_SRC;
    const dx = i * colSpacing;
    // Center the wider glyph in its column for even spacing
    const dx0 = Math.max(0, dx + (colSpacing - CELL_DST) * 0.5);

    // Purple-family tint + slight hue scatter per column
    const hueT = (i * 2.1 + depth * 18) % 1;
    const hueRot = -12 + (i % 9) * 2.4 + (hueT - 0.5) * 10;
    ctx.filter = `hue-rotate(${hueRot}deg) saturate(${0.88 + (i % 5) * 0.04})`;
    // Depth: alpha; lower depth = fainter (background columns)
    const aBase = Math.min(0.86, 0.28 + columns[base + OFFS_BRIGHT] + 0.24 * (1 - depth * 0.5));
    ctx.globalAlpha = aBase;

    const t = h > 1 ? y / h : 0;
    const glowT = t > 0.38 ? Math.min(1, (t - 0.35) / 0.64) : 0;
    if (glowT > 0.04) {
      const gh = 262 + (i % 6) * 3.5;
      ctx.shadowColor = `hsla(${gh}, 88%, 72%, ${0.3 + glowT * 0.5})`;
      ctx.shadowBlur = 5 + glowT * 32;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.drawImage(atlas, sx, sy, CELL_SRC, CELL_SRC, dx0, y, CELL_DST, CELL_DST);

    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    if (Math.random() < 0.06) {
      columns[base + OFFS_HEAD] = (head + 1) % GLYPH_COUNT;
    }
  }
  ctx.globalAlpha = 1;

  rafId = requestAnimationFrame(frame);
}

/**
 * Call once at app boot. Safe to call multiple times; guarded internally.
 */
export async function initMatrixRain(): Promise<void> {
  if (initialized || typeof window === 'undefined') return;
  const flags = visualFlags();
  if (!flags.rain || !flags.termiteFont) return;

  const el = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
  if (!el) return;
  canvas = el;
  ctx = canvas.getContext('2d');
  if (!ctx) return;

  atlas = await buildAtlas();
  if (!atlas) return;

  resizeCanvas();

  resizeListener = () => resizeCanvas();
  window.addEventListener('resize', resizeListener, { passive: true });
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', resizeListener, { passive: true });
    vv.addEventListener('scroll', resizeListener, { passive: true });
  }

  visListener = () => {
    if (document.hidden) {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (active) {
      lastT = performance.now();
      if (rafId == null) rafId = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', visListener);

  initialized = true;
}

/**
 * Returns true if the user has opted into the canvas rain. Consumers use
 * this to decide whether to suppress CSS rain fallbacks. Safe before init.
 */
export function isMatrixRainEnabled(): boolean {
  const flags = visualFlags();
  return flags.rain && flags.termiteFont;
}

export function showMatrixRain(): void {
  if (!canvas || !initialized) return;
  resizeCanvas();
  canvas.style.display = 'block';
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.55s ease-out';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (canvas) canvas.style.opacity = '1';
    });
  });
  active = true;
  lastT = performance.now();
  if (rafId == null) rafId = requestAnimationFrame(frame);
}

export function hideMatrixRain(): void {
  if (!canvas) return;
  canvas.style.transition = 'none';
  canvas.style.opacity = '';
  canvas.style.display = 'none';
  active = false;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
