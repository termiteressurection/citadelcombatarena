import { PROPERTY_SLOTS, SETTLEMENTS, type PropertySlot } from './universe';

export type PropertyKind = 'home' | 'shop' | 'estate' | 'tavern';
export type RentRate = 'low' | 'fair' | 'high';
export type PropertyMode = 'live' | 'rent';

export interface PropertyDef {
  id: string;
  name: string;
  settlementId: string;
  settlementName: string;
  kind: PropertyKind;
  x: number;
  z: number;
  signX: number;
  signZ: number;
  price: number;
  baseRent: number;
  accent: string;
  desc: string;
}

export interface OwnedPropertyState {
  id: string;
  mode: PropertyMode;
  rentRate: RentRate;
  tier: 1 | 2 | 3;
}

const CACHE_PROPERTY_META: Record<string, { name: string; price: number; baseRent: number; desc: string }> = {
  cache_alley_pad: {
    name: 'ALLEY CRASH-PAD',
    price: 60,
    baseRent: 14,
    desc: 'Compact neon sleep-pod tucked beneath Cache Plaza. Ideal starter address.',
  },
  cache_fountain_loft: {
    name: 'AQUEDUCT VIEW LOFT',
    price: 160,
    baseRent: 34,
    desc: 'Two-story glass loft overlooking the Memory Core Fountain waterfall.',
  },
  cache_patch_stall: {
    name: 'PLAZA DATA STALL',
    price: 240,
    baseRent: 52,
    desc: 'Busy vendor kiosk on East Plaza. Grants permanent Forge & Clinic discounts.',
  },
  cache_sky_penthouse: {
    name: 'PURGE AVENUE PENTHOUSE',
    price: 520,
    baseRent: 115,
    desc: 'Prime megablock suite overlooking the Purge Grid Colosseum gates.',
  },
};

const SETTLEMENT_BY_ID = new Map(SETTLEMENTS.map((s) => [s.id, s]));

function buildPropertyDef(slot: PropertySlot): PropertyDef {
  const s = SETTLEMENT_BY_ID.get(slot.settlementId)!;
  const custom = CACHE_PROPERTY_META[slot.id];
  if (custom) {
    return {
      ...slot,
      settlementName: s.name,
      name: custom.name,
      price: custom.price,
      baseRent: custom.baseRent,
      accent: s.accent,
      desc: custom.desc,
    };
  }

  const isCap = s.kind === 'capital';
  if (slot.kind === 'home') {
    const price = isCap ? 140 : s.biome === 'kernel' ? 190 : s.biome === 'vault' ? 130 : 75;
    const baseRent = Math.round(price * 0.22);
    const label = s.biome === 'vault' ? 'CRYSTAL COTTAGE' : s.biome === 'bazaar' ? 'SCAFFOLD LOFT' : s.biome === 'kernel' ? 'HALO RESIDENCE' : 'NEON COTTAGE';
    return {
      ...slot,
      settlementName: s.name,
      name: `${s.name} ${label}`,
      price,
      baseRent,
      accent: s.accent,
      desc: `Private sanctuary address in ${s.name}. Fast-travel anchor & steady Cycles.`,
    };
  }
  if (slot.kind === 'shop') {
    const price = isCap ? 280 : 185;
    const baseRent = Math.round(price * 0.22);
    return {
      ...slot,
      settlementName: s.name,
      name: `${s.name} EXCHANGE`,
      price,
      baseRent,
      accent: s.secondary,
      desc: `Commercial storefront in ${s.name}. Owning shops lowers Forge, Clinic & Kiosk prices.`,
    };
  }
  if (slot.kind === 'tavern') {
    const price = 220;
    const baseRent = 48;
    return {
      ...slot,
      settlementName: s.name,
      name: `${s.name} TAPHOUSE`,
      price,
      baseRent,
      accent: s.accent,
      desc: `Lively frontier tavern packed with Light-Cycle riders. Counts as a merchant holding.`,
    };
  }

  // Estate / Fortress / Manor
  const price = s.id === 'kernel_spire_estate' ? 680 : isCap ? 460 : s.safety === 'frontier' ? 320 : 290;
  const baseRent = Math.round(price * 0.23);
  const label = s.safety === 'frontier' ? 'BASTION MANOR' : s.biome === 'vault' ? 'FROST VILLA' : s.biome === 'kernel' ? 'SOVEREIGN MANOR' : 'GRAND ESTATE';
  return {
    ...slot,
    settlementName: s.name,
    name: `${s.name} ${label}`,
    price,
    baseRent,
    accent: s.accent,
    desc: `Flagship estate commanding prestige and massive Cycle revenue in ${s.name}.`,
  };
}

export const PROPERTIES: PropertyDef[] = PROPERTY_SLOTS.map(buildPropertyDef);
export const PROPERTY_BY_ID = new Map(PROPERTIES.map((p) => [p.id, p]));

const TIER_MULTS = [1, 1.5, 2.25] as const;

export function propertyRentPayout(def: PropertyDef, owned: OwnedPropertyState): number {
  if (owned.mode === 'live') return 0;
  const tierMul = TIER_MULTS[Math.max(0, Math.min(2, owned.tier - 1))];
  const rateMul = owned.rentRate === 'low' ? 0.5 : owned.rentRate === 'fair' ? 1.0 : 1.6;
  return Math.round(def.baseRent * tierMul * rateMul);
}

export function propertyRenovateCost(def: PropertyDef, currentTier: 1 | 2 | 3): number {
  if (currentTier >= 3) return 0;
  return Math.round(def.price * (currentTier === 1 ? 0.55 : 0.9));
}

export function propertySellValue(def: PropertyDef, owned: OwnedPropertyState): number {
  let invested = def.price;
  if (owned.tier >= 2) invested += propertyRenovateCost(def, 1);
  if (owned.tier >= 3) invested += propertyRenovateCost(def, 2);
  return Math.round(invested * 0.8);
}

export function reputationDeltaForRent(owned: OwnedPropertyState): number {
  if (owned.mode === 'live') return 0;
  if (owned.rentRate === 'low') return 2;
  if (owned.rentRate === 'high') return -3;
  return 0;
}

export function reputationRankOf(rep: number): { label: string; color: string } {
  if (rep >= 50) return { label: 'BELOVED PROTECTOR', color: '#3ff0ff' };
  if (rep >= 15) return { label: 'RESPECTED', color: '#4dffa0' };
  if (rep > -15) return { label: 'NEUTRAL', color: '#e9e6ff' };
  if (rep > -50) return { label: 'INFAMOUS', color: '#ff8a3d' };
  return { label: 'FEARED OVERLORD', color: '#ff3b5c' };
}

export function ownerShopDiscount(ownedMap: Record<string, OwnedPropertyState>): number {
  let shops = 0;
  for (const st of Object.values(ownedMap)) {
    const def = PROPERTY_BY_ID.get(st.id);
    if (def && (def.kind === 'shop' || def.kind === 'tavern')) shops += 1;
  }
  if (shops >= 3) return 0.25;
  if (shops === 2) return 0.2;
  if (shops === 1) return 0.15;
  return 0;
}

export function discountedCost(baseCost: number, ownedMap: Record<string, OwnedPropertyState>): number {
  const disc = ownerShopDiscount(ownedMap);
  if (disc <= 0 || baseCost <= 0) return baseCost;
  return Math.max(1, Math.round(baseCost * (1 - disc)));
}

export function nearestPropertyDeed(x: number, z: number, range = 5.0): PropertyDef | null {
  let best: PropertyDef | null = null;
  let bestD = range;
  for (const p of PROPERTIES) {
    const d = Math.hypot(p.signX - x, p.signZ - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
