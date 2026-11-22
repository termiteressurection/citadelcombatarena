import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CURVE_UNIFORMS, CITY_CURVE_RADIUS, curveDrop, makeCurvedBasicMaterial, patchCurvedMaterial } from '../art/curvature';
import type { Circle } from './colliders';
import { CAPITALS, SETTLEMENTS, type BiomeId } from './universe';

export type TreeVariantId =
  | 'wireframe'
  | 'dream'
  | 'acid'
  | 'ukiyoe'
  | 'cathedral'
  | 'crt'
  | 'kintsugi'
  | 'biolume';

export const TREE_VARIANT_IDS: readonly TreeVariantId[] = [
  'wireframe',
  'dream',
  'acid',
  'ukiyoe',
  'cathedral',
  'crt',
  'kintsugi',
  'biolume',
];

export interface MemoryTreePlacement {
  id: string;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  variant: TreeVariantId;
  trunkRadius: number;
  tint: string;
}

export interface BoostRingPlacement {
  id: string;
  x: number;
  z: number;
  yaw: number;
  color: string;
}

interface TreeSpec {
  trunkHeight: number;
  trunkScale: number;
  mainBoughCount: number;
  spreadAngle: number;
  boughLenScale: number;
  limbSides: number;
  trunkColors: [string, string];
  boughColors: [string, string, string];
  wireColors: [string, string, string];
  canopyPalette: string[];
  accentColor: string;
}

const TREE_SPECS: Record<TreeVariantId, TreeSpec> = {
  wireframe: {
    trunkHeight: 5.6, trunkScale: 1.0, mainBoughCount: 8, spreadAngle: 0.56, boughLenScale: 1.0, limbSides: 6,
    trunkColors: ['#2e1065', '#4c1d95'],
    boughColors: ['#581c87', '#6b21a8', '#7e22ce'],
    wireColors: ['#c084fc', '#22d3ee', '#fbbf24'],
    canopyPalette: ['#f472b6', '#fb923c', '#fbbf24', '#22d3ee', '#2dd4bf', '#c084fc', '#fde68a', '#38bdf8'],
    accentColor: '#22d3ee',
  },
  dream: {
    trunkHeight: 6.2, trunkScale: 1.18, mainBoughCount: 9, spreadAngle: 0.72, boughLenScale: 1.15, limbSides: 6,
    trunkColors: ['#6d4c41', '#8d6e63'],
    boughColors: ['#8e6b9e', '#a1887f', '#ba68c8'],
    wireColors: ['#f9e4c8', '#fbe4ee', '#fff3b0'],
    canopyPalette: ['#f48fb1', '#f8bbd0', '#fff3b0', '#ce93d8', '#a5d6a7', '#ffccbc', '#b39ddb', '#ffffff'],
    accentColor: '#f8bbd0',
  },
  acid: {
    trunkHeight: 6.4, trunkScale: 1.15, mainBoughCount: 10, spreadAngle: 0.68, boughLenScale: 1.2, limbSides: 6,
    trunkColors: ['#2d0647', '#ff007f'],
    boughColors: ['#7928ca', '#ff007f', '#00f0ff'],
    wireColors: ['#39ff14', '#00f0ff', '#ffe600'],
    canopyPalette: ['#ff007f', '#39ff14', '#00f0ff', '#ffe600', '#bf00ff', '#00ffaa', '#ff00ff', '#7fff00'],
    accentColor: '#39ff14',
  },
  ukiyoe: {
    trunkHeight: 5.0, trunkScale: 1.25, mainBoughCount: 7, spreadAngle: 0.75, boughLenScale: 1.22, limbSides: 6,
    trunkColors: ['#2b1d14', '#3d281d'],
    boughColors: ['#3d281d', '#1d3557', '#5c3d24'],
    wireColors: ['#d62828', '#e63946', '#f4ebd9'],
    canopyPalette: ['#d62828', '#e63946', '#f4ebd9', '#1d3557', '#2a9d8f', '#f4a261', '#e9c46a', '#ffb5a7'],
    accentColor: '#e63946',
  },
  cathedral: {
    trunkHeight: 7.2, trunkScale: 1.08, mainBoughCount: 8, spreadAngle: 0.42, boughLenScale: 1.15, limbSides: 6,
    trunkColors: ['#160c28', '#23133d'],
    boughColors: ['#23133d', '#3a1c5e', '#4c1d95'],
    wireColors: ['#ffb703', '#ff006e', '#3a86ff'],
    canopyPalette: ['#ff006e', '#ffb703', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0', '#ffbe0b', '#e0aaff'],
    accentColor: '#ffb703',
  },
  crt: {
    trunkHeight: 6.2, trunkScale: 1.05, mainBoughCount: 8, spreadAngle: 0.52, boughLenScale: 1.1, limbSides: 4,
    trunkColors: ['#031608', '#05240d'],
    boughColors: ['#05240d', '#073614', '#0a471b'],
    wireColors: ['#22ff66', '#39ff14', '#ffb000'],
    canopyPalette: ['#22ff66', '#39ff14', '#ffb000', '#80ff9f', '#00e640', '#ffd166', '#16a34a', '#bbf7d0'],
    accentColor: '#22ff66',
  },
  kintsugi: {
    trunkHeight: 5.4, trunkScale: 1.2, mainBoughCount: 7, spreadAngle: 0.62, boughLenScale: 1.12, limbSides: 4,
    trunkColors: ['#141218', '#1f1c24'],
    boughColors: ['#141218', '#1f1c24', '#292530'],
    wireColors: ['#ffd166', '#ffb703', '#ffe599'],
    canopyPalette: ['#ffd166', '#ffb703', '#ffe599', '#f4ebd9', '#292530', '#fb8500', '#ffffff', '#d4a373'],
    accentColor: '#ffd166',
  },
  biolume: {
    trunkHeight: 5.8, trunkScale: 1.15, mainBoughCount: 10, spreadAngle: 0.66, boughLenScale: 1.16, limbSides: 6,
    trunkColors: ['#041f36', '#073454'],
    boughColors: ['#073454', '#0a4870', '#0d5c8c'],
    wireColors: ['#00f5d4', '#f15bb5', '#7bf1a8'],
    canopyPalette: ['#00f5d4', '#f15bb5', '#00bbf9', '#7bf1a8', '#fee440', '#9b5de5', '#4cc9f0', '#ff70a6'],
    accentColor: '#00f5d4',
  },
};

const BIOME_TREE_POOLS: Record<BiomeId, readonly TreeVariantId[]> = {
  metropolis: ['wireframe', 'biolume', 'crt', 'dream', 'cathedral', 'kintsugi'],
  bazaar: ['ukiyoe', 'kintsugi', 'dream', 'wireframe', 'crt'],
  vault: ['cathedral', 'wireframe', 'dream', 'biolume', 'kintsugi'],
  frontier: ['acid', 'crt', 'kintsugi', 'ukiyoe', 'wireframe'],
  kernel: ['kintsugi', 'wireframe', 'cathedral', 'dream', 'biolume'],
};

const BIOME_TINTS = ['#ffffff', '#eafaff', '#fff2f8', '#f5eaff', '#fff8e2'] as const;

const CELL_SIZE = 90;

function hashCell(x: number, z: number, salt = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function approxBiome(x: number, z: number): BiomeId {
  let best = CAPITALS[0];
  let bestD = Infinity;
  for (const c of CAPITALS) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best.biome;
}

function insideAnySettlement(x: number, z: number): boolean {
  if (Math.hypot(x, z) < 110) return true;
  for (const s of SETTLEMENTS) {
    const pad = s.kind === 'capital' ? 24 : 16;
    if (Math.hypot(x - s.x, z - s.z) < s.radius + pad) return true;
  }
  return false;
}

const treeCellCache = new Map<string, MemoryTreePlacement[]>();

/** Deterministic Memory Trees placed across the wilderness in `CELL_SIZE` cells, clear of city plazas. */
export function memoryTreesInCell(cx: number, cz: number): MemoryTreePlacement[] {
  const key = `${cx},${cz}`;
  const cached = treeCellCache.get(key);
  if (cached) return cached;

  const list: MemoryTreePlacement[] = [];
  const groveWeight = hashCell(cx >> 1, cz >> 1, 17);
  const count = groveWeight > 0.56 ? 5 : groveWeight > 0.22 ? 4 : 3;

  for (let i = 0; i < count; i++) {
    const rx = hashCell(cx, cz, i * 11 + 1);
    const rz = hashCell(cx, cz, i * 11 + 2);
    const wx = cx * CELL_SIZE + 8 + rx * (CELL_SIZE - 16);
    const wz = cz * CELL_SIZE + 8 + rz * (CELL_SIZE - 16);
    if (Math.abs(wx) > 1960 || Math.abs(wz) > 1960) continue;
    if (insideAnySettlement(wx, wz)) continue;

    // Avoid overlapping existing trees inside the same cell
    let overlap = false;
    for (const prev of list) {
      if (Math.hypot(prev.x - wx, prev.z - wz) < 15) { overlap = true; break; }
    }
    if (overlap) continue;

    const biome = approxBiome(wx, wz);
    const pool = BIOME_TREE_POOLS[biome];
    const vPick = hashCell(cx, cz, i * 11 + 3);
    const variant = pool[Math.floor(vPick * pool.length) % pool.length];
    const scale = 0.74 + hashCell(cx, cz, i * 11 + 4) * 0.58;
    const yaw = hashCell(cx, cz, i * 11 + 5) * Math.PI * 2;
    const tintIdx = Math.floor(hashCell(cx, cz, i * 11 + 6) * BIOME_TINTS.length) % BIOME_TINTS.length;
    const spec = TREE_SPECS[variant];

    list.push({
      id: `mt-${cx}-${cz}-${i}`,
      x: wx,
      z: wz,
      scale,
      yaw,
      variant,
      trunkRadius: Number((0.68 * spec.trunkScale * scale).toFixed(2)),
      tint: BIOME_TINTS[tintIdx],
    });
  }

  treeCellCache.set(key, list);
  return list;
}

/** Query all Citadel Memory Trees within `radius` world units of `(x, z)`. */
export function memoryTreesNear(x: number, z: number, radius = 210): MemoryTreePlacement[] {
  const cMinX = Math.floor((x - radius) / CELL_SIZE);
  const cMaxX = Math.floor((x + radius) / CELL_SIZE);
  const cMinZ = Math.floor((z - radius) / CELL_SIZE);
  const cMaxZ = Math.floor((z + radius) / CELL_SIZE);
  const r2 = radius * radius;
  const out: MemoryTreePlacement[] = [];
  for (let cx = cMinX; cx <= cMaxX; cx++) {
    for (let cz = cMinZ; cz <= cMaxZ; cz++) {
      for (const t of memoryTreesInCell(cx, cz)) {
        const dx = t.x - x, dz = t.z - z;
        if (dx * dx + dz * dz <= r2) out.push(t);
      }
    }
  }
  return out;
}

/** Returns trunk circle colliders within `range` so fighters collide & Wall-Splat cleanly off Memory Trees. */
export function memoryTreeCollidersNear(x: number, z: number, range = 42): Circle[] {
  const out: Circle[] = [];
  for (const t of memoryTreesNear(x, z, range)) {
    out.push({ x: t.x, z: t.z, r: t.trunkRadius });
  }
  return out;
}

const ringCellCache = new Map<string, BoostRingPlacement[]>();

/** Deterministic Overclock Boost-Archways placed along wilderness trails & groves. */
export function boostRingsNear(x: number, z: number, radius = 185): BoostRingPlacement[] {
  const step = 180;
  const cMinX = Math.floor((x - radius) / step);
  const cMaxX = Math.floor((x + radius) / step);
  const cMinZ = Math.floor((z - radius) / step);
  const cMaxZ = Math.floor((z + radius) / step);
  const r2 = radius * radius;
  const out: BoostRingPlacement[] = [];

  for (let cx = cMinX; cx <= cMaxX; cx++) {
    for (let cz = cMinZ; cz <= cMaxZ; cz++) {
      const key = `${cx},${cz}`;
      let list = ringCellCache.get(key);
      if (!list) {
        list = [];
        const chance = hashCell(cx, cz, 409);
        if (chance > 0.35) {
          const rx = hashCell(cx, cz, 411);
          const rz = hashCell(cx, cz, 412);
          const wx = cx * step + 30 + rx * (step - 60);
          const wz = cz * step + 30 + rz * (step - 60);
          if (Math.abs(wx) < 1920 && Math.abs(wz) < 1920 && !insideAnySettlement(wx, wz)) {
            const biome = approxBiome(wx, wz);
            const col = biome === 'bazaar' ? '#ffc95c'
              : biome === 'vault' ? '#a78bfa'
              : biome === 'frontier' ? '#ff4fd8'
              : biome === 'kernel' ? '#ffe58f'
              : '#3ff0ff';
            list.push({
              id: `ring-${cx}-${cz}`,
              x: wx,
              z: wz,
              yaw: hashCell(cx, cz, 413) * Math.PI,
              color: col,
            });
          }
        }
        ringCellCache.set(key, list);
      }
      for (const r of list) {
        const dx = r.x - x, dz = r.z - z;
        if (dx * dx + dz * dz <= r2) out.push(r);
      }
    }
  }
  return out;
}

// ─── Procedural Citadel Memory Tree & Flora Geometry Merger ────────────────

interface ColoredGeoPiece {
  geo: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  color: string;
}

function mergeColoredPieces(pieces: ColoredGeoPiece[]): THREE.BufferGeometry {
  const nonIndexed: { pos: Float32Array; norm: Float32Array; count: number; col: THREE.Color }[] = [];
  let totalVerts = 0;

  for (const piece of pieces) {
    const g = piece.geo.index ? piece.geo.toNonIndexed() : piece.geo.clone();
    g.applyMatrix4(piece.matrix);
    g.computeVertexNormals();
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute;
    nonIndexed.push({
      pos: pos.array as Float32Array,
      norm: norm.array as Float32Array,
      count: pos.count,
      col: new THREE.Color(piece.color),
    });
    totalVerts += pos.count;
    if (piece.geo.index || g !== piece.geo) g.dispose();
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  let vOffset = 0;
  for (const part of nonIndexed) {
    positions.set(part.pos, vOffset * 3);
    normals.set(part.norm, vOffset * 3);
    for (let i = 0; i < part.count; i++) {
      const idx = (vOffset + i) * 3;
      colors[idx] = part.col.r;
      colors[idx + 1] = part.col.g;
      colors[idx + 2] = part.col.b;
    }
    vOffset += part.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

function createJewelPetalGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const p = [
    0, 0, 1.15, -0.58, 0, 0, 0, 0.32, 0.08,
    0, 0, 1.15, 0, 0.32, 0.08, 0.58, 0, 0,
    0, 0, 1.15, 0, -0.22, 0.08, -0.58, 0, 0,
    0, 0, 1.15, 0.58, 0, 0, 0, -0.22, 0.08,
    0, 0, -0.65, 0, 0.32, 0.08, -0.58, 0, 0,
    0, 0, -0.65, 0.58, 0, 0, 0, 0.32, 0.08,
    0, 0, -0.65, -0.58, 0, 0, 0, -0.22, 0.08,
    0, 0, -0.65, 0, -0.22, 0.08, 0.58, 0, 0,
  ];
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
  geom.computeVertexNormals();
  return geom;
}

interface VariantGeoBundle {
  limbs: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  ornament: THREE.BufferGeometry;
}

const variantBundleCache = new Map<TreeVariantId, VariantGeoBundle>();

function getVariantBundle(variant: TreeVariantId): VariantGeoBundle {
  const cached = variantBundleCache.get(variant);
  if (cached) return cached;

  const spec = TREE_SPECS[variant];
  const seedBase = TREE_VARIANT_IDS.indexOf(variant) * 97.31 + 31.17;
  const rng = (seed: number) => {
    const x = Math.sin((seed + seedBase) * 73.159 + 17.831) * 10000;
    return x - Math.floor(x);
  };

  const vUp = new THREE.Vector3(0, 1, 0);
  const limbPieces: ColoredGeoPiece[] = [];
  const canopyPieces: ColoredGeoPiece[] = [];
  const ornamentPieces: ColoredGeoPiece[] = [];

  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, spec.limbSides, 1);
  const pushLimb = (
    p0: [number, number, number],
    p1: [number, number, number],
    rBot: number,
    rTop: number,
    color: string,
  ) => {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.02) return;
    const cyl = new THREE.CylinderGeometry(rTop, rBot, len, spec.limbSides, 1);
    const mid = new THREE.Vector3(p0[0] + dx * 0.5, p0[1] + dy * 0.5, p0[2] + dz * 0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(vUp, new THREE.Vector3(dx, dy, dz).normalize());
    const mat = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
    limbPieces.push({ geo: cyl, matrix: mat, color });
  };

  const trunkH = spec.trunkHeight;
  const tS = spec.trunkScale;
  const trunkR0 = 0.48 * tS;
  const trunkR1 = 0.36 * tS;
  const trunkR2 = 0.25 * tS;
  const leanX = (rng(1) - 0.5) * 0.32;
  const leanZ = (rng(2) - 0.5) * 0.32;
  const midY = trunkH * 0.48;

  // Grounded tapered Citadel trunk (two segments) + exposed root flares
  pushLimb([0, 0, 0], [leanX * 0.5, midY, leanZ * 0.5], trunkR0 * 1.15, trunkR1, spec.trunkColors[0]);
  pushLimb([leanX * 0.5, midY, leanZ * 0.5], [leanX, trunkH, leanZ], trunkR1, trunkR2, spec.trunkColors[1]);
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2 + rng(r * 7) * 0.4;
    pushLimb([0, 0.55, 0], [Math.cos(a) * trunkR0 * 1.85, 0, Math.sin(a) * trunkR0 * 1.85], trunkR0 * 0.42, trunkR0 * 0.14, spec.trunkColors[0]);
  }

  // Primary boughs + secondary forks + tertiary twigs (faithful to InscriptionTree)
  const twigTips: [number, number, number][] = [];
  const yawOffset = rng(5) * Math.PI * 2;
  for (let m = 0; m < spec.mainBoughCount; m++) {
    const mPhi = yawOffset + (m / spec.mainBoughCount) * Math.PI * 2 + (m % 2) * 0.25;
    const bElev = trunkH * 0.65 + (m / spec.mainBoughCount) * (trunkH * 0.3);
    const bLen = (3.1 + rng(m * 7) * 0.8) * spec.boughLenScale;
    const spread = spec.spreadAngle + rng(m * 11) * 0.2;
    const bStart: [number, number, number] = [leanX, bElev, leanZ];
    const bEnd: [number, number, number] = [
      leanX + Math.cos(mPhi) * Math.sin(spread) * bLen,
      bElev + Math.cos(spread) * bLen * 0.85,
      leanZ + Math.sin(mPhi) * Math.sin(spread) * bLen,
    ];
    pushLimb(bStart, bEnd, trunkR2 * 0.72, trunkR2 * 0.46, spec.boughColors[m % 3]);

    for (let s = 0; s < 2; s++) {
      const sYaw = mPhi + (s === 0 ? -0.48 : 0.48);
      const sLen = (2.0 + rng(m * 17 + s) * 0.55) * spec.boughLenScale;
      const sSpread = spread + 0.26;
      const sEnd: [number, number, number] = [
        bEnd[0] + Math.cos(sYaw) * Math.sin(sSpread) * sLen,
        bEnd[1] + Math.cos(sSpread) * sLen * 0.75 + 0.25,
        bEnd[2] + Math.sin(sYaw) * Math.sin(sSpread) * sLen,
      ];
      pushLimb(bEnd, sEnd, trunkR2 * 0.42, trunkR2 * 0.24, spec.boughColors[(m + 1) % 3]);

      for (let w = 0; w < 2; w++) {
        const wYaw = sYaw + (w === 0 ? -0.52 : 0.52);
        const wLen = (1.25 + rng(m * 31 + s * 7 + w) * 0.4) * spec.boughLenScale;
        const wSpread = sSpread + 0.22;
        const wEnd: [number, number, number] = [
          sEnd[0] + Math.cos(wYaw) * Math.sin(wSpread) * wLen,
          sEnd[1] + Math.cos(wSpread) * wLen * 0.65 + 0.2,
          sEnd[2] + Math.sin(wYaw) * Math.sin(wSpread) * wLen,
        ];
        pushLimb(sEnd, wEnd, trunkR2 * 0.22, 0.05 * tS, spec.boughColors[(m + 2) % 3]);
        twigTips.push(wEnd);
      }
    }
  }
  unitCyl.dispose();

  // Architectural Citadel Top-Crowning Jewel Canopy (96 lush origami petals across tips, zenith dome & edges)
  const petalGeo = createJewelPetalGeometry();
  const maxCrownR = 7.4 * spec.boughLenScale;
  const zenithY = trunkH + 5.0 * spec.boughLenScale;
  const domeHeightAtR = (r: number) => zenithY - 2.2 * Math.pow(Math.min(1, r / maxCrownR), 1.7);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const foliagePts: [number, number, number][] = [];

  for (let i = 0; i < 24; i++) {
    const tip = twigTips[i % twigTips.length];
    foliagePts.push([tip[0] + (rng(i * 7 + 1) - 0.5) * 0.4, tip[1] + 0.35 + rng(i * 11 + 2) * 0.45, tip[2] + (rng(i * 13 + 3) - 0.5) * 0.4]);
  }
  for (let k = 0; k < 44; k++) {
    const frac = (k + 0.5) / 44;
    const r = (0.75 + Math.sqrt(frac) * 5.6) * spec.boughLenScale;
    const theta = k * goldenAngle + rng(k * 17 + 5) * 0.2;
    foliagePts.push([leanX + Math.cos(theta) * r, domeHeightAtR(r) - rng(k * 23 + 7) * 0.65, leanZ + Math.sin(theta) * r]);
  }
  for (let e = 0; e < 28; e++) {
    const theta = (e / 28) * Math.PI * 2;
    const r = (6.45 + (e % 3) * 0.45) * spec.boughLenScale;
    foliagePts.push([leanX + Math.cos(theta) * r, domeHeightAtR(r) + (e % 2 === 0 ? 0.2 : -0.22), leanZ + Math.sin(theta) * r]);
  }

  const dummy = new THREE.Object3D();
  for (let i = 0; i < foliagePts.length; i++) {
    const [px, py, pz] = foliagePts[i];
    const phi = Math.atan2(pz, px);
    dummy.position.set(px, py, pz);
    const isEdge = i >= 68;
    const s = (isEdge ? 0.52 : 0.64) * (0.9 + 0.3 * Math.sin(i * 3.1));
    dummy.scale.set(s * 1.35, s * 0.9, s * 1.45);
    dummy.rotation.set(isEdge ? 0.34 : (i * 1.13) % 6.28, isEdge ? -phi + Math.PI / 2 : (i * 0.79) % 6.28, isEdge ? 0.25 : 0);
    dummy.updateMatrix();
    const palColor = spec.canopyPalette[(Math.floor(((phi + Math.PI) / (Math.PI * 2)) * 8) * 2 + (i % 3)) % spec.canopyPalette.length];
    canopyPieces.push({ geo: petalGeo, matrix: dummy.matrix.clone(), color: palColor });
  }
  petalGeo.dispose();

  // Signature Illuminated Ornaments per Variant (Sigil base ring + Variant Crown)
  const baseRingGeo = new THREE.RingGeometry(1.1, 1.48, 8);
  dummy.position.set(0, 0.05, 0);
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  ornamentPieces.push({ geo: baseRingGeo, matrix: dummy.matrix.clone(), color: spec.wireColors[1] });
  baseRingGeo.dispose();

  const topY = trunkH + 1.2;
  if (variant === 'wireframe' || variant === 'kintsugi') {
    const tGeo = new THREE.TorusGeometry(4.6, 0.09, 5, 16);
    dummy.position.set(0, topY + 2.4, 0);
    dummy.rotation.set(Math.PI / 3, 0.3, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: tGeo, matrix: dummy.matrix.clone(), color: spec.wireColors[1] });
    dummy.rotation.set(-Math.PI / 3, Math.PI / 2, 0.2);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: tGeo, matrix: dummy.matrix.clone(), color: spec.wireColors[2] });
    tGeo.dispose();
    const oGeo = new THREE.OctahedronGeometry(0.95, 0);
    dummy.position.set(0, topY + 6.2, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: oGeo, matrix: dummy.matrix.clone(), color: spec.wireColors[0] });
    oGeo.dispose();
  } else if (variant === 'dream') {
    const oGeo = new THREE.OctahedronGeometry(0.28, 0);
    for (let g = 0; g < 8; g++) {
      const a = (g / 8) * Math.PI * 2;
      const r = 4.6 + (g % 2) * 1.1;
      for (let st = 0; st < 4; st++) {
        dummy.position.set(Math.cos(a) * r, topY + 1.8 - st * 0.72, Math.sin(a) * r);
        dummy.scale.setScalar(1 - st * 0.16);
        dummy.updateMatrix();
        ornamentPieces.push({ geo: oGeo, matrix: dummy.matrix.clone(), color: st % 2 === 0 ? '#f8bbd0' : '#fff3b0' });
      }
    }
    oGeo.dispose();
    dummy.scale.set(1, 1, 1);
  } else if (variant === 'acid') {
    const capGeo = new THREE.ConeGeometry(4.8, 1.8, 10, 1, true);
    dummy.position.set(0, topY + 4.4, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: capGeo, matrix: dummy.matrix.clone(), color: '#ff007f' });
    capGeo.dispose();
    const rGeo = new THREE.TorusGeometry(5.6, 0.11, 5, 16);
    dummy.position.set(0, topY + 2.2, 0);
    dummy.rotation.set(Math.PI / 4, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: rGeo, matrix: dummy.matrix.clone(), color: '#39ff14' });
    rGeo.dispose();
  } else if (variant === 'ukiyoe') {
    const sunGeo = new THREE.CircleGeometry(4.4, 16);
    dummy.position.set(0, topY + 2.2, -2.2);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: sunGeo, matrix: dummy.matrix.clone(), color: '#e63946' });
    sunGeo.dispose();
  } else if (variant === 'cathedral') {
    const roseGeo = new THREE.TorusGeometry(4.6, 0.15, 6, 16);
    dummy.position.set(0, topY + 2.8, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: roseGeo, matrix: dummy.matrix.clone(), color: '#ffb703' });
    roseGeo.dispose();
    const spireGeo = new THREE.ConeGeometry(0.26, 2.8, 4);
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 1.9, 1.4, Math.sin(a) * 1.9);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      ornamentPieces.push({ geo: spireGeo, matrix: dummy.matrix.clone(), color: '#ffb703' });
    }
    spireGeo.dispose();
  } else if (variant === 'crt') {
    for (let k = 0; k < 3; k++) {
      const scanGeo = new THREE.TorusGeometry(4.8 - k * 0.9, 0.08, 4, 16);
      dummy.position.set(0, topY + 0.6 + k * 1.6, 0);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      ornamentPieces.push({ geo: scanGeo, matrix: dummy.matrix.clone(), color: '#22ff66' });
      scanGeo.dispose();
    }
    const coreGeo = new THREE.OctahedronGeometry(1.1, 0);
    dummy.position.set(0, topY + 4.8, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    ornamentPieces.push({ geo: coreGeo, matrix: dummy.matrix.clone(), color: '#ffb000' });
    coreGeo.dispose();
  } else {
    // biolume coral spires
    const finGeo = new THREE.OctahedronGeometry(0.5, 0);
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 3.8, topY + 3.2 + (f % 2) * 0.9, Math.sin(a) * 3.8);
      dummy.scale.set(0.65, 2.2, 0.65);
      dummy.updateMatrix();
      ornamentPieces.push({ geo: finGeo, matrix: dummy.matrix.clone(), color: f % 2 === 0 ? '#00f5d4' : '#f15bb5' });
    }
    finGeo.dispose();
    dummy.scale.set(1, 1, 1);
  }

  const bundle: VariantGeoBundle = {
    limbs: mergeColoredPieces(limbPieces),
    canopy: mergeColoredPieces(canopyPieces),
    ornament: mergeColoredPieces(ornamentPieces),
  };
  variantBundleCache.set(variant, bundle);
  return bundle;
}

// ─── Merged Ambient Ground Flora Geometries ────────────────────────────────

let floraGeosCache: {
  fern: THREE.BufferGeometry;
  bloom: THREE.BufferGeometry;
  bamboo: THREE.BufferGeometry;
  stone: THREE.BufferGeometry;
  lantern: THREE.BufferGeometry;
  ring: THREE.BufferGeometry;
} | null = null;

function getFloraGeos() {
  if (floraGeosCache) return floraGeosCache;
  const dummy = new THREE.Object3D();

  // Crystal Fern Rosette (5 tilted faceted blades)
  const blade = new THREE.ConeGeometry(0.28, 0.9, 3, 1);
  const fernPieces: ColoredGeoPiece[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.25, 0.28, Math.sin(a) * 0.25);
    dummy.rotation.set(Math.sin(a) * 0.72, -a, -Math.cos(a) * 0.72);
    dummy.scale.set(1, 1, 0.35);
    dummy.updateMatrix();
    fernPieces.push({ geo: blade, matrix: dummy.matrix.clone(), color: i % 2 === 0 ? '#2dd4bf' : '#34d399' });
  }
  blade.dispose();

  // Tetrahedron Memory Bloom Cluster (4 glowing petals)
  const petal = new THREE.TetrahedronGeometry(0.24, 0);
  const bloomPieces: ColoredGeoPiece[] = [];
  const bloomCols = ['#c084fc', '#f472b6', '#fbbf24', '#3ff0ff'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.22, 0.28 + (i % 2) * 0.14, Math.sin(a) * 0.22);
    dummy.rotation.set(i * 0.6, a, 0.3);
    dummy.scale.set(1, 1.35, 1);
    dummy.updateMatrix();
    bloomPieces.push({ geo: petal, matrix: dummy.matrix.clone(), color: bloomCols[i] });
  }
  petal.dispose();

  // Segmented Cyber-Bamboo & Glowing Data-Reed Cluster (3 stalks)
  const stalk = new THREE.CylinderGeometry(0.06, 0.09, 3.2, 5, 1);
  const tip = new THREE.ConeGeometry(0.09, 0.28, 4);
  const bambooPieces: ColoredGeoPiece[] = [];
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 0.28;
    const oz = (i % 2 === 0 ? 1 : -1) * 0.22;
    const hScale = 0.75 + i * 0.22;
    dummy.position.set(ox, 1.6 * hScale, oz);
    dummy.rotation.set((i - 1) * 0.05, 0, (1 - i) * 0.04);
    dummy.scale.set(1, hScale, 1);
    dummy.updateMatrix();
    bambooPieces.push({ geo: stalk, matrix: dummy.matrix.clone(), color: i === 1 ? '#22d3ee' : '#10b981' });
    dummy.position.set(ox, 3.2 * hScale + 0.12, oz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bambooPieces.push({ geo: tip, matrix: dummy.matrix.clone(), color: '#fbbf24' });
  }
  stalk.dispose();
  tip.dispose();

  // Mossy Circuit Boulder + Fallen Column Drum
  const rock = new THREE.DodecahedronGeometry(0.95, 0);
  const capRock = new THREE.CylinderGeometry(0.55, 0.65, 0.55, 7);
  const stonePieces: ColoredGeoPiece[] = [];
  dummy.position.set(0, 0.45, 0);
  dummy.rotation.set(0.2, 0.7, 0.15);
  dummy.scale.set(1.2, 0.75, 1.0);
  dummy.updateMatrix();
  stonePieces.push({ geo: rock, matrix: dummy.matrix.clone(), color: '#2b335c' });
  dummy.position.set(0.8, 0.26, 0.45);
  dummy.rotation.set(0, 0.4, 0.12);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  stonePieces.push({ geo: capRock, matrix: dummy.matrix.clone(), color: '#475589' });
  rock.dispose();
  capRock.dispose();

  // Floating Diamond Memory Lantern
  const dia = new THREE.OctahedronGeometry(0.36, 0);
  const lanternPieces: ColoredGeoPiece[] = [];
  dummy.position.set(0, 1.85, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(0.85, 1.35, 0.85);
  dummy.updateMatrix();
  lanternPieces.push({ geo: dia, matrix: dummy.matrix.clone(), color: '#ffe58f' });
  dia.dispose();

  // Overclock Boost-Archway Gate (3.2m tall glowing neon arch)
  const archRing = new THREE.TorusGeometry(2.3, 0.18, 6, 16);
  const plinth = new THREE.BoxGeometry(0.9, 0.65, 0.9);
  const ringPieces: ColoredGeoPiece[] = [];
  dummy.position.set(0, 2.35, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1.15, 1);
  dummy.updateMatrix();
  ringPieces.push({ geo: archRing, matrix: dummy.matrix.clone(), color: '#ffffff' });
  for (const sx of [-2.2, 2.2]) {
    dummy.position.set(sx, 0.32, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ringPieces.push({ geo: plinth, matrix: dummy.matrix.clone(), color: '#2b335c' });
  }
  archRing.dispose();
  plinth.dispose();

  floraGeosCache = {
    fern: mergeColoredPieces(fernPieces),
    bloom: mergeColoredPieces(bloomPieces),
    bamboo: mergeColoredPieces(bambooPieces),
    stone: mergeColoredPieces(stonePieces),
    lantern: mergeColoredPieces(lanternPieces),
    ring: mergeColoredPieces(ringPieces),
  };
  return floraGeosCache;
}

const MAX_TREES_PER_VARIANT = 28;
const MAX_FERNS = 260;
const MAX_BLOOMS = 220;
const MAX_BAMBOO = 180;
const MAX_STONES = 120;
const MAX_LANTERNS = 90;
const MAX_RINGS = 32;

/**
 * Streams Citadel Memory-Tree groves (8 variations), lush ground wilderness flora,
 * stones/lanterns, and Overclock Boost-Archways seamlessly around the rider at 60 FPS.
 */
export function MemoryWoodsAndFlora({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const bundles = useMemo(() => {
    const out = {} as Record<TreeVariantId, VariantGeoBundle>;
    for (const v of TREE_VARIANT_IDS) out[v] = getVariantBundle(v);
    return out;
  }, []);
  const floraGeos = useMemo(getFloraGeos, []);

  const mats = useMemo(() => ({
    limbMat: patchCurvedMaterial(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, flatShading: true })),
    canopyMat: patchCurvedMaterial(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, emissive: '#161130', emissiveIntensity: 0.28 })),
    ornamentMat: makeCurvedBasicMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide }),
    floraMat: makeCurvedBasicMaterial({ color: '#ffffff', vertexColors: true }),
    stoneMat: patchCurvedMaterial(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, flatShading: true })),
  }), []);

  const treeLimbRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const treeCanopyRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const treeOrnamentRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const fernRef = useRef<THREE.InstancedMesh>(null!);
  const bloomRef = useRef<THREE.InstancedMesh>(null!);
  const bambooRef = useRef<THREE.InstancedMesh>(null!);
  const stoneRef = useRef<THREE.InstancedMesh>(null!);
  const lanternRef = useRef<THREE.InstancedMesh>(null!);
  const ringRef = useRef<THREE.InstancedMesh>(null!);

  const lastGrid = useRef({ cx: 99999, cz: 99999 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    // Keep uCurveRadius sync active even during initial ticks
    void CURVE_UNIFORMS;
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const gcx = Math.round(px / 28);
    const gcz = Math.round(pz / 28);

    // Gently bob floating lanterns
    if (lanternRef.current && lanternRef.current.count > 0) {
      lanternRef.current.position.y = Math.sin(clock.elapsedTime * 2.1) * 0.25;
    }

    if (gcx === lastGrid.current.cx && gcz === lastGrid.current.cz) return;
    lastGrid.current.cx = gcx;
    lastGrid.current.cz = gcz;

    // 1. Update 8 Memory Tree variant pools
    const nearbyTrees = memoryTreesNear(px, pz, 210);
    const grouped: Record<TreeVariantId, MemoryTreePlacement[]> = {
      wireframe: [], dream: [], acid: [], ukiyoe: [],
      cathedral: [], crt: [], kintsugi: [], biolume: [],
    };
    for (const t of nearbyTrees) grouped[t.variant].push(t);

    for (const v of TREE_VARIANT_IDS) {
      const items = grouped[v];
      const n = Math.min(items.length, MAX_TREES_PER_VARIANT);
      const lMesh = treeLimbRefs.current[v];
      const cMesh = treeCanopyRefs.current[v];
      const oMesh = treeOrnamentRefs.current[v];
      if (!lMesh || !cMesh || !oMesh) continue;
      lMesh.count = n;
      cMesh.count = n;
      oMesh.count = n;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        dummy.position.set(it.x, 0, it.z);
        dummy.rotation.set(0, it.yaw, 0);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        tmpColor.set(it.tint);
        lMesh.setMatrixAt(i, dummy.matrix);
        cMesh.setMatrixAt(i, dummy.matrix);
        oMesh.setMatrixAt(i, dummy.matrix);
        cMesh.setColorAt(i, tmpColor);
      }
      lMesh.instanceMatrix.needsUpdate = true;
      cMesh.instanceMatrix.needsUpdate = true;
      oMesh.instanceMatrix.needsUpdate = true;
      if (cMesh.instanceColor) cMesh.instanceColor.needsUpdate = true;
    }

    // 2. Populate lush ground flora, mossy stones & floating lanterns in nearby wilderness cells
    const cMinX = Math.floor((px - 170) / CELL_SIZE);
    const cMaxX = Math.floor((px + 170) / CELL_SIZE);
    const cMinZ = Math.floor((pz - 170) / CELL_SIZE);
    const cMaxZ = Math.floor((pz + 170) / CELL_SIZE);

    let fIdx = 0, bIdx = 0, bmIdx = 0, sIdx = 0, lIdx = 0;
    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        for (let k = 0; k < 14; k++) {
          const rx = hashCell(cx, cz, 800 + k * 5);
          const rz = hashCell(cx, cz, 801 + k * 5);
          const fx = cx * CELL_SIZE + rx * CELL_SIZE;
          const fz = cz * CELL_SIZE + rz * CELL_SIZE;
          if ((fx - px) * (fx - px) + (fz - pz) * (fz - pz) > 170 * 170) continue;
          if (Math.abs(fx) > 1970 || Math.abs(fz) > 1970 || insideAnySettlement(fx, fz)) continue;

          const kindRoll = hashCell(cx, cz, 802 + k * 5);
          const yaw = hashCell(cx, cz, 803 + k * 5) * Math.PI * 2;
          const sc = 0.72 + hashCell(cx, cz, 804 + k * 5) * 0.75;
          dummy.position.set(fx, 0, fz);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();

          if (kindRoll < 0.36 && fIdx < MAX_FERNS) {
            fernRef.current?.setMatrixAt(fIdx++, dummy.matrix);
          } else if (kindRoll < 0.64 && bIdx < MAX_BLOOMS) {
            bloomRef.current?.setMatrixAt(bIdx++, dummy.matrix);
          } else if (kindRoll < 0.84 && bmIdx < MAX_BAMBOO) {
            bambooRef.current?.setMatrixAt(bmIdx++, dummy.matrix);
          } else if (kindRoll < 0.94 && sIdx < MAX_STONES) {
            stoneRef.current?.setMatrixAt(sIdx++, dummy.matrix);
          } else if (lIdx < MAX_LANTERNS) {
            lanternRef.current?.setMatrixAt(lIdx++, dummy.matrix);
          }
        }
      }
    }

    if (fernRef.current) { fernRef.current.count = fIdx; fernRef.current.instanceMatrix.needsUpdate = true; }
    if (bloomRef.current) { bloomRef.current.count = bIdx; bloomRef.current.instanceMatrix.needsUpdate = true; }
    if (bambooRef.current) { bambooRef.current.count = bmIdx; bambooRef.current.instanceMatrix.needsUpdate = true; }
    if (stoneRef.current) { stoneRef.current.count = sIdx; stoneRef.current.instanceMatrix.needsUpdate = true; }
    if (lanternRef.current) { lanternRef.current.count = lIdx; lanternRef.current.instanceMatrix.needsUpdate = true; }

    // 3. Populate Overclock Boost-Archways
    const nearbyRings = boostRingsNear(px, pz, 185);
    if (ringRef.current) {
      const rn = Math.min(nearbyRings.length, MAX_RINGS);
      ringRef.current.count = rn;
      for (let i = 0; i < rn; i++) {
        const rg = nearbyRings[i];
        dummy.position.set(rg.x, 0, rg.z);
        dummy.rotation.set(0, rg.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tmpColor.set(rg.color);
        ringRef.current.setMatrixAt(i, dummy.matrix);
        ringRef.current.setColorAt(i, tmpColor);
      }
      ringRef.current.instanceMatrix.needsUpdate = true;
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
    }
  });

  // Unused curve helper import guard for static reference
  void curveDrop;
  void CITY_CURVE_RADIUS;

  return (
    <group>
      {TREE_VARIANT_IDS.map((v) => (
        <group key={`tv-${v}`}>
          <instancedMesh
            ref={(el) => { treeLimbRefs.current[v] = el; }}
            args={[bundles[v].limbs, mats.limbMat, MAX_TREES_PER_VARIANT]}
            count={0}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(el) => { treeCanopyRefs.current[v] = el; }}
            args={[bundles[v].canopy, mats.canopyMat, MAX_TREES_PER_VARIANT]}
            count={0}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(el) => { treeOrnamentRefs.current[v] = el; }}
            args={[bundles[v].ornament, mats.ornamentMat, MAX_TREES_PER_VARIANT]}
            count={0}
            frustumCulled={false}
          />
        </group>
      ))}
      <instancedMesh ref={fernRef} args={[floraGeos.fern, mats.floraMat, MAX_FERNS]} count={0} frustumCulled={false} />
      <instancedMesh ref={bloomRef} args={[floraGeos.bloom, mats.floraMat, MAX_BLOOMS]} count={0} frustumCulled={false} />
      <instancedMesh ref={bambooRef} args={[floraGeos.bamboo, mats.floraMat, MAX_BAMBOO]} count={0} frustumCulled={false} />
      <instancedMesh ref={stoneRef} args={[floraGeos.stone, mats.stoneMat, MAX_STONES]} count={0} frustumCulled={false} />
      <instancedMesh ref={lanternRef} args={[floraGeos.lantern, mats.ornamentMat, MAX_LANTERNS]} count={0} frustumCulled={false} />
      <instancedMesh ref={ringRef} args={[floraGeos.ring, mats.ornamentMat, MAX_RINGS]} count={0} frustumCulled={false} />
    </group>
  );
}
