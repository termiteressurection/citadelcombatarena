/**
 * Bit Society Seeded Trait System (Animal Crossing Style)
 *
 * Deterministic traits seeded by entry or mindmap node ID.
 * Every Bit in the Citadel has 5 traits that govern its motion,
 * social behavior, preferred gathering area, mood, and idle quirk.
 *
 * NO HARD TETHERS:
 * Home range is a PREFERENCE, never a fence or boundary.
 * Bits spend ~70% of their time near their preferred area and ~30%
 * on curiosity excursions across the entire overworld up to r < 580.
 *
 * Caste speeds (in units per second):
 * - Year: 2.0 u/s (slowest, noble stately pace: 1.70 - 2.0 u/s)
 * - Day: 2.4 u/s (second slowest, weary toiler: 2.4 * 0.85 = 2.04 u/s)
 * - Season: 3.2 u/s (district guardian: 3.2 - 4.0 u/s)
 * - Month: 3.6 u/s (industrious artisan: 3.6 - 4.5 u/s)
 * - Mindmap: 4.5 u/s (fastest, unconfined wanderer: 4.5 - 5.625 u/s)
 */

import { type NpcCaste } from './BitSocietyNPCs';

export type BitTempo = 'Slow' | 'Steady' | 'Brisk' | 'Darting';
export type BitSociability = 'Loner' | 'Friendly' | 'Social' | 'Greeter';
export type BitHomeRange = 'Homebody' | 'Neighbourhood' | 'Commuter' | 'Roamer';
export type BitMood = 'Calm' | 'Cheerful' | 'Curious' | 'Shy' | 'Grumpy';
export type BitQuirk =
  | 'Stargazer'
  | 'Gardener'
  | 'Napper'
  | 'Fidgeter'
  | 'Dancer'
  | 'Collector';

export interface BitTraits {
  seed: number;
  seedHex: string;
  tempo: BitTempo;
  sociability: BitSociability;
  homeRange: BitHomeRange;
  preferredArea: string;
  mood: BitMood;
  quirk: BitQuirk;
  tempoMultiplier: number;
  homeRangeRadius: number; // Retained for display / telemetry (preferred area radius)
  baseSpeed: number;
  effectiveSpeed: number;
  variantIndex: number;
  variantId: string;
}

export const TEMPO_MULTIPLIERS: Record<BitTempo, number> = {
  Slow: 0.85,
  Steady: 1.0,
  Brisk: 1.25,
  Darting: 1.5,
};

/** Base roaming speed in units/second per caste */
export const CASTE_BASE_SPEEDS: Record<NpcCaste, number> = {
  year: 2.0,    // Slowest (noble stately)
  day: 2.4,     // Second slowest (weary ember-core, strictly Slow -> 2.04 u/s)
  season: 3.2,  // Middle
  month: 3.6,   // Middle
  mindmap: 4.5, // Fastest (free wanderer)
};

/** Caste preferred gathering zones (bias, not boundary) */
export const CASTE_PREFERRED_GATHERING: Record<
  NpcCaste,
  { name: string; minR: number; maxR: number }
> = {
  year: { name: 'Plaza & Pyramid', minR: 10, maxR: 26 },
  season: { name: 'Torii & Season Paths', minR: 18, maxR: 36 },
  month: { name: 'Village Roads & Hedgerows', minR: 20, maxR: 46 },
  day: { name: 'Periphery & Hearthside', minR: 32, maxR: 62 },
  mindmap: { name: 'Everywhere & Mind Expanse', minR: 12, maxR: 85 },
};

/** Trait display preferences */
export const PREFERRED_AREA_DESCRIPTIONS: Record<BitHomeRange, { name: string; radius: number }> = {
  Homebody: { name: 'Village Periphery', radius: 18 },
  Neighbourhood: { name: 'District Thoroughfares', radius: 32 },
  Commuter: { name: 'Cross-Town Avenues', radius: 48 },
  Roamer: { name: 'Overworld Expanse', radius: 85 },
};

export const HOME_RANGE_RADII: Record<BitHomeRange, number> = {
  Homebody: 18,
  Neighbourhood: 32,
  Commuter: 48,
  Roamer: 85,
};

// Caste Clamping Tables
export const CASTE_CLAMPED_TEMPOS: Record<NpcCaste, BitTempo[]> = {
  year: ['Slow', 'Steady'],
  season: ['Steady', 'Brisk'],
  month: ['Steady', 'Brisk'],
  day: ['Slow'], // Day is strictly slow (0.85x)
  mindmap: ['Steady', 'Brisk'],
};

export const CASTE_CLAMPED_SOCIABILITIES: Record<NpcCaste, BitSociability[]> = {
  year: ['Loner', 'Friendly', 'Social', 'Greeter'],
  season: ['Loner', 'Friendly', 'Social', 'Greeter'],
  month: ['Loner', 'Friendly', 'Social', 'Greeter'],
  day: ['Loner', 'Friendly'],
  mindmap: ['Loner', 'Friendly', 'Social', 'Greeter'],
};

export const CASTE_CLAMPED_RANGES: Record<NpcCaste, BitHomeRange[]> = {
  year: ['Homebody', 'Neighbourhood', 'Commuter'],
  season: ['Neighbourhood', 'Commuter'],
  month: ['Homebody', 'Neighbourhood', 'Commuter'],
  day: ['Homebody'],
  mindmap: ['Roamer'],
};

export const CASTE_CLAMPED_MOODS: Record<NpcCaste, BitMood[]> = {
  year: ['Calm', 'Cheerful', 'Curious'],
  season: ['Calm', 'Cheerful', 'Curious', 'Shy', 'Grumpy'],
  month: ['Calm', 'Cheerful', 'Curious', 'Shy', 'Grumpy'],
  day: ['Shy', 'Grumpy', 'Calm'],
  mindmap: ['Calm', 'Cheerful', 'Curious'],
};

export const CASTE_CLAMPED_QUIRKS: Record<NpcCaste, BitQuirk[]> = {
  year: ['Stargazer', 'Gardener', 'Napper', 'Fidgeter', 'Dancer', 'Collector'],
  season: ['Stargazer', 'Gardener', 'Napper', 'Fidgeter', 'Dancer', 'Collector'],
  month: ['Stargazer', 'Gardener', 'Napper', 'Fidgeter', 'Dancer', 'Collector'],
  day: ['Napper', 'Fidgeter'],
  mindmap: ['Stargazer', 'Gardener', 'Napper', 'Dancer'],
};

/**
 * 32-bit FNV-1a hash function for stable determinism across sessions.
 */
export function hashString32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Mulberry32 seeded pseudo-random number generator.
 */
function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return function nextFloat(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically resolve the 5 traits of any Bit from its ID and Caste.
 */
export function resolveBitTraits(id: string, caste: NpcCaste): BitTraits {
  const seed = hashString32(`${caste}:${id}`);
  const rng = createMulberry32(seed);

  const allowedTempos = CASTE_CLAMPED_TEMPOS[caste];
  const allowedSociabilities = CASTE_CLAMPED_SOCIABILITIES[caste];
  const allowedRanges = CASTE_CLAMPED_RANGES[caste];
  const allowedMoods = CASTE_CLAMPED_MOODS[caste];
  const allowedQuirks = CASTE_CLAMPED_QUIRKS[caste];

  const tempoIdx = Math.floor(rng() * allowedTempos.length);
  const sociabilityIdx = Math.floor(rng() * allowedSociabilities.length);
  const rangeIdx = Math.floor(rng() * allowedRanges.length);
  const moodIdx = Math.floor(rng() * allowedMoods.length);
  const quirkIdx = Math.floor(rng() * allowedQuirks.length);

  const tempo = allowedTempos[tempoIdx];
  const sociability = allowedSociabilities[sociabilityIdx];
  const homeRange = allowedRanges[rangeIdx];
  const mood = allowedMoods[moodIdx];
  const quirk = allowedQuirks[quirkIdx];

  const tempoMultiplier = TEMPO_MULTIPLIERS[tempo];
  const baseSpeed = CASTE_BASE_SPEEDS[caste];
  const effectiveSpeed = baseSpeed * tempoMultiplier;

  // Caste Within-Variant Resolution (Deterministic from seed)
  let variantIndex = 0;
  let variantId = `${caste}-1`;
  if (caste === 'day') {
    variantIndex = (seed >>> 8) % 6;
    variantId = `Day-${variantIndex + 1}`;
  } else if (caste === 'mindmap') {
    variantIndex = (seed >>> 8) % 4;
    variantId = `Mindmap-${variantIndex + 1}`;
  } else if (caste === 'year') {
    variantIndex = (seed >>> 8) % 3;
    variantId = `Year-${variantIndex + 1}`;
  } else if (caste === 'season') {
    variantIndex = (seed >>> 8) % 2;
    variantId = `Season-${variantIndex + 1}`;
  } else if (caste === 'month') {
    variantIndex = (seed >>> 8) % 2;
    variantId = `Month-${variantIndex + 1}`;
  }

  return {
    seed,
    seedHex: seed.toString(16).padStart(8, '0').toUpperCase(),
    tempo,
    sociability,
    homeRange,
    preferredArea: PREFERRED_AREA_DESCRIPTIONS[homeRange].name,
    mood,
    quirk,
    tempoMultiplier,
    homeRangeRadius: PREFERRED_AREA_DESCRIPTIONS[homeRange].radius,
    baseSpeed,
    effectiveSpeed,
    variantIndex,
    variantId,
  };
}
