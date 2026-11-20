import type { Bounds, Circle } from './colliders';

export type Order = 'doric' | 'ionic' | 'corinthian';
export interface Col { pos: [number, number, number]; order: Order; scale: number }

const row = (xs: number[], zs: number[], orders: Order[], scale = 1): Col[] => {
  const out: Col[] = [];
  xs.forEach((x, i) => out.push({ pos: [x, 0, zs[i % zs.length]], order: orders[i % orders.length], scale }));
  return out;
};

/** Solomon's Temple pillar plan, carried over from the Citadel village. */
export const COLUMNS: Col[] = [
  // Jachin & Boaz — the twin porch pillars
  ...row([-5, 5], [-20], ['corinthian'], 1.25),
  // inner sanctuary peristyle
  ...[-24, -30, -36, -42, -48].flatMap((z, i) => (['doric', 'ionic', 'corinthian', 'ionic', 'doric'] as Order[]).slice(i, i + 1).flatMap((o) => [
    { pos: [-12, 0, z] as [number, number, number], order: o, scale: 1 },
    { pos: [12, 0, z] as [number, number, number], order: o, scale: 1 },
  ])),
  ...row([-6, 0, 6], [-48], ['ionic', 'corinthian', 'ionic']),
  // side chamber colonnades
  ...[-18, -26, -34, -42, -50].flatMap((z, i) => (['doric', 'ionic', 'corinthian', 'ionic', 'doric'] as Order[]).slice(i, i + 1).flatMap((o) => [
    { pos: [-26, 0, z] as [number, number, number], order: o, scale: 1 },
    { pos: [26, 0, z] as [number, number, number], order: o, scale: 1 },
  ])),
  // rear colonnade
  ...row([-18, -11, -4, 4, 11, 18], [-58], ['doric', 'ionic', 'corinthian', 'corinthian', 'ionic', 'doric']),
  // forecourt gates
  ...row([-8, 8], [24], ['doric']),
  { pos: [-26, 0, -4], order: 'ionic', scale: 1 },
  { pos: [-26, 0, 4], order: 'ionic', scale: 1 },
  { pos: [26, 0, -4], order: 'ionic', scale: 1 },
  { pos: [26, 0, 4], order: 'ionic', scale: 1 },
];

export const BOUNDS: Bounds = { minX: -34, maxX: 34, minZ: -64, maxZ: 36 };
export const PLAYER_START = { x: 0, z: 30 };
export const BASIN: Circle = { x: 0, z: 2, r: 3.2 };

export type StationId = 'gate' | 'armory' | 'shrine' | 'wall' | 'yard';
export interface Station {
  id: StationId;
  label: string;
  verb: string;
  pos: [number, number];
  color: string;
  solids: Circle[];
}

export const STATIONS: Station[] = [
  { id: 'gate', label: 'THE GATE', verb: 'ENTER THE ARENA', pos: [0, -41], color: '#ff4fd8',
    solids: [{ x: -2.4, z: -41, r: 0.8 }, { x: 2.4, z: -41, r: 0.8 }] },
  { id: 'armory', label: 'THE ARMORY', verb: 'CHOOSE YOUR GEAR', pos: [-18, 8], color: '#ffc95c',
    solids: [{ x: -18, z: 8, r: 1.7 }] },
  { id: 'shrine', label: 'THE SHRINE', verb: 'SPEND GLORY', pos: [18, 8], color: '#a78bfa',
    solids: [{ x: 18, z: 8, r: 1.7 }] },
  { id: 'yard', label: 'TRAINING YARD', verb: 'PRACTICE', pos: [-19, -33], color: '#ff6b6b',
    solids: [{ x: -21.5, z: -33, r: 0.7 }, { x: -16.5, z: -33, r: 0.7 }] },
  { id: 'wall', label: 'WALL OF THE FALLEN', verb: 'READ THE NAMES', pos: [19, -33], color: '#3ff0ff',
    solids: [{ x: 17, z: -33, r: 1 }, { x: 19, z: -33, r: 1 }, { x: 21, z: -33, r: 1 }] },
];

export const SOLIDS: Circle[] = [
  ...COLUMNS.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 0.9 * c.scale })),
  BASIN,
  ...STATIONS.flatMap((s) => s.solids),
];

export const INTERACT_RANGE = 4.6;

export function nearestStation(x: number, z: number): Station | null {
  let best: Station | null = null;
  let bd = INTERACT_RANGE;
  for (const s of STATIONS) {
    const d = Math.hypot(x - s.pos[0], z - s.pos[1]);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
