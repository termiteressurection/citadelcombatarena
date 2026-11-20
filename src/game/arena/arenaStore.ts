import { create } from 'zustand';
import type { LimbKey, Limbs } from './combat';

export type Phase = 'intro' | 'fight' | 'victory' | 'defeat' | 'draft' | 'champion';
export type LimbHud = Record<LimbKey, { r: number; s: boolean }>;

export function fullLimbHud(): LimbHud {
  return {
    head: { r: 1, s: false },
    torso: { r: 1, s: false },
    armL: { r: 1, s: false },
    armR: { r: 1, s: false },
    legL: { r: 1, s: false },
    legR: { r: 1, s: false },
  };
}

export function toLimbHud(limbs: Limbs): LimbHud {
  const f = (l: { hp: number; max: number; severed: boolean }) => ({
    r: Math.round((l.hp / (l.max || 1)) * 100) / 100,
    s: l.severed,
  });
  return {
    head: f(limbs.head),
    torso: f(limbs.torso),
    armL: f(limbs.armL),
    armR: f(limbs.armR),
    legL: f(limbs.legL),
    legR: f(limbs.legR),
  };
}

export interface EnemyBar { id: number; name: string; hp: number; max: number; limbs: LimbHud }
export interface Callout { text: string; color: string; id: number }

interface ArenaHud {
  phase: Phase; bout: number; hp: number; maxHp: number; st: number; maxSt: number;
  playerLimbs: LimbHud; enemies: EnemyBar[];
  boons: string[]; draft: string[]; carryHp: number; carryMax: number; earned: number;
  lockedName: string | null; combo: number; callout: Callout | null;
  set: (p: Partial<ArenaHud>) => void;
  startRun: () => void;
  pick: (id: string) => void;
}

const fresh = {
  phase: 'intro' as Phase, bout: 1, hp: 100, maxHp: 100, st: 100, maxSt: 100,
  playerLimbs: fullLimbHud(), enemies: [] as EnemyBar[],
  boons: [] as string[], draft: [] as string[], carryHp: 0, carryMax: 0, earned: 0,
  lockedName: null as string | null, combo: 0, callout: null as Callout | null,
};

export const useArena = create<ArenaHud>((set, get) => ({
  ...fresh,
  set: (p) => set(p),
  startRun: () => set({ ...fresh, playerLimbs: fullLimbHud() }),
  /** Take one Fate boon, lose the other two, and move on to the next bout. */
  pick: (id) => {
    const s = get();
    if (!s.draft.includes(id)) return;
    set({ boons: [...s.boons, id], draft: [], bout: s.bout + 1, phase: 'intro', callout: null, combo: 0, playerLimbs: fullLimbHud() });
  },
}));
