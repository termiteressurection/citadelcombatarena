import * as THREE from 'three';

export interface VillageCollider {
  id: string;
  name: string;
  kind: 'cottage' | 'column' | 'torii_post' | 'lamp' | 'tree_altar' | 'pyramid' | 'hedge';
  pos: [number, number, number];
  scale: [number, number, number];
  sourceFile: string;
}

export interface KeepClearZone {
  id: string;
  name: string;
  center: [number, number]; // [x, z]
  radius: number;
}

export const KEEP_CLEAR_ZONES: KeepClearZone[] = [
  { id: 'spawn-plaza', name: 'Spawn Plaza', center: [0, 12], radius: 4.5 },
  { id: 'altar-tree', name: 'Central Altar & Month Tree', center: [0, 0], radius: 5.5 },
  { id: 'today-portal', name: 'Today Portal', center: [-14, -10], radius: 3.5 },
  { id: 'eye-gate', name: 'Mind Map Eye Gate', center: [0, -32], radius: 4.0 },
  { id: 'sigma-dais', name: 'Sigma Worshipful Master Dais', center: [0, -80], radius: 7.5 },
  { id: 'year-pyramid', name: 'Open Year Glass Pyramid', center: [28, 0], radius: 5.5 },
  { id: 'north-torii-gate', name: 'North Torii Threshold', center: [0, -38], radius: 3.0 },
  { id: 'south-torii-gate', name: 'South Torii Threshold', center: [0, 38], radius: 3.0 },
  { id: 'west-torii-gate', name: 'West Torii Threshold', center: [-38, 0], radius: 3.0 },
  { id: 'east-torii-gate', name: 'East Torii Threshold', center: [38, 0], radius: 3.0 },
];

export function isInKeepClearZone(x: number, z: number, padding = 0): boolean {
  for (const zone of KEEP_CLEAR_ZONES) {
    const dx = x - zone.center[0];
    const dz = z - zone.center[1];
    if (dx * dx + dz * dz < (zone.radius + padding) * (zone.radius + padding)) {
      return true;
    }
  }
  // Also preserve cardinal road centerlines (width 4.0: [-2, 2])
  if (Math.abs(x) < 2.2 && Math.abs(z) <= 85) return true;
  if (Math.abs(z) < 2.2 && Math.abs(x) <= 85) return true;
  return false;
}

export function computeVillageColliders(): VillageCollider[] {
  const colliders: VillageCollider[] = [];

  // 1. The 4 Functional Service Cottages
  colliders.push({
    id: 'cottage-terminal',
    name: 'Terminal Library Cottage',
    kind: 'cottage',
    pos: [-52, 0, -38],
    scale: [4.2, 14, 4.2],
    sourceFile: 'EasternVillageArchitecture.tsx',
  });
  colliders.push({
    id: 'cottage-post',
    name: 'Courier Post Office Cottage',
    kind: 'cottage',
    pos: [52, 0, 38],
    scale: [3.8, 9, 3.8],
    sourceFile: 'EasternVillageArchitecture.tsx',
  });
  colliders.push({
    id: 'cottage-mindmap',
    name: 'Mind Map Pagoda Pavilion',
    kind: 'cottage',
    pos: [0, 0, -32],
    scale: [4.2, 18, 4.2],
    sourceFile: 'EasternVillageArchitecture.tsx',
  });
  colliders.push({
    id: 'cottage-synaptic',
    name: 'Synaptic Vault Tea House',
    kind: 'cottage',
    pos: [-52, 0, 38],
    scale: [4.2, 11, 4.2],
    sourceFile: 'EasternVillageArchitecture.tsx',
  });

  // Additional varied village cottages / shopfronts around the plaza quadrants
  const additionalCottages: Array<{ id: string; name: string; pos: [number, number, number]; r: number; h: number }> = [
    { id: 'cottage-nw-1', name: 'Northwest Scribe Cottage', pos: [-36, 0, -26], r: 3.2, h: 8 },
    { id: 'cottage-ne-1', name: 'Northeast Astrolabe Workshop', pos: [36, 0, -26], r: 3.2, h: 8 },
    { id: 'cottage-sw-1', name: 'Southwest Artisan Dwelling', pos: [-36, 0, 26], r: 3.2, h: 8 },
    { id: 'cottage-se-1', name: 'Southeast Botanist Tea Shop', pos: [36, 0, 26], r: 3.2, h: 8 },
  ];
  for (const c of additionalCottages) {
    colliders.push({
      id: c.id,
      name: c.name,
      kind: 'cottage',
      pos: c.pos,
      scale: [c.r, c.h, c.r],
      sourceFile: 'EasternVillageArchitecture.tsx',
    });
  }

  // 4. The Three Classical Orders Colonnade Trio: Doric, Ionic, Corinthian at X = -18
  colliders.push({
    id: 'column-order-doric',
    name: 'Doric Classical Order Column',
    kind: 'column',
    pos: [-18, 0, -6],
    scale: [0.8, 10, 0.8],
    sourceFile: 'ClassicalColumns.tsx',
  });
  colliders.push({
    id: 'column-order-ionic',
    name: 'Ionic Classical Order Column',
    kind: 'column',
    pos: [-18, 0, 0],
    scale: [0.75, 10, 0.75],
    sourceFile: 'ClassicalColumns.tsx',
  });
  colliders.push({
    id: 'column-order-corinthian',
    name: 'Corinthian Classical Order Column',
    kind: 'column',
    pos: [-18, 0, 6],
    scale: [0.75, 10, 0.75],
    sourceFile: 'ClassicalColumns.tsx',
  });

  // 5. Torii Gates — Each Torii has TWO vertical posts (left post and right post)!
  // The center gateway is OPEN so the player walks straight through!
  const toriiDefs: Array<{ id: string; name: string; center: [number, number, number]; axis: 'X' | 'Z'; span: number }> = [
    { id: 'torii-north', name: 'North Cardinal Torii Gate', center: [0, 0, -38], axis: 'X', span: 7.0 },
    { id: 'torii-south', name: 'South Cardinal Torii Gate', center: [0, 0, 38], axis: 'X', span: 7.0 },
    { id: 'torii-west', name: 'West Cardinal Torii Gate', center: [-38, 0, 0], axis: 'Z', span: 7.0 },
    { id: 'torii-east', name: 'East Cardinal Torii Gate', center: [38, 0, 0], axis: 'Z', span: 7.0 },
    { id: 'torii-inner-north', name: 'Inner North Wireframe Torii', center: [0, 0, -24], axis: 'X', span: 3.1 },
    { id: 'torii-inner-south', name: 'Inner South Wireframe Torii', center: [0, 0, 24], axis: 'X', span: 3.1 },
  ];

  for (const t of toriiDefs) {
    const half = t.span / 2;
    if (t.axis === 'X') {
      colliders.push({
        id: `${t.id}-post-left`,
        name: `${t.name} (West Post)`,
        kind: 'torii_post',
        pos: [t.center[0] - half, 0, t.center[2]],
        scale: [0.35, 11, 0.35],
        sourceFile: 'HubObjects.tsx',
      });
      colliders.push({
        id: `${t.id}-post-right`,
        name: `${t.name} (East Post)`,
        kind: 'torii_post',
        pos: [t.center[0] + half, 0, t.center[2]],
        scale: [0.35, 11, 0.35],
        sourceFile: 'HubObjects.tsx',
      });
    } else {
      colliders.push({
        id: `${t.id}-post-left`,
        name: `${t.name} (North Post)`,
        kind: 'torii_post',
        pos: [t.center[0], 0, t.center[2] - half],
        scale: [0.35, 11, 0.35],
        sourceFile: 'HubObjects.tsx',
      });
      colliders.push({
        id: `${t.id}-post-right`,
        name: `${t.name} (South Post)`,
        kind: 'torii_post',
        pos: [t.center[0], 0, t.center[2] + half],
        scale: [0.35, 11, 0.35],
        sourceFile: 'HubObjects.tsx',
      });
    }
  }

  // 6. Street Lamps along the 4 Cardinal Roads (16 lamps total)
  const lampPositions: [number, number, number][] = [
    // North road
    [-5, 0, -28], [5, 0, -28], [-5, 0, -48], [5, 0, -48],
    // South road
    [-5, 0, 28], [5, 0, 28], [-5, 0, 48], [5, 0, 48],
    // West road
    [-28, 0, -5], [-28, 0, 5], [-48, 0, -5], [-48, 0, 5],
    // East road
    [28, 0, -5], [28, 0, 5], [48, 0, -5], [48, 0, 5],
  ];
  lampPositions.forEach((pos, idx) => {
    colliders.push({
      id: `street-lamp-${idx}`,
      name: `Street Lamp ${idx + 1}`,
      kind: 'lamp',
      pos,
      scale: [0.28, 6.2, 0.28],
      sourceFile: 'HubObjects.tsx',
    });
  });

  // 7. Central Inscription Tree & Altar base at [0, 0, 0]
  colliders.push({
    id: 'altar-tree-core',
    name: 'Central Inscription Tree & Altar Stone Base',
    kind: 'tree_altar',
    pos: [0, 0, 0],
    scale: [1.4, 25, 1.4],
    sourceFile: 'InscriptionTree.tsx',
  });

  // 8. Open Year Glass Pyramid at [28, 0, 0]
  colliders.push({
    id: 'pyramid-open-year',
    name: 'Open Year Glass Pyramid Base',
    kind: 'pyramid',
    pos: [28, 0, 0],
    scale: [2.6, 12, 2.6],
    sourceFile: 'GlassPyramid.tsx',
  });

  return colliders;
}

export interface TeleportTarget {
  id: string;
  name: string;
  pos: [number, number, number];
  yaw: number;
}

export const VILLAGE_TELEPORT_TARGETS: TeleportTarget[] = [
  {
    id: 'spawn-plaza',
    name: 'Spawn Plaza',
    pos: [0, 1.6, 12],
    yaw: 0, // facing North toward Altar & Tree
  },
  {
    id: 'column-trio',
    name: 'Column Trio (Classical Colonnade)',
    pos: [-12, 1.6, 0],
    yaw: Math.PI / 2, // facing West toward Doric, Ionic, Corinthian
  },
  {
    id: 'torii-gate',
    name: 'Cardinal Torii Gate',
    pos: [0, 1.6, -26],
    yaw: 0, // facing North toward threshold
  },
  {
    id: 'bamboo-grove',
    name: 'Bamboo Grove',
    pos: [-26, 1.6, 26],
    yaw: -Math.PI * 0.75, // facing Southwest into the grove
  },
  {
    id: 'month-tree',
    name: 'Month Inscription Tree & Altar',
    pos: [0, 1.6, 6],
    yaw: 0, // facing North up at the Tree
  },
  {
    id: 'glass-pyramid',
    name: 'Open Year Glass Pyramid',
    pos: [18, 1.6, 0],
    yaw: -Math.PI / 2, // facing East toward Pyramid
  },
];
