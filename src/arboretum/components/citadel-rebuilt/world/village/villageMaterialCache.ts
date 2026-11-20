import * as THREE from 'three';
import type { SeasonVariant } from '@/core/state/villageTunerStore';

// ─── YEAR MATERIALS ──────────────────────────────────────────────────────────
export const YEAR_BASE_MAT = new THREE.MeshStandardMaterial({
  color: 0xd97706,
  metalness: 0.88,
  roughness: 0.22,
  emissive: 0x78350f,
  emissiveIntensity: 0.25,
});

export const YEAR_FACET_MAT = new THREE.MeshStandardMaterial({
  color: 0xfbbf24,
  metalness: 0.92,
  roughness: 0.15,
  emissive: 0xb45309,
  emissiveIntensity: 0.3,
});

export const YEAR_WIREFRAME_MAT = new THREE.MeshBasicMaterial({
  color: 0xfef08a,
  wireframe: true,
  transparent: true,
  opacity: 0.65,
});

export const YEAR_RIVET_MAT = new THREE.MeshBasicMaterial({
  color: 0xfffbeb,
});

// ─── SEASON MATERIALS (4 VARIANTS) ───────────────────────────────────────────
export interface SeasonMaterialSet {
  base: THREE.MeshStandardMaterial;
  spike: THREE.MeshStandardMaterial;
  trim: THREE.Material;
}

export const SEASON_MATERIALS: Record<SeasonVariant, SeasonMaterialSet> = {
  spring: {
    base: new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      roughness: 0.28,
      metalness: 0.35,
      emissive: 0x042f2e,
      emissiveIntensity: 0.3,
    }),
    spike: new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      metalness: 0.5,
      roughness: 0.2,
      emissive: 0x0f766e,
      emissiveIntensity: 0.35,
    }),
    trim: new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      side: THREE.DoubleSide,
    }),
  },
  summer: {
    base: new THREE.MeshStandardMaterial({
      color: 0x047857,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x064e3b,
      emissiveIntensity: 0.35,
    }),
    spike: new THREE.MeshStandardMaterial({
      color: 0x34d399,
      metalness: 0.55,
      roughness: 0.18,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    }),
  },
  autumn: {
    base: new THREE.MeshStandardMaterial({
      color: 0x115e59,
      roughness: 0.35,
      metalness: 0.3,
      emissive: 0x134e4a,
      emissiveIntensity: 0.3,
    }),
    spike: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0x9a3412,
      emissiveIntensity: 0.3,
    }),
  },
  winter: {
    base: new THREE.MeshStandardMaterial({
      color: 0x134e4a,
      roughness: 0.4,
      metalness: 0.25,
      emissive: 0x042f2e,
      emissiveIntensity: 0.2,
    }),
    spike: new THREE.MeshStandardMaterial({
      color: 0x99f6e4,
      metalness: 0.2,
      roughness: 0.4,
      emissive: 0x115e59,
      emissiveIntensity: 0.15,
    }),
    trim: new THREE.MeshBasicMaterial({
      color: 0xcffafe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  },
};

// ─── MONTH MATERIALS (12 CALENDAR VARIANTS) ───────────────────────────────────
export const MONTH_BASE_MAT = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  metalness: 0.88,
  roughness: 0.22,
  emissive: 0x78350f,
  emissiveIntensity: 0.25,
});

export const MONTH_SEAMS_BRACKETS_MAT = new THREE.MeshStandardMaterial({
  color: 0xb45309,
  metalness: 0.9,
  roughness: 0.3,
  emissive: 0x451a03,
  emissiveIntensity: 0.3,
});

export const MONTH_ACCENT_MATERIALS: Record<number, THREE.Material> = {
  1: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 }), // Jan: Ice Silver
  2: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.5, roughness: 0.3 }), // Feb: Violet Slate
  3: new THREE.MeshStandardMaterial({ color: 0x86efac, metalness: 0.4, roughness: 0.3 }), // Mar: Celadon Green
  4: new THREE.MeshStandardMaterial({ color: 0xf472b6, metalness: 0.3, roughness: 0.3 }), // Apr: Blossom Pink
  5: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.6, roughness: 0.2 }), // May: Radiant Emerald
  6: new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.7, roughness: 0.2 }), // Jun: High-Noon Cyan
  7: new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.15 }), // Jul: Amber Gold
  8: new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.7, roughness: 0.25 }), // Aug: Wheat Gold
  9: new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.3 }), // Sep: Harvest Ochre
  10: new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.5, roughness: 0.3 }), // Oct: Russet Terracotta
  11: new THREE.MeshStandardMaterial({ color: 0x7c2d12, metalness: 0.7, roughness: 0.4 }), // Nov: Smoldering Charcoal
  12: new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.6, roughness: 0.2 }), // Dec: Sapphire Indigo
};

// ─── DAY MATERIALS (WITH VISIBLE EMBER CORE & 6 SEEDED VARIANTS) ─────────────
export interface DayVariantMaterials {
  rock: THREE.MeshStandardMaterial;
  crevice: THREE.MeshBasicMaterial;
  emberCore: THREE.MeshBasicMaterial;
}

export const DAY_ROCK_MAT = new THREE.MeshStandardMaterial({
  color: 0x4b5563,
  roughness: 0.95,
  metalness: 0.08,
  flatShading: true,
});

export const DAY_CREVICE_MAT = new THREE.MeshBasicMaterial({
  color: 0x1f2937,
  wireframe: true,
  transparent: true,
  opacity: 0.65,
});

export const DAY_EMBER_CORE_MAT = new THREE.MeshBasicMaterial({
  color: 0xb45309,
  transparent: true,
  opacity: 0.78,
});

export const DAY_FISSURE_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x92400e,
});

/** 6 Shared Static Day Variants — Low-caste, dull, weathered, distinct */
export const DAY_VARIANT_MATS: DayVariantMaterials[] = [
  // 1. Slate Charcoal (default)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.95, metalness: 0.08, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x1f2937, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0xb45309, transparent: true, opacity: 0.78 }),
  },
  // 2. Ash Grey (cool chalky rock, dull red-amber core)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.92, metalness: 0.05, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x111827, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0x9a3412, transparent: true, opacity: 0.76 }),
  },
  // 3. Dark Peat Brown (earthy weathered stone, smoldering russet ember)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x3f3935, roughness: 0.96, metalness: 0.04, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x292524, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0xc2410c, transparent: true, opacity: 0.8 }),
  },
  // 4. Slag Purple-Grey (industrial slag stone, deep ochre core)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x3b3845, roughness: 0.94, metalness: 0.09, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x1e1b2e, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0x92400e, transparent: true, opacity: 0.75 }),
  },
  // 5. Cold Slate Blue-Grey (mineral seam, teal-grey dying ember)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95, metalness: 0.1, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x0f172a, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.76 }),
  },
  // 6. Matte Basalt Black (volcanic stone, pale sulfur-amber core)
  {
    rock: new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.98, metalness: 0.04, flatShading: true }),
    crevice: new THREE.MeshBasicMaterial({ color: 0x171717, wireframe: true, transparent: true, opacity: 0.65 }),
    emberCore: new THREE.MeshBasicMaterial({ color: 0xa16207, transparent: true, opacity: 0.78 }),
  },
];

// ─── MINDMAP MATERIALS (4 SEEDED PALE TINT VARIANTS) ────────────────────────
export interface MindmapVariantMaterials {
  base: THREE.MeshStandardMaterial;
  edge: THREE.MeshBasicMaterial;
  glint: THREE.MeshBasicMaterial;
}

export const MINDMAP_BASE_MAT = new THREE.MeshStandardMaterial({
  color: 0xcffafe,
  roughness: 0.08,
  metalness: 0.15,
  transparent: true,
  opacity: 0.84,
  emissive: 0x0891b2,
  emissiveIntensity: 0.25,
});

export const MINDMAP_EDGE_MAT = new THREE.MeshBasicMaterial({
  color: 0xe0f2fe,
  wireframe: true,
  transparent: true,
  opacity: 0.95,
});

export const MINDMAP_GLINT_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
});

/** 4 Shared Static Mindmap Variants — Serene, unhurried, pale tints */
export const MINDMAP_VARIANT_MATS: MindmapVariantMaterials[] = [
  // 1. Pale Cyan (Original)
  {
    base: new THREE.MeshStandardMaterial({ color: 0xcffafe, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.84, emissive: 0x0891b2, emissiveIntensity: 0.25 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xe0f2fe, wireframe: true, transparent: true, opacity: 0.95 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  },
  // 2. Lavender Mist
  {
    base: new THREE.MeshStandardMaterial({ color: 0xede9fe, roughness: 0.1, metalness: 0.12, transparent: true, opacity: 0.82, emissive: 0x7c3aed, emissiveIntensity: 0.22 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xf5f3ff, wireframe: true, transparent: true, opacity: 0.92 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  },
  // 3. Pale Mint / Celadon
  {
    base: new THREE.MeshStandardMaterial({ color: 0xccfbf1, roughness: 0.08, metalness: 0.14, transparent: true, opacity: 0.85, emissive: 0x0d9488, emissiveIntensity: 0.23 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xf0fdfa, wireframe: true, transparent: true, opacity: 0.94 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  },
  // 4. Soft Alabaster White
  {
    base: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.06, metalness: 0.18, transparent: true, opacity: 0.88, emissive: 0x64748b, emissiveIntensity: 0.2 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.98 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  },
];
