import type { Bounds, Circle } from './colliders';

export type Order = 'doric' | 'ionic' | 'corinthian';
export interface Col { pos: [number, number, number]; order: Order; scale: number }

const row = (xs: number[], zs: number[], orders: Order[], scale = 1): Col[] => {
  const out: Col[] = [];
  xs.forEach((x, i) => out.push({ pos: [x, 0, zs[i % zs.length]], order: orders[i % orders.length], scale }));
  return out;
};

/** Roman Town Sanctuary, Forum Colonnade & Colosseum Avenue pillar plan. */
export const COLUMNS: Col[] = [
  // Jachin & Boaz — twin Colosseum Avenue porch pillars
  ...row([-6, 6], [-38], ['corinthian'], 1.25),
  ...row([-6, 6], [-56], ['corinthian'], 1.15),
  // Forum colonnade pairs flanking the central square
  ...[-20, -4, 10, 22].flatMap((z, i) =>
    (['doric', 'ionic', 'corinthian', 'ionic'] as Order[]).slice(i, i + 1).flatMap((o) => [
      { pos: [-11, 0, z] as [number, number, number], order: o, scale: 1 },
      { pos: [11, 0, z] as [number, number, number], order: o, scale: 1 },
    ]),
  ),
  // Outer market arcade colonnades
  ...[-32, -20, -6, 8, 22, 34].flatMap((z, i) =>
    (['doric', 'ionic', 'corinthian', 'ionic', 'doric', 'ionic'] as Order[]).slice(i, i + 1).flatMap((o) => [
      { pos: [-35, 0, z] as [number, number, number], order: o, scale: 1 },
      { pos: [35, 0, z] as [number, number, number], order: o, scale: 1 },
    ]),
  ),
  // Rear northern Colosseum plaza columns
  ...row([-20, -13, 13, 20], [-58], ['doric', 'ionic', 'ionic', 'doric']),
  // South Barracks entrance piers
  ...row([-8, 8], [32], ['doric']),
];

export const BOUNDS: Bounds = { minX: -48, maxX: 48, minZ: -64, maxZ: 44 };
export const PLAYER_START = { x: 0, z: 34 };
export const BASIN: Circle = { x: 0, z: 2, r: 3.2 };

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
  { id: 'bunk', label: 'LUDUS BUNK', verb: 'REST & NEXT DAY', pos: [-16, 30], color: '#a78bfa',
    solids: [{ x: -16, z: 30, r: 1.9 }] },
  { id: 'locker', label: 'GEAR LOCKER', verb: 'GEAR & STATS [C]', pos: [16, 30], color: '#ffc95c',
    solids: [{ x: 16, z: 30, r: 1.6 }] },
  { id: 'yard', label: 'TRAINING YARD', verb: 'TRAIN STATS', pos: [-24, 12], color: '#ff6b6b',
    solids: [{ x: -26.5, z: 12, r: 0.7 }, { x: -21.5, z: 12, r: 0.7 }] },
  { id: 'apothecary', label: 'APOTHECARY', verb: 'FLASKS & MEALS', pos: [24, 12], color: '#4dffa0',
    solids: [{ x: 24, z: 12, r: 1.8 }] },
  { id: 'smith', label: 'BLACKSMITH', verb: 'BUY WEAPONS', pos: [-22, -10], color: '#ff8a3d',
    solids: [{ x: -22, z: -10, r: 1.9 }] },
  { id: 'armorer', label: 'ARMORER', verb: 'BUY ARMOR', pos: [22, -10], color: '#3ff0ff',
    solids: [{ x: 22, z: -10, r: 1.9 }] },
  { id: 'board', label: 'CONTRACT BOARD', verb: 'CONTRACTS', pos: [-12, -26], color: '#ffc95c',
    solids: [{ x: -12, z: -26, r: 1.3 }] },
  { id: 'wall', label: 'WALL OF FAME', verb: 'HONORS & CRESTS', pos: [14, -26], color: '#a78bfa',
    solids: [{ x: 12, z: -26, r: 1 }, { x: 14, z: -26, r: 1 }, { x: 16, z: -26, r: 1 }] },
  { id: 'gate', label: 'COLOSSEUM GATE', verb: 'FIGHT CARDS', pos: [0, -48], color: '#ff4fd8',
    solids: [{ x: -2.4, z: -48, r: 0.8 }, { x: 2.4, z: -48, r: 0.8 }] },
];

export const SOLIDS: Circle[] = [
  ...COLUMNS.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 0.9 * c.scale })),
  BASIN,
  ...STATIONS.flatMap((s) => s.solids),
];

export const INTERACT_RANGE = 4.8;

export function nearestStation(x: number, z: number): Station | null {
  let best: Station | null = null;
  let bd = INTERACT_RANGE;
  for (const s of STATIONS) {
    const d = Math.hypot(x - s.pos[0], z - s.pos[1]);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
