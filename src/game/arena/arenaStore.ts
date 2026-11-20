import { create } from 'zustand';

export type Phase = 'intro' | 'fight' | 'victory' | 'defeat';
export interface EnemyBar { id: number; name: string; hp: number; max: number }
interface ArenaHud {
  phase: Phase; bout: number; hp: number; maxHp: number; st: number; maxSt: number; enemies: EnemyBar[]; banner: string;
  set: (p: Partial<ArenaHud>) => void;
}
export const useArena = create<ArenaHud>((set) => ({
  phase: 'intro', bout: 1, hp: 100, maxHp: 100, st: 100, maxSt: 100, enemies: [], banner: '',
  set: (p) => set(p),
}));
