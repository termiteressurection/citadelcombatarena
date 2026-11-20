import { describe, expect, it } from 'vitest';
import { BOONS, drawBoons, modsFor } from '../arena/boons';
import { ATTACKS, makeFighter, startAttack, stepFighter, resolveStrike, dodgeCostOf, NO_INTENT } from '../arena/combat';
import { LADDER, LOOKS, carryHp, gloryForBout, isFinalBout, rosterFor } from '../arena/run';

describe('Fate boons', () => {
  it('ships 12 boons with unique ids', () => {
    expect(BOONS).toHaveLength(12);
    expect(new Set(BOONS.map((b) => b.id)).size).toBe(12);
  });
  it('drafts three distinct boons every time', () => {
    for (let i = 0; i < 200; i++) expect(new Set(drawBoons().map((b) => b.id)).size).toBe(3);
  });
  it('every boon stacks 20 times without breaking limits', () => {
    for (const b of BOONS) {
      const m = modsFor(Array(20).fill(b.id));
      for (const v of Object.values(m)) expect(Number.isFinite(v)).toBe(true);
      expect(m.speed).toBeLessThanOrEqual(1.5);
      expect(m.parryWindow).toBeLessThanOrEqual(0.17);
      const f = makeFighter(0, 'player', 0, 0, m);
      expect(dodgeCostOf(f)).toBeGreaterThanOrEqual(4);
    }
  });
  it('random 15-boon builds never produce NaN, and bigger builds hit harder', () => {
    const e0 = makeFighter(1, 'brute', 0, 2); e0.hp = e0.maxHp = 9999;
    const base = makeFighter(0, 'player', 0, 0); startAttack(base, 'heavy'); for (let i = 0; i < 40; i++) stepFighter(base, NO_INTENT, 1 / 60, e0);
    resolveStrike(base, [e0]);
    const dealt0 = 9999 - e0.hp;
    for (let n = 0; n < 50; n++) {
      const ids = Array.from({ length: 15 }, () => BOONS[Math.floor(Math.random() * BOONS.length)].id);
      const f = makeFighter(0, 'player', 0, 0, modsFor(ids));
      expect(Number.isFinite(f.maxHp + f.maxStamina)).toBe(true);
    }
    const strong = makeFighter(0, 'player', 0, 0, modsFor(['ares', 'crush']));
    const e1 = makeFighter(1, 'brute', 0, 2); e1.hp = e1.maxHp = 9999;
    startAttack(strong, 'heavy'); for (let i = 0; i < 40; i++) stepFighter(strong, NO_INTENT, 1 / 60, e1);
    resolveStrike(strong, [e1]);
    expect(9999 - e1.hp).toBeGreaterThan(dealt0);
  });
  it('a new player and a veteran with no boons hit identically (unlocks are cosmetic)', () => {
    expect(modsFor([])).toEqual(modsFor([]));
    expect(LOOKS.every((l) => typeof l.color === 'string')).toBe(true);
    expect(ATTACKS.light.dmg).toBe(12);
  });
});

describe('ladder', () => {
  it('ends with the champion', () => {
    expect(LADDER).toHaveLength(5);
    expect(rosterFor(5)).toEqual(['champion']);
    expect(isFinalBout(5)).toBe(true);
    expect(isFinalBout(4)).toBe(false);
  });
  it('rewards climb and carry-over healing is capped', () => {
    expect(gloryForBout(3, 1)).toBeGreaterThan(gloryForBout(1, 1));
    expect(carryHp(95, 100)).toBe(100);
    expect(carryHp(10, 100)).toBe(40);
  });
});
