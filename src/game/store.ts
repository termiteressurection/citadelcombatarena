import { create } from 'zustand';
import type { StationId } from './world/layout';

export type Scene = 'ludus' | 'arena';
export interface Fallen { name: string; bouts: number; cause: string; date: string }
interface Save { glory: number; unlocks: string[]; fallen: Fallen[] }

const KEY = 'boneyard.save.v1';
const blank = (): Save => ({ glory: 0, unlocks: ['sword', 'shield'], fallen: [] });

export function loadSave(): Save {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return blank();
    const p = JSON.parse(raw);
    return {
      glory: Number.isFinite(p.glory) ? p.glory : 0,
      unlocks: Array.isArray(p.unlocks) ? p.unlocks.filter((u: unknown) => typeof u === 'string') : blank().unlocks,
      fallen: Array.isArray(p.fallen) ? p.fallen.slice(-50) : [],
    };
  } catch { return blank(); }
}
function persist(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

interface GameState extends Save {
  scene: Scene;
  panel: StationId | null;
  near: StationId | null;
  setNear: (id: StationId | null) => void;
  openPanel: (id: StationId | null) => void;
  setScene: (s: Scene) => void;
  recordDeath: (f: Fallen) => void;
  addGlory: (n: number) => void;
}

export const useGame = create<GameState>((set, get) => ({
  ...loadSave(),
  scene: typeof location !== 'undefined' && location.search.includes('arena') ? 'arena' : 'ludus',
  panel: null,
  near: null,
  setNear: (near) => { if (get().near !== near) set({ near }); },
  openPanel: (panel) => set({ panel }),
  setScene: (scene) => set({ scene, panel: null, near: null }),
  recordDeath: (f) => {
    const fallen = [...get().fallen, f].slice(-50);
    set({ fallen });
    persist({ glory: get().glory, unlocks: get().unlocks, fallen });
  },
  addGlory: (n) => {
    const glory = Math.max(0, get().glory + n);
    set({ glory });
    persist({ glory, unlocks: get().unlocks, fallen: get().fallen });
  },
}));
