/**
 * World Looks — the art-style registry for the 3D world.
 *
 * The vision: 16 unique aesthetics (one per personality result), each a complete
 * re-skin of the same Citadel with its own bespoke planetary curvature radius:
 *   • Minimal: R = 2000 (sweeping, almost-flat monumental horizon)
 *   • Acid Trip: R = 60 (tight, hyper-curved disorienting psychedelic planetoid)
 *   • Neon Wireframe: R = 120 (canonical sanctuary dome)
 *   • Tactile Papercraft: R = 160 (intimate tabletop diorama curve)
 *   • Iron Foundry: R = 900 (cavernous industrial warehouse floor)
 *   • Dust & Daguerreotype: R = 1200 (wide-open frontier prairie horizon)
 */

import { create } from 'zustand';
import {
  getCitadelSettings,
  updateCitadelSettings,
  type WorldLookId,
} from '../settings/citadelSettings';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';

export type { WorldLookId };

export interface WorldLookInfo {
  id: WorldLookId;
  name: string;
  tagline: string;
  /** CSS gradient used for the preview tile in the settings menu. */
  preview: string;
  /** Bespoke planetary curvature radius (in world units) tailored for this aesthetic. */
  curvatureRadius: number;
  /** Synaptic Vault archetype title mapped to this aesthetic. */
  archetypeTitle: string;
}

export const WORLD_LOOK_CURVATURE: Record<WorldLookId, number> = {
  wireframe: 120,
  dream: 180,
  comic: 150,
  acid: 60,
  minimal: 2000,
  papercraft: 160,
  industrial: 900,
  western: 1200,
  crt: 140,
  ukiyoe: 240,
  cathedral: 500,
  blueprint: 1000,
  biolume: 90,
  kintsugi: 300,
  solarpunk: 220,
  noir: 600,
};

export const WORLD_LOOKS: readonly WorldLookInfo[] = [
  {
    id: 'wireframe',
    name: 'Neon Wireframe',
    tagline: 'Glowing wire on the indigo void. The original (R=120).',
    preview: 'linear-gradient(160deg, #06050d 0%, #1b0b3a 55%, #3ff0ff 140%)',
    curvatureRadius: 120,
    archetypeTitle: 'The Systems Architect',
  },
  {
    id: 'dream',
    name: 'Dream',
    tagline: 'A soft painted storybook: pastel haze, brush strokes, sparkle dust (R=180).',
    preview: 'linear-gradient(160deg, #a99bd6 0%, #f2b8d6 50%, #b9e08a 100%)',
    curvatureRadius: 180,
    archetypeTitle: 'The Empathic Idealist',
  },
  {
    id: 'comic',
    name: 'Pulp Comic',
    tagline: 'Bold India-ink outlines, Ben-Day halftone dots & four-color action panels (R=150).',
    preview: 'linear-gradient(155deg, #ffe600 0%, #ff2a55 52%, #00d4ff 100%)',
    curvatureRadius: 150,
    archetypeTitle: 'The Kinetic Dynamo',
  },
  {
    id: 'acid',
    name: 'Acid Trip',
    tagline: 'Disorienting R=60 micro-planetoid with kaleidoscopic mandalas & breathing prisms.',
    preview: 'linear-gradient(135deg, #ff007f 0%, #7928ca 35%, #00f0ff 70%, #39ff14 100%)',
    curvatureRadius: 60,
    archetypeTitle: 'The Chaos Alchemist',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Vast R=2000 horizon, a black void, one white light for you, and only the altar.',
    preview: 'radial-gradient(circle at 50% 55%, #ffffff 0%, #8a8a99 9%, #000000 55%)',
    curvatureRadius: 2000,
    archetypeTitle: 'The Essentialist Monk',
  },
  {
    id: 'papercraft',
    name: 'Tactile Papercraft',
    tagline: 'Folded origami trees, layered construction-paper cliffs & tabletop diorama charm (R=160).',
    preview: 'linear-gradient(150deg, #f6ead4 0%, #e07a5f 48%, #3d405b 100%)',
    curvatureRadius: 160,
    archetypeTitle: 'The Craft Tactician',
  },
  {
    id: 'industrial',
    name: 'Iron Foundry',
    tagline: 'Harsh brutalist warehouse, sodium-vapor cages, rusted steel & furnace sparks (R=900).',
    preview: 'linear-gradient(155deg, #111317 0%, #382214 55%, #ff6b00 100%)',
    curvatureRadius: 900,
    archetypeTitle: 'The Rugged Pragmatist',
  },
  {
    id: 'western',
    name: 'Dust & Daguerreotype',
    tagline: 'Old Western sepia frontier, burnt lens vignette, weathered timber & desert mesas (R=1200).',
    preview: 'linear-gradient(160deg, #2b1d12 0%, #8c6239 52%, #e6ccb2 100%)',
    curvatureRadius: 1200,
    archetypeTitle: 'The Frontier Stoic',
  },
  {
    id: 'crt',
    name: 'CRT Phosphor',
    tagline: 'Curved P31 phosphor green terminal, scanlines, barrel glass & floating data obelisks (R=140).',
    preview: 'linear-gradient(160deg, #020a04 0%, #063b16 55%, #22ff66 100%)',
    curvatureRadius: 140,
    archetypeTitle: 'The Logic Hacker',
  },
  {
    id: 'ukiyoe',
    name: 'Ukiyo-e Woodblock',
    tagline: 'Washi mulberry paper, Prussian-blue Great Waves, vermilion sun & floating lanterns (R=240).',
    preview: 'linear-gradient(160deg, #f4ebd9 0%, #1d3557 55%, #e63946 100%)',
    curvatureRadius: 240,
    archetypeTitle: 'The Poetic Harmonizer',
  },
  {
    id: 'cathedral',
    name: 'Stained Cathedral',
    tagline: 'Jewel-toned leaded glass rose windows, gothic ribbed vaults & golden incense motes (R=500).',
    preview: 'linear-gradient(155deg, #100826 0%, #6d1b7b 48%, #ffb703 100%)',
    curvatureRadius: 500,
    archetypeTitle: 'The Visionary Mentor',
  },
  {
    id: 'blueprint',
    name: 'Blueprint Atelier',
    tagline: 'Prussian cyanotype drafting table, white chalk gridlines, callout ticks & astrolabes (R=1000).',
    preview: 'linear-gradient(160deg, #072247 0%, #0f4c81 55%, #e0f4ff 100%)',
    curvatureRadius: 1000,
    archetypeTitle: 'The Master Planner',
  },
  {
    id: 'biolume',
    name: 'Biolume Abyss',
    tagline: 'Deep-sea R=90 trench, caustic ripples, glowing coral spires & drifting jellyfish (R=90).',
    preview: 'linear-gradient(160deg, #020818 0%, #053c5e 52%, #00f5d4 100%)',
    curvatureRadius: 90,
    archetypeTitle: 'The Deep Mystic',
  },
  {
    id: 'kintsugi',
    name: 'Gilded Kintsugi',
    tagline: 'Dark obsidian & ceramic flagstones mended with glowing veins of molten 24k gold (R=300).',
    preview: 'linear-gradient(160deg, #121114 0%, #2b262c 55%, #ffd166 100%)',
    curvatureRadius: 300,
    archetypeTitle: 'The Resilient Healer',
  },
  {
    id: 'solarpunk',
    name: 'Solarpunk Glasshouse',
    tagline: 'Sunlit Art-Nouveau botanical conservatory, terraced emerald moss & brass wind-harps (R=220).',
    preview: 'linear-gradient(155deg, #1b4332 0%, #52b788 50%, #ffd166 100%)',
    curvatureRadius: 220,
    archetypeTitle: 'The Radiant Catalyst',
  },
  {
    id: 'noir',
    name: 'Velvet Noir',
    tagline: 'High-contrast silver chiaroscuro, rain-slicked cobbles, Venetian blinds & crimson neon (R=600).',
    preview: 'linear-gradient(160deg, #050507 0%, #22222b 58%, #e6193c 100%)',
    curvatureRadius: 600,
    archetypeTitle: 'The Night Seeker',
  },
];

export interface SynapticWorldSlot {
  slot: number;
  title: string;
  archetype: string;
  cognitiveCode: string; // E.g. 'I·N·T·J' / 'Inward · Pattern · Principle · Structured'
  subtitle: string;
  curvatureRadius: number;
  lookId?: WorldLookId;
}

/**
 * The complete 16-Slot Master Roster mapping every Synaptic Vault 4-axis
 * Cognitive Continua combination to its signature World Style Pack and curvature.
 */
export const SYNAPTIC_WORLD_SLOTS: readonly SynapticWorldSlot[] = [
  {
    slot: 1,
    title: 'Neon Wireframe',
    archetype: 'The Systems Architect',
    cognitiveCode: 'Inward · Pattern · Principle · Structured',
    subtitle: 'Glowing vector geometry on an indigo void',
    curvatureRadius: 120,
    lookId: 'wireframe',
  },
  {
    slot: 2,
    title: 'Dream',
    archetype: 'The Empathic Idealist',
    cognitiveCode: 'Inward · Pattern · People · Adaptive',
    subtitle: 'Soft painted storybook · pastel haze, brushstrokes & sparkles',
    curvatureRadius: 180,
    lookId: 'dream',
  },
  {
    slot: 3,
    title: 'Pulp Comic',
    archetype: 'The Kinetic Dynamo',
    cognitiveCode: 'Outward · Concrete · People · Adaptive',
    subtitle: 'Halftone Ben-Day dots, bold India-ink & action bursts',
    curvatureRadius: 150,
    lookId: 'comic',
  },
  {
    slot: 4,
    title: 'Acid Trip',
    archetype: 'The Chaos Alchemist',
    cognitiveCode: 'Outward · Pattern · Principle · Adaptive',
    subtitle: 'Disorienting R=60 mandalas, breathing oil-slick & glowing mushrooms',
    curvatureRadius: 60,
    lookId: 'acid',
  },
  {
    slot: 5,
    title: 'Minimal',
    archetype: 'The Essentialist Monk',
    cognitiveCode: 'Inward · Concrete · Principle · Structured',
    subtitle: 'Vast R=2000 black void, one white light & only the altar',
    curvatureRadius: 2000,
    lookId: 'minimal',
  },
  {
    slot: 6,
    title: 'Tactile Papercraft',
    archetype: 'The Craft Tactician',
    cognitiveCode: 'Inward · Concrete · People · Adaptive',
    subtitle: 'Folded origami sanctuary, layered cardstock & stop-motion charm',
    curvatureRadius: 160,
    lookId: 'papercraft',
  },
  {
    slot: 7,
    title: 'Iron Foundry',
    archetype: 'The Rugged Pragmatist',
    cognitiveCode: 'Inward · Concrete · Principle · Adaptive',
    subtitle: 'Harsh industrial warehouse, sodium-vapor glare & welding sparks',
    curvatureRadius: 900,
    lookId: 'industrial',
  },
  {
    slot: 8,
    title: 'Dust & Daguerreotype',
    archetype: 'The Frontier Stoic',
    cognitiveCode: 'Outward · Concrete · Principle · Structured',
    subtitle: 'Old Western sepia filter, burnt vignette & sun-bleached mesas',
    curvatureRadius: 1200,
    lookId: 'western',
  },
  {
    slot: 9,
    title: 'CRT Phosphor',
    archetype: 'The Logic Hacker',
    cognitiveCode: 'Inward · Pattern · Principle · Adaptive',
    subtitle: 'Curved monochrome green/amber terminal scanlines & dithered shadow',
    curvatureRadius: 140,
    lookId: 'crt',
  },
  {
    slot: 10,
    title: 'Ukiyo-e Woodblock',
    archetype: 'The Poetic Harmonizer',
    cognitiveCode: 'Inward · Concrete · People · Structured',
    subtitle: 'Carved woodgrain paper, Prussian-blue waves & vermilion sun',
    curvatureRadius: 240,
    lookId: 'ukiyoe',
  },
  {
    slot: 11,
    title: 'Stained Cathedral',
    archetype: 'The Visionary Mentor',
    cognitiveCode: 'Outward · Pattern · People · Structured',
    subtitle: 'Jewel-toned leaded glass arches & volumetric sunbeam motes',
    curvatureRadius: 500,
    lookId: 'cathedral',
  },
  {
    slot: 12,
    title: 'Blueprint Atelier',
    archetype: 'The Master Planner',
    cognitiveCode: 'Outward · Pattern · Principle · Structured',
    subtitle: 'Prussian cyanotype paper, chalk drafting lines & compass arcs',
    curvatureRadius: 1000,
    lookId: 'blueprint',
  },
  {
    slot: 13,
    title: 'Biolume Abyss',
    archetype: 'The Deep Mystic',
    cognitiveCode: 'Inward · Pattern · People · Structured',
    subtitle: 'Tranquil midnight-blue sea canyon & drifting jellyfish lanterns',
    curvatureRadius: 90,
    lookId: 'biolume',
  },
  {
    slot: 14,
    title: 'Gilded Kintsugi',
    archetype: 'The Resilient Healer',
    cognitiveCode: 'Outward · Concrete · People · Structured',
    subtitle: 'Raw charcoal sketch textures mended with molten 24k gold seams',
    curvatureRadius: 300,
    lookId: 'kintsugi',
  },
  {
    slot: 15,
    title: 'Solarpunk Glasshouse',
    archetype: 'The Radiant Catalyst',
    cognitiveCode: 'Outward · Pattern · People · Adaptive',
    subtitle: 'Sunlit Art-Nouveau botanical conservatory & spinning brass turbines',
    curvatureRadius: 220,
    lookId: 'solarpunk',
  },
  {
    slot: 16,
    title: 'Velvet Noir',
    archetype: 'The Night Seeker',
    cognitiveCode: 'Outward · Concrete · Principle · Adaptive',
    subtitle: 'Stark chiaroscuro rain, Venetian blind shadows & crimson neon',
    curvatureRadius: 600,
    lookId: 'noir',
  },
];

/** Total number of aesthetics the Citadel is designed to hold. */
export const WORLD_LOOK_SLOT_COUNT = 16;

export function getCurvatureForLook(look: WorldLookId): number {
  return WORLD_LOOK_CURVATURE[look] ?? 120;
}

/**
 * Resolve which of the 16 Synaptic World Slots a player unlocks from their
 * Synaptic Vault calibration (4-axis cognitive style + Big-Five tiebreakers).
 */
export function resolveUnlockedWorldSlot(params: {
  energy?: 'inward' | 'outward' | 'balanced';
  perception?: 'concrete' | 'pattern' | 'balanced';
  decision?: 'principle' | 'people' | 'balanced';
  rhythm?: 'structured' | 'adaptive' | 'balanced';
  oMean?: number;
  cMean?: number;
  eMean?: number;
  aMean?: number;
}): SynapticWorldSlot {
  const isOutward =
    params.energy === 'outward' ||
    (params.energy === 'balanced' && (params.eMean ?? 3) >= 3.2);
  const isPattern =
    params.perception === 'pattern' ||
    (params.perception === 'balanced' && (params.oMean ?? 3) >= 3.2);
  const isPeople =
    params.decision === 'people' ||
    (params.decision === 'balanced' && (params.aMean ?? 3) >= 3.2);
  const isAdaptive =
    params.rhythm === 'adaptive' ||
    (params.rhythm === 'balanced' && (params.cMean ?? 3) < 3.2);

  const code = `${isOutward ? 'Outward' : 'Inward'} · ${isPattern ? 'Pattern' : 'Concrete'} · ${
    isPeople ? 'People' : 'Principle'
  } · ${isAdaptive ? 'Adaptive' : 'Structured'}`;

  return (
    SYNAPTIC_WORLD_SLOTS.find((s) => s.cognitiveCode === code) ?? SYNAPTIC_WORLD_SLOTS[0]
  );
}

interface WorldLookState {
  look: WorldLookId;
  setLook: (look: WorldLookId) => void;
}

const initialLook = getCitadelSettings().worldLook;
// Ensure initial curvature matches the stored look right on boot
try {
  useVillageTunerStore.getState().setCurvatureRadius(getCurvatureForLook(initialLook));
} catch {
  // ignore if store not yet initialized
}

export const useWorldLook = create<WorldLookState>((set) => ({
  look: initialLook,
  setLook: (look) => {
    updateCitadelSettings({ worldLook: look });
    useVillageTunerStore.getState().setCurvatureRadius(getCurvatureForLook(look));
    set({ look });
  },
}));

export function getWorldLook(): WorldLookId {
  return useWorldLook.getState().look;
}
