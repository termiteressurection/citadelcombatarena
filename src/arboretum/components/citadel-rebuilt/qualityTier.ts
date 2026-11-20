/**
 * qualityTier.ts — auto-detected GPU/CPU performance tier.
 *
 * Three tiers, named for the doctrine:
 *   BRICK  — integrated GPU, low memory, the toaster floor.
 *   HEARTH — average mid-2010s laptop, the default we design against.
 *   FORGE  — Apple Silicon, discrete GPUs, anything from 2020+.
 *
 * Detection is static-best-guess from `WEBGL_debug_renderer_info` + memory
 * heuristics. Runtime DRS in AdaptiveRenderer can still demote on the fly,
 * but the tier sets the *initial* render budget so we don't show a
 * full-fidelity frame on a machine that can't sustain it.
 *
 * The user can override in Settings; persisted to portable prefs when
 * repo-local mode is active, else localStorage.
 */

import { readPortablePref, writePortablePref } from '@/core/persistence/portablePrefs';

export type QualityTier = 'brick' | 'hearth' | 'forge';

/**
 * Per-tier configuration for the Phase 1+ visual brand systems. These are
 * *design budgets* — every consumer reads from here instead of branching on
 * the tier string directly, so adjustments happen in one file.
 *
 * Budget numbers (skyBudgetMs) are the GPU fragment-cost target for the
 * neural skybox shader at the tier's effective render resolution, not a
 * hard cap. Verification v3 (WEBGL_disjoint_timer_query) measures against
 * these; DRS handles overruns at runtime.
 */
export interface VisualBrandConfig {
  /** Skybox rendering mode. 'gradient' = cheap vertex-color fallback. */
  skyMode: 'gradient' | 'worley';
  /** Worley cell density relative to the design baseline (1.0 = full). */
  skyWorleyDensity: number;
  /** Fragment-cost budget for the sky at this tier, in ms. 0 for gradient. */
  skyBudgetMs: number;
  /** Wireframe altar nesting depth (1..3). Hysteresis may temporarily drop. */
  altarLayers: 1 | 2 | 3;
  /** Matrix rain column hard cap; actual count = min(cap, width/colSpacing). */
  rainColumnCap: number;
  /** Matrix rain column spacing floor in CSS px (density ceiling). */
  rainColumnSpacing: number;
  /** CSS custom property value for `--ui-glow-enabled`: 0 | 0.5 | 1.0. */
  uiGlowEnabled: number;
}

export interface QualityProfile {
  tier: QualityTier;
  /** Initial dpr ceiling. Adaptive DRS can lower at runtime. */
  maxPixelRatio: number;
  /** Initial dpr floor. Adaptive DRS can rise back up to this. */
  minPixelRatio: number;
  /** WebGL antialias hint. */
  antialias: boolean;
  /** Allow ShaderMaterial / heavy effects (bloom, refraction, post). */
  allowHeavyShaders: boolean;
  /** Particle counts may be capped to this fraction of designed count. */
  particleScale: number;
  /** Skip non-critical useFrame work above this median frame ms. */
  budgetMs: number;
  /** Phase 1+ visual brand tier config. */
  visuals: VisualBrandConfig;
}

const STORAGE_KEY = 'citadel.quality.override';

function readOverride(): QualityTier | null {
  const v = readPortablePref(STORAGE_KEY);
  if (v === 'brick' || v === 'hearth' || v === 'forge') return v;
  return null;
}

export function setQualityOverride(tier: QualityTier | null): void {
  writePortablePref(STORAGE_KEY, tier);
}

/**
 * Detect tier purely from environmental signals. No render probe — those
 * cost a frame budget themselves and we'd rather get the user playing.
 * Adaptive DRS will demote at runtime if we guessed too high.
 */
function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'hearth';

  // 1) Manual override wins.
  const override = readOverride();
  if (override) return override;

  // 2) GPU string lookup via WEBGL_debug_renderer_info.
  let gpu = '';
  try {
    const probe = document.createElement('canvas');
    const ctx = probe.getContext('webgl2') || probe.getContext('webgl');
    if (ctx) {
      const ext = ctx.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        gpu = String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
      }
    }
  } catch { /* WebGL may not be ready */ }
  const gpuLower = gpu.toLowerCase();

  // Apple Silicon / discrete cards → FORGE.
  if (
    gpuLower.includes('apple m') ||
    gpuLower.includes('apple gpu') ||
    gpuLower.includes('rtx') ||
    gpuLower.includes('radeon pro') ||
    gpuLower.includes('radeon rx') ||
    gpuLower.includes('geforce gtx 1') ||
    gpuLower.includes('geforce gtx 2') ||
    gpuLower.includes('geforce rtx')
  ) {
    return 'forge';
  }

  // Old Intel integrated → BRICK.
  if (
    gpuLower.includes('intel(r) hd graphics') ||
    gpuLower.includes('intel hd graphics') ||
    gpuLower.includes('iris(tm) plus') ||
    gpuLower.includes('iris plus') ||
    gpuLower.includes('uhd graphics 6') ||
    gpuLower.includes('uhd graphics 5')
  ) {
    return 'brick';
  }

  // 3) Memory heuristics for unknown GPUs.
  const navAny = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = navAny.deviceMemory ?? 8; // Chromium hint, GB
  const cores = navAny.hardwareConcurrency ?? 4;
  if (mem <= 4 || cores <= 2) return 'brick';
  if (mem >= 16 && cores >= 8) return 'forge';

  return 'hearth';
}

const PROFILES: Record<QualityTier, QualityProfile> = {
  brick: {
    tier: 'brick',
    maxPixelRatio: 1.0,
    minPixelRatio: 0.7,
    antialias: false,
    allowHeavyShaders: false,
    particleScale: 0.3,
    budgetMs: 22,
    visuals: {
      skyMode: 'gradient',
      skyWorleyDensity: 0,
      skyBudgetMs: 0,
      altarLayers: 1,
      rainColumnCap: 44,
      rainColumnSpacing: 26,
      uiGlowEnabled: 0,
    },
  },
  hearth: {
    tier: 'hearth',
    maxPixelRatio: 1.25,
    minPixelRatio: 0.85,
    antialias: false,
    allowHeavyShaders: true,
    particleScale: 0.7,
    budgetMs: 17,
    visuals: {
      skyMode: 'worley',
      skyWorleyDensity: 0.6,
      skyBudgetMs: 3.5,
      altarLayers: 2,
      rainColumnCap: 76,
      rainColumnSpacing: 22,
      uiGlowEnabled: 0.5,
    },
  },
  forge: {
    tier: 'forge',
    maxPixelRatio: 1.5,
    minPixelRatio: 1.0,
    antialias: true,
    allowHeavyShaders: true,
    particleScale: 1.0,
    budgetMs: 14,
    visuals: {
      skyMode: 'worley',
      skyWorleyDensity: 1.0,
      skyBudgetMs: 4.0,
      altarLayers: 3,
      rainColumnCap: 96,
      rainColumnSpacing: 18,
      uiGlowEnabled: 1.0,
    },
  },
};

let _cachedProfile: QualityProfile | null = null;

export function getQualityProfile(): QualityProfile {
  if (!_cachedProfile) {
    const tier = detectTier();
    _cachedProfile = PROFILES[tier];
    if (typeof console !== 'undefined') {
      console.log(`[Citadel] quality tier: ${tier}`, _cachedProfile);
    }
  }
  return _cachedProfile;
}

export function refreshQualityProfile(): QualityProfile {
  _cachedProfile = null;
  return getQualityProfile();
}
