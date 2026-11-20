import { defaultMods, type Mods } from '../arena/combat';
import type { ResolvedGear } from './items';

export type StatKey = 'vit' | 'str' | 'agi' | 'end' | 'tec';
export const STAT_KEYS: readonly StatKey[] = ['vit', 'str', 'agi', 'end', 'tec'];

export interface RpgStats {
  vit: number;
  str: number;
  agi: number;
  end: number;
  tec: number;
}

export const DEFAULT_STATS: RpgStats = { vit: 1, str: 1, agi: 1, end: 1, tec: 1 };

export const STAT_INFO: Record<StatKey, { label: string; short: string; desc: string; color: string }> = {
  vit: { label: 'VITALITY', short: 'VIT', desc: '+14 Max HP & limb durability per point', color: '#ff4f6d' },
  str: { label: 'STRENGTH', short: 'STR', desc: '+6% weapon & heavy damage per point', color: '#ff8a3d' },
  agi: { label: 'AGILITY', short: 'AGI', desc: '+3.5% move speed & cheaper dodges', color: '#4dffa0' },
  end: { label: 'ENDURANCE', short: 'END', desc: '+10 Max Stamina & +8% stamina regen', color: '#3ff0ff' },
  tec: { label: 'TECHNIQUE', short: 'TEC', desc: 'Wider parry window & harder Ripostes', color: '#ffc95c' },
};

export function xpForNextLevel(level: number): number {
  return Math.round(50 * Math.pow(Math.max(1, level), 1.35));
}

export function applyXp(
  level: number,
  xp: number,
  statPoints: number,
  gain: number,
): { level: number; xp: number; statPoints: number; levelsGained: number } {
  let lv = Math.max(1, level);
  let curXp = Math.max(0, xp + Math.max(0, Math.round(gain)));
  let pts = Math.max(0, statPoints);
  let levelsGained = 0;
  while (curXp >= xpForNextLevel(lv)) {
    curXp -= xpForNextLevel(lv);
    lv += 1;
    pts += 3;
    levelsGained += 1;
  }
  return { level: lv, xp: curXp, statPoints: pts, levelsGained };
}

export interface FameRank { name: string; min: number; color: string }
export const FAME_RANKS: FameRank[] = [
  { name: 'RECRUIT', min: 0, color: '#cfc6e8' },
  { name: 'PIT FIGHTER', min: 60, color: '#3ff0ff' },
  { name: 'BLOODED', min: 150, color: '#4dffa0' },
  { name: 'CROWD FAVORITE', min: 300, color: '#ffc95c' },
  { name: 'GLADIATOR', min: 550, color: '#ff8a3d' },
  { name: 'CHAMPION', min: 900, color: '#ff4fd8' },
  { name: 'LIVING LEGEND', min: 1400, color: '#ffe57f' },
];

export function fameRankOf(fame: number): FameRank {
  let rank = FAME_RANKS[0];
  for (const r of FAME_RANKS) if (fame >= r.min) rank = r;
  return rank;
}

export function nextFameRankOf(fame: number): FameRank | null {
  return FAME_RANKS.find((r) => r.min > fame) ?? null;
}

export type DailyBuffId = 'honey_bread' | 'iron_wine' | 'whetstone_oil';
export type ConsumableId = 'healing_flask' | DailyBuffId;
export const MAX_FLASKS = 3;

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  desc: string;
  cost: number;
  color: string;
  kind: 'flask' | 'buff';
}

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'healing_flask', name: 'HEALING FLASK [H]', desc: 'Drink in combat to mend 45% HP & bruised limbs (max 3 carried).', cost: 20, color: '#4dffa0', kind: 'flask' },
  { id: 'honey_bread', name: 'ROMAN HONEY BREAD', desc: 'Today only: +25 Max Health before your next sleep.', cost: 25, color: '#ffc95c', kind: 'buff' },
  { id: 'iron_wine', name: 'SPICED IRON WINE', desc: 'Today only: +25% Stamina Recovery in the sand.', cost: 30, color: '#3ff0ff', kind: 'buff' },
  { id: 'whetstone_oil', name: 'WHETSTONE BLADE OIL', desc: 'Today only: +15% Attack Damage across all bouts.', cost: 35, color: '#ff6b6b', kind: 'buff' },
];

export function buildPlayerMods(
  stats: RpgStats,
  gear: ResolvedGear,
  buffs: DailyBuffId[],
  boonMods?: Mods,
): Mods {
  const m = boonMods ? { ...boonMods } : defaultMods();
  const vit = Math.max(0, stats.vit - 1);
  const str = Math.max(0, stats.str - 1);
  const agi = Math.max(0, stats.agi - 1);
  const end = Math.max(0, stats.end - 1);
  const tec = Math.max(0, stats.tec - 1);

  m.maxHp += vit * 14 + gear.bonusHp + (buffs.includes('honey_bread') ? 25 : 0);
  m.dmg += str * 0.06 + (buffs.includes('whetstone_oil') ? 0.15 : 0);
  m.speed += Math.min(0.38, agi * 0.035);
  m.dodgeCost += Math.min(10, Math.round(agi * 1.2));
  m.maxStamina += end * 10;
  m.stamRegen += end * 0.08 + (buffs.includes('iron_wine') ? 0.25 : 0);
  m.parryWindow += Math.min(0.12, tec * 0.015);
  m.riposteBonus = (m.riposteBonus ?? 0) + Math.min(0.45, tec * 0.03);
  m.glory *= gear.fameMul;
  return m;
}
