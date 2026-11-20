/**
 * ═══════════════════════════════════════════════════════════════════════════
 * URBAN-NATURE MELTING POT SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Nature and city coexist at ALL depths in varying ratios. This is not a
 * succession model where one replaces the other — it's a gradient where both
 * worlds blend together, creating a "melting pot" aesthetic.
 * 
 * DEPTH GRADIENT (0-5+):
 * Depth 0-1: 90% City / 10% Nature — controlled garden in digital plaza
 * Depth 2-3: 60% City / 40% Nature — nature negotiating with architecture
 * Depth 4:   40% City / 60% Nature — ruins in a garden
 * Depth 5+:  20% City / 80% Nature — ancient temple overgrown but not forgotten
 * 
 * AESTHETIC PILLARS (Termite Doctrine compliance):
 * 1. Ritual Over Utility: Depth choice is meaningful, slow-burn growth
 * 2. Aesthetic Consequence: World reacts to inner state (depth + thoughts)
 * 3. Premium Craft: All assets polished, ≤22 polys, optimistic synthwave palette
 * 4. Performance: Instanced rendering, 150 flora cap, minimal allocations
 */

import type { Chamber } from '../types';
import { isCitadelMicro } from '../citadelBuildMode';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum flora elements per chamber (calendar-chamber sized cap) */
const MAX_FLORA = 150;

/** Milestones that trigger visual celebration effects */
export const OVERGROWTH_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

// ═══════════════════════════════════════════════════════════════════════════
// FERTILITY FORMULA (Depth 0-5+)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate spawn threshold based on chamber depth.
 * Lower threshold = more fertile (easier to spawn growth).
 * 
 * Formula: max(1, 100 - (depth * 20))
 * 
 * Depth 0: 100 thoughts per growth unit
 * Depth 1: 80 thoughts per growth unit
 * Depth 2: 60 thoughts per growth unit
 * Depth 3: 40 thoughts per growth unit
 * Depth 4: 20 thoughts per growth unit
 * Depth 5+: 1 thought per growth unit (instant bloom)
 */
export function getFertilityThreshold(depth: number): number {
  return Math.max(1, 100 - depth * 20);
}

/**
 * Calculate how many growth units should exist given thought count and depth.
 * This drives the total flora budget allocation.
 */
export function calculateGrowthUnits(thoughtCount: number, depth: number): number {
  const threshold = getFertilityThreshold(depth);
  return Math.floor(thoughtCount / threshold);
}

// ═══════════════════════════════════════════════════════════════════════════
// URBAN-NATURE RATIO
// ═══════════════════════════════════════════════════════════════════════════

export interface UrbanNatureRatio {
  city: number;    // 0-1 (1 = 100% city)
  nature: number;  // 0-1 (1 = 100% nature)
}

/**
 * Get the city/nature blend ratio for a given depth.
 * Both values always present — this is a melting pot, not replacement.
 */
export function getUrbanNatureRatio(depth: number): UrbanNatureRatio {
  if (depth <= 1) return { city: 0.9, nature: 0.1 };
  if (depth <= 3) return { city: 0.6, nature: 0.4 };
  if (depth === 4) return { city: 0.4, nature: 0.6 };
  return { city: 0.2, nature: 0.8 }; // Depth 5+
}

/**
 * Get pillar opacity based on depth (pillars never disappear, just fade).
 * Depth 0-1: 100% (solid)
 * Depth 2-3: 85-70% (cracking)
 * Depth 4: 50% (overgrown)
 * Depth 5+: 30% (ghost wireframe)
 */
export function getPillarOpacity(depth: number): number {
  if (depth <= 1) return 1.0;
  if (depth === 2) return 0.85;
  if (depth === 3) return 0.70;
  if (depth === 4) return 0.50;
  return 0.30; // Depth 5+ (ghost)
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE BLENDING
// ═══════════════════════════════════════════════════════════════════════════

export interface BlendedPalette {
  cityPrimary: number;     // Pillar/structure color
  cityAccent: number;      // Crack/detail color
  naturePrimary: number;   // Bamboo/foliage color
  natureAccent: number;    // Bloom/highlight color
  ambientGlow: number;     // Atmospheric light color
}

/**
 * Get color palette that blends city and nature based on depth.
 * Optimistic synthwave palette (no grit, no dark cyberpunk).
 */
export function getBlendedPalette(depth: number): BlendedPalette {
  if (depth <= 1) {
    // Pristine City: Cold geometric + rare organic
    return {
      cityPrimary: 0x6366f1,    // Indigo pillars
      cityAccent: 0xa855f7,     // Purple accents
      naturePrimary: 0x34d399,  // Emerald bamboo (rare)
      natureAccent: 0x22c55e,   // Green highlights
      ambientGlow: 0xc084fc,    // Lavender atmosphere
    };
  }
  
  if (depth <= 3) {
    // Encroachment: Violet cracks + growing green
    return {
      cityPrimary: 0x8b5cf6,    // Violet pillars
      cityAccent: 0xec4899,     // Pink cracks
      naturePrimary: 0x22c55e,  // Green bamboo
      natureAccent: 0x10b981,   // Emerald accents
      ambientGlow: 0xfbbf24,    // Amber glow
    };
  }
  
  if (depth === 4) {
    // Overgrowth: Purple ruins + dominant flora
    return {
      cityPrimary: 0xa855f7,    // Purple overgrown pillars
      cityAccent: 0xec4899,     // Pink moss
      naturePrimary: 0x10b981,  // Emerald dominant
      natureAccent: 0xfde047,   // Yellow blooms
      ambientGlow: 0x34d399,    // Green-teal atmosphere
    };
  }
  
  // Deep Wilds: Cyan ghosts + forest green
  return {
    cityPrimary: 0x22d3ee,    // Cyan ghost pillars
    cityAccent: 0x06b6d4,     // Teal wireframe
    naturePrimary: 0x059669,  // Deep green forest
    natureAccent: 0xfbbf24,   // Gold natural light
    ambientGlow: 0x10b981,    // Emerald atmosphere
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLORA DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════

export interface FloraDistribution {
  bamboo: number;   // Stalk count
  ferns: number;    // Ground cover count
  reeds: number;    // Accent count
  blooms: number;   // Rare highlight count
  palms: number;    // 0 or 6 (only at Depth 5+)
}

/**
 * Calculate how many of each flora type should spawn based on depth and growth units.
 * 
 * LESS IS MORE DOCTRINE:
 * - Depth 0: Only bamboo, max 3 stalks, widely spaced. Nothing else.
 * - Depth 1: Bamboo only, max 6 stalks. Still clean.
 * - Depth 2: Bamboo + first cracks. Ferns unlock but sparse.
 * - Depth 3: Bamboo clusters, ferns, first reeds.
 * - Depth 4: Full flora set, dense.
 * - Depth 5+: Maximum density, blooms, palms.
 * 
 * Each asset type must be unmistakably readable at the depth it appears.
 * Total capped at MAX_FLORA (150).
 */
export function getFloraDistribution(depth: number, growthUnits: number): FloraDistribution {
  // Depth 0: 3 bamboo max, nothing else. Clean plaza.
  if (depth === 0) {
    return {
      bamboo: Math.min(3, growthUnits),
      ferns: 0,
      reeds: 0,
      blooms: 0,
      palms: 0,
    };
  }

  // Depth 1: bamboo only, max 6, widely spaced.
  if (depth === 1) {
    return {
      bamboo: Math.min(6, 2 + growthUnits),
      ferns: 0,
      reeds: 0,
      blooms: 0,
      palms: 0,
    };
  }

  // Depth 2: bamboo + sparse ferns. Cracks appear on pillars.
  if (depth === 2) {
    return {
      bamboo: Math.min(12, 4 + growthUnits),
      ferns: Math.min(4, Math.floor(growthUnits * 0.3)),
      reeds: 0,
      blooms: 0,
      palms: 0,
    };
  }

  // Depth 3: bamboo clusters, ferns, first reeds.
  if (depth === 3) {
    const bamboo = Math.min(25, 8 + growthUnits);
    const ferns = Math.min(10, 3 + Math.floor(growthUnits * 0.4));
    const reeds = Math.min(6, Math.floor(growthUnits * 0.2));
    return { bamboo, ferns, reeds, blooms: 0, palms: 0 };
  }

  // Depth 4: full flora, dense. Blooms unlock.
  if (depth === 4) {
    const bamboo = Math.min(50, 15 + growthUnits);
    const ferns = Math.min(20, 8 + Math.floor(growthUnits * 0.4));
    const reeds = Math.min(15, 5 + Math.floor(growthUnits * 0.3));
    const blooms = Math.min(8, Math.floor(growthUnits * 0.15));
    const total = bamboo + ferns + reeds + blooms;
    if (total > MAX_FLORA) {
      const s = MAX_FLORA / total;
      return { bamboo: Math.floor(bamboo * s), ferns: Math.floor(ferns * s), reeds: Math.floor(reeds * s), blooms: Math.floor(blooms * s), palms: 0 };
    }
    return { bamboo, ferns, reeds, blooms, palms: 0 };
  }

  // Depth 5+: maximum density, palms at pillar positions.
  const bamboo = Math.min(80, 25 + growthUnits);
  const ferns = Math.min(30, 12 + Math.floor(growthUnits * 0.4));
  const reeds = Math.min(20, 8 + Math.floor(growthUnits * 0.3));
  const blooms = Math.min(15, 4 + Math.floor(growthUnits * 0.2));
  const palms = 6;
  const total = bamboo + ferns + reeds + blooms;
  if (total > MAX_FLORA - palms) {
    const s = (MAX_FLORA - palms) / total;
    return { bamboo: Math.floor(bamboo * s), ferns: Math.floor(ferns * s), reeds: Math.floor(reeds * s), blooms: Math.floor(blooms * s), palms };
  }
  return { bamboo, ferns, reeds, blooms, palms };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCEDURAL PLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

export interface FloraElement {
  type: 'bamboo' | 'fern' | 'reed' | 'bloom' | 'palm';
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  seed: number;
}

/**
 * Generate deterministic flora placement based on chamber ID.
 * Same chamber always produces same layout (no randomness per frame).
 */
export function generateFloraElements(chamber: Chamber): FloraElement[] {
  // Skip in micro build
  if (isCitadelMicro()) return [];
  
  const growthUnits = calculateGrowthUnits(chamber.thoughts.length, chamber.depth);
  const distribution = getFloraDistribution(chamber.depth, growthUnits);
  
  const elements: FloraElement[] = [];
  
  // Deterministic RNG seeded by chamber ID
  const rng = (seed: number) => {
    let s = (chamber.id * 2654435761 + seed * 1103515245) >>> 0;
    s = ((s >>> 16) ^ s) * 0x45d9f3b;
    s = ((s >>> 16) ^ s) * 0x45d9f3b;
    return ((s >>> 16) ^ s) / 0xffffffff;
  };
  
  let seedCounter = 0;
  
  // Bamboo: clustered placement
  for (let i = 0; i < distribution.bamboo; i++) {
    const angle = rng(seedCounter++) * Math.PI * 2;
    const radius = 10 + rng(seedCounter++) * 30;
    elements.push({
      type: 'bamboo',
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
      scale: 0.8 + rng(seedCounter++) * 0.4,
      rotation: rng(seedCounter++) * Math.PI * 2,
      seed: i,
    });
  }
  
  // Ferns: ground cover near bamboo
  for (let i = 0; i < distribution.ferns; i++) {
    const angle = rng(seedCounter++) * Math.PI * 2;
    const radius = 8 + rng(seedCounter++) * 25;
    elements.push({
      type: 'fern',
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
      scale: 0.6 + rng(seedCounter++) * 0.6,
      rotation: rng(seedCounter++) * Math.PI * 2,
      seed: i + 1000,
    });
  }
  
  // Reeds: accent placement at edges
  for (let i = 0; i < distribution.reeds; i++) {
    const angle = rng(seedCounter++) * Math.PI * 2;
    const radius = 20 + rng(seedCounter++) * 20;
    elements.push({
      type: 'reed',
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
      scale: 0.7 + rng(seedCounter++) * 0.5,
      rotation: rng(seedCounter++) * Math.PI * 2,
      seed: i + 2000,
    });
  }
  
  // Blooms: rare highlights
  for (let i = 0; i < distribution.blooms; i++) {
    const angle = rng(seedCounter++) * Math.PI * 2;
    const radius = 12 + rng(seedCounter++) * 18;
    elements.push({
      type: 'bloom',
      x: Math.cos(angle) * radius,
      y: 0.5 + rng(seedCounter++) * 1.0,
      z: Math.sin(angle) * radius,
      scale: 0.5 + rng(seedCounter++) * 0.3,
      rotation: rng(seedCounter++) * Math.PI * 2,
      seed: i + 3000,
    });
  }
  
  // Palms: fixed positions at pillar locations (Depth 5+ only)
  if (distribution.palms > 0) {
    const palmPositions: [number, number][] = [
      [-18, -18], [18, -18], [-18, 18], [18, 18], [-18, 0], [18, 0],
    ];
    palmPositions.forEach(([x, z], i) => {
      elements.push({
        type: 'palm',
        x,
        y: 0,
        z,
        scale: 1.0,
        rotation: rng(seedCounter++) * Math.PI * 2,
        seed: i + 4000,
      });
    });
  }
  
  return elements;
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a thought count milestone was just crossed.
 * Returns milestone value if crossed, null otherwise.
 */
export function checkOvergrowthMilestone(
  previousCount: number,
  currentCount: number
): number | null {
  for (const milestone of OVERGROWTH_MILESTONES) {
    if (previousCount < milestone && currentCount >= milestone) {
      return milestone;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a human-readable description of the current blend state.
 */
export function getBlendDescription(depth: number): string {
  const ratio = getUrbanNatureRatio(depth);
  const cityPct = Math.round(ratio.city * 100);
  const naturePct = Math.round(ratio.nature * 100);
  
  if (depth <= 1) return `Pristine City (${cityPct}% city / ${naturePct}% nature)`;
  if (depth <= 3) return `Encroachment (${cityPct}% city / ${naturePct}% nature)`;
  if (depth === 4) return `Overgrowth (${cityPct}% city / ${naturePct}% nature)`;
  return `Deep Wilds (${cityPct}% city / ${naturePct}% nature)`;
}

/**
 * Calculate overall "wildness" score (0-100) for a chamber.
 * Combines depth and thought count into single metric.
 */
export function getWildnessScore(chamber: Chamber): number {
  const depthScore = Math.min(50, chamber.depth * 10);
  const thoughtScore = Math.min(50, chamber.thoughts.length / 2);
  return Math.floor(depthScore + thoughtScore);
}
