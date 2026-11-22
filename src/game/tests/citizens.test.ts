import { describe, expect, it } from 'vitest';
import { CITY_CURVE_RADIUS, curveDrop } from '../art/curvature';
import { isFree } from '../world/colliders';
import { BOUNDS, SOLIDS } from '../world/layout';
import {
  advanceNpcSchedule, antagonizeNpc, createCityPopulation, greetNpc, triggerStreetEvent,
} from '../world/citizens';

describe('city horizon curvature math', () => {
  it('computes continuous d^2 / (2R) sagitta drop at R = 200', () => {
    expect(CITY_CURVE_RADIUS).toBe(200);
    expect(curveDrop(0, 0, 200)).toBe(0);
    expect(curveDrop(20, 0, 200)).toBeCloseTo(1.0);
    expect(curveDrop(30, 40, 200)).toBeCloseTo((900 + 1600) / 400);
    expect(curveDrop(50, 0, 0)).toBe(0);
  });
});

describe('deleted-file city NPCs & RDR2 street interactions', () => {
  it('spawns 26 named deleted-file NPCs across free city coordinates', () => {
    const pop = createCityPopulation();
    expect(pop).toHaveLength(26);
    const names = new Set(pop.map((n) => n.filename));
    expect(names.size).toBe(26);
    for (const n of pop) {
      expect(isFree(n.x, n.z, 0.55, SOLIDS, BOUNDS)).toBe(true);
    }
  });

  it('grants Cycles and healing from helpful deleted-file greets', () => {
    const pop = createCityPopulation();
    const helpful = pop.find((n) => n.role === 'citizen' && n.temperament === 'helpful')!;
    const out = greetNpc(helpful, 100, 0.5);
    expect(out.cyclesDelta).toBeGreaterThan(0);
    expect(out.healPct).toBeGreaterThan(0);
    expect(out.turnHostile).toBe(false);
    expect(helpful.mood).toBe('grateful');
  });

  it('provokes proud gladiators into hostile street combat and scares timid citizens into fleeing', () => {
    const pop = createCityPopulation();
    const glad = pop.find((n) => n.role === 'gladiator')!;
    const gladOut = antagonizeNpc(glad, true, 0.2);
    expect(gladOut.turnHostile).toBe(true);
    expect(glad.mood).toBe('hostile');

    const timid = pop.find((n) => n.role === 'citizen' && n.temperament === 'timid')!;
    const timidOut = antagonizeNpc(timid, true, 0.1);
    expect(timidOut.turnHostile).toBe(false);
    expect(timidOut.cyclesDelta).toBeGreaterThan(0);
    expect(timidOut.addBounty).toBeGreaterThan(0);
    expect(timid.mood).toBe('fleeing');
  });

  it('keeps Sanctuary plazas calm and triggers outbreaks only outside sanctuaries', () => {
    const pop = createCityPopulation();
    // Corrupted files stay outside Cache Plaza sanctuary radius (> 72u)
    for (const c of pop.filter((n) => n.role === 'corrupted')) {
      expect(Math.hypot(c.x, c.z)).toBeGreaterThan(72);
    }

    // Inside Cache City Sanctuary (0, 0): never mutates or turns NPCs hostile
    const calmEvent = triggerStreetEvent(pop, 0, 0, 0.95);
    expect(calmEvent).not.toBeNull();
    expect(calmEvent!.title).not.toBe('CORRUPTION OUTBREAK');
    const calmSpeaker = pop.find((n) => n.id === calmEvent!.npcId)!;
    expect(calmSpeaker.mood).not.toBe('hostile');

    // Outside Sanctuary on open frontier (260, 0): corruption outbreaks can happen
    const outbreak = triggerStreetEvent(pop, 260, 0, 0.95);
    expect(outbreak).not.toBeNull();
    expect(outbreak!.title).toBe('CORRUPTION OUTBREAK');
  });

  it('assigns daily schedules and hard-light vehicles to calm NPCs for distant commutes', () => {
    const pop = createCityPopulation();
    const riders = pop.filter((n) => n.hasVehicle);
    expect(riders.length).toBeGreaterThanOrEqual(8);
    expect(pop.some((n) => n.role === 'corrupted' && n.hasVehicle)).toBe(false);

    const npc = riders[0];
    npc.mood = 'calm';
    npc.x = 0;
    npc.z = 0;
    // Short walk stays on foot
    advanceNpcSchedule(npc, { x: 4, z: 4 }, 0.25);
    expect(npc.onVehicle).toBe(false);
    expect(npc.activityLabel.length).toBeGreaterThan(3);

    // Distant commute mounts the Light-Cycle
    advanceNpcSchedule(npc, { x: 35, z: 0 }, 0.25);
    expect(npc.onVehicle).toBe(true);

    // Conflict forces immediate dismount
    antagonizeNpc(npc, true, 0.2);
    if (npc.mood !== 'calm') expect(npc.onVehicle).toBe(false);
  });
});
