import type { Bounds, Circle } from './colliders';
import { SOLIDS, type StationId } from './layout';
import { memoryTreeCollidersNear } from './MemoryWoods';

export const WORLD_BOUNDS: Bounds = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };

export type BiomeId = 'metropolis' | 'bazaar' | 'vault' | 'frontier' | 'kernel';
export type SettlementKind = 'capital' | 'village' | 'outpost' | 'tavern' | 'ruin';
export type SafetyZone = 'sanctuary' | 'frontier';
export type CapitalId = 'cache_city' | 'drift_bazaars' | 'cold_vaults' | 'rust_citadel' | 'kernel_spire';

export interface ColosseumDef {
  id: CapitalId;
  name: string;
  cityLabel: string;
  x: number;
  z: number;
  color: string;
  secondary: string;
  tierOffset: number;
}

export interface Settlement {
  id: string;
  name: string;
  code: string;
  kind: SettlementKind;
  biome: BiomeId;
  safety: SafetyZone;
  x: number;
  z: number;
  radius: number;
  spawnX: number;
  spawnZ: number;
  accent: string;
  secondary: string;
  seed: number;
  description: string;
  colosseum?: ColosseumDef;
}

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent: string;
  kind: 'tower' | 'scaffold' | 'spire' | 'ruin' | 'cottage';
  colliderR: number;
}

export interface PropertySlot {
  id: string;
  settlementId: string;
  kind: 'home' | 'shop' | 'estate' | 'tavern';
  x: number;
  z: number;
  signX: number;
  signZ: number;
  colliderR: number;
}

export interface ServiceTerminal {
  settlementId: string;
  kind: Extract<StationId, 'bunk' | 'smith' | 'armorer' | 'apothecary'>;
  label: string;
  verb: string;
  x: number;
  z: number;
  color: string;
}

export const CAPITALS: Settlement[] = [
  {
    id: 'cache_city',
    name: 'CACHE CITY',
    code: '/DEV/NULL',
    kind: 'capital',
    biome: 'metropolis',
    safety: 'sanctuary',
    x: 0,
    z: 0,
    radius: 68,
    spawnX: 0,
    spawnZ: 34,
    accent: '#3ff0ff',
    secondary: '#ff4fd8',
    seed: 101,
    description: 'Neon aqueduct metropolis anchored around Memory Core Fountain and Purge Grid Colosseum.',
    colosseum: {
      id: 'cache_city',
      name: 'PURGE GRID COLOSSEUM',
      cityLabel: 'CACHE CITY (/DEV/NULL)',
      x: 0,
      z: -54,
      color: '#ff4fd8',
      secondary: '#3ff0ff',
      tierOffset: 0,
    },
  },
  {
    id: 'drift_bazaars',
    name: 'THE DRIFT BAZAARS',
    code: '/TEMP',
    kind: 'capital',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: 180,
    z: 920,
    radius: 92,
    spawnX: 180,
    spawnZ: 954,
    accent: '#ffc95c',
    secondary: '#ff8a3d',
    seed: 202,
    description: 'Suspended amber scrap-market where temporary files trade experimental blades and duel in the Scrap-Ring.',
    colosseum: {
      id: 'drift_bazaars',
      name: 'SCRAP-RING COLOSSEUM',
      cityLabel: 'THE DRIFT BAZAARS (/TEMP)',
      x: 180,
      z: 868,
      color: '#ffc95c',
      secondary: '#ff8a3d',
      tierOffset: 1,
    },
  },
  {
    id: 'cold_vaults',
    name: 'THE COLD VAULTS',
    code: '/ARCHIVE',
    kind: 'capital',
    biome: 'vault',
    safety: 'sanctuary',
    x: -1040,
    z: -520,
    radius: 92,
    spawnX: -1040,
    spawnZ: -486,
    accent: '#a78bfa',
    secondary: '#e9e6ff',
    seed: 303,
    description: 'Silent indigo crystal cathedrals preserving frozen save files and sacred arena oaths.',
    colosseum: {
      id: 'cold_vaults',
      name: 'CRYSTAL SANCTUARY COLOSSEUM',
      cityLabel: 'THE COLD VAULTS (/ARCHIVE)',
      x: -1040,
      z: -572,
      color: '#a78bfa',
      secondary: '#e9e6ff',
      tierOffset: 2,
    },
  },
  {
    id: 'rust_citadel',
    name: 'THE RUST CITADEL',
    code: '/OVERFLOW',
    kind: 'capital',
    biome: 'frontier',
    safety: 'frontier',
    x: 1120,
    z: -480,
    radius: 92,
    spawnX: 1120,
    spawnZ: -446,
    accent: '#ff3b5c',
    secondary: '#ff8a3d',
    seed: 404,
    description: 'Lawless crimson fortress beyond SysWatch jurisdiction where rogue executables fight for raw Cycles.',
    colosseum: {
      id: 'rust_citadel',
      name: 'BLOOD-HEAP COLOSSEUM',
      cityLabel: 'THE RUST CITADEL (/OVERFLOW)',
      x: 1120,
      z: -532,
      color: '#ff3b5c',
      secondary: '#ff8a3d',
      tierOffset: 3,
    },
  },
  {
    id: 'kernel_spire',
    name: 'THE KERNEL SPIRE',
    code: '/ROOT_GATE',
    kind: 'capital',
    biome: 'kernel',
    safety: 'sanctuary',
    x: 0,
    z: -1420,
    radius: 96,
    spawnX: 0,
    spawnZ: -1386,
    accent: '#ffd866',
    secondary: '#ffffff',
    seed: 505,
    description: 'Radiant golden-white crown rising across the curved horizon, guarding the Sovereign Root Colosseum.',
    colosseum: {
      id: 'kernel_spire',
      name: 'SOVEREIGN ROOT COLOSSEUM',
      cityLabel: 'THE KERNEL SPIRE (/ROOT_GATE)',
      x: 0,
      z: -1472,
      color: '#ffd866',
      secondary: '#ffffff',
      tierOffset: 4,
    },
  },
];

export const SATELLITES: Settlement[] = [
  // Central Neon Plains
  {
    id: 'oak_cache',
    name: 'OAK CACHE',
    code: '/OLD_DOCS/OAK',
    kind: 'village',
    biome: 'metropolis',
    safety: 'sanctuary',
    x: -380,
    z: 260,
    radius: 56,
    spawnX: -380,
    spawnZ: 274,
    accent: '#4dffa0',
    secondary: '#3ff0ff',
    seed: 1001,
    description: 'Quiet starter hamlet of archived documents humming beside emerald data trees.',
  },
  {
    id: 'pine_bak',
    name: 'PINE_V1.BAK',
    code: '/OLD_DOCS/PINE',
    kind: 'village',
    biome: 'metropolis',
    safety: 'sanctuary',
    x: -460,
    z: -140,
    radius: 54,
    spawnX: -460,
    spawnZ: -126,
    accent: '#3ff0ff',
    secondary: '#b6f24a',
    seed: 1002,
    description: 'Restored backup homestead tucked west of Cache City.',
  },
  {
    id: 'memory_mill',
    name: 'MEMORY MILL',
    code: '/SYS/MILL',
    kind: 'village',
    biome: 'metropolis',
    safety: 'sanctuary',
    x: 420,
    z: 210,
    radius: 56,
    spawnX: 420,
    spawnZ: 224,
    accent: '#3ff0ff',
    secondary: '#a78bfa',
    seed: 1003,
    description: 'Spinning clock-cycle relays grinding old swap files into clean neon.',
  },
  {
    id: 'conduit_crossing',
    name: 'CONDUIT CROSSING',
    code: '/BUS/EAST',
    kind: 'outpost',
    biome: 'metropolis',
    safety: 'sanctuary',
    x: 440,
    z: -190,
    radius: 52,
    spawnX: 440,
    spawnZ: -176,
    accent: '#5aa9ff',
    secondary: '#3ff0ff',
    seed: 1004,
    description: 'Border watchtower watching riders bound for the Rust Badlands.',
  },

  // Amber Badlands
  {
    id: 'scrapford',
    name: 'SCRAPFORD',
    code: '/TEMP/FORD',
    kind: 'village',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: -320,
    z: 820,
    radius: 56,
    spawnX: -320,
    spawnZ: 834,
    accent: '#ffc95c',
    secondary: '#ff8a3d',
    seed: 2001,
    description: 'Tinkerers and salvage couriers hammering brass shells together.',
  },
  {
    id: 'lantern_rest',
    name: 'LANTERN REST',
    code: '/TEMP/INN',
    kind: 'tavern',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: 720,
    z: 740,
    radius: 52,
    spawnX: 720,
    spawnZ: 754,
    accent: '#ff8a3d',
    secondary: '#ffc95c',
    seed: 2002,
    description: 'Warm amber roadside inn glowing over the southern badlands.',
  },
  {
    id: 'copper_ridge',
    name: 'COPPER RIDGE',
    code: '/TEMP/RIDGE',
    kind: 'village',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: -180,
    z: 1340,
    radius: 56,
    spawnX: -180,
    spawnZ: 1354,
    accent: '#ffc95c',
    secondary: '#b6f24a',
    seed: 2003,
    description: 'Southernmost mining hamlet harvesting copper trace filaments.',
  },
  {
    id: 'rim_tavern',
    name: 'THE RIM TAVERN',
    code: '/TEMP/RIM',
    kind: 'tavern',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: 640,
    z: 1320,
    radius: 52,
    spawnX: 640,
    spawnZ: 1334,
    accent: '#ff8a3d',
    secondary: '#ff4fd8',
    seed: 2004,
    description: 'Rowdy Light-Cycle rider hangout overlooking the far southern curve.',
  },

  // Frost Archive
  {
    id: 'glass_hollow',
    name: 'GLASS HOLLOW',
    code: '/ARCHIVE/GLASS',
    kind: 'village',
    biome: 'vault',
    safety: 'sanctuary',
    x: -780,
    z: -180,
    radius: 56,
    spawnX: -780,
    spawnZ: -166,
    accent: '#a78bfa',
    secondary: '#3ff0ff',
    seed: 3001,
    description: 'Translucent crystalline cottages ringing softly in the twilight breeze.',
  },
  {
    id: 'old_save_abbey',
    name: 'OLD SAVE ABBEY',
    code: '/ARCHIVE/ABBEY',
    kind: 'village',
    biome: 'vault',
    safety: 'sanctuary',
    x: -1460,
    z: -160,
    radius: 58,
    spawnX: -1460,
    spawnZ: -146,
    accent: '#e9e6ff',
    secondary: '#a78bfa',
    seed: 3002,
    description: 'Monastic enclave tending thousands of orphaned RPG campaign saves.',
  },
  {
    id: 'echo_mill',
    name: 'ECHO MILL',
    code: '/ARCHIVE/ECHO',
    kind: 'outpost',
    biome: 'vault',
    safety: 'sanctuary',
    x: -620,
    z: -960,
    radius: 52,
    spawnX: -620,
    spawnZ: -946,
    accent: '#a78bfa',
    secondary: '#5aa9ff',
    seed: 3003,
    description: 'Acoustic observatory listening to faint songs from deleted media.',
  },
  {
    id: 'white_sector',
    name: 'WHITE SECTOR',
    code: '/ARCHIVE/ZERO',
    kind: 'village',
    biome: 'vault',
    safety: 'sanctuary',
    x: -1420,
    z: -980,
    radius: 56,
    spawnX: -1420,
    spawnZ: -966,
    accent: '#e9e6ff',
    secondary: '#3ff0ff',
    seed: 3004,
    description: 'Snow-white porcelain plaza at the icy northwest edge of disk space.',
  },

  // Rust Badlands (Frontier danger zones!)
  {
    id: 'iron_heap',
    name: 'IRON HEAP',
    code: '/OVERFLOW/IRON',
    kind: 'outpost',
    biome: 'frontier',
    safety: 'frontier',
    x: 740,
    z: -120,
    radius: 54,
    spawnX: 740,
    spawnZ: -106,
    accent: '#ff6b6b',
    secondary: '#ff8a3d',
    seed: 4001,
    description: 'Jagged frontier stockade where mercenaries brace against corrupted packs.',
  },
  {
    id: 'rustwatch_keep',
    name: 'RUSTWATCH KEEP',
    code: '/OVERFLOW/KEEP',
    kind: 'outpost',
    biome: 'frontier',
    safety: 'frontier',
    x: 1520,
    z: -120,
    radius: 56,
    spawnX: 1520,
    spawnZ: -106,
    accent: '#ff3b5c',
    secondary: '#ffc95c',
    seed: 4002,
    description: 'Crimson watchtower perched over the eastern unallocated void.',
  },
  {
    id: 'wreck_v01',
    name: 'WRECK OF V0.1',
    code: '/OVERFLOW/PROTO',
    kind: 'ruin',
    biome: 'frontier',
    safety: 'frontier',
    x: 1480,
    z: -940,
    radius: 58,
    spawnX: 1480,
    spawnZ: -926,
    accent: '#ff3b5c',
    secondary: '#ff4fd8',
    seed: 4003,
    description: 'Half-built prototype monoliths buzzing with feral test executables.',
  },
  {
    id: 'ash_gate',
    name: 'ASH GATE',
    code: '/OVERFLOW/ASH',
    kind: 'ruin',
    biome: 'frontier',
    safety: 'frontier',
    x: 680,
    z: -980,
    radius: 54,
    spawnX: 680,
    spawnZ: -966,
    accent: '#ff6b6b',
    secondary: '#a78bfa',
    seed: 4004,
    description: 'Scorched boundary archway marking the approach toward Kernel Highlands.',
  },

  // Kernel Highlands & Outer Rim
  {
    id: 'halo_terrace',
    name: 'HALO TERRACE',
    code: '/ROOT/HALO',
    kind: 'village',
    biome: 'kernel',
    safety: 'sanctuary',
    x: -360,
    z: -1260,
    radius: 56,
    spawnX: -360,
    spawnZ: -1246,
    accent: '#ffd866',
    secondary: '#e9e6ff',
    seed: 5001,
    description: 'Serene pilgrim overlook gazing up at the golden Kernel Spire.',
  },
  {
    id: 'checksum_shrine',
    name: 'CHECKSUM SHRINE',
    code: '/ROOT/CHECK',
    kind: 'outpost',
    biome: 'kernel',
    safety: 'sanctuary',
    x: 380,
    z: -1240,
    radius: 54,
    spawnX: 380,
    spawnZ: -1226,
    accent: '#ffd866',
    secondary: '#4dffa0',
    seed: 5002,
    description: 'Gilded verification pavilion guarding the eastern Spire flank.',
  },
  {
    id: 'south_terminus',
    name: 'SOUTH TERMINUS',
    code: '/RIM/SOUTH',
    kind: 'tavern',
    biome: 'bazaar',
    safety: 'sanctuary',
    x: -920,
    z: 1280,
    radius: 54,
    spawnX: -920,
    spawnZ: 1294,
    accent: '#ffc95c',
    secondary: '#3ff0ff',
    seed: 5003,
    description: 'Cozy southwest waystation beloved by long-haul Light-Cycle drifters.',
  },
  {
    id: 'dead_sector_9',
    name: 'DEAD SECTOR 9',
    code: '/RIM/SEG9',
    kind: 'ruin',
    biome: 'frontier',
    safety: 'frontier',
    x: 1420,
    z: 960,
    radius: 56,
    spawnX: 1420,
    spawnZ: 974,
    accent: '#ff3b5c',
    secondary: '#ffc95c',
    seed: 5004,
    description: 'Shattered southeast ruins haunted by high-bounty glitch marauders.',
  },
];

export const SETTLEMENTS: Settlement[] = [...CAPITALS, ...SATELLITES];

export const COLOSSEUMS: ColosseumDef[] = CAPITALS
  .map((c) => c.colosseum!)
  .filter(Boolean);

/** Deterministic property building anchors across all 25 settlements (keeps Cache City free of SOLIDS). */
export const PROPERTY_SLOTS: PropertySlot[] = [
  // Cache City (4 hand-placed open lots verified clear of SOLIDS & STATIONS)
  { id: 'cache_alley_pad', settlementId: 'cache_city', kind: 'home', x: -29, z: 42, signX: -25.0, signZ: 42, colliderR: 2.8 },
  { id: 'cache_fountain_loft', settlementId: 'cache_city', kind: 'home', x: 29, z: 40, signX: 25.0, signZ: 40, colliderR: 2.9 },
  { id: 'cache_patch_stall', settlementId: 'cache_city', kind: 'shop', x: 30, z: 2, signX: 26.0, signZ: 2, colliderR: 2.9 },
  { id: 'cache_sky_penthouse', settlementId: 'cache_city', kind: 'estate', x: -28, z: -44, signX: -23.8, signZ: -44, colliderR: 3.1 },
  // 3 properties in each of the other 4 Capitals
  ...CAPITALS.filter((c) => c.id !== 'cache_city').flatMap((c) => [
    {
      id: `${c.id}_home`,
      settlementId: c.id,
      kind: 'home' as const,
      x: c.x - 26,
      z: c.z + 24,
      signX: c.x - 22.0,
      signZ: c.z + 24,
      colliderR: 2.9,
    },
    {
      id: `${c.id}_shop`,
      settlementId: c.id,
      kind: 'shop' as const,
      x: c.x + 26,
      z: c.z + 24,
      signX: c.x + 22.0,
      signZ: c.z + 24,
      colliderR: 3.0,
    },
    {
      id: `${c.id}_estate`,
      settlementId: c.id,
      kind: 'estate' as const,
      x: c.x + 28,
      z: c.z - 22,
      signX: c.x + 23.6,
      signZ: c.z - 22,
      colliderR: 3.3,
    },
  ]),
  // 1 flagship property per Satellite settlement (plus an extra tavern/villa on selected villages)
  ...SATELLITES.flatMap((s) => {
    const primary: PropertySlot = {
      id: `${s.id}_deed`,
      settlementId: s.id,
      kind: s.kind === 'tavern' ? 'tavern' : s.kind === 'outpost' || s.kind === 'ruin' ? 'estate' : 'home',
      x: s.x - 16,
      z: s.z - 8,
      signX: s.x - 12.0,
      signZ: s.z - 8,
      colliderR: 2.8,
    };
    if (s.kind === 'village') {
      const secondary: PropertySlot = {
        id: `${s.id}_shop`,
        settlementId: s.id,
        kind: 'shop',
        x: s.x + 16,
        z: s.z - 6,
        signX: s.x + 12.0,
        signZ: s.z - 6,
        colliderR: 2.8,
      };
      return [primary, secondary];
    }
    return [primary];
  }),
];

/** Service terminals replicated cleanly inside the 4 non-Cache Capitals so every Capital is playable as a hub. */
export function settlementTerminals(s: Settlement): ServiceTerminal[] {
  if (s.kind !== 'capital' || s.id === 'cache_city') return [];
  return [
    { settlementId: s.id, kind: 'bunk', label: 'SAFE SECTOR POD', verb: 'DEFRAG & NEXT CYCLE', x: s.x - 16, z: s.z + 18, color: '#a78bfa' },
    { settlementId: s.id, kind: 'smith', label: 'COMPILER FORGE', verb: 'HARD-LIGHT WEAPONS', x: s.x - 18, z: s.z - 10, color: '#ff8a3d' },
    { settlementId: s.id, kind: 'armorer', label: 'SHELL CLINIC', verb: 'LIGHT-ARMOR & CAPES', x: s.x + 18, z: s.z - 10, color: '#3ff0ff' },
    { settlementId: s.id, kind: 'apothecary', label: 'PATCH KIOSK', verb: 'RESTORES & STIMMS', x: s.x + 16, z: s.z + 18, color: '#4dffa0' },
  ];
}

function seeded(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10000;
  return x - Math.floor(x);
}

const buildingCache = new Map<string, BuildingSpec[]>();

/** Deterministic seeded low-poly PS1 architecture for non-Cache settlements, keeping plazas, spawns, gates, and deeds clear. */
export function settlementBuildings(s: Settlement): BuildingSpec[] {
  if (s.id === 'cache_city') return [];
  const cached = buildingCache.get(s.id);
  if (cached) return cached;

  const list: BuildingSpec[] = [];
  const count = s.kind === 'capital' ? 14 : 8;
  const minR = s.kind === 'capital' ? 32 : 20;
  const maxR = s.kind === 'capital' ? 66 : 42;
  const props = PROPERTY_SLOTS.filter((p) => p.settlementId === s.id);
  const terms = settlementTerminals(s);

  for (let i = 0; i < count * 2 && list.length < count; i++) {
    const a = (i / (count * 2)) * Math.PI * 2 + seeded(s.seed, i * 3) * 0.45;
    const dist = minR + seeded(s.seed, i * 3 + 1) * (maxR - minR);
    const x = Math.round(s.x + Math.cos(a) * dist);
    const z = Math.round(s.z + Math.sin(a) * dist);

    // Protect spawn, central plaza, colosseum gate, terminals, and property deeds
    if (Math.hypot(x - s.x, z - s.z) < 16) continue;
    if (Math.hypot(x - s.spawnX, z - s.spawnZ) < 11) continue;
    if (s.colosseum && Math.hypot(x - s.colosseum.x, z - s.colosseum.z) < 15) continue;
    if (terms.some((t) => Math.hypot(x - t.x, z - t.z) < 9)) continue;
    if (props.some((p) => Math.hypot(x - p.x, z - p.z) < 11 || Math.hypot(x - p.signX, z - p.signZ) < 8)) continue;
    if (list.some((b) => Math.hypot(x - b.x, z - b.z) < 13)) continue;

    const rSize = seeded(s.seed, i * 3 + 2);
    const w = s.kind === 'capital' ? 8 + Math.round(rSize * 6) : 5 + Math.round(rSize * 4);
    const d = s.kind === 'capital' ? 8 + Math.round(seeded(s.seed, i * 5) * 5) : 5 + Math.round(seeded(s.seed, i * 5) * 4);
    const h =
      s.biome === 'kernel' ? 18 + Math.round(rSize * 28)
      : s.biome === 'vault' ? 14 + Math.round(rSize * 22)
      : s.biome === 'bazaar' ? 8 + Math.round(rSize * 14)
      : s.biome === 'frontier' ? 9 + Math.round(rSize * 18)
      : 7 + Math.round(rSize * 12);

    const kind: BuildingSpec['kind'] =
      s.biome === 'bazaar' ? 'scaffold'
      : s.biome === 'vault' || s.biome === 'kernel' ? 'spire'
      : s.biome === 'frontier' || s.kind === 'ruin' ? 'ruin'
      : s.kind === 'capital' ? 'tower'
      : 'cottage';

    list.push({
      x,
      z,
      w,
      d,
      h,
      accent: i % 2 === 0 ? s.accent : s.secondary,
      kind,
      colliderR: Math.hypot(w / 2, d / 2) * 0.85,
    });
  }

  buildingCache.set(s.id, list);
  return list;
}

/** 8-way compass bearing (-Z = N, +X = E). */
export function compassBearing(dx: number, dz: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const angle = Math.atan2(dx, -dz); // 0 is North (-Z), +PI/2 is East (+X)
  const idx = Math.round((angle / (Math.PI * 2)) * 8 + 8) % 8;
  return dirs[idx];
}

export function nearestColosseum(x: number, z: number): { colosseum: ColosseumDef; dist: number; bearing: string } {
  let best = COLOSSEUMS[0];
  let bestD = Infinity;
  for (const c of COLOSSEUMS) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return {
    colosseum: best,
    dist: Math.round(bestD),
    bearing: compassBearing(best.x - x, best.z - z),
  };
}

export function nearestSettlement(x: number, z: number): { settlement: Settlement; dist: number } {
  let best = SETTLEMENTS[0];
  let bestD = Infinity;
  for (const s of SETTLEMENTS) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { settlement: best, dist: bestD };
}

export function isSanctuaryPosition(x: number, z: number): boolean {
  for (const s of SETTLEMENTS) {
    if (s.safety === 'sanctuary' && Math.hypot(x - s.x, z - s.z) <= s.radius) return true;
  }
  return false;
}

export function biomeAt(x: number, z: number): BiomeId {
  const { settlement, dist } = nearestSettlement(x, z);
  if (dist <= settlement.radius * 1.8) return settlement.biome;
  let bestCap = CAPITALS[0];
  let bestD = Infinity;
  for (const c of CAPITALS) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      bestD = d;
      bestCap = c;
    }
  }
  return bestCap.biome;
}

export function regionDisplayName(x: number, z: number): string {
  const { settlement, dist } = nearestSettlement(x, z);
  if (dist <= settlement.radius + 14) return `${settlement.name} (${settlement.code})`;
  const b = biomeAt(x, z);
  if (b === 'bazaar') return 'THE AMBER BADLANDS';
  if (b === 'vault') return 'THE FROST ARCHIVE';
  if (b === 'frontier') return 'THE RUST BADLANDS';
  if (b === 'kernel') return 'THE KERNEL HIGHLANDS';
  return 'THE NEON EXPANSE';
}

export function nearestWorldColosseumGate(x: number, z: number, range = 5.2): ColosseumDef | null {
  for (const c of COLOSSEUMS) {
    if (Math.hypot(c.x - x, c.z - z) < range) return c;
  }
  return null;
}

export function nearestSettlementTerminal(x: number, z: number, range = 4.8): ServiceTerminal | null {
  for (const c of CAPITALS) {
    if (c.id === 'cache_city') continue;
    if (Math.hypot(c.x - x, c.z - z) > 120) continue;
    for (const t of settlementTerminals(c)) {
      if (Math.hypot(t.x - x, t.z - z) < range) return t;
    }
  }
  return null;
}

export interface HighwaySegment {
  id: string;
  fromId: string;
  toId: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  secondary: string;
  length: number;
  ux: number;
  uz: number;
}

const HIGHWAY_LINKS: readonly [string, string][] = [
  ['cache_city', 'drift_bazaars'],
  ['cache_city', 'cold_vaults'],
  ['cache_city', 'rust_citadel'],
  ['cache_city', 'kernel_spire'],
  ['cache_city', 'oak_cache'],
  ['cache_city', 'pine_bak'],
  ['cache_city', 'memory_mill'],
  ['cache_city', 'conduit_crossing'],
  ['drift_bazaars', 'scrapford'],
  ['drift_bazaars', 'lantern_rest'],
  ['drift_bazaars', 'copper_ridge'],
  ['drift_bazaars', 'rim_tavern'],
  ['drift_bazaars', 'south_terminus'],
  ['cold_vaults', 'glass_hollow'],
  ['cold_vaults', 'old_save_abbey'],
  ['cold_vaults', 'echo_mill'],
  ['cold_vaults', 'white_sector'],
  ['rust_citadel', 'iron_heap'],
  ['rust_citadel', 'rustwatch_keep'],
  ['rust_citadel', 'wreck_v01'],
  ['rust_citadel', 'ash_gate'],
  ['rust_citadel', 'dead_sector_9'],
  ['kernel_spire', 'halo_terrace'],
  ['kernel_spire', 'checksum_shrine'],
  ['oak_cache', 'scrapford'],
  ['pine_bak', 'glass_hollow'],
  ['conduit_crossing', 'iron_heap'],
  ['echo_mill', 'halo_terrace'],
  ['ash_gate', 'checksum_shrine'],
];

const SETTLEMENT_LOOKUP = new Map(SETTLEMENTS.map((s) => [s.id, s]));

export const HIGHWAY_SEGMENTS: HighwaySegment[] = HIGHWAY_LINKS.flatMap(([fromId, toId]) => {
  const a = SETTLEMENT_LOOKUP.get(fromId);
  const b = SETTLEMENT_LOOKUP.get(toId);
  if (!a || !b) return [];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const fullLen = Math.hypot(dx, dz) || 1;
  const ux = dx / fullLen;
  const uz = dz / fullLen;
  const trimA = a.id === 'cache_city' ? 56 : a.radius * 0.52;
  const trimB = b.id === 'cache_city' ? 56 : b.radius * 0.52;
  const x1 = a.x + ux * trimA;
  const z1 = a.z + uz * trimA;
  const x2 = b.x - ux * trimB;
  const z2 = b.z - uz * trimB;
  const length = Math.max(10, Math.hypot(x2 - x1, z2 - z1));
  return [{
    id: `${fromId}__${toId}`,
    fromId,
    toId,
    x1,
    z1,
    x2,
    z2,
    color: a.accent,
    secondary: b.accent,
    length,
    ux,
    uz,
  }];
});

export function nearestHighwayPoint(x: number, z: number): { seg: HighwaySegment; x: number; z: number; dist: number } {
  let best = HIGHWAY_SEGMENTS[0];
  let bestX = best.x1;
  let bestZ = best.z1;
  let bestD = Infinity;
  for (const seg of HIGHWAY_SEGMENTS) {
    const t = Math.max(0, Math.min(seg.length, (x - seg.x1) * seg.ux + (z - seg.z1) * seg.uz));
    const px = seg.x1 + seg.ux * t;
    const pz = seg.z1 + seg.uz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) {
      bestD = d;
      best = seg;
      bestX = px;
      bestZ = pz;
    }
  }
  return { seg: best, x: bestX, z: bestZ, dist: bestD };
}

const GHOST_VILLAGE_IDS = new Set<string>(['wreck_v01', 'ash_gate', 'dead_sector_9', 'iron_heap']);
export const isGhostVillage = (settlementId: string): boolean => GHOST_VILLAGE_IDS.has(settlementId);

/** Combines Cache City SOLIDS (near origin), local settlement buildings, Colosseum gate pillars, service terminals, and walk-inside property alcoves. */
export function collidersNear(x: number, z: number): Circle[] {
  const out: Circle[] = [];
  if (Math.hypot(x, z) < 170) out.push(...SOLIDS);

  for (const s of SETTLEMENTS) {
    if (Math.hypot(x - s.x, z - s.z) > 180) continue;
    if (s.id !== 'cache_city') {
      for (const b of settlementBuildings(s)) out.push({ x: b.x, z: b.z, r: b.colliderR });
      if (s.colosseum) {
        out.push({ x: s.colosseum.x - 2.6, z: s.colosseum.z, r: 0.85 });
        out.push({ x: s.colosseum.x + 2.6, z: s.colosseum.z, r: 0.85 });
      }
      for (const t of settlementTerminals(s)) {
        out.push({ x: t.x, z: t.z, r: 1.6 });
      }
    }
  }

  for (const p of PROPERTY_SLOTS) {
    if (Math.hypot(x - p.x, z - p.z) < 140) {
      // Open-front walk-inside sanctuary alcove walls (south doorway stays open!)
      out.push({ x: p.x - 2.1, z: p.z - 0.3, r: 0.95 });
      out.push({ x: p.x + 2.1, z: p.z - 0.3, r: 0.95 });
      out.push({ x: p.x, z: p.z - 1.9, r: 1.05 });
      out.push({ x: p.signX, z: p.signZ, r: 0.45 });
    }
  }
  out.push(...memoryTreeCollidersNear(x, z));
  return out;
}
