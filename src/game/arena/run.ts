import type { Kind } from './combat';

/** The championship ladder. The last bout is the Champion. */
export const LADDER: Kind[][] = [
  ['skirmisher'],
  ['skirmisher', 'skirmisher'],
  ['brute'],
  ['brute', 'skirmisher'],
  ['champion'],
];
export const rosterFor = (bout: number): Kind[] => LADDER[Math.min(LADDER.length, Math.max(1, bout)) - 1];
export const isFinalBout = (bout: number) => bout >= LADDER.length;
export const BOUT_HEAL = 0.3;
export const gloryForBout = (bout: number, mul: number) => Math.round(10 * bout * mul);
export const CHAMPION_BONUS = 100;
export const carryHp = (hp: number, maxHp: number) => Math.min(maxHp, Math.ceil(hp + maxHp * BOUT_HEAL));

export interface Look { id: string; name: string; color: string; cost: number }
export const LOOKS: Look[] = [
  { id: 'cyan', name: 'CYAN CREST', color: '#3ff0ff', cost: 0 },
  { id: 'gold', name: 'GILDED CREST', color: '#ffc95c', cost: 40 },
  { id: 'magenta', name: 'MAGENTA CREST', color: '#ff4fd8', cost: 80 },
  { id: 'emerald', name: 'EMERALD CREST', color: '#4dffa0', cost: 120 },
  { id: 'violet', name: 'VIOLET CREST', color: '#a78bfa', cost: 160 },
];
export const lookColor = (id: string) => LOOKS.find((l) => l.id === id)?.color ?? LOOKS[0].color;
