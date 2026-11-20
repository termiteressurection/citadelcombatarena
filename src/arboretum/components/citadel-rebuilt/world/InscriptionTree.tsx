import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, applyGlobeCurvature } from '../RebuiltWorldShared';
import { DigitalAlarmHaloRing } from './PortalSystems';
import { applyTermiteseGlitch } from '@/features/sigma/termiteseGlitch';
import {
  computeAliveness,
  computeFoliageCount,
  getMonthFoliageState,
  type MonthFoliageState,
} from '../fractalCalendarModel';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';
import { useWorldLook, type WorldLookId } from '../looks/worldLook';

const TREE_OWN_TAG = {
  dreamOwn: true,
  comicOwn: true,
  acidOwn: true,
  papercraftOwn: true,
  industrialOwn: true,
  westernOwn: true,
  archetypeOwn: true,
};

interface WorldTreeVarianceSpec {
  trunkHeight: number;
  trunkScale: number;
  mainBoughCount: number;
  spreadAngle: number;
  boughLenScale: number;
  limbSides: number;
  inkOutline?: boolean;
  wireOpacity: number;
  foliageScale: number;
  trunkColors: [string, string];
  boughColors: [string, string, string];
  wireColors: [string, string, string];
  canopyPalette: string[];
}

const WORLD_TREE_SPECS: Record<Exclude<WorldLookId, 'minimal'>, WorldTreeVarianceSpec> = {
  wireframe: {
    trunkHeight: 5.6,
    trunkScale: 1.0,
    mainBoughCount: 8,
    spreadAngle: 0.56,
    boughLenScale: 1.0,
    limbSides: 6,
    wireOpacity: 0.55,
    foliageScale: 1.0,
    trunkColors: ['#2e1065', '#4c1d95'],
    boughColors: ['#581c87', '#6b21a8', '#7e22ce'],
    wireColors: ['#c084fc', '#22d3ee', '#fbbf24'],
    canopyPalette: ['#f472b6', '#fb923c', '#fbbf24', '#22d3ee', '#2dd4bf', '#c084fc', '#fde68a', '#38bdf8'],
  },
  dream: {
    trunkHeight: 6.2,
    trunkScale: 1.18,
    mainBoughCount: 9,
    spreadAngle: 0.72,
    boughLenScale: 1.15,
    limbSides: 8,
    wireOpacity: 0.48,
    foliageScale: 1.28,
    trunkColors: ['#6d4c41', '#8d6e63'],
    boughColors: ['#8e6b9e', '#a1887f', '#ba68c8'],
    wireColors: ['#f9e4c8', '#fbe4ee', '#fff3b0'],
    canopyPalette: ['#f48fb1', '#f8bbd0', '#fff3b0', '#ce93d8', '#a5d6a7', '#ffccbc', '#b39ddb', '#ffffff'],
  },
  comic: {
    trunkHeight: 6.0,
    trunkScale: 1.22,
    mainBoughCount: 7,
    spreadAngle: 0.62,
    boughLenScale: 1.12,
    limbSides: 4,
    inkOutline: true,
    wireOpacity: 0.95,
    foliageScale: 1.32,
    trunkColors: ['#ff2a55', '#9b4dff'],
    boughColors: ['#00d4ff', '#ff2a55', '#ffe600'],
    wireColors: ['#08040f', '#08040f', '#08040f'],
    canopyPalette: ['#ffe600', '#ff2a55', '#00d4ff', '#00e575', '#9b4dff', '#fff75e', '#ff3366', '#00f0ff'],
  },
  acid: {
    trunkHeight: 6.4,
    trunkScale: 1.15,
    mainBoughCount: 10,
    spreadAngle: 0.68,
    boughLenScale: 1.2,
    limbSides: 8,
    wireOpacity: 0.92,
    foliageScale: 1.25,
    trunkColors: ['#2d0647', '#ff007f'],
    boughColors: ['#7928ca', '#ff007f', '#00f0ff'],
    wireColors: ['#39ff14', '#00f0ff', '#ffe600'],
    canopyPalette: ['#ff007f', '#39ff14', '#00f0ff', '#ffe600', '#bf00ff', '#00ffaa', '#ff00ff', '#7fff00'],
  },
  papercraft: {
    trunkHeight: 5.4,
    trunkScale: 1.12,
    mainBoughCount: 6,
    spreadAngle: 0.58,
    boughLenScale: 1.05,
    limbSides: 4,
    wireOpacity: 0.78,
    foliageScale: 1.22,
    trunkColors: ['#b08968', '#c89f7c'],
    boughColors: ['#d4a373', '#e07a5f', '#81b29a'],
    wireColors: ['#6c4632', '#8a5a44', '#5c3d24'],
    canopyPalette: ['#e07a5f', '#81b29a', '#f2cc8f', '#fdf8ee', '#e6ccb2', '#d62828', '#6b9080', '#f4a261'],
  },
  industrial: {
    trunkHeight: 6.5,
    trunkScale: 1.28,
    mainBoughCount: 8,
    spreadAngle: 0.5,
    boughLenScale: 1.08,
    limbSides: 4,
    wireOpacity: 0.85,
    foliageScale: 1.15,
    trunkColors: ['#1d2128', '#2b303a'],
    boughColors: ['#3b2618', '#2b303a', '#4a3520'],
    wireColors: ['#d97706', '#ff6b00', '#ff9e00'],
    canopyPalette: ['#ff6b00', '#ff9e00', '#d97706', '#fbbf24', '#ef4444', '#f59e0b', '#fde047', '#ea580c'],
  },
  western: {
    trunkHeight: 5.8,
    trunkScale: 1.32,
    mainBoughCount: 8,
    spreadAngle: 0.7,
    boughLenScale: 1.18,
    limbSides: 6,
    wireOpacity: 0.55,
    foliageScale: 1.24,
    trunkColors: ['#4a301c', '#5c3d24'],
    boughColors: ['#6e4726', '#8c5e36', '#7a4e2d'],
    wireColors: ['#d4a373', '#faedcd', '#ffd27d'],
    canopyPalette: ['#d4a373', '#e9c46a', '#f4a261', '#e76f51', '#8ab17d', '#ffd27d', '#bc6c25', '#dda15e'],
  },
  crt: {
    trunkHeight: 6.2,
    trunkScale: 1.05,
    mainBoughCount: 8,
    spreadAngle: 0.52,
    boughLenScale: 1.1,
    limbSides: 4,
    wireOpacity: 0.95,
    foliageScale: 1.1,
    trunkColors: ['#031608', '#05240d'],
    boughColors: ['#05240d', '#073614', '#0a471b'],
    wireColors: ['#22ff66', '#39ff14', '#ffb000'],
    canopyPalette: ['#22ff66', '#39ff14', '#ffb000', '#80ff9f', '#00e640', '#ffd166', '#16a34a', '#bbf7d0'],
  },
  ukiyoe: {
    trunkHeight: 5.0,
    trunkScale: 1.25,
    mainBoughCount: 7,
    spreadAngle: 0.75,
    boughLenScale: 1.22,
    limbSides: 6,
    wireOpacity: 0.72,
    foliageScale: 1.3,
    trunkColors: ['#2b1d14', '#3d281d'],
    boughColors: ['#3d281d', '#1d3557', '#5c3d24'],
    wireColors: ['#d62828', '#161412', '#f4ebd9'],
    canopyPalette: ['#d62828', '#e63946', '#f4ebd9', '#1d3557', '#2a9d8f', '#f4a261', '#e9c46a', '#ffb5a7'],
  },
  cathedral: {
    trunkHeight: 7.2,
    trunkScale: 1.08,
    mainBoughCount: 8,
    spreadAngle: 0.4,
    boughLenScale: 1.15,
    limbSides: 6,
    wireOpacity: 0.9,
    foliageScale: 1.18,
    trunkColors: ['#160c28', '#23133d'],
    boughColors: ['#23133d', '#3a1c5e', '#4c1d95'],
    wireColors: ['#ffb703', '#ff006e', '#3a86ff'],
    canopyPalette: ['#ff006e', '#ffb703', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0', '#ffbe0b', '#e0aaff'],
  },
  blueprint: {
    trunkHeight: 6.0,
    trunkScale: 1.05,
    mainBoughCount: 8,
    spreadAngle: 0.56,
    boughLenScale: 1.1,
    limbSides: 6,
    wireOpacity: 0.95,
    foliageScale: 1.12,
    trunkColors: ['#082c54', '#0b3b6e'],
    boughColors: ['#0b3b6e', '#104c8a', '#1660a8'],
    wireColors: ['#e0f4ff', '#ffd166', '#90e0ef'],
    canopyPalette: ['#e0f4ff', '#90e0ef', '#ffd166', '#48cae4', '#ffffff', '#00b4d8', '#caf0f8', '#fcbf49'],
  },
  biolume: {
    trunkHeight: 5.8,
    trunkScale: 1.15,
    mainBoughCount: 10,
    spreadAngle: 0.66,
    boughLenScale: 1.16,
    limbSides: 8,
    wireOpacity: 0.9,
    foliageScale: 1.24,
    trunkColors: ['#041f36', '#073454'],
    boughColors: ['#073454', '#0a4870', '#0d5c8c'],
    wireColors: ['#00f5d4', '#f15bb5', '#7bf1a8'],
    canopyPalette: ['#00f5d4', '#f15bb5', '#00bbf9', '#7bf1a8', '#fee440', '#9b5de5', '#4cc9f0', '#ff70a6'],
  },
  kintsugi: {
    trunkHeight: 5.4,
    trunkScale: 1.2,
    mainBoughCount: 7,
    spreadAngle: 0.62,
    boughLenScale: 1.12,
    limbSides: 4,
    wireOpacity: 0.95,
    foliageScale: 1.18,
    trunkColors: ['#141218', '#1f1c24'],
    boughColors: ['#141218', '#1f1c24', '#292530'],
    wireColors: ['#ffd166', '#ffb703', '#ffe599'],
    canopyPalette: ['#ffd166', '#ffb703', '#ffe599', '#f4ebd9', '#292530', '#fb8500', '#ffffff', '#d4a373'],
  },
  solarpunk: {
    trunkHeight: 6.2,
    trunkScale: 1.24,
    mainBoughCount: 9,
    spreadAngle: 0.66,
    boughLenScale: 1.18,
    limbSides: 8,
    wireOpacity: 0.75,
    foliageScale: 1.26,
    trunkColors: ['#f4f1de', '#e9edc9'],
    boughColors: ['#d4a373', '#52b788', '#74c69d'],
    wireColors: ['#ffd166', '#d4a373', '#52b788'],
    canopyPalette: ['#52b788', '#74c69d', '#95d5b2', '#ffd166', '#f4f1de', '#40916c', '#b7e4c7', '#ffb703'],
  },
  noir: {
    trunkHeight: 6.8,
    trunkScale: 1.15,
    mainBoughCount: 8,
    spreadAngle: 0.48,
    boughLenScale: 1.14,
    limbSides: 6,
    wireOpacity: 0.85,
    foliageScale: 1.18,
    trunkColors: ['#0c0c10', '#16161d'],
    boughColors: ['#16161d', '#20202a', '#2d2d3a'],
    wireColors: ['#e2e8f0', '#e6193c', '#94a3b8'],
    canopyPalette: ['#f8fafc', '#e6193c', '#cbd5e1', '#ff2a4b', '#64748b', '#ffffff', '#94a3b8', '#be123c'],
  },
};

function createJewelFoliageGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  // Origami diamond crystal petal with 8 crisp triangular facets
  const p = [
    // Top-front-left
    0, 0, 1.15, -0.58, 0, 0, 0, 0.32, 0.08,
    // Top-front-right
    0, 0, 1.15, 0, 0.32, 0.08, 0.58, 0, 0,
    // Top-back-left
    0, 0, 1.15, 0, -0.22, 0.08, -0.58, 0, 0,
    // Top-back-right
    0, 0, 1.15, 0.58, 0, 0, 0, -0.22, 0.08,
    // Base-front-left
    0, 0, -0.65, 0, 0.32, 0.08, -0.58, 0, 0,
    // Base-front-right
    0, 0, -0.65, 0.58, 0, 0, 0, 0.32, 0.08,
    // Base-back-left
    0, 0, -0.65, -0.58, 0, 0, 0, -0.22, 0.08,
    // Base-back-right
    0, 0, -0.65, 0, -0.22, 0.08, 0.58, 0, 0,
  ];
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
  geom.computeVertexNormals();
  return geom;
}

const TEXT_NEAR_RADIUS_SQ = 20 * 20;

export interface TreeGrowthMetrics {
  thoughtCount: number;
  stage: 'bare-cylinder' | 'growing-tree';
  trunkHeight: number;
  trunkRadiusBase: number;
  trunkRadiusTop: number;
  mainBoughCount: number;
  secondaryForkCount: number;
  tertiaryTwigCount: number;
  totalLimbCount: number;
  blossomCount: number;
  canopySpan: number;
}

export const TREE_GROWTH_FORMULA_SUMMARY =
  'n=0: bare cylinder (1 trunk, 0 boughs, 0 blossoms) | n>=1: boughs = n (1..5) then 5+floor(sqrt(n-5)*2.2), secondaries = n+floor(n*0.65), twigs = 2*(n-1), blossoms = n, trunkHeight = 4.5 + 0.38*sqrt(n) + 0.025*n';

/**
 * Pure, inspectable growth function mapping monthly journal entry count (`n`)
 * to tree structural metrics.
 *
 * Guarantees:
 * - `n === 0`: bare vertical cylinder ("telephone pole" — 1 cylinder, 0 branches, 0 blossoms)
 * - Every `+1` entry (`n -> n + 1`) produces a strictly larger tree across all `n >= 0`
 * - Zero plateau across `0..5` (`mainBoughCount` = `0, 1, 2, 3, 4, 5`)
 * - No hard cap at 15 (scales smoothly to hundreds of entries)
 */
export function computeTreeGrowthMetrics(rawCount: number): TreeGrowthMetrics {
  const n = Math.max(0, Math.floor(Number.isFinite(rawCount) ? rawCount : 0));

  if (n === 0) {
    return {
      thoughtCount: 0,
      stage: 'bare-cylinder',
      trunkHeight: 4.5,
      trunkRadiusBase: 0.42,
      trunkRadiusTop: 0.42,
      mainBoughCount: 0,
      secondaryForkCount: 0,
      tertiaryTwigCount: 0,
      totalLimbCount: 1,
      blossomCount: 0,
      canopySpan: 0.84,
    };
  }

  const trunkHeight = Number((4.5 + 0.38 * Math.sqrt(n) + 0.025 * n).toFixed(3));
  const trunkRadiusBase = Number((0.44 + 0.045 * Math.sqrt(n) + 0.0025 * n).toFixed(3));
  const trunkRadiusTop = Number((trunkRadiusBase * 0.56).toFixed(3));

  // Linearly 1..5 for n=1..5 (no 0-5 plateau), then smooth unbounded square-root + linear progression
  const mainBoughCount =
    n <= 5
      ? n
      : 5 + Math.floor(Math.sqrt(n - 5) * 2.2 + (n - 5) * 0.15);

  const secondaryForkCount = n + Math.floor(n * 0.65);
  const tertiaryTwigCount = (n - 1) * 2;
  const trunkSegmentCount = 2;
  const totalLimbCount =
    trunkSegmentCount + mainBoughCount + secondaryForkCount + tertiaryTwigCount;
  const blossomCount = n;
  const canopySpan = Number((2.2 + 1.15 * Math.sqrt(n) + 0.08 * n).toFixed(3));

  return {
    thoughtCount: n,
    stage: 'growing-tree',
    trunkHeight,
    trunkRadiusBase,
    trunkRadiusTop,
    mainBoughCount,
    secondaryForkCount,
    tertiaryTwigCount,
    totalLimbCount,
    blossomCount,
    canopySpan,
  };
}

interface InscriptionTreeProps {
  thoughtCount: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  /** 0 = JAN .. 11 = DEC. Defaults to the current calendar month. */
  monthIndex?: number;
  /** Number of active distinct days with entries. Inferred from thoughtCount if omitted. */
  activeDays?: number;
  /** Direct aliveness metric (A = 2E + 3D). Computed if omitted. */
  aliveness?: number;
  /** Month-end crystallization state. */
  isCrystallized?: boolean;
  /** World [x, y, z] anchor. Defaults to [0, 0, 0] (Altar center). */
  position?: [number, number, number];
  /** Uniform scale factor (e.g. 0.78 for grove portals). */
  scale?: number;
  /** When set, the tree acts as an interactive Month Portal in the Fractal Eye. */
  portalLabel?: string;
  active?: boolean;
  stale?: boolean;
  onEnter?: () => void;
}

interface LimbSegment {
  id: string;
  mid: [number, number, number];
  quat: THREE.Quaternion;
  length: number;
  radiusTop: number;
  radiusBot: number;
  color: string;
  wireColor: string;
}

interface MicroBlossom {
  id: string;
  pos: [number, number, number];
  radius: number;
  color: string;
}

interface MonthTreeTheme {
  trunkColors: [string, string];
  boughColors: [string, string, string];
  wireColors: [string, string, string];
  blossomPalette: string[];
  lightPrimary: string;
  lightSecondary: string;
}

const MONTH_TREE_THEMES: MonthTreeTheme[] = [
  // 0: JAN — Boreal Frost Crystal
  {
    trunkColors: ['#0f172a', '#1e3a8a'],
    boughColors: ['#1d4ed8', '#0284c7', '#0ea5e9'],
    wireColors: ['#38bdf8', '#7dd3fc', '#bae6fd'],
    blossomPalette: ['#e0f2fe', '#38bdf8', '#818cf8', '#f0f9ff', '#67e8f9', '#c084fc'],
    lightPrimary: '#38bdf8',
    lightSecondary: '#e0f2fe',
  },
  // 1: FEB — Amethyst Thaw
  {
    trunkColors: ['#2e1065', '#4c1d95'],
    boughColors: ['#581c87', '#701a75', '#86198f'],
    wireColors: ['#c084fc', '#e879f9', '#f5d0fe'],
    blossomPalette: ['#f472b6', '#e879f9', '#c084fc', '#fbcfe8', '#38bdf8', '#fde047'],
    lightPrimary: '#e879f9',
    lightSecondary: '#f472b6',
  },
  // 2: MAR — Vernal Mist
  {
    trunkColors: ['#064e3b', '#065f46'],
    boughColors: ['#047857', '#0d9488', '#10b981'],
    wireColors: ['#34d399', '#6ee7b7', '#a7f3d0'],
    blossomPalette: ['#6ee7b7', '#34d399', '#fde047', '#a7f3d0', '#2dd4bf', '#f9a8d4'],
    lightPrimary: '#34d399',
    lightSecondary: '#fde047',
  },
  // 3: APR — Sakura Quartz
  {
    trunkColors: ['#4a044e', '#701a75'],
    boughColors: ['#831843', '#9d174d', '#be185d'],
    wireColors: ['#f472b6', '#f9a8d4', '#fbcfe8'],
    blossomPalette: ['#fbcfe8', '#f472b6', '#fda4af', '#ffffff', '#e879f9', '#fde047'],
    lightPrimary: '#f472b6',
    lightSecondary: '#fbcfe8',
  },
  // 4: MAY — Emerald Canopy
  {
    trunkColors: ['#14532d', '#166534'],
    boughColors: ['#15803d', '#16a34a', '#22c55e'],
    wireColors: ['#4ade80', '#86efac', '#bbf7d0'],
    blossomPalette: ['#4ade80', '#fde047', '#86efac', '#38bdf8', '#f472b6', '#a7f3d0'],
    lightPrimary: '#4ade80',
    lightSecondary: '#fde047',
  },
  // 5: JUN — Solstice Amber
  {
    trunkColors: ['#422006', '#713f12'],
    boughColors: ['#854d0e', '#a16207', '#ca8a04'],
    wireColors: ['#facc15', '#fde047', '#fef08a'],
    blossomPalette: ['#fde047', '#facc15', '#fb923c', '#4ade80', '#fef08a', '#38bdf8'],
    lightPrimary: '#facc15',
    lightSecondary: '#fb923c',
  },
  // 6: JUL — Heliotrope Sun
  {
    trunkColors: ['#3b0764', '#581c87'],
    boughColors: ['#6b21a8', '#9333ea', '#a855f7'],
    wireColors: ['#fbbf24', '#f59e0b', '#fde68a'],
    blossomPalette: ['#fbbf24', '#f472b6', '#22d3ee', '#fde047', '#e879f9', '#4ade80'],
    lightPrimary: '#fbbf24',
    lightSecondary: '#e879f9',
  },
  // 7: AUG — Late Summer Copper
  {
    trunkColors: ['#431407', '#7c2d12'],
    boughColors: ['#9a3412', '#c2410c', '#ea580c'],
    wireColors: ['#fb923c', '#fdba74', '#fed7aa'],
    blossomPalette: ['#fb923c', '#fde047', '#f87171', '#fdba74', '#c084fc', '#34d399'],
    lightPrimary: '#fb923c',
    lightSecondary: '#fde047',
  },
  // 8: SEP — Equinox Indigo
  {
    trunkColors: ['#1e1b4b', '#312e81'],
    boughColors: ['#3730a3', '#4338ca', '#4f46e5'],
    wireColors: ['#818cf8', '#a5b4fc', '#c7d2fe'],
    blossomPalette: ['#818cf8', '#fde047', '#c084fc', '#38bdf8', '#f472b6', '#a5b4fc'],
    lightPrimary: '#818cf8',
    lightSecondary: '#fbbf24',
  },
  // 9: OCT — Obsidian Harvest (Classic Citadel Amethyst & Starlight)
  {
    trunkColors: ['#2e1065', '#3b0764'],
    boughColors: ['#581c87', '#6b21a8', '#7e22ce'],
    wireColors: ['#c084fc', '#d8b4fe', '#e9d5ff'],
    blossomPalette: ['#fde047', '#c084fc', '#f472b6', '#38bdf8', '#4ade80', '#e879f9'],
    lightPrimary: '#c084fc',
    lightSecondary: '#fbbf24',
  },
  // 10: NOV — Frostfire Crimson
  {
    trunkColors: ['#450a0a', '#7f1d1d'],
    boughColors: ['#991b1b', '#b91c1c', '#dc2626'],
    wireColors: ['#f87171', '#fca5a5', '#fecaca'],
    blossomPalette: ['#f87171', '#fbbf24', '#fca5a5', '#e2e8f0', '#c084fc', '#fde047'],
    lightPrimary: '#f87171',
    lightSecondary: '#fbbf24',
  },
  // 11: DEC — Starlight Evergreen
  {
    trunkColors: ['#022c22', '#115e59'],
    boughColors: ['#0f766e', '#0d9488', '#14b8a6'],
    wireColors: ['#2dd4bf', '#5eead4', '#99f6e4'],
    blossomPalette: ['#2dd4bf', '#fde047', '#ffffff', '#38bdf8', '#5eead4', '#f472b6'],
    lightPrimary: '#2dd4bf',
    lightSecondary: '#fde047',
  },
];

export function buildTreeGeometry(
  thoughtCount: number,
  monthIndex = 0,
  isPortal = false,
): {
  metrics: TreeGrowthMetrics;
  limbs: LimbSegment[];
  blossoms: MicroBlossom[];
} {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const theme = MONTH_TREE_THEMES[normalizedMonth];
  const metrics = computeTreeGrowthMetrics(thoughtCount);

  const monthSeed = (normalizedMonth + 1) * 97.31;
  const rng = (seed: number) => {
    const x = Math.sin((seed + monthSeed) * 73.159 + 17.831) * 10000;
    return x - Math.floor(x);
  };

  const limbList: LimbSegment[] = [];
  const blossomList: MicroBlossom[] = [];
  const { blossomPalette, trunkColors, boughColors, wireColors } = theme;
  const vUp = new THREE.Vector3(0, 1, 0);
  let idCounter = 0;

  const addLimb = (
    p0: [number, number, number],
    p1: [number, number, number],
    rBot: number,
    rTop: number,
    color: string,
    wireColor: string,
  ) => {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return;

    const mid: [number, number, number] = [
      p0[0] + dx * 0.5,
      p0[1] + dy * 0.5,
      p0[2] + dz * 0.5,
    ];
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(vUp, dir);

    limbList.push({
      id: `limb-${idCounter++}`,
      mid,
      quat,
      length: len,
      radiusTop: rTop,
      radiusBot: rBot,
      color,
      wireColor,
    });
  };

  const baseY = isPortal ? 0.0 : 2.0;
  const topY = baseY + metrics.trunkHeight;

  // ── Base State (0 entries): Bare Vertical Cylinder ("Telephone Pole") ──
  if (metrics.thoughtCount === 0) {
    addLimb(
      [0, baseY, 0],
      [0, topY, 0],
      metrics.trunkRadiusBase,
      metrics.trunkRadiusTop,
      trunkColors[0],
      wireColors[0],
    );
    return { metrics, limbs: limbList, blossoms: blossomList };
  }

  // ── Growing Tree State (n >= 1 entries) ──
  const trunkR0 = metrics.trunkRadiusBase;
  const trunkR1 = Number((trunkR0 * 0.76).toFixed(3));
  const trunkR2 = metrics.trunkRadiusTop;

  const leanX = (rng(1) - 0.5) * 0.32;
  const leanZ = (rng(2) - 0.5) * 0.32;
  const midY = baseY + metrics.trunkHeight * 0.48;

  // 2 tapered trunk segments
  addLimb(
    [0, baseY, 0],
    [leanX * 0.5, midY, leanZ * 0.5],
    trunkR0,
    trunkR1,
    trunkColors[0],
    wireColors[0],
  );
  addLimb(
    [leanX * 0.5, midY, leanZ * 0.5],
    [leanX, topY, leanZ],
    trunkR1,
    trunkR2,
    trunkColors[1],
    wireColors[1],
  );

  const splitRatio = 0.72;
  const monthYawOffset = rng(5) * Math.PI * 2;
  const { mainBoughCount, secondaryForkCount, tertiaryTwigCount, blossomCount } = metrics;

  const boughEndpoints: Array<{
    endP: [number, number, number];
    phi: number;
    rPrimary: number;
    boughIndex: number;
  }> = [];

  const tipCandidates: Array<{ pos: [number, number, number]; seed: number }> = [];

  for (let m = 0; m < mainBoughCount; m++) {
    const mPhi =
      monthYawOffset +
      (m / Math.max(1, mainBoughCount)) * Math.PI * 2 +
      (m % 2) * 0.32;
    const boughElevation =
      baseY +
      metrics.trunkHeight * 0.68 +
      (m / Math.max(1, mainBoughCount)) * (metrics.trunkHeight * 0.32);
    const boughLen =
      2.35 +
      Math.min(2.6, Math.sqrt(metrics.thoughtCount) * 0.32) +
      rng(m * 11) * 1.15;
    const spreadAngle = 0.52 + rng(m * 13) * 0.32;

    const startP: [number, number, number] = [leanX, boughElevation, leanZ];
    const endP: [number, number, number] = [
      leanX + Math.cos(mPhi) * Math.sin(spreadAngle) * boughLen,
      boughElevation + Math.cos(spreadAngle) * boughLen * 0.9,
      leanZ + Math.sin(mPhi) * Math.sin(spreadAngle) * boughLen,
    ];

    const rPrimary = trunkR2 * splitRatio;
    addLimb(startP, endP, trunkR2 * 0.85, rPrimary, boughColors[0], wireColors[0]);
    boughEndpoints.push({ endP, phi: mPhi, rPrimary, boughIndex: m });
    tipCandidates.push({ pos: endP, seed: m * 17 + 3 });
  }

  const secondaryEndpoints: Array<{
    sEndP: [number, number, number];
    sForkYaw: number;
    rSecondary: number;
    secIndex: number;
  }> = [];

  for (let s = 0; s < secondaryForkCount; s++) {
    const parent = boughEndpoints[s % boughEndpoints.length];
    const branchSiblingIndex = Math.floor(s / boughEndpoints.length);
    const sSeed = parent.boughIndex * 29 + s * 17;
    const sideSign = branchSiblingIndex % 2 === 0 ? -1 : 1;
    const sForkYaw =
      parent.phi +
      sideSign * (0.38 + (branchSiblingIndex >> 1) * 0.22) +
      (rng(sSeed) - 0.5) * 0.22;
    const sSpread = 0.45 + rng(sSeed + 1) * 0.32;
    const sLen = 1.65 + Math.min(1.6, Math.sqrt(metrics.thoughtCount) * 0.18) + rng(sSeed + 2) * 0.95;

    const sEndP: [number, number, number] = [
      parent.endP[0] + Math.cos(sForkYaw) * Math.sin(sSpread) * sLen,
      parent.endP[1] + Math.cos(sSpread) * sLen * 0.85,
      parent.endP[2] + Math.sin(sForkYaw) * Math.sin(sSpread) * sLen,
    ];

    const rSecondary = parent.rPrimary * splitRatio;
    addLimb(
      parent.endP,
      sEndP,
      parent.rPrimary,
      rSecondary,
      boughColors[1],
      wireColors[1],
    );
    secondaryEndpoints.push({ sEndP, sForkYaw, rSecondary, secIndex: s });
    tipCandidates.unshift({ pos: sEndP, seed: sSeed + 5 });
  }

  for (let t = 0; t < tertiaryTwigCount; t++) {
    const parent = secondaryEndpoints[t % secondaryEndpoints.length];
    const twigSibling = Math.floor(t / secondaryEndpoints.length);
    const tSeed = parent.secIndex * 37 + t * 19;
    const sideSign = twigSibling % 2 === 0 ? -1 : 1;
    const tForkYaw =
      parent.sForkYaw +
      sideSign * (0.34 + (twigSibling >> 1) * 0.18) +
      (rng(tSeed) - 0.5) * 0.2;
    const tSpread = 0.4 + rng(tSeed + 1) * 0.35;
    const tLen = 1.05 + rng(tSeed + 2) * 0.75;

    const tEndP: [number, number, number] = [
      parent.sEndP[0] + Math.cos(tForkYaw) * Math.sin(tSpread) * tLen,
      parent.sEndP[1] + Math.cos(tSpread) * tLen * 0.8,
      parent.sEndP[2] + Math.sin(tForkYaw) * Math.sin(tSpread) * tLen,
    ];

    const rTwig = parent.rSecondary * splitRatio;
    addLimb(
      parent.sEndP,
      tEndP,
      parent.rSecondary,
      rTwig,
      boughColors[2],
      wireColors[2],
    );
    tipCandidates.unshift({ pos: tEndP, seed: tSeed + 11 });
  }

  // Place 1 crystal memory blossom per journal entry (`blossomCount === n`)
  for (let b = 0; b < blossomCount; b++) {
    const tip = tipCandidates[b % tipCandidates.length];
    const cycle = Math.floor(b / tipCandidates.length);
    const bSeed = tip.seed + b * 23;
    const jitter: [number, number, number] =
      cycle === 0
        ? [0, 0, 0]
        : [
            (rng(bSeed) - 0.5) * 0.45,
            (rng(bSeed + 1) - 0.5) * 0.35,
            (rng(bSeed + 2) - 0.5) * 0.45,
          ];
    const bRadius = (0.075 + rng(bSeed + 5) * 0.045) * 1.75;
    const bColor = blossomPalette[b % blossomPalette.length];

    blossomList.push({
      id: `blossom-${idCounter++}`,
      pos: [
        tip.pos[0] + jitter[0],
        tip.pos[1] + jitter[1],
        tip.pos[2] + jitter[2],
      ],
      radius: bRadius,
      color: bColor,
    });
  }

  return { metrics, limbs: limbList, blossoms: blossomList };
}

export function buildConstantTreeGeometry(
  monthIndex = 0,
  isPortal = false,
  look: WorldLookId = 'wireframe',
): {
  limbs: LimbSegment[];
  foliagePoints: Array<[number, number, number]>;
} {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const theme = MONTH_TREE_THEMES[normalizedMonth];
  const spec = WORLD_TREE_SPECS[look === 'minimal' ? 'wireframe' : look];
  const trunkColors = isPortal ? theme.trunkColors : spec.trunkColors;
  const boughColors = isPortal ? theme.boughColors : spec.boughColors;
  const wireColors = isPortal ? theme.wireColors : spec.wireColors;

  const monthSeed = (normalizedMonth + 1) * 97.31;
  const rng = (seed: number) => {
    const x = Math.sin((seed + monthSeed) * 73.159 + 17.831) * 10000;
    return x - Math.floor(x);
  };

  const limbList: LimbSegment[] = [];
  const vUp = new THREE.Vector3(0, 1, 0);
  let idCounter = 0;

  const addLimb = (
    p0: [number, number, number],
    p1: [number, number, number],
    rBot: number,
    rTop: number,
    color: string,
    wireColor: string,
  ) => {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return;

    const mid: [number, number, number] = [
      p0[0] + dx * 0.5,
      p0[1] + dy * 0.5,
      p0[2] + dz * 0.5,
    ];
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(vUp, dir);

    limbList.push({
      id: `limb-${idCounter++}`,
      mid,
      quat,
      length: len,
      radiusTop: rTop,
      radiusBot: rBot,
      color,
      wireColor,
    });
  };

  const baseY = isPortal ? 0.0 : 2.0;
  const trunkHeight = isPortal ? 5.6 : spec.trunkHeight;
  const tScale = isPortal ? 1.0 : spec.trunkScale;
  const topY = baseY + trunkHeight;
  const trunkR0 = 0.48 * tScale;
  const trunkR1 = 0.38 * tScale;
  const trunkR2 = 0.28 * tScale;

  const leanX = (rng(1) - 0.5) * 0.25;
  const leanZ = (rng(2) - 0.5) * 0.25;
  const midY = baseY + trunkHeight * 0.48;

  // 2 tapered trunk segments
  addLimb([0, baseY, 0], [leanX * 0.5, midY, leanZ * 0.5], trunkR0, trunkR1, trunkColors[0], wireColors[0]);
  addLimb([leanX * 0.5, midY, leanZ * 0.5], [leanX, topY, leanZ], trunkR1, trunkR2, trunkColors[1], wireColors[1]);

  const mainBoughCount = isPortal ? 8 : spec.mainBoughCount;
  const boughLenScale = isPortal ? 1.0 : spec.boughLenScale;
  const baseSpread = isPortal ? 0.56 : spec.spreadAngle;
  const monthYawOffset = rng(5) * Math.PI * 2;

  const twigTips: Array<[number, number, number]> = [];
  const secondaryForks: Array<[number, number, number]> = [];
  const boughForks: Array<[number, number, number]> = [];

  for (let m = 0; m < mainBoughCount; m++) {
    const mPhi = monthYawOffset + (m / mainBoughCount) * Math.PI * 2 + (m % 2) * 0.25;
    const bElevation = baseY + trunkHeight * 0.65 + (m / mainBoughCount) * (trunkHeight * 0.3);
    const bLen = (3.2 + rng(m * 7) * 0.8) * boughLenScale;
    const spreadAngle = baseSpread + rng(m * 11) * 0.22;

    const bStart: [number, number, number] = [leanX, bElevation, leanZ];
    const bEnd: [number, number, number] = [
      leanX + Math.cos(mPhi) * Math.sin(spreadAngle) * bLen,
      bElevation + Math.cos(spreadAngle) * bLen * 0.85,
      leanZ + Math.sin(mPhi) * Math.sin(spreadAngle) * bLen,
    ];
    addLimb(bStart, bEnd, trunkR2 * 0.72, trunkR2 * 0.48, boughColors[m % 3], wireColors[m % 3]);
    boughForks.push(bEnd);

    // 2 secondary forks per main bough
    for (let s = 0; s < 2; s++) {
      const sYaw = mPhi + (s === 0 ? -0.48 : 0.48);
      const sLen = (2.1 + rng(m * 17 + s) * 0.6) * boughLenScale;
      const sSpread = spreadAngle + 0.28;
      const sEnd: [number, number, number] = [
        bEnd[0] + Math.cos(sYaw) * Math.sin(sSpread) * sLen,
        bEnd[1] + Math.cos(sSpread) * sLen * 0.75 + 0.3,
        bEnd[2] + Math.sin(sYaw) * Math.sin(sSpread) * sLen,
      ];
      addLimb(bEnd, sEnd, trunkR2 * 0.44, trunkR2 * 0.28, boughColors[(m + 1) % 3], wireColors[(m + 1) % 3]);
      secondaryForks.push(sEnd);

      // 2 tertiary twigs per secondary fork
      for (let w = 0; w < 2; w++) {
        const wYaw = sYaw + (w === 0 ? -0.52 : 0.52);
        const wLen = (1.4 + rng(m * 31 + s * 7 + w) * 0.45) * boughLenScale;
        const wSpread = sSpread + 0.22;
        const wEnd: [number, number, number] = [
          sEnd[0] + Math.cos(wYaw) * Math.sin(wSpread) * wLen,
          sEnd[1] + Math.cos(wSpread) * wLen * 0.65 + 0.25,
          sEnd[2] + Math.sin(wYaw) * Math.sin(wSpread) * wLen,
        ];
        addLimb(sEnd, wEnd, trunkR2 * 0.24, 0.05 * tScale, boughColors[(m + 2) % 3], wireColors[(m + 2) % 3]);
        twigTips.push(wEnd);
      }
    }
  }

  // ── ARCHITECTURAL TOP-CROWNING CANOPY FORMULA (180 Total Points) ──
  const maxCrownR = 7.6 * boughLenScale;
  const zenithY = baseY + trunkHeight + 5.2 * boughLenScale;
  const domeHeightAtR = (r: number) => {
    const normR = Math.min(1.0, r / maxCrownR);
    return zenithY - 2.25 * Math.pow(normR, 1.7);
  };

  // Tier 1: 32 Terminal Crown Anchors
  const tier1Tips: Array<[number, number, number]> = [];
  for (let idx = 0; idx < 32; idx++) {
    const tip = twigTips[idx % twigTips.length];
    const jx = (rng(idx * 7 + 1) - 0.5) * 0.35;
    const jy = 0.32 + rng(idx * 11 + 2) * 0.45;
    const jz = (rng(idx * 13 + 3) - 0.5) * 0.35;
    tier1Tips.push([tip[0] + jx, tip[1] + jy, tip[2] + jz]);
  }

  // Tier 2: 64 Zenith Umbrella Dome Nodes
  const tier2Dome: Array<[number, number, number]> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < 64; k++) {
    const fraction = (k + 0.5) / 64;
    const r = (0.75 + Math.sqrt(fraction) * 5.65) * boughLenScale;
    const theta = k * goldenAngle + rng(k * 17 + 5) * 0.18;
    const topDomeY = domeHeightAtR(r);
    const y = topDomeY - rng(k * 23 + 7) * 0.55;
    tier2Dome.push([
      leanX + Math.cos(theta) * r,
      y,
      leanZ + Math.sin(theta) * r,
    ]);
  }

  // Tier 3: 48 Sub-Canopy Cloud Billows
  const tier3Billows: Array<[number, number, number]> = [];
  for (let j = 0; j < 48; j++) {
    const fraction = (j + 0.5) / 48;
    const r = (1.4 + Math.sqrt(fraction) * 5.1) * boughLenScale;
    const theta = j * goldenAngle + 1.25 + rng(j * 29 + 11) * 0.25;
    const topDomeY = domeHeightAtR(r);
    const y = topDomeY - 0.75 - rng(j * 31 + 13) * 1.15;
    tier3Billows.push([
      leanX + Math.cos(theta) * r,
      y,
      leanZ + Math.sin(theta) * r,
    ]);
  }

  // Tier 4: 36 Edge Permutation Plates & Shingles
  const tier4EdgePermutations: Array<[number, number, number]> = [];
  for (let e = 0; e < 36; e++) {
    const theta = (e / 36) * Math.PI * 2 + (rng(e * 37 + 17) - 0.5) * 0.08;
    const edgePhase = e % 3;
    let r = 6.6 * boughLenScale;
    let yOffset = 0;
    if (edgePhase === 0) {
      r = (7.35 + rng(e * 41 + 19) * 0.35) * boughLenScale;
      yOffset = 0.22;
    } else if (edgePhase === 1) {
      r = (6.45 + rng(e * 41 + 19) * 0.3) * boughLenScale;
      yOffset = -0.26;
    } else {
      r = (7.0 + rng(e * 41 + 19) * 0.35) * boughLenScale;
      yOffset = 0.08;
    }
    const topDomeY = domeHeightAtR(r);
    tier4EdgePermutations.push([
      leanX + Math.cos(theta) * r,
      topDomeY + yOffset,
      leanZ + Math.sin(theta) * r,
    ]);
  }

  const foliagePoints: Array<[number, number, number]> = [
    ...tier1Tips,
    ...tier2Dome,
    ...tier3Billows,
    ...tier4EdgePermutations,
  ];

  return { limbs: limbList, foliagePoints };
}

// Citadel Canopy Jewel Foliage Palette: Pink, Orange, Amber, Cyan, Teal, and soft pastel harmonics
export const CITADEL_CANOPY_PALETTE = [
  '#f472b6', // Pastel Pink Blossom
  '#fb7185', // Rose Quartz Pink
  '#fbcfe8', // Soft Sakura Pastel Pink
  '#fb923c', // Sunset Tangerine Orange
  '#f97316', // Radiant Solar Orange
  '#ffedd5', // Pastel Peach Shimmer
  '#fbbf24', // Honey Amber Gold
  '#f59e0b', // Deep Sunstone Amber
  '#fde68a', // Pastel Amber Starlight
  '#22d3ee', // Luminous Electric Cyan
  '#38bdf8', // Pastel Sky Cyan
  '#06b6d4', // Deep Crystal Cyan
  '#2dd4bf', // Vernal Mint Teal
  '#14b8a6', // Deep Emerald Teal
  '#99f6e4', // Pastel Seafoam Teal
  '#c084fc', // Pastel Amethyst Lavender
];

export function InstancedTreeFoliage({
  points,
  count,
  color: _color,
  active,
  isCrystallized,
  palette = CITADEL_CANOPY_PALETTE,
  foliageScale = 1.0,
}: {
  points: [number, number, number][];
  count: number;
  color: string;
  active: boolean;
  isCrystallized: boolean;
  palette?: string[];
  foliageScale?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const debugStore = useFoliageDebugStore();
  const [dissolveScale, setDissolveScale] = useState(1);

  useFrame(() => {
    if (debugStore.isDissolving && debugStore.dissolutionStartTime) {
      const elapsed = performance.now() - debugStore.dissolutionStartTime;
      const progress = Math.max(0, 1 - elapsed / 1200);
      setDissolveScale(progress);
      if (progress <= 0) {
        debugStore.endDissolution();
      }
    } else if (dissolveScale < 1 && !debugStore.isDissolving) {
      setDissolveScale(1);
    }
  });

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const activeCount = Math.min(count, points.length);
    const activePalette = palette.length > 0 ? palette : CITADEL_CANOPY_PALETTE;

    for (let i = 0; i < points.length; i++) {
      if (i < activeCount && dissolveScale > 0.001) {
        const [px, py, pz] = points[i];
        dummy.position.set(px, py, pz);

        const r = Math.hypot(px, pz);
        const phi = Math.atan2(pz, px);
        const isEdge = i >= 144 || r >= 6.2;

        if (isEdge) {
          // ── PERMUTATIONS ON THE EDGES (Faceted Shingles, Diamond Plates & Crystal Fins) ──
          const edgeType = i % 3;
          const baseS = (isCrystallized ? 0.4 : 0.34) * dissolveScale * foliageScale;

          if (edgeType === 0) {
            dummy.scale.set(baseS * 1.55, baseS * 0.48, baseS * 1.35);
          } else if (edgeType === 1) {
            dummy.scale.set(baseS * 1.25, baseS * 0.65, baseS * 1.6);
          } else {
            dummy.scale.set(baseS * 0.75, baseS * 1.45, baseS * 1.1);
          }

          dummy.rotation.set(
            0.32,
            -phi + Math.PI / 2,
            i % 2 === 0 ? 0.28 : -0.28,
          );
        } else {
          // ── CORE DOME & CLOUD BILLOW VOLUMES (Lush, Overlapping Billows) ──
          const baseS = (isCrystallized ? 0.48 : 0.42) * dissolveScale * foliageScale;
          const scaleVar = 0.95 + 0.35 * Math.sin(i * 3.71);
          const s = baseS * scaleVar;

          const sx = s * (1.0 + 0.22 * Math.sin(i * 1.93));
          const sy = s * (0.85 + 0.18 * Math.cos(i * 2.47));
          const sz = s * (1.0 + 0.22 * Math.sin(i * 4.11));
          dummy.scale.set(sx, sy, sz);

          dummy.rotation.set(
            (i * 1.13) % (Math.PI * 2),
            (i * 0.79) % (Math.PI * 2),
            (i * 0.53) % (Math.PI * 2),
          );
        }

        const sector = Math.floor(((phi + Math.PI) / (Math.PI * 2)) * 8);
        const paletteIndex = (sector * 2 + (i % 3)) % activePalette.length;
        const hex = activePalette[paletteIndex];
        tempColor.set(hex);

        if (active) {
          tempColor.lerp(new THREE.Color('#67e8f9'), 0.4);
        }
        mesh.setColorAt(i, tempColor);
      } else {
        dummy.position.set(0, -999, 0);
        dummy.scale.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [points, count, isCrystallized, dummy, tempColor, dissolveScale, active, palette, foliageScale]);

  const jewelGeometry = useMemo(() => createJewelFoliageGeometry(), []);

  if (count <= 0 || dissolveScale <= 0.001) return null;

  return (
    <instancedMesh
      ref={meshRef}
      geometry={jewelGeometry}
      args={[undefined, undefined, points.length]}
      count={Math.min(count, points.length)}
    >
      {isCrystallized ? (
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.92}
          roughness={0.12}
          flatShading
          emissive="#38bdf8"
          emissiveIntensity={0.35}
        />
      ) : (
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.25}
          roughness={0.22}
          flatShading
          transparent
          opacity={0.96 * dissolveScale}
        />
      )}
    </instancedMesh>
  );
}

/**
 * Bespoke 3D architectural, botanical, and sculptural crown/trunk ornaments
 * giving the central Memory Tree unmistakable silhouette variance across all 15 rich worlds.
 */
function TreeWorldVarianceOrnament({
  look,
  topY,
}: {
  look: Exclude<WorldLookId, 'minimal'>;
  topY: number;
}) {
  const animRef = useRef<THREE.Group>(null);
  const counterRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (animRef.current) {
      animRef.current.rotation.y = t * 0.22;
    }
    if (counterRef.current) {
      counterRef.current.rotation.y = -t * 0.34;
    }
  });

  switch (look) {
    case 'wireframe':
      return (
        <group>
          <group ref={animRef} position={[0, topY + 2.8, 0]}>
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[6.4, 0.045, 8, 48]} />
              <meshBasicMaterial color="#22d3ee" wireframe />
            </mesh>
            <mesh rotation={[-Math.PI / 3, Math.PI / 4, 0]}>
              <torusGeometry args={[5.2, 0.04, 8, 40]} />
              <meshBasicMaterial color="#fbbf24" wireframe />
            </mesh>
            <mesh position={[0, 4.2, 0]}>
              <octahedronGeometry args={[1.15, 0]} />
              <meshBasicMaterial color="#c084fc" wireframe />
            </mesh>
          </group>
        </group>
      );

    case 'dream':
      return (
        <group>
          {/* Hanging Wisteria & Sakura Blossom Garlands */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r = 4.6 + (i % 3) * 1.1;
            const gx = Math.cos(a) * r;
            const gz = Math.sin(a) * r;
            return (
              <group key={i} position={[gx, topY + 2.2, gz]}>
                {[0, 1, 2, 3, 4].map((step) => (
                  <mesh key={step} position={[0, -step * 0.72, 0]}>
                    <octahedronGeometry args={[0.34 - step * 0.045, 0]} />
                    <meshBasicMaterial
                      color={step % 2 === 0 ? '#f8bbd0' : step === 1 ? '#ce93d8' : '#fff3b0'}
                      transparent
                      opacity={0.92}
                    />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* Warm Golden-Hour Sun Halo */}
          <mesh position={[0, topY + 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[6.2, 0.07, 8, 48]} />
            <meshBasicMaterial color="#fff3b0" transparent opacity={0.68} />
          </mesh>
        </group>
      );

    case 'comic':
      return (
        <group>
          {/* Jack Kirby Krackle Energy Nodes orbiting the canopy */}
          <group ref={animRef} position={[0, topY + 2.6, 0]}>
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const r = 5.8 + (i % 3) * 0.9;
              const y = ((i % 4) - 1.5) * 1.1;
              return (
                <group key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]}>
                  <mesh>
                    <icosahedronGeometry args={[0.48, 0]} />
                    <meshBasicMaterial color="#08040f" />
                  </mesh>
                  <mesh position={[0.14, 0.14, 0.14]}>
                    <icosahedronGeometry args={[0.28, 0]} />
                    <meshBasicMaterial color={i % 2 === 0 ? '#ff2a55' : '#00d4ff'} />
                  </mesh>
                </group>
              );
            })}
          </group>
          {/* Action Starburst Crown Ring */}
          <mesh position={[0, 2.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.6, 3.8, 8]} />
            <meshBasicMaterial color="#ffe600" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 2.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.55, 3.9, 8]} />
            <meshBasicMaterial color="#08040f" side={THREE.DoubleSide} />
          </mesh>
        </group>
      );

    case 'acid':
      return (
        <group>
          {/* Giant Bioluminescent Mushroom Parasol Cap crowning the Tree */}
          <group position={[0, topY + 4.8, 0]}>
            <mesh scale={[1, 0.36, 1]}>
              <sphereGeometry args={[5.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshBasicMaterial color="#ff007f" transparent opacity={0.78} />
            </mesh>
            <mesh scale={[1.01, 0.37, 1.01]}>
              <sphereGeometry args={[5.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshBasicMaterial color="#39ff14" wireframe />
            </mesh>
          </group>
          {/* Counter-Rotating Sacred Merkaba Neon Rings */}
          <group ref={animRef} position={[0, topY + 2.0, 0]}>
            <mesh rotation={[Math.PI / 4, 0, 0]}>
              <torusGeometry args={[7.2, 0.08, 8, 48]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
            <mesh rotation={[-Math.PI / 4, Math.PI / 3, 0]}>
              <torusGeometry args={[6.4, 0.08, 8, 48]} />
              <meshBasicMaterial color="#ffe600" />
            </mesh>
          </group>
        </group>
      );

    case 'papercraft':
      return (
        <group>
          {/* Orbiting Flock of Folded Origami Paper Cranes */}
          <group ref={animRef} position={[0, topY + 2.8, 0]}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r = 5.8 + (i % 2) * 1.1;
              const y = (i % 3) * 0.7;
              return (
                <group
                  key={i}
                  position={[Math.cos(a) * r, y, Math.sin(a) * r]}
                  rotation={[0, -a, 0.2]}
                >
                  <mesh rotation={[0, 0, Math.PI / 2]}>
                    <coneGeometry args={[0.55, 1.4, 4]} />
                    <meshBasicMaterial color={i % 2 === 0 ? '#fdf8ee' : '#e07a5f'} />
                  </mesh>
                  <mesh rotation={[0, 0, Math.PI / 2]} scale={1.03}>
                    <coneGeometry args={[0.55, 1.4, 4]} />
                    <meshBasicMaterial color="#6c4632" wireframe />
                  </mesh>
                </group>
              );
            })}
          </group>
          {/* Stepped Cardboard Diorama Plinth */}
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[2.2, 2.6, 0.45, 8]} />
            <meshBasicMaterial color="#d4a373" />
          </mesh>
          <mesh position={[0, 2.2, 0]} scale={1.01}>
            <cylinderGeometry args={[2.2, 2.6, 0.45, 8]} />
            <meshBasicMaterial color="#6c4632" wireframe />
          </mesh>
        </group>
      );

    case 'industrial':
      return (
        <group>
          {/* Molten Orange Induction Coils & Heavy Steel Clamps */}
          {[3.2, 5.0, 6.8].map((yPos, idx) => (
            <group key={idx} position={[0, yPos, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.85 - idx * 0.08, 0.14, 6, 16]} />
                <meshBasicMaterial color="#1d2128" />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.92 - idx * 0.08, 0.06, 6, 16]} />
                <meshBasicMaterial color="#ff6b00" />
              </mesh>
            </group>
          ))}
          {/* Spinning Steel Gantry Turbine Halo */}
          <group ref={animRef} position={[0, topY + 2.4, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[5.6, 0.18, 6, 24]} />
              <meshBasicMaterial color="#2b303a" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[5.6, 0.2, 6, 24]} />
              <meshBasicMaterial color="#ff9e00" wireframe />
            </mesh>
          </group>
        </group>
      );

    case 'western':
      return (
        <group>
          {/* Wooden Wagon-Wheel Corral Ring at Base */}
          <group position={[0, 2.4, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.4, 0.12, 6, 16]} />
              <meshBasicMaterial color="#5c3d24" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.4, 0.13, 6, 16]} />
              <meshBasicMaterial color="#d4a373" wireframe />
            </mesh>
          </group>
          {/* 6 Hanging Brass Frontier Oil Lanterns suspended from the Boughs */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            const r = 4.2;
            const lx = Math.cos(a) * r;
            const lz = Math.sin(a) * r;
            return (
              <group key={i} position={[lx, topY + 0.6, lz]}>
                <mesh position={[0, 0.7, 0]}>
                  <cylinderGeometry args={[0.025, 0.025, 1.4, 4]} />
                  <meshBasicMaterial color="#8c5e36" />
                </mesh>
                <mesh>
                  <octahedronGeometry args={[0.38, 0]} />
                  <meshBasicMaterial color="#ffd27d" />
                </mesh>
                <mesh scale={1.12}>
                  <octahedronGeometry args={[0.38, 0]} />
                  <meshBasicMaterial color="#5c3d24" wireframe />
                </mesh>
              </group>
            );
          })}
        </group>
      );

    case 'crt':
      return (
        <group>
          {/* Horizontal Green Phosphor Scanline Rings */}
          {[0.4, 2.2, 4.0].map((yOff, idx) => (
            <mesh key={idx} position={[0, topY + yOff, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[6.4 - idx * 1.1, 0.045, 4, 32]} />
              <meshBasicMaterial color="#22ff66" />
            </mesh>
          ))}
          {/* Spinning Amber Mainframe Octahedron Core */}
          <group ref={animRef} position={[0, topY + 5.2, 0]}>
            <mesh>
              <octahedronGeometry args={[1.35, 0]} />
              <meshBasicMaterial color="#ffb000" wireframe />
            </mesh>
          </group>
        </group>
      );

    case 'ukiyoe':
      return (
        <group>
          {/* Giant Vermilion Woodblock Rising Sun Disk behind the Crown */}
          <mesh position={[0, topY + 2.4, -2.6]}>
            <circleGeometry args={[5.2, 32]} />
            <meshBasicMaterial color="#d62828" side={THREE.DoubleSide} transparent opacity={0.86} />
          </mesh>
          <mesh position={[0, topY + 2.4, -2.58]}>
            <ringGeometry args={[5.05, 5.28, 32]} />
            <meshBasicMaterial color="#161412" side={THREE.DoubleSide} />
          </mesh>
          {/* Floating Sumi-e Cloud Layer Pads */}
          {[-1, 1].map((dir, idx) => (
            <group key={idx} position={[dir * 3.8, topY + 1.2 + idx * 1.4, 1.2]}>
              <mesh scale={[2.4, 0.22, 1.2]}>
                <cylinderGeometry args={[1, 1, 1, 8]} />
                <meshBasicMaterial color="#f4ebd9" />
              </mesh>
              <mesh scale={[2.45, 0.24, 1.25]}>
                <cylinderGeometry args={[1, 1, 1, 8]} />
                <meshBasicMaterial color="#1d3557" wireframe />
              </mesh>
            </group>
          ))}
        </group>
      );

    case 'cathedral':
      return (
        <group>
          {/* Vertical Stained-Glass Rose Window Halo */}
          <group position={[0, topY + 2.8, 0]}>
            <mesh>
              <torusGeometry args={[5.8, 0.14, 8, 36]} />
              <meshBasicMaterial color="#ffb703" />
            </mesh>
            <mesh>
              <ringGeometry args={[2.2, 5.7, 12]} />
              <meshBasicMaterial
                color="#ff006e"
                wireframe
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh>
              <ringGeometry args={[0.8, 2.2, 12]} />
              <meshBasicMaterial
                color="#3a86ff"
                transparent
                opacity={0.55}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
          {/* 6 Gothic Brass Pinnacles around Trunk */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 2.2, 4.2, Math.sin(a) * 2.2]}
              >
                <coneGeometry args={[0.28, 3.6, 4]} />
                <meshBasicMaterial color="#ffb703" wireframe />
              </mesh>
            );
          })}
        </group>
      );

    case 'blueprint':
      return (
        <group>
          {/* Brass & Cyanotype Armillary Sphere */}
          <group ref={animRef} position={[0, topY + 1.8, 0]}>
            <mesh>
              <torusGeometry args={[6.8, 0.05, 8, 48]} />
              <meshBasicMaterial color="#e0f4ff" />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[6.8, 0.05, 8, 48]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[6.8, 0.06, 8, 48]} />
              <meshBasicMaterial color="#90e0ef" wireframe />
            </mesh>
          </group>
          {/* Floor Protractor Compass Ring */}
          <mesh position={[0, 2.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.8, 3.4, 24]} />
            <meshBasicMaterial color="#e0f4ff" wireframe side={THREE.DoubleSide} />
          </mesh>
        </group>
      );

    case 'biolume':
      return (
        <group>
          {/* Translucent Medusa Jellyfish Bell Crown */}
          <group position={[0, topY + 4.4, 0]}>
            <mesh scale={[1, 0.55, 1]}>
              <sphereGeometry args={[4.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshBasicMaterial color="#00f5d4" transparent opacity={0.42} />
            </mesh>
            <mesh scale={[1.01, 0.56, 1.01]}>
              <sphereGeometry args={[4.8, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshBasicMaterial color="#f15bb5" wireframe />
            </mesh>
          </group>
          {/* 10 Trailing Bioluminescent Medusa Tendrils */}
          <group ref={animRef} position={[0, topY + 1.4, 0]}>
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              const r = 4.5 + (i % 2) * 0.9;
              return (
                <mesh
                  key={i}
                  position={[Math.cos(a) * r, -1.8, Math.sin(a) * r]}
                >
                  <cylinderGeometry args={[0.04, 0.01, 4.2, 5]} />
                  <meshBasicMaterial color={i % 2 === 0 ? '#00f5d4' : '#f15bb5'} />
                </mesh>
              );
            })}
          </group>
        </group>
      );

    case 'kintsugi':
      return (
        <group>
          {/* 3 Blazing 24k Molten Gold Fracture Seam Rings */}
          <group ref={animRef} position={[0, topY + 1.6, 0]}>
            <mesh rotation={[0.45, 0.2, 0]}>
              <torusGeometry args={[6.2, 0.09, 6, 40]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
            <mesh rotation={[-0.5, 0.8, 0.3]}>
              <torusGeometry args={[5.4, 0.075, 6, 36]} />
              <meshBasicMaterial color="#ffb703" />
            </mesh>
          </group>
          {/* 8 Levitating Fractured Obsidian Shards */}
          <group ref={counterRef} position={[0, topY + 1.6, 0]}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r = 5.8;
              return (
                <group
                  key={i}
                  position={[Math.cos(a) * r, (i % 3) * 0.8 - 0.8, Math.sin(a) * r]}
                >
                  <mesh>
                    <octahedronGeometry args={[0.52, 0]} />
                    <meshBasicMaterial color="#141218" />
                  </mesh>
                  <mesh scale={1.06}>
                    <octahedronGeometry args={[0.52, 0]} />
                    <meshBasicMaterial color="#ffd166" wireframe />
                  </mesh>
                </group>
              );
            })}
          </group>
        </group>
      );

    case 'solarpunk':
      return (
        <group>
          {/* 6 Arching Brass & Emerald Banyan Prop-Roots */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            const r = 1.65;
            return (
              <group
                key={i}
                position={[Math.cos(a) * r, 3.8, Math.sin(a) * r]}
                rotation={[0, -a, -0.45]}
              >
                <mesh>
                  <cylinderGeometry args={[0.08, 0.18, 4.2, 6]} />
                  <meshBasicMaterial color="#d4a373" />
                </mesh>
                <mesh scale={1.04}>
                  <cylinderGeometry args={[0.08, 0.18, 4.2, 6]} />
                  <meshBasicMaterial color="#ffd166" wireframe />
                </mesh>
              </group>
            );
          })}
          {/* Spinning Golden Solar Wind-Catcher Halo */}
          <group ref={animRef} position={[0, topY + 4.5, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[4.4, 0.08, 8, 36]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
            <mesh>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color="#52b788" wireframe />
            </mesh>
          </group>
        </group>
      );

    case 'noir':
      return (
        <group>
          {/* Blazing Vertical Crimson-Neon Halo Ring */}
          <mesh position={[0, topY + 2.4, 0]}>
            <torusGeometry args={[6.0, 0.11, 8, 48]} />
            <meshBasicMaterial color="#e6193c" />
          </mesh>
          {/* Stark White Venetian-Blind Light Collar at Trunk Base */}
          {[2.2, 2.6, 3.0].map((yPos, idx) => (
            <mesh key={idx} position={[0, yPos, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.4 + idx * 0.25, 0.04, 4, 24]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>
      );
  }
}

export function InscriptionTree({
  thoughtCount,
  playerPos,
  monthIndex = new Date().getMonth(),
  activeDays,
  aliveness,
  isCrystallized = false,
  position = [0, 0, 0],
  scale = 1,
  portalLabel,
  active = false,
  stale = false,
  onEnter,
}: InscriptionTreeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Group>(null);
  const [isNear, setIsNear] = useState(false);

  const look = useWorldLook((s) => s.look);
  const isPortal = Boolean(portalLabel);

  const debugStore = useFoliageDebugStore();
  const effectiveCount = debugStore.enabled ? debugStore.overrideE : thoughtCount;
  const resolvedActiveDays = debugStore.enabled
    ? debugStore.overrideD
    : activeDays ?? (thoughtCount > 0 ? 1 : 0);
  const resolvedAliveness = debugStore.enabled
    ? computeAliveness(effectiveCount, resolvedActiveDays)
    : aliveness ?? computeAliveness(thoughtCount, resolvedActiveDays);
  const foliageCount = computeFoliageCount(resolvedAliveness);
  // Ensure the central Hub Memory Tree always commands strong visual presence in all 15 non-minimal worlds
  const displayFoliageCount =
    !isPortal && !debugStore.enabled ? Math.max(foliageCount, 128) : foliageCount;
  const foliageState: MonthFoliageState = getMonthFoliageState(resolvedAliveness, isCrystallized);

  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const theme = MONTH_TREE_THEMES[normalizedMonth];
  const activeSpecKey: Exclude<WorldLookId, 'minimal'> =
    look === 'minimal' ? 'wireframe' : look;
  const spec = WORLD_TREE_SPECS[activeSpecKey];

  const termiteseName = useMemo(
    () => (portalLabel ? applyTermiteseGlitch(portalLabel, 0) : ''),
    [portalLabel],
  );

  const { limbs, foliagePoints } = useMemo(
    () => buildConstantTreeGeometry(normalizedMonth, isPortal, look),
    [normalizedMonth, isPortal, look],
  );

  // Expose live metrics for inspection (dev log + window.__citadelTreeMetrics)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        (window as unknown as { __citadelTreeMetrics?: Record<string, unknown> }).__citadelTreeMetrics = {
          month: normalizedMonth,
          thoughtCount: effectiveCount,
          activeDays: resolvedActiveDays,
          aliveness: resolvedAliveness,
          foliageCount: displayFoliageCount,
          foliageState,
          stage: foliageState === 'bare' ? 'bare' : 'growing-tree',
          isCrystallized,
          debugOverridesActive: debugStore.enabled,
          worldLook: look,
        };
      }
    } catch {
      // Window may have readonly properties in certain WebKit configurations
    }
    console.info(
      `[Citadel Tree Foliage] look=${look} month=${normalizedMonth} entries=${effectiveCount} activeDays=${resolvedActiveDays} aliveness=${resolvedAliveness} foliageCount=${displayFoliageCount} state=${foliageState} debug=${debugStore.enabled}`,
    );
  }, [normalizedMonth, effectiveCount, resolvedActiveDays, resolvedAliveness, displayFoliageCount, foliageState, isCrystallized, debugStore.enabled, look]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;

    if (isPortal) {
      const distSq = dx * dx + dz * dz;
      const currentlyNear = distSq < TEXT_NEAR_RADIUS_SQ;
      if (currentlyNear !== isNear) {
        setIsNear(currentlyNear);
      }
    }

    // Pin to planetary curvature
    if (groupRef.current) {
      applyGlobeCurvature(groupRef.current, position[0], 0, position[2], pp);
    }

    // Majestic subtle breathing of the upper crown
    if (canopyRef.current) {
      canopyRef.current.rotation.y = t * 0.02 + normalizedMonth * 0.5 + Math.sin(t * 0.8) * 0.012;
      canopyRef.current.rotation.z = Math.sin(t * 0.6 + normalizedMonth) * 0.008;
    }
  });

  // Never render the central Memory Tree in Minimalist (INTJ) mode
  if (look === 'minimal' && !isPortal) {
    return null;
  }

  const displayText = portalLabel ? (isNear ? portalLabel : termiteseName) : '';
  const sigilColor = active ? '#fbbf24' : isPortal ? theme.wireColors[0] : spec.wireColors[0];
  const limbSides = isPortal ? 6 : spec.limbSides;
  const wireOpacity = isPortal ? 0.38 : spec.wireOpacity;

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[2]]}
      userData={TREE_OWN_TAG}
      onClick={onEnter}
    >
      <group scale={scale}>
        {/* ── 1. LEONARDO DA VINCI / WORLD-VARIANCE ARBOR ── */}
        <group ref={canopyRef}>
          {/* Constant Wireframe & Solid-Core Limbs */}
          {limbs.map((l) => (
            <group key={l.id} position={l.mid} quaternion={l.quat}>
              {/* Solid / Translucent Crystal Core */}
              <mesh>
                <cylinderGeometry args={[l.radiusTop, l.radiusBot, l.length, limbSides]} />
                <meshBasicMaterial color={l.color} transparent opacity={stale ? 0.35 : 0.86} />
              </mesh>
              {/* Fine Edge Facet Highlight */}
              <mesh scale={[1.03, 1.0, 1.03]}>
                <cylinderGeometry args={[l.radiusTop, l.radiusBot, l.length, limbSides]} />
                <meshBasicMaterial
                  color={active ? '#fbbf24' : l.wireColor}
                  wireframe
                  transparent
                  opacity={active ? 0.85 : stale ? 0.18 : wireOpacity}
                />
              </mesh>
              {/* Optional Comic Book Cel-Shaded Ink Outline */}
              {!isPortal && spec.inkOutline && (
                <mesh scale={[1.14, 1.01, 1.14]}>
                  <cylinderGeometry args={[l.radiusTop, l.radiusBot, l.length, limbSides]} />
                  <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
                </mesh>
              )}
            </group>
          ))}

          {/* ── 2. DIGITAL FOLIAGE (Single InstancedMesh Draw Call) ── */}
          <InstancedTreeFoliage
            points={foliagePoints}
            count={displayFoliageCount}
            color={isPortal ? theme.blossomPalette[0] : spec.canopyPalette[0]}
            active={active}
            isCrystallized={isCrystallized}
            palette={isPortal ? CITADEL_CANOPY_PALETTE : spec.canopyPalette}
            foliageScale={isPortal ? 1.0 : spec.foliageScale}
          />

          {/* ── 3. BESPOKE WORLD CROWN & TRUNK ORNAMENTS ── */}
          {!isPortal && (
            <TreeWorldVarianceOrnament
              look={activeSpecKey}
              topY={2.0 + spec.trunkHeight}
            />
          )}
        </group>

        {/* ── 4. HUB ROOT SANCTUARY SIGIL / FRACTAL EYE PORTAL SIGIL ── */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, isPortal ? 0.06 : 2.04, 0]}>
          <ringGeometry args={[isPortal ? 1.4 : 1.8, isPortal ? 2.3 : 3.2, limbSides === 4 ? 8 : 12]} />
          <meshBasicMaterial
            color={sigilColor}
            wireframe
            transparent
            opacity={active ? 0.85 : 0.62}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, isPortal ? 0.04 : 2.02, 0]}>
          <ringGeometry args={[0.5, isPortal ? 2.1 : 2.9, limbSides === 4 ? 8 : 12]} />
          <meshBasicMaterial
            color={sigilColor}
            transparent
            opacity={active ? 0.22 : 0.14}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Portal Halo Ring kept at crisp standard scale around the trunk */}
      {isPortal && portalLabel && (
        <group position={[0, 1.8, 0]}>
          <DigitalAlarmHaloRing
            text={displayText}
            active={active}
            stale={stale}
            radius={2.2}
            colorScheme={active ? 'amber' : 'cyan'}
          />
        </group>
      )}
    </group>
  );
}

