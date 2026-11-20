import { create } from 'zustand';
import type { StationId } from './world/layout';
import { LOOKS } from './arena/run';

export type Scene = 'ludus' | 'arena';
export interface Fallen { name: string; bouts: number; cause: string; date: string }
interface Save { glory: number; unlocks: string[]; fallen: Fallen[]; look: string; champions: number }

const KEY = 'boneyard.save.v1';
const blank = (): Save => ({ glory: 0, unlocks: ['cyan'], fallen: [], look: 'cyan', champions: 0 });

export function loadSave(): Save {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return blank();
    const p = JSON.parse(raw);
    const ids = new Set(LOOKS.map((l) => l.id));
    const unlocks: string[] = Array.isArray(p.unlocks) ? p.unlocks.filter((u: unknown) => typeof u === 'string' && ids.has(u)) : [];
    if (!unlocks.includes('cyan')) unlocks.unshift('cyan');
    return {
      glory: Number.isFinite(p.glory) ? p.glory : 0,
      unlocks,
      fallen: Array.isArray(p.fallen) ? p.fallen.slice(-50) : [],
      look: typeof p.look === 'string' && unlocks.includes(p.look) ? p.look : 'cyan',
      champions: Number.isFinite(p.champions) ? p.champions : 0,
    };
  } catch { return blank(); }
}

interface GameState extends Save {
  scene: Scene;
  panel: StationId | null;
  near: StationId | null;
  setNear: (id: StationId | null) => void;
  openPanel: (id: StationId | null) => void;
  setScene: (s: Scene) => void;
  recordDeath: (f: Fallen) => void;
  recordChampion: () => void;
  addGlory: (n: number) => void;
  buyLook: (id: string) => boolean;
  equipLook: (id: string) => void;
}

export const useGame = create<GameState>((set, get) => {
  const save = () => {
    const { glory, unlocks, fallen, look, champions } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ glory, unlocks, fallen, look, champions })); } catch { /* storage unavailable */ }
  };
  return {
    ...loadSave(),
    scene: typeof location !== 'undefined' && location.search.includes('arena') ? 'arena' : 'ludus',
    panel: null,
    near: null,
    setNear: (near) => { if (get().near !== near) set({ near }); },
    openPanel: (panel) => set({ panel }),
    setScene: (scene) => set({ scene, panel: null, near: null }),
    recordDeath: (f) => { set({ fallen: [...get().fallen, f].slice(-50) }); save(); },
    recordChampion: () => { set({ champions: get().champions + 1 }); save(); },
    addGlory: (n) => { set({ glory: Math.max(0, get().glory + n) }); save(); },
    buyLook: (id) => {
      const look = LOOKS.find((l) => l.id === id);
      const s = get();
      if (!look || s.unlocks.includes(id) || s.glory < look.cost) return false;
      set({ glory: s.glory - look.cost, unlocks: [...s.unlocks, id] });
      save();
      return true;
    },
    equipLook: (id) => { if (get().unlocks.includes(id)) { set({ look: id }); save(); } },
  };
});
