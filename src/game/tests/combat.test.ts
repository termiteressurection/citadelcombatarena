import { describe, expect, it } from 'vitest';
import { ATTACKS, KINDS, NO_INTENT, aiIntent, makeFighter, resolveStrike, startAttack, stepFighter, PARRY_WINDOW } from '../arena/combat';

const duel = () => {
  const p = makeFighter(0, 'player', 0, 0);
  const e = makeFighter(1, 'skirmisher', 0, 2);
  p.yaw = 0; e.yaw = Math.PI;
  return { p, e };
};
const run = (f: ReturnType<typeof makeFighter>, t: number, other: ReturnType<typeof makeFighter>, intent = NO_INTENT) => {
  let strike = false;
  for (let i = 0; i < Math.round(t * 60); i++) strike = stepFighter(f, intent, 1 / 60, other) || strike;
  return strike;
};

describe('combat rules', () => {
  it('enemy telegraphs are readable (windup >= 0.4s)', () => {
    for (const k of ['skirmisher', 'brute', 'champion'] as const) {
      expect(ATTACKS.light.windup * KINDS[k].windupMul).toBeGreaterThanOrEqual(0.4);
    }
  });
  it('a light hit deals damage and staggers', () => {
    const { p, e } = duel();
    startAttack(p, 'light');
    expect(run(p, 0.25, e)).toBe(true);
    const ev = resolveStrike(p, [e]);
    expect(ev[0].type).toBe('hit');
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e.state).toBe('stagger');
  });
  it('heavy attacks kill a weakened target', () => {
    const { p, e } = duel();
    e.hp = 10;
    startAttack(p, 'heavy');
    run(p, 0.6, e);
    expect(resolveStrike(p, [e])[0].type).toBe('kill');
    expect(e.state).toBe('dead');
  });
  it('a hit from behind or out of reach whiffs', () => {
    const { p, e } = duel();
    e.z = 9;
    startAttack(p, 'light'); run(p, 0.25, e);
    expect(resolveStrike(p, [e])).toHaveLength(0);
  });
  it('blocking absorbs damage, drains stamina', () => {
    const { p, e } = duel();
    e.blocking = true; e.blockT = 1; e.yaw = Math.PI;
    startAttack(p, 'light'); run(p, 0.25, e);
    const before = e.stamina;
    expect(resolveStrike(p, [e])[0].type).toBe('block');
    expect(e.stamina).toBeLessThan(before);
    expect(e.hp).toBeGreaterThan(e.maxHp - 5);
  });
  it('a perfect parry staggers the attacker', () => {
    const { p, e } = duel();
    e.blocking = true; e.blockT = PARRY_WINDOW / 2;
    startAttack(p, 'light'); run(p, 0.25, e);
    expect(resolveStrike(p, [e])[0].type).toBe('parry');
    expect(p.state).toBe('stagger');
  });
  it('dodge i-frames avoid a strike', () => {
    const { p, e } = duel();
    stepFighter(e, { ...NO_INTENT, dodge: true, moveX: 1 }, 1 / 60, p);
    expect(e.state).toBe('dodge');
    startAttack(p, 'light');
    expect(resolveStrike(p, [e])).toHaveLength(0);
  });
  it('cannot attack without stamina', () => {
    const { p } = duel();
    p.stamina = 3;
    expect(startAttack(p, 'light')).toBe(false);
  });
  it('AI eventually attacks and never moves through NaN', () => {
    const { p, e } = duel();
    let attacked = false;
    for (let i = 0; i < 60 * 12; i++) {
      stepFighter(e, aiIntent(e, p, 1 / 60), 1 / 60, p);
      if (e.state === 'windup') attacked = true;
      expect(Number.isFinite(e.x + e.z)).toBe(true);
    }
    expect(attacked).toBe(true);
  });
  it('3-hit light combo escalates damage and resets when window expires', () => {
    const { p, e } = duel();
    e.hp = e.maxHp = 500;
    // Hit 1: light
    stepFighter(p, { ...NO_INTENT, light: true }, 1 / 60, e);
    expect(p.atk).toBe('light');
    expect(p.comboStep).toBe(1);
    run(p, 0.22, e);
    const ev1 = resolveStrike(p, [e]);
    expect(ev1[0].dmg).toBe(12);
    // Queue Hit 2 during recover
    stepFighter(p, { ...NO_INTENT, light: true }, 1 / 60, e);
    run(p, 0.25, e);
    expect(p.atk).toBe('light2');
    expect(p.comboStep).toBe(2);
    run(p, 0.2, e);
    const ev2 = resolveStrike(p, [e]);
    expect(ev2[0].dmg).toBe(14);
    // Queue Hit 3 during recover
    stepFighter(p, { ...NO_INTENT, light: true }, 1 / 60, e);
    run(p, 0.25, e);
    expect(p.atk).toBe('light3');
    expect(p.comboStep).toBe(3);
    run(p, 0.28, e);
    const ev3 = resolveStrike(p, [e]);
    expect(ev3[0].dmg).toBe(22);
    // Wait out full recover + combo window and verify reset
    run(p, 1.1, e);
    expect(p.state).toBe('idle');
    expect(p.comboStep).toBe(0);
    stepFighter(p, { ...NO_INTENT, light: true }, 1 / 60, e);
    expect(p.atk).toBe('light');
  });
  it('light attack cancels into heavy during recovery', () => {
    const { p, e } = duel();
    stepFighter(p, { ...NO_INTENT, light: true }, 1 / 60, e);
    run(p, 0.35, e); // in recover
    stepFighter(p, { ...NO_INTENT, heavy: true }, 1 / 60, e);
    expect(p.queuedAtk).toBe('heavy');
    run(p, 0.2, e);
    expect(p.atk).toBe('heavy');
    expect(p.state).toBe('windup');
  });
  it('guard-break bash shatters a blocking defender', () => {
    const { p, e } = duel();
    e.blocking = true; e.blockT = 0.05; e.yaw = Math.PI;
    const beforeStam = e.stamina;
    stepFighter(p, { ...NO_INTENT, bash: true }, 1 / 60, e);
    expect(p.atk).toBe('bash');
    expect(run(p, 0.2, e)).toBe(true);
    const ev = resolveStrike(p, [e]);
    expect(ev[0].type).toBe('guardBreak');
    expect(e.blocking).toBe(false);
    expect(e.stamina).toBeLessThan(beforeStam);
    expect(e.state).toBe('stagger');
  });
  it('forward lunge advances the attacker on strike frame', () => {
    const { p, e } = duel();
    e.z = 5;
    const z0 = p.z;
    startAttack(p, 'light');
    expect(run(p, 0.25, e)).toBe(true);
    expect(p.z).toBeGreaterThan(z0 + 0.1);
  });
  it('computes localVx and localVz for forward, backpedal, and strafe', () => {
    const { p, e } = duel(); // p faces +Z (yaw = 0)
    run(p, 0.3, e, { ...NO_INTENT, moveZ: 1 });
    expect(p.localVz).toBeGreaterThan(0.7);
    expect(Math.abs(p.localVx)).toBeLessThan(0.1);
    run(p, 0.4, e, { ...NO_INTENT, moveZ: -1 });
    expect(p.localVz).toBeLessThan(-0.7);
    run(p, 0.4, e, { ...NO_INTENT, moveX: 1 });
    expect(p.localVx).toBeGreaterThan(0.7);
  });
});
