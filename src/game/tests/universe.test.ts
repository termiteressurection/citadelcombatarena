import { describe, expect, it } from 'vitest';
import { isFree } from '../world/colliders';
import {
  CAPITALS, COLOSSEUMS, SATELLITES, SETTLEMENTS, WORLD_BOUNDS,
  collidersNear, isSanctuaryPosition, nearestColosseum, nearestWorldColosseumGate,
} from '../world/universe';
import { memoryTreesNear } from '../world/MemoryWoods';
import {
  PROPERTIES, discountedCost, nearestPropertyDeed, ownerShopDiscount,
  propertyRenovateCost, propertyRentPayout, propertySellValue, reputationDeltaForRent, reputationRankOf,
} from '../world/properties';
import { generateFightCards } from '../rpg/quests';

describe('Daggerfall-scale curved universe & 5 capital colosseums', () => {
  it('defines 5 Capital Cities with Colosseums and 20 Satellite settlements inside WORLD_BOUNDS', () => {
    expect(CAPITALS).toHaveLength(5);
    expect(COLOSSEUMS).toHaveLength(5);
    expect(SATELLITES).toHaveLength(20);
    expect(SETTLEMENTS).toHaveLength(25);

    const ids = new Set(SETTLEMENTS.map((s) => s.id));
    expect(ids.size).toBe(25);

    for (const s of SETTLEMENTS) {
      expect(s.spawnX).toBeGreaterThan(WORLD_BOUNDS.minX);
      expect(s.spawnX).toBeLessThan(WORLD_BOUNDS.maxX);
      expect(s.spawnZ).toBeGreaterThan(WORLD_BOUNDS.minZ);
      expect(s.spawnZ).toBeLessThan(WORLD_BOUNDS.maxZ);
      const solids = collidersNear(s.spawnX, s.spawnZ);
      expect(isFree(s.spawnX, s.spawnZ, 0.55, solids, WORLD_BOUNDS)).toBe(true);
      if (s.colosseum) {
        expect(isFree(s.colosseum.x, s.colosseum.z, 0.55, solids, WORLD_BOUNDS)).toBe(true);
        expect(nearestWorldColosseumGate(s.colosseum.x, s.colosseum.z)?.id).toBe(s.colosseum.id);
      }
    }
  });

  it('always identifies the exact closest Capital Colosseum across the 4000x4000 continent', () => {
    expect(nearestColosseum(0, 34).colosseum.id).toBe('cache_city');
    expect(nearestColosseum(190, 960).colosseum.id).toBe('drift_bazaars');
    expect(nearestColosseum(-1100, -500).colosseum.id).toBe('cold_vaults');
    expect(nearestColosseum(1200, -500).colosseum.id).toBe('rust_citadel');
    expect(nearestColosseum(0, -1500).colosseum.id).toBe('kernel_spire');
    expect(nearestColosseum(0, -1380).bearing).toBe('N');
  });

  it('enforces Sanctuary vs Lawless Frontier safety zones cleanly', () => {
    expect(isSanctuaryPosition(0, 20)).toBe(true);
    expect(isSanctuaryPosition(180, 920)).toBe(true);
    expect(isSanctuaryPosition(-1040, -520)).toBe(true);
    expect(isSanctuaryPosition(0, -1420)).toBe(true);
    expect(isSanctuaryPosition(1120, -480)).toBe(false); // Rust Citadel is frontier
    expect(isSanctuaryPosition(500, 500)).toBe(false);   // Open wilds
  });

  it('builds themed fight cards for every Capital Colosseum with accessible Tier 1', () => {
    for (const c of COLOSSEUMS) {
      const cards = generateFightCards(1, 0, c.id);
      expect(cards).toHaveLength(4);
      expect(cards[0].reqFame).toBe(0);
    }
    const cacheCards = generateFightCards(1, 0, 'cache_city');
    const kernelCards = generateFightCards(1, 0, 'kernel_spire');
    expect(kernelCards[0].denarii).toBeGreaterThan(cacheCards[0].denarii);
  });
});

describe('Fable-inspired property ownership, rent, renovation & reputation', () => {
  it('places unique, collider-safe property deeds across the continent', () => {
    expect(PROPERTIES.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(PROPERTIES.map((p) => p.id));
    expect(ids.size).toBe(PROPERTIES.length);

    for (const p of PROPERTIES) {
      const solids = collidersNear(p.signX, p.signZ);
      const approachDir = p.signX >= p.x ? 1.5 : -1.5;
      expect(isFree(p.signX + approachDir, p.signZ, 0.55, solids, WORLD_BOUNDS)).toBe(true);
      expect(nearestPropertyDeed(p.signX, p.signZ)?.id).toBe(p.id);
    }
  });

  it('calculates Live vs Low/Fair/High rent payouts, renovations, sell values & reputation shifts', () => {
    const prop = PROPERTIES[0];
    expect(propertyRentPayout(prop, { id: prop.id, mode: 'live', rentRate: 'high', tier: 3 })).toBe(0);
    const low1 = propertyRentPayout(prop, { id: prop.id, mode: 'rent', rentRate: 'low', tier: 1 });
    const fair1 = propertyRentPayout(prop, { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 1 });
    const high1 = propertyRentPayout(prop, { id: prop.id, mode: 'rent', rentRate: 'high', tier: 1 });
    const fair3 = propertyRentPayout(prop, { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 3 });

    expect(low1).toBeLessThan(fair1);
    expect(fair1).toBeLessThan(high1);
    expect(fair3).toBeGreaterThan(fair1);

    expect(reputationDeltaForRent({ id: prop.id, mode: 'rent', rentRate: 'low', tier: 1 })).toBeGreaterThan(0);
    expect(reputationDeltaForRent({ id: prop.id, mode: 'rent', rentRate: 'high', tier: 1 })).toBeLessThan(0);
    expect(reputationRankOf(60).label).toBe('BELOVED PROTECTOR');
    expect(reputationRankOf(-60).label).toBe('FEARED OVERLORD');

    const ren1 = propertyRenovateCost(prop, 1);
    const ren2 = propertyRenovateCost(prop, 2);
    expect(ren2).toBeGreaterThan(ren1);
    expect(propertyRenovateCost(prop, 3)).toBe(0);

    const sell1 = propertySellValue(prop, { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 1 });
    const sell2 = propertySellValue(prop, { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 2 });
    expect(sell2).toBeGreaterThan(sell1);
  });

  it('grants permanent vendor discounts when owning shops or taverns', () => {
    expect(ownerShopDiscount({})).toBe(0);
    expect(discountedCost(100, {})).toBe(100);

    const shopProp = PROPERTIES.find((p) => p.kind === 'shop')!;
    const ownedOne = { [shopProp.id]: { id: shopProp.id, mode: 'rent' as const, rentRate: 'fair' as const, tier: 1 as const } };
    expect(ownerShopDiscount(ownedOne)).toBeCloseTo(0.15);
    expect(discountedCost(100, ownedOne)).toBe(85);
  });

  it('populates varied Citadel Memory Trees in the wilderness while keeping Capital plazas clear', () => {
    // Capital plaza center (0, 0) is completely clear of Memory Trees
    expect(memoryTreesNear(0, 0, 95)).toHaveLength(0);

    // Countryside wilderness has multiple varied Citadel Memory Tree styles
    const wildTrees = memoryTreesNear(480, 480, 260);
    expect(wildTrees.length).toBeGreaterThanOrEqual(8);
    const variants = new Set(wildTrees.map((t) => t.variant));
    expect(variants.size).toBeGreaterThanOrEqual(3);

    // Trunk colliders appear cleanly inside collidersNear near any Memory Tree
    const t0 = wildTrees[0];
    const solids = collidersNear(t0.x, t0.z);
    expect(solids.some((c) => Math.hypot(c.x - t0.x, c.z - t0.z) < 0.05 && c.r === t0.trunkRadius)).toBe(true);
  });
});
