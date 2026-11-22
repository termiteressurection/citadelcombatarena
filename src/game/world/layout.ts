import type { Bounds, Circle } from './colliders';

export type Order = 'doric' | 'ionic' | 'corinthian';
export interface Col { pos: [number, number, number]; order: Order; scale: number }

export interface CityTower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent: string;
  billboard?: boolean;
}

export interface AqueductPier {
  x: number;
  z: number;
  rotY: number;
  r: number;
}

const row = (xs: number[], zs: number[], orders: Order[], scale = 1): Col[] => {
  const out: Col[] = [];
  xs.forEach((x, i) => out.push({ pos: [x, 0, zs[i % zs.length]], order: orders[i % orders.length], scale }));
  return out;
};

/** Neon Monolith Avenue & Purge Arena colonnade plan. */
export const COLUMNS: Col[] = [
  ...row([-6.5, 6.5], [-40], ['corinthian'], 1.25),
  ...row([-6.5, 6.5], [-62], ['corinthian'], 1.15),
  ...[-22, -6, 10, 24].flatMap((z, i) =>
    (['doric', 'ionic', 'corinthian', 'ionic'] as Order[]).slice(i, i + 1).flatMap((o) => [
      { pos: [-11.5, 0, z] as [number, number, number], order: o, scale: 1 },
      { pos: [11.5, 0, z] as [number, number, number], order: o, scale: 1 },
    ]),
  ),
  ...[-36, -22, -8, 8, 22, 36].flatMap((z, i) =>
    (['doric', 'ionic', 'corinthian', 'ionic', 'doric', 'ionic'] as Order[]).slice(i, i + 1).flatMap((o) => [
      { pos: [-35, 0, z] as [number, number, number], order: o, scale: 1 },
      { pos: [35, 0, z] as [number, number, number], order: o, scale: 1 },
    ]),
  ),
  ...row([-20, -13, 13, 20], [-64], ['doric', 'ionic', 'ionic', 'doric']),
  ...row([-8.5, 8.5], [34], ['doric']),
];

export const BOUNDS: Bounds = { minX: -96, maxX: 96, minZ: -108, maxZ: 88 };
export const PLAYER_START = { x: 0, z: 34 };
export const BASIN: Circle = { x: 0, z: 2, r: 3.4 };
export const JAIL_CELL: Circle = { x: -34, z: -26, r: 3.8 };

export const AQUEDUCT_SLOPE = 0.25;
export const aqueductZAt = (x: number): number => 2 + x * AQUEDUCT_SLOPE;
export const AQUEDUCT_YAW = -Math.atan2(AQUEDUCT_SLOPE, 1);

export const AQUEDUCT_PIERS: AqueductPier[] = [-86, -68, -50, -32, -14, 14, 32, 50, 68, 86].map((x) => ({
  x,
  z: aqueductZAt(x),
  rotY: AQUEDUCT_YAW,
  r: 1.55,
}));

/** Dense Night City megablock towers ringing Cache Plaza, Under-Conduit Alleys, and Purge Avenue. */
export const CITY_TOWERS: CityTower[] = [
  // West megablock row (leaving clear avenues at z = 22, -26, -46)
  { x: -50, z: 46, w: 12, d: 13, h: 26, accent: '#3ff0ff', billboard: true },
  { x: -50, z: 22, w: 11, d: 11, h: 19, accent: '#ff4fd8' },
  { x: -52, z: -38, w: 13, d: 12, h: 34, accent: '#ffc95c', billboard: true },
  { x: -50, z: -60, w: 12, d: 14, h: 24, accent: '#a78bfa' },
  { x: -74, z: 54, w: 14, d: 14, h: 38, accent: '#ff4fd8' },
  { x: -74, z: 28, w: 12, d: 14, h: 28, accent: '#3ff0ff', billboard: true },
  { x: -76, z: -2, w: 13, d: 12, h: 31, accent: '#4dffa0' },
  { x: -74, z: -48, w: 14, d: 14, h: 42, accent: '#3ff0ff' },
  // East megablock row
  { x: 50, z: 46, w: 12, d: 13, h: 29, accent: '#ff4fd8', billboard: true },
  { x: 52, z: 30, w: 11, d: 11, h: 21, accent: '#3ff0ff' },
  { x: 50, z: -12, w: 12, d: 12, h: 27, accent: '#4dffa0', billboard: true },
  { x: 52, z: -38, w: 13, d: 13, h: 36, accent: '#3ff0ff' },
  { x: 50, z: -60, w: 12, d: 13, h: 25, accent: '#ffc95c' },
  { x: 74, z: 54, w: 14, d: 14, h: 33, accent: '#3ff0ff' },
  { x: 76, z: -4, w: 13, d: 12, h: 39, accent: '#ff4fd8', billboard: true },
  { x: 74, z: -48, w: 14, d: 14, h: 30, accent: '#a78bfa' },
  // North Purge Stadium backdrop & flanking monoliths (keeping Gate (0,-54) clear)
  { x: -28, z: -76, w: 12, d: 12, h: 32, accent: '#ff4fd8', billboard: true },
  { x: 28, z: -76, w: 12, d: 12, h: 32, accent: '#3ff0ff', billboard: true },
  { x: -56, z: -84, w: 14, d: 12, h: 24, accent: '#a78bfa' },
  { x: 56, z: -84, w: 14, d: 12, h: 24, accent: '#ffc95c' },
  // South Under-City skyline wings (leaving main central avenue open to z=82)
  { x: -24, z: 58, w: 12, d: 11, h: 22, accent: '#a78bfa' },
  { x: 24, z: 58, w: 12, d: 11, h: 22, accent: '#3ff0ff' },
  { x: -46, z: 72, w: 13, d: 12, h: 28, accent: '#ff4fd8' },
  { x: 46, z: 72, w: 13, d: 12, h: 28, accent: '#ffc95c' },
];

export type StationId =
  | 'gate'
  | 'locker'
  | 'bunk'
  | 'yard'
  | 'smith'
  | 'armorer'
  | 'apothecary'
  | 'board'
  | 'wall';

export interface Station {
  id: StationId;
  label: string;
  verb: string;
  pos: [number, number];
  color: string;
  solids: Circle[];
}

export const STATIONS: Station[] = [
  { id: 'bunk', label: 'SAFE SECTOR POD', verb: 'DEFRAG & NEXT CYCLE', pos: [-18, 32], color: '#a78bfa',
    solids: [{ x: -18, z: 32, r: 1.9 }] },
  { id: 'locker', label: 'MEMORY LOCKER', verb: 'LOADOUT & SPECS [C]', pos: [18, 32], color: '#ffc95c',
    solids: [{ x: 18, z: 32, r: 1.6 }] },
  { id: 'yard', label: 'SIM TRAINING NODE', verb: 'COMBAT DRILL', pos: [-26, 12], color: '#ff6b6b',
    solids: [{ x: -28.5, z: 12, r: 0.7 }, { x: -23.5, z: 12, r: 0.7 }] },
  { id: 'apothecary', label: 'PATCH KIOSK', verb: 'RESTORES & STIMMS', pos: [26, 12], color: '#4dffa0',
    solids: [{ x: 26, z: 12, r: 1.8 }] },
  { id: 'smith', label: 'COMPILER FORGE', verb: 'HARD-LIGHT WEAPONS', pos: [-24, -12], color: '#ff8a3d',
    solids: [{ x: -24, z: -12, r: 1.9 }] },
  { id: 'armorer', label: 'SHELL CLINIC', verb: 'LIGHT-ARMOR & CAPES', pos: [24, -12], color: '#3ff0ff',
    solids: [{ x: 24, z: -12, r: 1.9 }] },
  { id: 'board', label: 'BOUNTY TERMINAL', verb: 'SYS CONTRACTS', pos: [-14, -30], color: '#ffc95c',
    solids: [{ x: -14, z: -30, r: 1.3 }] },
  { id: 'wall', label: 'DELETION ARCHIVE', verb: 'SIGNAL & SHELL TINTS', pos: [16, -30], color: '#a78bfa',
    solids: [{ x: 14, z: -30, r: 1 }, { x: 16, z: -30, r: 1 }, { x: 18, z: -30, r: 1 }] },
  { id: 'gate', label: 'PURGE ARENA GATE', verb: 'ENTER PURGE GRID', pos: [0, -54], color: '#ff4fd8',
    solids: [{ x: -2.6, z: -54, r: 0.85 }, { x: 2.6, z: -54, r: 0.85 }] },
];

export const SOLIDS: Circle[] = [
  ...COLUMNS.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 0.9 * c.scale })),
  BASIN,
  ...STATIONS.flatMap((s) => s.solids),
  ...AQUEDUCT_PIERS.map((p) => ({ x: p.x, z: p.z, r: p.r })),
  ...CITY_TOWERS.map((t) => ({ x: t.x, z: t.z, r: Math.hypot(t.w / 2, t.d / 2) * 0.86 })),
  // Quarantine cell structural corners (leaving southern doorway at z = -22.2 open!)
  { x: -37.2, z: -26, r: 0.9 },
  { x: -30.8, z: -26, r: 0.9 },
  { x: -34, z: -29.2, r: 0.9 },
];

export const INTERACT_RANGE = 4.8;

export function nearestStation(x: number, z: number): Station | null {
  let best: Station | null = null, bd = INTERACT_RANGE;
  for (const s of STATIONS) {
    const d = Math.hypot(s.pos[0] - x, s.pos[1] - z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
