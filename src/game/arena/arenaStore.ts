import { create } from 'zustand';

export type Phase = 'intro' | 'fight' | 'victory' | 'defeat' | 'draft' | 'champion';
export interface EnemyBar { id: number; name: string; hp: number; max: number }
interface ArenaHud {
  phase: Phase; bout: number; hp: number; maxHp: number; st: number; maxSt: number; enemies: EnemyBar[];
  boons: string[]; draft: string[]; carryHp: number; carryMax: number; earned: number;
  set: (p: Partial<ArenaHud>) => void;
  startRun: () => void;
  pick: (id: string) => void;
}
const fresh = { phase: 'intro' as Phase, bout: 1, hp: 100, maxHp: 100, st: 100, maxSt: 100, enemies: [] as EnemyBar[], boons: [] as string[], draft: [] as string[], carryHp: 0, carryMax: 0, earned: 0 };
export const useArena = create<ArenaHud>((set, get) => ({
  ...fresh,
  set: (p) => set(p),
  startRun: () => set({ ...fresh }),
  /** Take one Fate boon, lose the other two, and move on to the next bout. */
  pick: (id) => { const s = get(); if (!s.draft.includes(id)) return; set({ boons: [...s.boons, id], draft: [], bout: s.bout + 1, phase: 'intro' }); },
}));
