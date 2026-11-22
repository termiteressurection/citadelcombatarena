import type { LimbKey } from '../arena/combat';
import type { StyleId } from '../arena/styles';
import type { CapitalId } from '../world/universe';
import type { WeaponFamily } from './items';
import type { FightCard } from './quests';

export interface NemesisRival {
  id: string;
  name: string;
  title: string;
  colosseumId: CapitalId;
  style: StyleId;
  color: string;
  level: number;
  encounters: number;
  playerWins: number;
  rivalWins: number;
  cyberLimbs: Partial<Record<LimbKey, boolean>>;
  adaptedAgainst?: WeaponFamily;
  counterLabel?: string;
  grudgeBark: string;
}

export interface NemesisEncounterUpdate {
  victory: boolean;
  weaponFamily: WeaponFamily;
  severedLimbs: LimbKey[];
  executed?: boolean;
}

const COUNTER_GEAR: Record<WeaponFamily, { style: StyleId; label: string }> = {
  gladius: { style: 'murmillo', label: 'FIREWALL SCUTUM ANTI-BLADE' },
  spear: { style: 'retiarius', label: 'TRAP-NET ANTI-LANCE' },
  twinSica: { style: 'executioner', label: 'IRON CAGE ANTI-SICA' },
  warhammer: { style: 'dimachaerus', label: 'PHASE DODGE ANTI-MAUL' },
  trident: { style: 'hoplomachus', label: 'AEGIS SPEAR COUNTER' },
};

const SEED_RIVALS: Record<CapitalId, Omit<NemesisRival, 'encounters' | 'playerWins' | 'rivalWins' | 'cyberLimbs'>> = {
  cache_city: {
    id: 'nem_cache_city',
    name: 'CRIXUS_ROOT.SYS',
    title: 'Purge Grid Apex',
    colosseumId: 'cache_city',
    style: 'hoplomachus',
    color: '#ff4fd8',
    level: 1,
    grudgeBark: 'Your address belongs in the heap. Show me your edge on the Purge Grid!',
  },
  drift_bazaars: {
    id: 'nem_drift_bazaars',
    name: 'TORQUE_V8.TMP',
    title: 'Scrap-Ring Kingpin',
    colosseumId: 'drift_bazaars',
    style: 'dimachaerus',
    color: '#ffc95c',
    level: 2,
    grudgeBark: 'Every bolt in /TEMP bends to my twin blades. Step inside the cage!',
  },
  cold_vaults: {
    id: 'nem_cold_vaults',
    name: 'SOLSTICE_01.SAV',
    title: 'Crystal Oathkeeper',
    colosseumId: 'cold_vaults',
    style: 'murmillo',
    color: '#a78bfa',
    level: 2,
    grudgeBark: 'Frozen saves never forget a wound. Come freeze beneath the cathedral.',
  },
  rust_citadel: {
    id: 'nem_rust_citadel',
    name: 'SEGFAULT_REX.ERR',
    title: 'Overflow Warlord',
    colosseumId: 'rust_citadel',
    style: 'executioner',
    color: '#ff3b5c',
    level: 3,
    grudgeBark: 'My Maul cracked forty contenders this cycle—your shell is next!',
  },
  kernel_spire: {
    id: 'nem_kernel_spire',
    name: 'KERNEL_PRIME.SYS',
    title: 'Sovereign Warden',
    colosseumId: 'kernel_spire',
    style: 'hoplomachus',
    color: '#ffd866',
    level: 4,
    grudgeBark: 'Root privilege is forged in blood and silicon. Ascend and bleed!',
  },
};

export function createDefaultNemesisRoster(): Record<CapitalId, NemesisRival> {
  return {
    cache_city: { ...SEED_RIVALS.cache_city, encounters: 0, playerWins: 0, rivalWins: 0, cyberLimbs: {} },
    drift_bazaars: { ...SEED_RIVALS.drift_bazaars, encounters: 0, playerWins: 0, rivalWins: 0, cyberLimbs: {} },
    cold_vaults: { ...SEED_RIVALS.cold_vaults, encounters: 0, playerWins: 0, rivalWins: 0, cyberLimbs: {} },
    rust_citadel: { ...SEED_RIVALS.rust_citadel, encounters: 0, playerWins: 0, rivalWins: 0, cyberLimbs: {} },
    kernel_spire: { ...SEED_RIVALS.kernel_spire, encounters: 0, playerWins: 0, rivalWins: 0, cyberLimbs: {} },
  };
}

export function recordNemesisEncounter(
  roster: Record<CapitalId, NemesisRival>,
  colosseumId: CapitalId,
  update: NemesisEncounterUpdate,
): Record<CapitalId, NemesisRival> {
  const cur = roster[colosseumId];
  if (!cur) return roster;
  const nextCyber: Partial<Record<LimbKey, boolean>> = { ...cur.cyberLimbs };
  if (update.victory) {
    for (const limb of update.severedLimbs) nextCyber[limb] = true;
    if (update.executed || update.severedLimbs.length === 0) nextCyber.armR = true;
    const counter = COUNTER_GEAR[update.weaponFamily] ?? COUNTER_GEAR.gladius;
    return {
      ...roster,
      [colosseumId]: {
        ...cur,
        level: Math.min(10, cur.level + 1),
        encounters: cur.encounters + 1,
        playerWins: cur.playerWins + 1,
        style: counter.style,
        cyberLimbs: nextCyber,
        adaptedAgainst: update.weaponFamily,
        counterLabel: counter.label,
        grudgeBark: `You scarred my frame with that ${update.weaponFamily}—I compiled ${counter.label} just for you!`,
      },
    };
  }
  return {
    ...roster,
    [colosseumId]: {
      ...cur,
      level: Math.min(10, cur.level + 1),
      encounters: cur.encounters + 1,
      rivalWins: cur.rivalWins + 1,
      grudgeBark: 'You hit the sand once already! Come back when your Cycles stop trembling.',
    },
  };
}

export function nemesisFightCardFor(rival: NemesisRival): FightCard {
  const denarii = 220 + rival.level * 65 + rival.rivalWins * 55;
  return {
    id: `nemesis_${rival.colosseumId}_lvl${rival.level}`,
    title: `NEMESIS DUEL · ${rival.name}`,
    subtitle: `${rival.title} · LVL ${rival.level}${rival.counterLabel ? ` · ${rival.counterLabel}` : ''}`,
    tier: 4,
    reqFame: 0,
    denarii,
    xp: 165 + rival.level * 25,
    fame: 110 + rival.level * 20,
    enemies: [{ name: rival.name, kind: 'champion', style: rival.style }],
  };
}
