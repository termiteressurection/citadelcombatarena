/**
 * Citadel Celestial Sky Parameters — Single Source of Truth for Atmospheric Art Direction
 *
 * Canon Visionary Art Direction:
 * - Void-first discipline: near-black zenith across all chambers (#000002 to #020108).
 * - Tight horizon glow bands: accents glow without flooding the dome.
 * - Distinct, non-overlapping chamber profiles: no two calendar chambers share the same
 *   cloud type + star dialect + hero + horizon combination.
 * - Summer: Signature dragon-scale ceiling with countable 3-face faceted tiles & grout crevices.
 * - Year: Severe obsidian void with the radiant gold sun hero from the canon visionary plate.
 * - Winter: Dormant dark scales, frozen motion, frost horizon line, mandala starburst flare.
 * - Day: Intimate twilight navy->ember horizon, faceted moon, square pixel stars. Sealed days crystallize.
 * - Month (1..12): High weather faceted clouds, aether weather falling triangles and cosmic dust.
 * - Root Hub: Dark constellation disc, 4-point sparkle stars, deep violet-black void.
 * - Mindmap: Full 360-degree neural thread canopy (axons, dendrites, mycelium, synaptic beads).
 */

import type { Chamber } from '../../types';
import { parseCalendarChamberId, isCalendarYearId, isCalendarSeasonId, isCalendarMonthId } from '../../fractalCalendarModel';
import { parseLocalDateFromChamber } from '../../calendarChamberUtils';
import { getPeriodWritability } from '../../writablePath';

export type StarDialect = 'sparkle' | 'pixel' | 'aether' | 'plexus';
export type HeroCelestialBody = 'gold_sun' | 'faceted_moon' | 'dark_constellation_disc' | 'mandala_flare' | 'none';
export type RetroMotif =
  | 'none'
  | 'towerWorld'     // Early-2000s memory towers rising at horizon rim + drifting soft orbs
  | 'cubeWorld'      // Tumbling chrome/translucent cube low in sky
  | 'swirlWorld'     // Fluid ribbon spiral arcing across upper dome + aether dust
  | 'bladeWorld'     // Translucent geometric blades/panels sliding gently into place
  | 'orbReveal'      // Floating reflective chrome sphere low at horizon
  | 'ringDrift'      // Concentric translucent rings drifting slowly across sunset bands
  | 'monolithReveal' // Tall rotating crystalline monolith before the celestial hero
  | 'cubeDust';      // Faint tiny translucent tumbling cube particles drifting through canopy

export interface CitadelSkyConfig {
  id: string;
  name: string;
  // Void gradients
  zenithColor: string;
  midSkyColor: string;
  horizonColor: string;
  horizonGlowIntensity: number;
  nadirColor: string;
  // Nebulae wash
  nebulaColorA: string;
  nebulaColorB: string;
  nebulaDensity: number;
  // Star dialect
  starDialect: StarDialect;
  starDensity: number;
  starColor: string;
  starTwinkleSpeed: number;
  // Faceted clouds
  cloudColor: string;
  cloudOpacity: number;
  cloudScale: number;
  cloudDriftSpeed: number;
  // Hero celestial body
  hero: HeroCelestialBody;
  heroElevation: number;  // 0.0 (horizon) to 1.0 (zenith)
  heroAzimuth: number;    // radians
  heroScale: number;
  heroColor: string;
  heroDimmed?: boolean;
  // Dragon scale ceiling
  hasScaleCeiling: boolean;
  scaleColorPrimary: string;
  scaleColorSecondary: string;
  scaleColorAccent: string;
  scaleBreathingSpeed: number; // 0 for dormant/frozen
  scaleDensity: number;
  scaleElevationStart: number; // minimum y elevation where scales start
  scaleDormant?: boolean;
  // Constellation plexus
  hasPlexus: boolean;
  plexusColor: string;
  // Neural thread canopy (Mindmap)
  hasThreadCanopy: boolean;
  threadColorPrimary: string;
  threadColorSecondary: string;
  threadColorAccent: string;
  threadDensity: number;
  // Retro early-2000s console startup menu vibe layer (evocative silhouettes)
  retroMotif: RetroMotif;
  retroColorPrimary: string;
  retroColorSecondary: string;
  retroColorRim: string;
  retroSpeed: number;
  retroScale: number;
  retroElevation: number; // 0.0 (horizon) to 1.0 (zenith)
  retroAzimuth: number;
  retroOpacity: number;
  // Sealed / stone state
  isCrystallized: boolean;
  // Coupled scene lighting & fog
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientLightColor: string;
  ambientLightIntensity: number;
}

export function resolveSkyParams(
  chamber?: Chamber | null,
  isNearSigma = false
): CitadelSkyConfig {
  // ── 0. MINDMAP OVERLAY SKYBOX (Chamber -1000 or template 'mindmap') ────────
  if (chamber?.id === -1000 || chamber?.template === 'mindmap') {
    return {
      id: 'mindmap',
      name: 'Mind Map Neural Thread Canopy',
      zenithColor: '#000003',
      midSkyColor: '#020108',
      horizonColor: '#082f49',
      horizonGlowIntensity: 0.5,
      nadirColor: '#000001',
      nebulaColorA: '#020b18',
      nebulaColorB: '#0b1626',
      nebulaDensity: 0.12,
      starDialect: 'sparkle',
      starDensity: 0.2,
      starColor: '#7dd3fc',
      starTwinkleSpeed: 0.15,
      cloudColor: '#000000',
      cloudOpacity: 0.0,
      cloudScale: 1.0,
      cloudDriftSpeed: 0.0,
      hero: 'none',
      heroElevation: 0.5,
      heroAzimuth: 0,
      heroScale: 1.0,
      heroColor: '#000000',
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: false,
      plexusColor: '#000000',
      hasThreadCanopy: true,
      threadColorPrimary: '#0e7490',
      threadColorSecondary: '#155e75',
      threadColorAccent: '#f59e0b',
      threadDensity: 1.0,
      retroMotif: 'cubeDust',
      retroColorPrimary: '#0e7490',
      retroColorSecondary: '#155e75',
      retroColorRim: '#38bdf8',
      retroSpeed: 0.15,
      retroScale: 1.0,
      retroElevation: 0.5,
      retroAzimuth: 0.0,
      retroOpacity: 0.35,
      isCrystallized: false,
      fogColor: '#010004',
      fogNear: 60,
      fogFar: 400,
      ambientLightColor: '#38bdf8',
      ambientLightIntensity: 0.25,
    };
  }

  // ── 1. ROOT HUB & SIGMA SANCTUARY AXIS (Chamber 0) ─────────────────────────
  if (!chamber || chamber.id === 0) {
    if (isNearSigma) {
      // Sigma Sanctuary: Deep space cosmos nebula + teal matrix data rain + mandala flare
      return {
        id: 'sigma_sanctuary',
        name: 'Sigma Sanctuary Axis',
        zenithColor: '#000004',
        midSkyColor: '#050212',
        horizonColor: '#06b6d4',
        horizonGlowIntensity: 0.85,
        nadirColor: '#000002',
        nebulaColorA: '#3b0764',
        nebulaColorB: '#083344',
        nebulaDensity: 0.32,
        starDialect: 'aether',
        starDensity: 1.25,
        starColor: '#38bdf8',
        starTwinkleSpeed: 0.45,
        cloudColor: '#1e0836',
        cloudOpacity: 0.1,
        cloudScale: 1.8,
        cloudDriftSpeed: 0.0015,
        hero: 'mandala_flare',
        heroElevation: 0.72,
        heroAzimuth: -Math.PI / 2, // Facing Sigma North/Z=-80
        heroScale: 1.2,
        heroColor: '#a855f7',
        hasScaleCeiling: false,
        scaleColorPrimary: '#0d9488',
        scaleColorSecondary: '#1e1b4b',
        scaleColorAccent: '#22d3ee',
        scaleBreathingSpeed: 0.0,
        scaleDensity: 1.0,
        scaleElevationStart: 0.4,
        hasPlexus: true,
        plexusColor: '#0891b2',
        hasThreadCanopy: false,
        threadColorPrimary: '#000000',
        threadColorSecondary: '#000000',
        threadColorAccent: '#000000',
        threadDensity: 1.0,
        retroMotif: 'towerWorld',
        retroColorPrimary: '#083344',
        retroColorSecondary: '#06b6d4',
        retroColorRim: '#22d3ee',
        retroSpeed: 0.12,
        retroScale: 0.8,
        retroElevation: 0.08,
        retroAzimuth: -Math.PI / 2,
        retroOpacity: 0.28,
        isCrystallized: false,
        fogColor: '#03010c',
        fogNear: 35,
        fogFar: 160,
        ambientLightColor: '#6366f1',
        ambientLightIntensity: 0.35,
      };
    }

    // Sanctuary Hub: Torii baseline void + Dark Constellation Disc + 4-Point Sparkles
    return {
      id: 'sanctuary_hub',
      name: 'Sanctuary Hub',
      zenithColor: '#010005',
      midSkyColor: '#060214',
      horizonColor: '#0891b2',
      horizonGlowIntensity: 0.65,
      nadirColor: '#000002',
      nebulaColorA: '#2e1065',
      nebulaColorB: '#4a044e',
      nebulaDensity: 0.22,
      starDialect: 'sparkle',
      starDensity: 0.85,
      starColor: '#e9d5ff',
      starTwinkleSpeed: 0.35,
      cloudColor: '#000000',
      cloudOpacity: 0.0, // No clouds in hub - pure void with hero disc
      cloudScale: 1.4,
      cloudDriftSpeed: 0.0,
      hero: 'dark_constellation_disc',
      heroElevation: 0.58,
      heroAzimuth: -1.2,
      heroScale: 1.15,
      heroColor: '#06b6d4',
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: false,
      plexusColor: '#0891b2',
      hasThreadCanopy: false,
      threadColorPrimary: '#000000',
      threadColorSecondary: '#000000',
      threadColorAccent: '#000000',
      threadDensity: 1.0,
      retroMotif: 'towerWorld',
      retroColorPrimary: '#0f172a',
      retroColorSecondary: '#1e1b4b',
      retroColorRim: '#06b6d4',
      retroSpeed: 0.18,
      retroScale: 1.0,
      retroElevation: 0.06,
      retroAzimuth: -1.2,
      retroOpacity: 0.45,
      isCrystallized: false,
      fogColor: '#020108',
      fogNear: 50,
      fogFar: 180,
      ambientLightColor: '#7c3aed',
      ambientLightIntensity: 0.3,
    };
  }

  // ── 2. DAY CHAMBER (Today vs Sealed Past) ──────────────────────────────────
  if (chamber.template === 'day') {
    const dayIso = parseLocalDateFromChamber(chamber);
    const writability = dayIso ? getPeriodWritability('day', dayIso) : { status: 'current' as const };
    const isPast = writability.status === 'past';

    if (isPast) {
      // Crystallized Stone Day Sky: motion frozen, desaturated slate indigo, dimmed moon
      return {
        id: 'day_sealed',
        name: `Day ${dayIso || ''} (Crystallized)`,
        zenithColor: '#010205',
        midSkyColor: '#030710',
        horizonColor: '#1e3a5f',
        horizonGlowIntensity: 0.35,
        nadirColor: '#000103',
        nebulaColorA: '#0f172a',
        nebulaColorB: '#1e293b',
        nebulaDensity: 0.1,
        starDialect: 'pixel',
        starDensity: 0.4,
        starColor: '#64748b',
        starTwinkleSpeed: 0.0, // Frozen motion
        cloudColor: '#000000',
        cloudOpacity: 0.0,
        cloudScale: 1.2,
        cloudDriftSpeed: 0.0,
        hero: 'faceted_moon',
        heroElevation: 0.55,
        heroAzimuth: 0.8,
        heroScale: 0.9,
        heroColor: '#475569',
        heroDimmed: true,
        hasScaleCeiling: false,
        scaleColorPrimary: '#000000',
        scaleColorSecondary: '#000000',
        scaleColorAccent: '#000000',
        scaleBreathingSpeed: 0.0,
        scaleDensity: 1.0,
        scaleElevationStart: 0.4,
        hasPlexus: false,
        plexusColor: '#1e3a5f',
        hasThreadCanopy: false,
        threadColorPrimary: '#000000',
        threadColorSecondary: '#000000',
        threadColorAccent: '#000000',
        threadDensity: 1.0,
        retroMotif: 'cubeWorld',
        retroColorPrimary: '#1e293b',
        retroColorSecondary: '#0f172a',
        retroColorRim: '#475569',
        retroSpeed: 0.0, // Frozen motion in crystallized stone
        retroScale: 0.85,
        retroElevation: 0.22,
        retroAzimuth: 1.2,
        retroOpacity: 0.35,
        isCrystallized: true,
        fogColor: '#020308',
        fogNear: 30,
        fogFar: 135,
        ambientLightColor: '#475569',
        ambientLightIntensity: 0.22,
      };
    }

    // Writable Current Day: Intimate twilight gradient (navy -> teal -> burnt ember band)
    return {
      id: 'day_current',
      name: `Day ${dayIso || 'Today'}`,
      zenithColor: '#010308',
      midSkyColor: '#031422',
      horizonColor: '#9a3412',
      horizonGlowIntensity: 0.85,
      nadirColor: '#000104',
      nebulaColorA: '#0369a1',
      nebulaColorB: '#701a75',
      nebulaDensity: 0.16,
      starDialect: 'pixel',
      starDensity: 0.95,
      starColor: '#fef08a',
      starTwinkleSpeed: 0.25,
      cloudColor: '#431407',
      cloudOpacity: 0.12, // Clouds low on horizon only
      cloudScale: 1.8,
      cloudDriftSpeed: 0.001,
      hero: 'faceted_moon',
      heroElevation: 0.62,
      heroAzimuth: 0.65,
      heroScale: 1.1,
      heroColor: '#cbd5e1',
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: false,
      plexusColor: '#0369a1',
      hasThreadCanopy: false,
      threadColorPrimary: '#000000',
      threadColorSecondary: '#000000',
      threadColorAccent: '#000000',
      threadDensity: 1.0,
      retroMotif: 'cubeWorld',
      retroColorPrimary: '#1e293b',
      retroColorSecondary: '#431407',
      retroColorRim: '#94a3b8',
      retroSpeed: 0.2, // ~30s+ period slow tumble
      retroScale: 0.95,
      retroElevation: 0.24,
      retroAzimuth: 1.15,
      retroOpacity: 0.55,
      isCrystallized: false,
      fogColor: '#030812',
      fogNear: 40,
      fogFar: 160,
      ambientLightColor: '#c2410c',
      ambientLightIntensity: 0.3,
    };
  }

  // ── 3. SEASON CHAMBERS (Winter=0, Spring=1, Summer=2, Autumn=3) ────────────
  if (chamber.template === 'season' || isCalendarSeasonId(chamber.id)) {
    const parsed = parseCalendarChamberId(chamber.id);
    const s = parsed.seasonIndex ?? 0;

    // SUMMER (Index 2): The Dragon Scale Ceiling Owns the Zenith
    if (s === 2) {
      return {
        id: 'season_summer',
        name: 'Summer Chamber',
        zenithColor: '#010306',
        midSkyColor: '#020e14',
        horizonColor: '#0f766e',
        horizonGlowIntensity: 0.85,
        nadirColor: '#000102',
        nebulaColorA: '#042f2e',
        nebulaColorB: '#083344',
        nebulaDensity: 0.12,
        starDialect: 'pixel',
        starDensity: 0.2, // Almost no stars visible through scales
        starColor: '#99f6e4',
        starTwinkleSpeed: 0.2,
        cloudColor: '#000000',
        cloudOpacity: 0.0, // No competing cloud layer
        cloudScale: 1.0,
        cloudDriftSpeed: 0.0,
        hero: 'none', // Scale ceiling owns the sky
        heroElevation: 0.5,
        heroAzimuth: 0,
        heroScale: 1.0,
        heroColor: '#0d9488',
        hasScaleCeiling: true,
        scaleColorPrimary: '#04423d',     // Deep teal-slate
        scaleColorSecondary: '#071022',   // Deep navy shadow
        scaleColorAccent: '#0d9488',      // Subtle cyan breath
        scaleBreathingSpeed: 0.24,        // 26s slow breathing cycle
        scaleDensity: 1.35,
        scaleElevationStart: 0.22,        // Covers upper dome
        scaleDormant: false,
        hasPlexus: false,
        plexusColor: '#0f766e',
        hasThreadCanopy: false,
        threadColorPrimary: '#000000',
        threadColorSecondary: '#000000',
        threadColorAccent: '#000000',
        threadDensity: 1.0,
        retroMotif: 'orbReveal',
        retroColorPrimary: '#042f2e',
        retroColorSecondary: '#0d9488',
        retroColorRim: '#5eead4',
        retroSpeed: 0.14,
        retroScale: 1.1,
        retroElevation: 0.12,
        retroAzimuth: 0.0,
        retroOpacity: 0.48,
        isCrystallized: false,
        fogColor: '#01090c',
        fogNear: 40,
        fogFar: 170,
        ambientLightColor: '#0d9488',
        ambientLightIntensity: 0.35,
      };
    }

    // WINTER (Index 0): Dormant & Still — Dark Sleeping Scales, Teal Plexus, Mandala Flare
    if (s === 0) {
      return {
        id: 'season_winter',
        name: 'Winter Chamber',
        zenithColor: '#000003',
        midSkyColor: '#020108',
        horizonColor: '#3730a3',
        horizonGlowIntensity: 0.55,
        nadirColor: '#000001',
        nebulaColorA: '#1e1b4b',
        nebulaColorB: '#2e1065',
        nebulaDensity: 0.15,
        starDialect: 'aether',
        starDensity: 0.5, // Faint dust
        starColor: '#c7d2fe',
        starTwinkleSpeed: 0.0, // Still
        cloudColor: '#000000',
        cloudOpacity: 0.0, // No clouds
        cloudScale: 1.0,
        cloudDriftSpeed: 0.0,
        hero: 'mandala_flare',
        heroElevation: 0.74,
        heroAzimuth: 0.2,
        heroScale: 1.05,
        heroColor: '#818cf8',
        hasScaleCeiling: true,
        scaleColorPrimary: '#050512',
        scaleColorSecondary: '#020208',
        scaleColorAccent: '#0f1124',
        scaleBreathingSpeed: 0.0, // Dormant / frozen: Winter sleeps
        scaleDensity: 1.25,
        scaleElevationStart: 0.32,
        scaleDormant: true,
        hasPlexus: true,
        plexusColor: '#22d3ee', // Faint teal constellation plexus lines
        hasThreadCanopy: false,
        threadColorPrimary: '#000000',
        threadColorSecondary: '#000000',
        threadColorAccent: '#000000',
        threadDensity: 1.0,
        retroMotif: 'bladeWorld',
        retroColorPrimary: '#0f172a',
        retroColorSecondary: '#1e1b4b',
        retroColorRim: '#38bdf8',
        retroSpeed: 0.0, // Frozen blades: locked in place, motion 0, frost-rimmed, dormant
        retroScale: 1.0,
        retroElevation: 0.08,
        retroAzimuth: 0.2,
        retroOpacity: 0.35,
        isCrystallized: true,
        fogColor: '#010006',
        fogNear: 35,
        fogFar: 145,
        ambientLightColor: '#4338ca',
        ambientLightIntensity: 0.25,
      };
    }

    // SPRING (Index 1): Pink/Teal Faceted Clouds, Brightening Horizon, Sparkle Stars
    if (s === 1) {
      return {
        id: 'season_spring',
        name: 'Spring Chamber',
        zenithColor: '#020006',
        midSkyColor: '#0a0314',
        horizonColor: '#db2777',
        horizonGlowIntensity: 0.85,
        nadirColor: '#000002',
        nebulaColorA: '#831843',
        nebulaColorB: '#064e3b',
        nebulaDensity: 0.22,
        starDialect: 'sparkle',
        starDensity: 0.6,
        starColor: '#fbcfe8',
        starTwinkleSpeed: 0.4,
        cloudColor: '#9d174d',
        cloudOpacity: 0.28,
        cloudScale: 1.4,
        cloudDriftSpeed: 0.002,
        hero: 'none',
        heroElevation: 0.5,
        heroAzimuth: 0,
        heroScale: 1.0,
        heroColor: '#db2777',
        hasScaleCeiling: false,
        scaleColorPrimary: '#000000',
        scaleColorSecondary: '#000000',
        scaleColorAccent: '#000000',
        scaleBreathingSpeed: 0.0,
        scaleDensity: 1.0,
        scaleElevationStart: 0.4,
        hasPlexus: false,
        plexusColor: '#db2777',
        hasThreadCanopy: false,
        threadColorPrimary: '#000000',
        threadColorSecondary: '#000000',
        threadColorAccent: '#000000',
        threadDensity: 1.0,
        retroMotif: 'bladeWorld',
        retroColorPrimary: '#064e3b',
        retroColorSecondary: '#831843',
        retroColorRim: '#34d399',
        retroSpeed: 0.16,
        retroScale: 1.05,
        retroElevation: 0.09,
        retroAzimuth: 0.0,
        retroOpacity: 0.45,
        isCrystallized: false,
        fogColor: '#06010e',
        fogNear: 35,
        fogFar: 155,
        ambientLightColor: '#db2777',
        ambientLightIntensity: 0.32,
      };
    }

    // AUTUMN (Index 3): Banded Sunset Stripes, Low Coral/Orange Faceted Clouds, Bronze Hero
    return {
      id: 'season_autumn',
      name: 'Autumn Chamber',
      zenithColor: '#020005',
      midSkyColor: '#12020a',
      horizonColor: '#c2410c',
      horizonGlowIntensity: 0.95,
      nadirColor: '#000002',
      nebulaColorA: '#581c87',
      nebulaColorB: '#7c2d12',
      nebulaDensity: 0.24,
      starDialect: 'pixel',
      starDensity: 0.45,
      starColor: '#fdba74',
      starTwinkleSpeed: 0.3,
      cloudColor: '#9a3412',
      cloudOpacity: 0.32,
      cloudScale: 1.5,
      cloudDriftSpeed: 0.0018,
      hero: 'faceted_moon', // Faceted bronze celestial disc
      heroElevation: 0.52,
      heroAzimuth: 0.4,
      heroScale: 1.05,
      heroColor: '#b45309',
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: false,
      plexusColor: '#c2410c',
      hasThreadCanopy: false,
      threadColorPrimary: '#000000',
      threadColorSecondary: '#000000',
      threadColorAccent: '#000000',
      threadDensity: 1.0,
      retroMotif: 'ringDrift',
      retroColorPrimary: '#431407',
      retroColorSecondary: '#7c2d12',
      retroColorRim: '#fb923c',
      retroSpeed: 0.12,
      retroScale: 1.2,
      retroElevation: 0.22,
      retroAzimuth: 0.4,
      retroOpacity: 0.45,
      isCrystallized: false,
      fogColor: '#080106',
      fogNear: 35,
      fogFar: 150,
      ambientLightColor: '#ea580c',
      ambientLightIntensity: 0.3,
    };
  }

  // ── 4. MONTH CHAMBERS (1..12 - High Weather) ───────────────────────────────
  if (chamber.template === 'month' || isCalendarMonthId(chamber.id)) {
    const parsed = parseCalendarChamberId(chamber.id);
    const m = parsed.month ?? 1;

    // Distinct monthly calendar hues (controlled saturation, tight horizon)
    const monthPalette: Record<number, { horizon: string; cloud: string; fog: string }> = {
      1:  { horizon: '#4338ca', cloud: '#312e81', fog: '#020108' },
      2:  { horizon: '#7e22ce', cloud: '#581c87', fog: '#04010a' },
      3:  { horizon: '#059669', cloud: '#064e3b', fog: '#010503' },
      4:  { horizon: '#be185d', cloud: '#831843', fog: '#060105' },
      5:  { horizon: '#15803d', cloud: '#14532d', fog: '#010502' },
      6:  { horizon: '#a16207', cloud: '#713f12', fog: '#060401' },
      7:  { horizon: '#0e7490', cloud: '#155e75', fog: '#010508' },
      8:  { horizon: '#c2410c', cloud: '#7c2d12', fog: '#060201' },
      9:  { horizon: '#6d28d9', cloud: '#4c1d95', fog: '#030108' },
      10: { horizon: '#4338ca', cloud: '#1e1b4b', fog: '#020108' },
      11: { horizon: '#9f1239', cloud: '#881337', fog: '#060103' },
      12: { horizon: '#0369a1', cloud: '#075985', fog: '#010408' },
    };
    const mStyle = monthPalette[m] ?? monthPalette[10];

    return {
      id: `month_${m}`,
      name: chamber.name || `Month ${m}`,
      zenithColor: '#010006',
      midSkyColor: '#060214',
      horizonColor: mStyle.horizon,
      horizonGlowIntensity: 0.75,
      nadirColor: '#000002',
      nebulaColorA: '#3b0764',
      nebulaColorB: '#0e7490',
      nebulaDensity: 0.18,
      starDialect: 'aether', // Falling triangles & cosmic dust
      starDensity: 1.1,
      starColor: '#e0e7ff',
      starTwinkleSpeed: 0.45,
      cloudColor: mStyle.cloud,
      cloudOpacity: 0.42, // High weather clouds dominate the upper dome
      cloudScale: 1.8,
      cloudDriftSpeed: 0.002,
      hero: 'none', // High clouds own the celestial dome
      heroElevation: 0.5,
      heroAzimuth: 0,
      heroScale: 1.0,
      heroColor: mStyle.horizon,
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: false,
      plexusColor: mStyle.horizon,
      hasThreadCanopy: false,
      threadColorPrimary: '#000000',
      threadColorSecondary: '#000000',
      threadColorAccent: '#000000',
      threadDensity: 1.0,
      retroMotif: 'swirlWorld',
      retroColorPrimary: mStyle.cloud,
      retroColorSecondary: mStyle.fog,
      retroColorRim: mStyle.horizon,
      retroSpeed: 0.15,
      retroScale: 1.1,
      retroElevation: 0.48,
      retroAzimuth: 0.0,
      retroOpacity: 0.42,
      isCrystallized: false,
      fogColor: mStyle.fog,
      fogNear: 35,
      fogFar: 145,
      ambientLightColor: mStyle.horizon,
      ambientLightIntensity: 0.3,
    };
  }

  // ── 5. YEAR CHAMBER (Glass Pyramid — Severe Obsidian Void + Gold Sun Hero) ──
  if (chamber.template === 'calendar-root' || isCalendarYearId(chamber.id)) {
    const parsed = parseCalendarChamberId(chamber.id);
    const yr = parsed.year ?? 2026;
    const isPastYear = yr < new Date().getFullYear();

    return {
      id: 'year_chamber',
      name: `Year ${yr}`,
      zenithColor: '#000002',
      midSkyColor: '#020008',
      horizonColor: '#4c1d95',
      horizonGlowIntensity: 0.7,
      nadirColor: '#000000',
      nebulaColorA: '#1e0836',
      nebulaColorB: '#172554',
      nebulaDensity: 0.14,
      starDialect: 'sparkle',
      starDensity: 0.55,
      starColor: '#fef08a',
      starTwinkleSpeed: 0.25,
      cloudColor: '#000000',
      cloudOpacity: 0.0, // No clouds in year chamber
      cloudScale: 1.0,
      cloudDriftSpeed: 0.0,
      hero: 'gold_sun', // The canon visionary radiant gold sun-disc!
      heroElevation: 0.68,
      heroAzimuth: 0.0,
      heroScale: 1.35,
      heroColor: '#f59e0b',
      heroDimmed: isPastYear,
      hasScaleCeiling: false,
      scaleColorPrimary: '#000000',
      scaleColorSecondary: '#000000',
      scaleColorAccent: '#000000',
      scaleBreathingSpeed: 0.0,
      scaleDensity: 1.0,
      scaleElevationStart: 0.4,
      hasPlexus: true,
      plexusColor: '#581c87',
      hasThreadCanopy: false,
      threadColorPrimary: '#000000',
      threadColorSecondary: '#000000',
      threadColorAccent: '#000000',
      threadDensity: 1.0,
      retroMotif: 'monolithReveal',
      retroColorPrimary: '#050308',
      retroColorSecondary: '#1e0836',
      retroColorRim: '#d97706',
      retroSpeed: isPastYear ? 0.0 : 0.15,
      retroScale: 1.25,
      retroElevation: 0.42,
      retroAzimuth: 0.0,
      retroOpacity: isPastYear ? 0.35 : 0.58,
      isCrystallized: isPastYear,
      fogColor: '#020006',
      fogNear: 40,
      fogFar: 180,
      ambientLightColor: '#d97706',
      ambientLightIntensity: 0.28,
    };
  }

  // ── 6. DEFAULT FALLBACK (Rhymes with Sanctuary Hub) ────────────────────────
  return {
    id: 'default_chamber',
    name: chamber.name || 'Citadel Chamber',
    zenithColor: '#010005',
    midSkyColor: '#060214',
    horizonColor: '#0891b2',
    horizonGlowIntensity: 0.65,
    nadirColor: '#000002',
    nebulaColorA: '#2e1065',
    nebulaColorB: '#4a044e',
    nebulaDensity: 0.2,
    starDialect: 'sparkle',
    starDensity: 0.8,
    starColor: '#e9d5ff',
    starTwinkleSpeed: 0.35,
    cloudColor: '#000000',
    cloudOpacity: 0.0,
    cloudScale: 1.4,
    cloudDriftSpeed: 0.0,
    hero: 'none',
    heroElevation: 0.5,
    heroAzimuth: 0,
    heroScale: 1.0,
    heroColor: '#0891b2',
    hasScaleCeiling: false,
    scaleColorPrimary: '#000000',
    scaleColorSecondary: '#000000',
    scaleColorAccent: '#000000',
    scaleBreathingSpeed: 0.0,
    scaleDensity: 1.0,
    scaleElevationStart: 0.4,
    hasPlexus: false,
    plexusColor: '#0891b2',
    hasThreadCanopy: false,
    threadColorPrimary: '#000000',
    threadColorSecondary: '#000000',
    threadColorAccent: '#000000',
    threadDensity: 1.0,
    retroMotif: 'none',
    retroColorPrimary: '#000000',
    retroColorSecondary: '#000000',
    retroColorRim: '#000000',
    retroSpeed: 0.0,
    retroScale: 1.0,
    retroElevation: 0.0,
    retroAzimuth: 0.0,
    retroOpacity: 0.0,
    isCrystallized: false,
    fogColor: '#020108',
    fogNear: 45,
    fogFar: 175,
    ambientLightColor: '#7c3aed',
    ambientLightIntensity: 0.3,
  };
}
