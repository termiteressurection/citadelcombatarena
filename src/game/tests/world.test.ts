import { describe, expect, it } from 'vitest';
import { clampBounds, isFree, resolveCircles } from '../world/colliders';
import {
  AQUEDUCT_PIERS, BOUNDS, CITY_TOWERS, COLUMNS, PLAYER_START, SOLIDS, STATIONS, nearestStation,
} from '../world/layout';

describe('colliders', () => {
  it('pushes a circle out of a solid', () => {
    const p = { x: 0.2, z: 0 };
    resolveCircles(p, 0.5, [{ x: 0, z: 0, r: 1 }]);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.5);
  });
  it('clamps to bounds', () => {
    const p = { x: 999, z: -999 };
    clampBounds(p, 0.5, BOUNDS);
    expect(p.x).toBe(BOUNDS.maxX - 0.5);
    expect(p.z).toBe(BOUNDS.minZ + 0.5);
  });
});

describe('sector /dev/null open city layout', () => {
  it('has a solid for every column, aqueduct pier, and city tower', () => {
    expect(COLUMNS.length).toBeGreaterThanOrEqual(30);
    expect(AQUEDUCT_PIERS.length).toBeGreaterThanOrEqual(8);
    expect(CITY_TOWERS.length).toBeGreaterThanOrEqual(20);
    for (const c of COLUMNS) expect(SOLIDS.some((s) => s.x === c.pos[0] && s.z === c.pos[2])).toBe(true);
    for (const p of AQUEDUCT_PIERS) expect(SOLIDS.some((s) => s.x === p.x && s.z === p.z)).toBe(true);
    for (const t of CITY_TOWERS) expect(SOLIDS.some((s) => s.x === t.x && s.z === t.z)).toBe(true);
  });
  it('spawns the player in free space', () => {
    expect(isFree(PLAYER_START.x, PLAYER_START.z, 0.55, SOLIDS, BOUNDS)).toBe(true);
  });
  it('keeps every station reachable and inside the open city', () => {
    expect(STATIONS).toHaveLength(9);
    for (const s of STATIONS) {
      expect(s.pos[0]).toBeGreaterThan(BOUNDS.minX);
      expect(s.pos[0]).toBeLessThan(BOUNDS.maxX);
      expect(s.pos[1]).toBeGreaterThan(BOUNDS.minZ);
      expect(s.pos[1]).toBeLessThan(BOUNDS.maxZ);
      expect(nearestStation(s.pos[0], s.pos[1] + 3)?.id).toBe(s.id);
    }
  });
  it('leaves the Purge Arena Gate opening walkable', () => {
    expect(isFree(0, -54, 0.55, SOLIDS, BOUNDS)).toBe(true);
  });
});
