import * as THREE from 'three';

export type Ps1TexKind =
  | 'sand'
  | 'stone'
  | 'flagstone'
  | 'bronze'
  | 'tunic'
  | 'banner'
  | 'wood'
  | 'water'
  | 'rune';

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

const cache = new Map<Ps1TexKind, THREE.CanvasTexture | null>();

function hash2(x: number, y: number, seed = 1337): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function bayerPick(x: number, y: number, t: number): number {
  const b = BAYER4[(y & 3) * 4 + (x & 3)] / 16;
  return t > b ? 1 : 0;
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function buildCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function fillDither(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixelFn: (x: number, y: number) => [number, number, number],
) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y);
      const i = (y * w + x) * 4;
      // Slight PS1 15-bit color quantization feel
      d[i] = clamp255(r) & 0xf8;
      d[i + 1] = clamp255(g) & 0xf8;
      d[i + 2] = clamp255(b) & 0xf8;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function createTexture(kind: Ps1TexKind): THREE.CanvasTexture | null {
  switch (kind) {
    case 'sand':
      return buildCanvas(64, 64, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const n = hash2(x, y, 17);
          const rake = Math.sin((y + Math.sin(x * 0.25) * 1.5) * 0.48) * 0.5 + 0.5;
          const pebble = hash2(x >> 1, y >> 1, 91) > 0.94 ? 1 : 0;
          const dark = bayerPick(x, y, 0.35 + rake * 0.25 + n * 0.25);
          if (pebble) return [124, 100, 74];
          return dark ? [102, 78, 56] : [76, 56, 42];
        });
      });

    case 'stone':
      return buildCanvas(64, 64, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const row = Math.floor(y / 16);
          const offset = (row % 2) * 16;
          const bx = (x + offset) % 32;
          const by = y % 16;
          if (by === 0 || bx === 0) return [34, 28, 46]; // deep mortar
          if (by === 1 || bx === 1) return [118, 108, 134]; // bevel highlight
          if (by === 15 || bx === 31) return [46, 38, 62]; // bottom/right shadow
          const blockNoise = hash2(row, Math.floor((x + offset) / 32), 55);
          const grit = hash2(x, y, 203);
          const hi = bayerPick(x, y, 0.35 + blockNoise * 0.25 + grit * 0.3);
          return hi ? [98, 88, 114] : [74, 66, 90];
        });
      });

    case 'flagstone':
      return buildCanvas(64, 64, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const tileX = x % 32, tileY = y % 32;
          const seam = tileX === 0 || tileY === 0;
          const goldTrim = (x % 64 === 1 && y % 4 !== 0) || (y % 64 === 1 && x % 4 !== 0);
          if (seam) return [22, 16, 36];
          if (goldTrim) return [142, 108, 44];
          const tint = hash2(Math.floor(x / 32), Math.floor(y / 32), 77);
          const speck = hash2(x, y, 409);
          const pick = bayerPick(x, y, 0.3 + tint * 0.35 + speck * 0.25);
          return pick ? [64, 54, 86] : [46, 38, 66];
        });
      });

    case 'bronze':
      return buildCanvas(32, 32, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const rivet = (x === 3 || x === 28) && (y === 3 || y === 28);
          if (rivet) return [248, 214, 128];
          if (x === 0 || y === 0) return [196, 148, 64];
          if (x === w - 1 || y === h - 1) return [56, 40, 20];
          const gleam = Math.sin((x + y * 0.5) * 0.28) * 0.5 + 0.5;
          const dither = bayerPick(x, y, 0.25 + gleam * 0.6);
          return dither ? [184, 138, 58] : [116, 82, 34];
        });
      });

    case 'tunic':
      return buildCanvas(32, 32, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const strap = Math.abs(x - y) <= 1 || y === 24 || y === 25;
          if (strap) return [98, 74, 48];
          const weave = ((x + y) & 1) === 0 ? 0.65 : 0.35;
          const n = hash2(x, y, 811);
          const pick = bayerPick(x, y, weave * 0.6 + n * 0.35);
          return pick ? [198, 192, 214] : [148, 142, 168];
        });
      });

    case 'banner':
      return buildCanvas(32, 64, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          if (x <= 2 || x >= w - 3 || y === 2 || y === h - 4) return [214, 164, 62];
          if (Math.abs(x - 16) + Math.abs(y - 26) < 7 && (Math.abs(x - 16) + Math.abs(y - 26)) >= 4) {
            return [224, 178, 72];
          }
          const fold = Math.sin(x * 0.6) * 0.5 + 0.5;
          const pick = bayerPick(x, y, 0.3 + fold * 0.5);
          return pick ? [154, 24, 46] : [104, 16, 34];
        });
      });

    case 'wood':
      return buildCanvas(32, 32, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const ring = Math.sin(x * 0.7 + Math.sin(y * 0.25) * 1.4) * 0.5 + 0.5;
          const grit = hash2(x, y >> 2, 307);
          const pick = bayerPick(x, y, 0.25 + ring * 0.5 + grit * 0.2);
          return pick ? [108, 70, 42] : [68, 42, 24];
        });
      });

    case 'water':
      return buildCanvas(32, 32, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const wave = Math.sin((x + y * 0.7) * 0.45) * 0.5 + 0.5;
          const sparkle = hash2(x, y, 919) > 0.92 ? 1 : 0;
          if (sparkle) return [156, 248, 255];
          const pick = bayerPick(x, y, 0.2 + wave * 0.65);
          return pick ? [52, 168, 198] : [26, 84, 128];
        });
      });

    case 'rune':
      return buildCanvas(64, 64, (ctx, w, h) => {
        fillDither(ctx, w, h, (x, y) => {
          const border = x < 3 || x >= w - 3 || y < 3 || y >= h - 3;
          if (border) return [124, 112, 148];
          const rowBand = y > 10 && y < h - 10 && y % 6 === 0 && x > 8 && x < w - 8;
          if (rowBand && hash2(Math.floor(x / 3), y, 613) > 0.35) return [88, 210, 232];
          const crack = Math.abs(x - 22 - Math.floor(Math.sin(y * 0.22) * 3)) === 0 && y > 16;
          if (crack) return [24, 18, 34];
          const pick = bayerPick(x, y, 0.35 + hash2(x, y, 501) * 0.45);
          return pick ? [74, 66, 92] : [52, 46, 68];
        });
      });
  }
}

export function getPs1Texture(kind: Ps1TexKind): THREE.CanvasTexture | null {
  if (!cache.has(kind)) cache.set(kind, createTexture(kind));
  return cache.get(kind) ?? null;
}

export function cloneTex(tex: THREE.CanvasTexture | null, rx: number, ry: number): THREE.CanvasTexture | null {
  if (!tex) return null;
  const c = tex.clone();
  c.repeat.set(rx, ry);
  c.magFilter = THREE.NearestFilter;
  c.minFilter = THREE.NearestFilter;
  c.generateMipmaps = false;
  c.colorSpace = THREE.SRGBColorSpace;
  c.wrapS = THREE.RepeatWrapping;
  c.wrapT = THREE.RepeatWrapping;
  c.needsUpdate = true;
  return c;
}

export function makePs1Material(opts: {
  color: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: opts.color,
    map: opts.map ?? null,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    flatShading: true,
    dithering: true,
  });
}
