import { create } from 'zustand';
import {
  type BitTempo,
  type BitSociability,
  type BitHomeRange,
  type BitMood,
  type BitQuirk,
} from '@/arboretum/components/citadel-rebuilt/world/village/bitTraits';

export type SeasonVariant = 'spring' | 'summer' | 'autumn' | 'winter';

export type NpcTypeFilter =
  | 'all'
  | 'year'
  | 'season'
  | 'month'
  | 'day'
  | 'mindmap'
  | 'season-spring'
  | 'season-summer'
  | 'season-autumn'
  | 'season-winter'
  | 'month-1'
  | 'month-2'
  | 'month-3'
  | 'month-4'
  | 'month-5'
  | 'month-6'
  | 'month-7'
  | 'month-8'
  | 'month-9'
  | 'month-10'
  | 'month-11'
  | 'month-12';

export interface DensityCurveSettings {
  rMax: number;       // default 900 (extended border)
  coreMax: number;    // default 135 (proportional 1.5x)
  rampMax: number;    // default 333 (proportional 1.5x)
  plateauMax: number; // default 522 (proportional 1.5x)
  fadeMax: number;    // default 747 (proportional 1.5x)
}

export const DEFAULT_DENSITY_CURVE: DensityCurveSettings = {
  rMax: 900,
  coreMax: 135,
  rampMax: 333,
  plateauMax: 522,
  fadeMax: 747,
};

export interface TraitFilters {
  tempo: BitTempo | 'all';
  sociability: BitSociability | 'all';
  homeRange: BitHomeRange | 'all';
  mood: BitMood | 'all';
  quirk: BitQuirk | 'all';
}

export const DEFAULT_TRAIT_FILTERS: TraitFilters = {
  tempo: 'all',
  sociability: 'all',
  homeRange: 'all',
  mood: 'all',
  quirk: 'all',
};

export interface PlayerZoneInfo {
  r: number;
  t: number;
  zoneName: string;
}

export interface InspectedBitTelemetry {
  id: string;
  caste: string;
  preferredArea: string;
  currentZone: string;
  distFromSpawn: number;
  state: 'Preferred' | 'Travelling' | 'Curious Excursion' | 'Quirk' | 'Gathering' | 'Greeting';
  waypoint: [number, number];
  speed: number;
}

export function getZoneName(r: number, curve: DensityCurveSettings = DEFAULT_DENSITY_CURVE): string {
  if (r >= curve.rMax) return 'Edge Boundary [Error null]';
  if (r >= curve.fadeMax) return 'Zone 5: Barren Rim (Silence)';
  if (r >= curve.plateauMax) return 'Zone 4: Fade-out';
  if (r >= curve.rampMax) return 'Zone 3: Dense Plateau (Peak Wild)';
  if (r >= curve.coreMax) return 'Zone 2: Ramp-up (Outskirts)';
  return 'Zone 1: Town Core';
}

export interface VillageTunerState {
  enabled: boolean;
  simulatedNpcCount: number | null;
  typeFilter: NpcTypeFilter;
  collidersVisible: boolean;
  collidersEnabled: boolean;
  keepClearZonesVisible: boolean;
  labelsVisible: boolean;
  hedgeDensity: number;
  bambooDensity: number;
  cottageVariant: number;
  sizeBandHighlight: boolean;
  tunerOpen: boolean;
  fps: number;
  drawCalls: number;
  inspectedNpcId: string | null;

  // Dispersed Overworld & Edge Boundary Controls
  densityCurve: DensityCurveSettings;
  edgeModalOpen: boolean;
  playerZoneInfo: PlayerZoneInfo;

  // Player Atlas Chunks & Streaming Telemetry
  atlasGridVisible: boolean;
  loadedChunkCount: number;
  chunksLoadedPerTick: number;

  // Curiosity Excursions & Free-Roam
  excursionProbability: number;
  scatterBitsTrigger: number;
  inspectedBitTelemetry: InspectedBitTelemetry | null;

  // Trait Filtering
  traitFilters: TraitFilters;

  // Live Planetary Curvature Control (Judging Tool)
  curvatureRadius: number;
  setCurvatureRadius: (radius: number) => void;

  setSimulatedNpcCount: (count: number | null) => void;
  setTypeFilter: (filter: NpcTypeFilter) => void;
  setCollidersVisible: (visible: boolean) => void;
  setCollidersEnabled: (enabled: boolean) => void;
  setKeepClearZonesVisible: (visible: boolean) => void;
  setLabelsVisible: (visible: boolean) => void;
  setHedgeDensity: (density: number) => void;
  setBambooDensity: (density: number) => void;
  cycleCottageVariant: () => void;
  setSizeBandHighlight: (highlight: boolean) => void;
  setTunerOpen: (open: boolean) => void;
  toggleTunerOpen: () => void;
  setPerformanceMetrics: (fps: number, drawCalls: number) => void;
  setInspectedNpcId: (id: string | null) => void;
  toggleInspectNpc: (id: string) => void;

  setDensityCurve: (curve: Partial<DensityCurveSettings>) => void;
  resetDensityCurve: () => void;
  setEdgeModalOpen: (open: boolean) => void;
  setPlayerZoneInfo: (info: PlayerZoneInfo) => void;

  setAtlasGridVisible: (visible: boolean) => void;
  setLoadedChunkCount: (count: number) => void;
  setChunksLoadedPerTick: (count: number) => void;

  setExcursionProbability: (prob: number) => void;
  triggerScatterBitsWorldWide: () => void;
  setInspectedBitTelemetry: (telemetry: InspectedBitTelemetry | null) => void;

  setTraitFilter: <K extends keyof TraitFilters>(category: K, value: TraitFilters[K]) => void;
  clearTraitFilters: () => void;

  resetVillageOverrides: () => void;
}

export const useVillageTunerStore = create<VillageTunerState>((set) => ({
  enabled: false,
  simulatedNpcCount: null,
  typeFilter: 'all',
  collidersVisible: false,
  collidersEnabled: false,
  keepClearZonesVisible: false,
  labelsVisible: false,
  hedgeDensity: 1.0,
  bambooDensity: 1.0,
  cottageVariant: 0,
  sizeBandHighlight: false,
  tunerOpen: false,
  fps: 60,
  drawCalls: 0,
  inspectedNpcId: null,

  densityCurve: { ...DEFAULT_DENSITY_CURVE },
  edgeModalOpen: false,
  playerZoneInfo: { r: 12, t: 12 / 900, zoneName: 'Zone 1: Town Core' },

  curvatureRadius: 120.0,
  setCurvatureRadius: (curvatureRadius) => set({ curvatureRadius }),

  atlasGridVisible: false,
  loadedChunkCount: 0,
  chunksLoadedPerTick: 0,

  excursionProbability: 0.30,
  scatterBitsTrigger: 0,
  inspectedBitTelemetry: null,

  traitFilters: { ...DEFAULT_TRAIT_FILTERS },

  setSimulatedNpcCount: (count) =>
    set({
      simulatedNpcCount: count,
      enabled: count !== null,
    }),

  setTypeFilter: (filter) =>
    set({
      typeFilter: filter,
      enabled: true,
    }),

  setCollidersVisible: (collidersVisible) => set({ collidersVisible }),
  setCollidersEnabled: (collidersEnabled) => set({ collidersEnabled }),
  setKeepClearZonesVisible: (keepClearZonesVisible) => set({ keepClearZonesVisible }),
  setLabelsVisible: (labelsVisible) => set({ labelsVisible }),
  setHedgeDensity: (hedgeDensity) => set({ hedgeDensity }),
  setBambooDensity: (bambooDensity) => set({ bambooDensity }),
  cycleCottageVariant: () => set((s) => ({ cottageVariant: (s.cottageVariant + 1) % 4 })),
  setSizeBandHighlight: (sizeBandHighlight) => set({ sizeBandHighlight }),
  setTunerOpen: (tunerOpen) => set({ tunerOpen }),
  toggleTunerOpen: () => set((s) => ({ tunerOpen: !s.tunerOpen })),
  setPerformanceMetrics: (fps, drawCalls) => set({ fps, drawCalls }),

  setInspectedNpcId: (id) => set({ inspectedNpcId: id }),
  toggleInspectNpc: (id) =>
    set((s) => ({ inspectedNpcId: s.inspectedNpcId === id ? null : id })),

  setDensityCurve: (curve) =>
    set((s) => ({ densityCurve: { ...s.densityCurve, ...curve } })),
  resetDensityCurve: () => set({ densityCurve: { ...DEFAULT_DENSITY_CURVE } }),
  setEdgeModalOpen: (edgeModalOpen) => set({ edgeModalOpen }),
  setPlayerZoneInfo: (playerZoneInfo) => set({ playerZoneInfo }),

  setAtlasGridVisible: (atlasGridVisible) => set({ atlasGridVisible }),
  setLoadedChunkCount: (loadedChunkCount) => set({ loadedChunkCount }),
  setChunksLoadedPerTick: (chunksLoadedPerTick) => set({ chunksLoadedPerTick }),

  setExcursionProbability: (excursionProbability) => set({ excursionProbability }),
  triggerScatterBitsWorldWide: () =>
    set((s) => ({ scatterBitsTrigger: s.scatterBitsTrigger + 1 })),
  setInspectedBitTelemetry: (inspectedBitTelemetry) => set({ inspectedBitTelemetry }),

  setTraitFilter: (category, value) =>
    set((s) => ({
      traitFilters: { ...s.traitFilters, [category]: value },
    })),
  clearTraitFilters: () => set({ traitFilters: { ...DEFAULT_TRAIT_FILTERS } }),

  resetVillageOverrides: () =>
    set({
      enabled: false,
      simulatedNpcCount: null,
      typeFilter: 'all',
      collidersVisible: false,
      collidersEnabled: true,
      keepClearZonesVisible: false,
      labelsVisible: false,
      hedgeDensity: 1.0,
      bambooDensity: 1.0,
      sizeBandHighlight: false,
      inspectedNpcId: null,
      densityCurve: { ...DEFAULT_DENSITY_CURVE },
      edgeModalOpen: false,
      curvatureRadius: 120.0,
      atlasGridVisible: false,
      excursionProbability: 0.30,
      inspectedBitTelemetry: null,
      traitFilters: { ...DEFAULT_TRAIT_FILTERS },
    }),
}));

export function resetVillageDebugOverrides(): void {
  useVillageTunerStore.getState().resetVillageOverrides();
}
