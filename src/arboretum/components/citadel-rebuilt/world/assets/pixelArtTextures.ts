/* ─────────────────────────────────────────────────────────────────
   PIXEL ART TEXTURES
   Extracted from CityAssets.tsx.
   Pure canvas-based texture generators — no React, no components.
   All textures are lazily created and cached on first access.
   ───────────────────────────────────────────────────────────────── */
import * as THREE from 'three';

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

// ── Palm tree ────────────────────────────────────────────────────

function generatePalmTreeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x * 2, y * 2, c, 2);
  for (let y = 16; y < 32; y++) {
    const curve = Math.floor(Math.sin((y - 16) * 0.14) * 2.5);
    const x = 16 - curve;
    dp(x, y, '#000000'); dp(x + 1, y, '#000000');
    dp(x - 1, y, '#fbbf24'); dp(x + 2, y, '#fbbf24');
  }
  const leaves = [
    { dx: -1.2, dy: -1.1, len: 12 }, { dx: 1.2, dy: -1.1, len: 12 },
    { dx: -1.5, dy: -0.4, len: 10 }, { dx: 1.5, dy: -0.4, len: 10 },
    { dx: -0.6, dy: -1.4, len: 11 }, { dx: 0.6, dy: -1.4, len: 11 },
  ];
  leaves.forEach(l => {
    for (let step = 0; step < l.len; step++) {
      const t = step / l.len;
      const lx = Math.round(16 + l.dx * step);
      const ly = Math.round(16 + l.dy * step + (t * t) * 5);
      dp(lx, ly, '#000000'); dp(lx, ly - 1, '#fbbf24');
      dp(lx - 1, ly, '#fbbf24'); dp(lx + 1, ly, '#fbbf24');
    }
  });
  return makeTexture(canvas);
}

// ── Grass ────────────────────────────────────────────────────────

function generateGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
  const blades = [
    { x: 7, h: 12, skew: -2 }, { x: 11, h: 19, skew: -1 },
    { x: 16, h: 23, skew: 0 }, { x: 20, h: 17, skew: 1 },
    { x: 24, h: 13, skew: 2 }, { x: 28, h: 9, skew: 3 },
  ];
  blades.forEach(b => {
    for (let y = 0; y < b.h; y++) {
      const t = y / b.h;
      const bx = Math.round(b.x + b.skew * t);
      const by = Math.round(31 - y);
      dp(bx, by, '#22c55e'); dp(bx - 1, by, '#4ade80');
      if (y === b.h - 1) dp(bx, by - 1, '#166534');
      dp(bx - 2, by, '#14532d'); dp(bx + 1, by, '#14532d');
    }
  });
  for (let x = 5; x < 27; x++) { dp(x, 31, '#14532d'); dp(x, 30, '#166534'); }
  return makeTexture(canvas);
}

// ── Floppy disk ──────────────────────────────────────────────────

function generateFloppyDiskTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
  for (let y = 4; y < 28; y++) {
    for (let x = 4; x < 28; x++) {
      if ((x === 27 || x === 26) && y === 4) continue;
      const isBorder = x === 4 || x === 27 || y === 4 || y === 27;
      dp(x, y, isBorder ? '#22d3ee' : '#0a0f2d');
    }
  }
  for (let y = 16; y < 26; y++) for (let x = 8; x < 24; x++) dp(x, y, '#1e293b');
  for (let x = 10; x < 22; x += 2) { dp(x, 19, '#22d3ee'); dp(x, 22, '#22d3ee'); }
  for (let y = 5; y < 11; y++) for (let x = 10; x < 18; x++) dp(x, y, '#475569');
  return makeTexture(canvas);
}

// ── CRT monitor (4-frame animation) ─────────────────────────────

function generateCRTMonitorTextures(): THREE.CanvasTexture[] {
  return [0, 1, 2, 3].map(frame => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
    for (let y = 2; y < 26; y++) {
      for (let x = 2; x < 30; x++) {
        dp(x, y, (x === 2 || x === 29 || y === 2 || y === 25) ? '#a855f7' : '#020617');
      }
    }
    for (let x = 12; x < 20; x++) {
      dp(x, 26, '#a855f7'); dp(x - 2, 27, '#a855f7'); dp(x + 2, 27, '#a855f7');
    }
    if (frame === 0) {
      for (let x = 6; x < 20; x += 2) { dp(x, 8, '#22d3ee'); dp(x, 14, '#34d399'); }
    } else if (frame === 1) {
      for (let x = 8; x < 22; x += 2) dp(x, 9, '#22d3ee');
      for (let x = 4; x < 28; x++) dp(x, 15, '#ec4899');
    } else if (frame === 2) {
      for (let x = 10; x < 22; x += 2) dp(x, 10, '#ef4444');
      for (let y = 14; y < 20; y++) for (let x = 8; x < 24; x++) if ((x + y + frame) % 3 === 0) dp(x, y, '#22d3ee');
    } else {
      for (let y = 6; y < 22; y += 3) for (let x = 4; x < 28; x++) dp(x, y, '#3b82f6');
    }
    return makeTexture(canvas);
  });
}

// ── Heart ────────────────────────────────────────────────────────

function generateHeartTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
  const pts: [number, number][] = [
    [12,8],[13,8],[18,8],[19,8],
    [11,9],[12,9],[13,9],[14,9],[17,9],[18,9],[19,9],[20,9],
    [10,10],[11,10],[12,10],[13,10],[14,10],[15,10],[16,10],[17,10],[18,10],[19,10],[20,10],[21,10],
    [10,11],[11,11],[12,11],[13,11],[14,11],[15,11],[16,11],[17,11],[18,11],[19,11],[20,11],[21,11],
  ];
  for (let y = 12; y <= 22; y++) {
    const inset = y - 12;
    for (let x = 10 + inset; x <= 21 - inset; x++) pts.push([x, y]);
  }
  pts.forEach(([x, y]) => dp(x, y, '#ec4899'));
  pts.forEach(([x, y]) => {
    [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx, ny]) => {
      if (!pts.some(([hx,hy]) => hx===nx && hy===ny)) dp(nx, ny, '#000000');
    });
  });
  dp(12, 10, '#ffffff'); dp(13, 10, '#ffffff'); dp(12, 11, '#ffffff');
  return makeTexture(canvas);
}

// ── Hypercube ────────────────────────────────────────────────────

function generateHypercubeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
  const cubes = [
    { cx: 16, cy: 16, r: 6, color: '#d946ef', highlight: '#fde047' },
    { cx: 10, cy: 11, r: 4, color: '#a855f7', highlight: '#22d3ee' },
    { cx: 22, cy: 21, r: 4, color: '#a855f7', highlight: '#22d3ee' },
    { cx: 22, cy: 10, r: 3, color: '#6366f1', highlight: '#ec4899' },
    { cx:  9, cy: 22, r: 3, color: '#6366f1', highlight: '#ec4899' },
  ];
  cubes.forEach(c => {
    for (let dy = -c.r; dy <= c.r; dy++) {
      for (let dx = -c.r; dx <= c.r; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= c.r * 1.3) {
          const isEdge = dist === Math.floor(c.r * 1.3) || Math.abs(dx) === c.r || Math.abs(dy) === c.r;
          dp(c.cx + dx, c.cy + dy, isEdge ? c.highlight : c.color);
        }
      }
    }
  });
  return makeTexture(canvas);
}

// ── Glitch cloud (4-frame animation) ────────────────────────────

function generateGlitchCloudTextures(): THREE.CanvasTexture[] {
  return [0, 1, 2, 3].map(frame => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
    let seed = frame * 100;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = 4; y < 28; y++) {
      for (let x = 4; x < 28; x++) {
        const dist = Math.sqrt((x-16)**2 + (y-16)**2);
        if (dist < 10 + rand() * 4) {
          const rVal = rand();
          if (rVal > 0.65) dp(x, y, '#22d3ee');
          else if (rVal > 0.35) dp(x, y, '#ec4899');
          else if (rVal > 0.15) dp(x, y, '#0a0514');
        }
      }
    }
    return makeTexture(canvas);
  });
}

// ── Watcher eye ──────────────────────────────────────────────────

function generateWatcherEyeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dp = (x: number, y: number, c: string) => px(ctx, x, y, c);
  for (let x = 4; x < 28; x++) {
    const eyeHalfH = Math.floor(Math.sqrt(Math.max(0, 144 - (x-16)**2 * 0.25)) * 0.5);
    for (let y = 16 - eyeHalfH; y <= 16 + eyeHalfH; y++) {
      dp(x, y, (y === 16 - eyeHalfH || y === 16 + eyeHalfH || x === 4 || x === 27) ? '#a855f7' : '#0a0514');
    }
  }
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d <= 5) dp(16+dx, 16+dy, d > 3 ? '#22d3ee' : d > 1.2 ? '#fde047' : '#000000');
    }
  }
  return makeTexture(canvas);
}

// ── Image-based (external assets) ───────────────────────────────

function generatePigeonTexture(): THREE.Texture {
  const t = new THREE.TextureLoader().load('/pigeon.png');
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

function generateBisonTexture(): THREE.Texture {
  const t = new THREE.TextureLoader().load('/bison.png');
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

// ── Lazy caches ──────────────────────────────────────────────────

let _palmTree: THREE.CanvasTexture | null = null;
let _grass: THREE.CanvasTexture | null = null;
let _floppy: THREE.CanvasTexture | null = null;
let _crt: THREE.CanvasTexture[] | null = null;
let _heart: THREE.CanvasTexture | null = null;
let _hypercube: THREE.CanvasTexture | null = null;
let _glitchCloud: THREE.CanvasTexture[] | null = null;
let _watcherEye: THREE.CanvasTexture | null = null;
let _pigeon: THREE.Texture | null = null;
let _bison: THREE.Texture | null = null;

export const getPalmTreeTexture   = () => _palmTree   ??= generatePalmTreeTexture();
export const getGrassTexture      = () => _grass      ??= generateGrassTexture();
export const getFloppyDiskTexture = () => _floppy     ??= generateFloppyDiskTexture();
export const getCRTMonitorTextures = () => _crt       ??= generateCRTMonitorTextures();
export const getHeartTexture      = () => _heart      ??= generateHeartTexture();
export const getHypercubeTexture  = () => _hypercube  ??= generateHypercubeTexture();
export const getGlitchCloudTextures = () => _glitchCloud ??= generateGlitchCloudTextures();
export const getWatcherEyeTexture = () => _watcherEye ??= generateWatcherEyeTexture();
export const getPigeonTexture     = () => _pigeon     ??= generatePigeonTexture();
export const getBisonTexture      = () => _bison      ??= generateBisonTexture();
