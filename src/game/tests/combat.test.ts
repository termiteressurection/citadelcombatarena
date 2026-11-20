import { describe, expect, it } from 'vitest';
import { ATTACKS, KINDS, NO_INTENT, PARRY_WINDOW, RIPOSTE_DMG_MUL, aiIntent, defaultMods, makeFighter, parryWindowOf, pickTargetZone, resolveStrike, startAttack, stepFighter } from '../arena/combat';
import { STYLE_IDS, moveOf, styleOf } from '../arena/styles';

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
  it('routes attacks to distinct limbs and falls back to torso when severed', () => {
    const { e } = duel();
    expect(pickTargetZone('light', e)).toBe('armL');
    expect(pickTargetZone('light2', e)).toBe('armR');
    expect(pickTargetZone('light3', e)).toBe('legL');
    expect(pickTargetZone('bash', e)).toBe('legL');
    expect(pickTargetZone('heavy', e)).toBe('head');
    e.limbs.legL.hp = 0; e.limbs.legL.severed = true;
    expect(pickTargetZone('light3', e)).toBe('legR');
    e.limbs.armL.hp = 0; e.limbs.armL.severed = true;
    expect(pickTargetZone('light', e)).toBe('torso');
  });
  it('severing shield arm disables blocking', () => {
    const { p, e } = duel();
    e.hp = e.maxHp = 500;
    e.limbs.armL.hp = 5;
    startAttack(p, 'light'); run(p, 0.22, e);
    const ev = resolveStrike(p, [e]);
    expect(ev[0].severed).toBe('armL');
    expect(e.limbs.armL.severed).toBe(true);
    stepFighter(e, { ...NO_INTENT, block: true }, 1 / 60, p);
    expect(e.blocking).toBe(false);
  });
  it('breaking enemy sword arm disarms, while player sword arm cripples without soft-lock', () => {
    const p = makeFighter(0, 'player', 0, 0);
    const e = makeFighter(1, 'skirmisher', 0, 2, defaultMods(), 'murmillo');
    p.yaw = 0; e.yaw = Math.PI;
    e.hp = e.maxHp = 500;
    e.limbs.armR.hp = 5;
    p.state = 'idle'; p.atk = 'light2';
    const evE = resolveStrike(p, [e]);
    expect(evE[0].severed).toBe('armR');
    expect(e.limbs.armR.severed).toBe(true);
    e.state = 'idle';
    expect(startAttack(e, 'light')).toBe(false);
    // Disarmed AI never picks light/heavy even at melee range
    e.z = 1.5; e.ai.timer = 10;
    const intent = aiIntent(e, p, 1 / 60);
    expect(intent.light).toBe(false);
    expect(intent.heavy).toBe(false);

    // Player armR cripples instead of severing and deals 0.65x damage
    const p2 = makeFighter(0, 'player', 0, 0);
    const dummy = makeFighter(1, 'brute', 0, 2);
    dummy.hp = dummy.maxHp = 500;
    p2.limbs.armR.hp = 5;
    const e2 = makeFighter(2, 'skirmisher', 0, 2);
    e2.yaw = Math.PI;
    e2.state = 'idle'; e2.atk = 'light2';
    const evP = resolveStrike(e2, [p2]);
    expect(evP[0].broken).toBe('armR');
    expect(evP[0].severed).toBeUndefined();
    expect(p2.limbs.armR.severed).toBe(false);
    p2.state = 'idle'; p2.atk = 'light';
    const crippledHit = resolveStrike(p2, [dummy]);
    expect(crippledHit[0].dmg).toBeCloseTo(12 * 0.65, 5);
  });
  it('broken leg slows movement and prevents dodging', () => {
    const p1 = makeFighter(0, 'player', 0, 0);
    const p2 = makeFighter(1, 'player', 0, 0);
    p2.limbs.legL.hp = 0;
    const foe = makeFighter(2, 'skirmisher', 0, 10);
    run(p1, 0.4, foe, { ...NO_INTENT, moveZ: 1 });
    run(p2, 0.4, foe, { ...NO_INTENT, moveZ: 1 });
    expect(p2.z).toBeLessThan(p1.z * 0.7);
    stepFighter(p2, { ...NO_INTENT, dodge: true, moveX: 1 }, 1 / 60, foe);
    expect(p2.state).not.toBe('dodge');
  });
  it('breaking head triggers instant decapitation kill', () => {
    const { p, e } = duel();
    e.hp = e.maxHp = 500;
    e.limbs.head.hp = 10;
    startAttack(p, 'heavy'); run(p, 0.55, e);
    const ev = resolveStrike(p, [e]);
    expect(ev[0].type).toBe('kill');
    expect(ev[0].decap).toBe(true);
    expect(ev[0].severed).toBe('head');
    expect(e.state).toBe('dead');
  });
  it('all 5 styles construct distinct fighters', () => {
    expect(STYLE_IDS).toHaveLength(5);
    const speeds = new Set<number>();
    const reaches = new Set<number>();
    for (const sid of STYLE_IDS) {
      const f = makeFighter(0, 'player', 0, 0, defaultMods(), sid);
      expect(f.style).toBe(sid);
      speeds.add(styleOf(sid).speedMul);
      reaches.add(styleOf(sid).reachMul);
      expect(Number.isFinite(f.armor.helm.hp + f.armor.pauldron.hp + f.armor.shield.hp)).toBe(true);
    }
    expect(speeds.size).toBe(5);
    expect(reaches.size).toBe(5);
  });
  it('armor degrades, shatters with armorBroken event, and stops mitigating limb damage', () => {
    const p = makeFighter(0, 'player', 0, 0, defaultMods(), 'murmillo');
    const e = makeFighter(1, 'brute', 0, 2, defaultMods(), 'murmillo');
    e.hp = e.maxHp = 500;
    p.yaw = 0; e.yaw = Math.PI;
    e.armor.helm.hp = 15;
    p.state = 'idle'; p.atk = 'heavy';
    const headBefore = e.limbs.head.hp;
    const ev1 = resolveStrike(p, [e]);
    expect(ev1[0].armorBroken).toBe('helm');
    expect(e.armor.helm.broken).toBe(true);
    const armoredLimbLoss = headBefore - e.limbs.head.hp;
    expect(armoredLimbLoss).toBeCloseTo(30 * 1.25 * 0.45, 4);

    // Next hit on exposed head takes full unmitigated limb damage
    e.state = 'idle'; e.iframes = 0;
    p.atk = 'heavy';
    const headBefore2 = e.limbs.head.hp;
    const ev2 = resolveStrike(p, [e]);
    expect(ev2[0].armorBroken).toBeUndefined();
    const unarmoredLimbLoss = headBefore2 - e.limbs.head.hp;
    expect(unarmoredLimbLoss).toBeCloseTo(30 * 1.25, 4);
    expect(unarmoredLimbLoss).toBeGreaterThan(armoredLimbLoss * 2);
  });
  it('executioner blunt hammer deals heavy armor bleed-through and breaks blocks with heavy', () => {
    const blunt = makeFighter(0, 'player', 0, 0, defaultMods(), 'executioner');
    const sharp = makeFighter(1, 'player', 0, 0, defaultMods(), 'murmillo');
    const t1 = makeFighter(2, 'brute', 0, 2, defaultMods(), 'hoplomachus');
    const t2 = makeFighter(3, 'brute', 0, 2, defaultMods(), 'hoplomachus');
    t1.hp = t1.maxHp = 500; t2.hp = t2.maxHp = 500;
    blunt.atk = 'light'; sharp.atk = 'light';
    resolveStrike(blunt, [t1]);
    resolveStrike(sharp, [t2]);
    // Blunt deals 0.75 bleed-through vs 0.45 sharp (plus higher raw dmg/limbMul)
    expect(t1.limbs.armL.max - t1.limbs.armL.hp).toBeGreaterThan((t2.limbs.armL.max - t2.limbs.armL.hp) * 2);

    // Heavy breaks an actively blocking defender
    t2.state = 'idle'; t2.blocking = true; t2.blockT = 1; t2.yaw = Math.PI;
    blunt.atk = 'heavy';
    const ev = resolveStrike(blunt, [t2]);
    expect(ev[0].type).toBe('guardBreak');
    expect(t2.blocking).toBe(false);
    expect(t2.state).toBe('stagger');
  });
  it('retiarius heavy net snares target, slows movement, and prevents dodge', () => {
    const ret = makeFighter(0, 'player', 0, 0, defaultMods(), 'retiarius');
    const fast = makeFighter(1, 'skirmisher', 0, 3.8, defaultMods(), 'dimachaerus');
    ret.atk = 'heavy';
    const ev = resolveStrike(ret, [fast]);
    expect(ev[0].snared).toBe(true);
    expect(fast.snared).toBeGreaterThan(1);

    fast.state = 'idle'; fast.kx = 0; fast.kz = 0; fast.z = 3.8;
    const free = makeFighter(2, 'skirmisher', 0, 3.8, defaultMods(), 'dimachaerus');
    const foe = makeFighter(3, 'player', 0, 12);
    run(free, 0.35, foe, { ...NO_INTENT, moveZ: 1 });
    run(fast, 0.35, foe, { ...NO_INTENT, moveZ: 1 });
    expect(fast.z - 3.8).toBeLessThan((free.z - 3.8) * 0.4);

    stepFighter(fast, { ...NO_INTENT, dodge: true, moveX: 1 }, 1 / 60, foe);
    expect(fast.state).not.toBe('dodge');
  });
  it('dimachaerus can keep attacking with one arm severed until both arms are lost', () => {
    const p = makeFighter(0, 'player', 0, 0, defaultMods(), 'murmillo');
    const dim = makeFighter(1, 'skirmisher', 0, 2, defaultMods(), 'dimachaerus');
    dim.hp = dim.maxHp = 500;
    dim.limbs.armR.hp = 5;
    p.atk = 'light2';
    resolveStrike(p, [dim]);
    expect(dim.limbs.armR.severed).toBe(true);
    dim.state = 'idle';
    expect(startAttack(dim, 'light')).toBe(true);

    // Sever left arm too -> fully disarmed
    dim.state = 'idle'; dim.iframes = 0; dim.limbs.armL.hp = 5;
    p.atk = 'light';
    resolveStrike(p, [dim]);
    expect(dim.limbs.armL.severed).toBe(true);
    dim.state = 'idle';
    expect(startAttack(dim, 'light')).toBe(false);
  });

  it('distinct weapon movesets: spear heavy thrusts far forward, hammer light sweeps wide flanks', () => {
    expect(moveOf('hoplomachus', 'heavy').motion).toBe('thrust');
    expect(moveOf('executioner', 'light').motion).toBe('sweep');
    expect(moveOf('dimachaerus', 'light3').motion).toBe('twinCross');
    expect(moveOf('retiarius', 'heavy').motion).toBe('netThrow');

    // Hoplomachus spear heavy reaches 4.7m straight ahead, misses wide flank
    const hop = makeFighter(0, 'player', 0, 0, defaultMods(), 'hoplomachus');
    const farFront = makeFighter(1, 'brute', 0, 4.7, defaultMods(), 'murmillo');
    const sideFlank = makeFighter(2, 'brute', 2.6, 1.5, defaultMods(), 'murmillo'); // ~60 deg off-axis (> PI/5.5)
    hop.atk = 'heavy';
    const evHop = resolveStrike(hop, [farFront, sideFlank]);
    expect(evHop.map((e) => e.victim)).toEqual([1]);

    // Executioner wide sweep clips broad off-axis flank target (~60 deg)
    const exe = makeFighter(3, 'player', 0, 0, defaultMods(), 'executioner');
    const sweptFlank = makeFighter(4, 'brute', 2.1, 1.2, defaultMods(), 'murmillo');
    exe.atk = 'light';
    const evExe = resolveStrike(exe, [sweptFlank]);
    expect(evExe).toHaveLength(1);
    expect(evExe[0].type).toBe('hit');
  });

  it('parry cancels recover/early windup, deflects Executioner heavy, and empowers 1.65x riposte', () => {
    const p = makeFighter(0, 'player', 0, 0, defaultMods(), 'hoplomachus');
    const exe = makeFighter(1, 'brute', 0, 2.2, defaultMods(), 'executioner');
    p.yaw = 0; exe.yaw = Math.PI;
    exe.hp = exe.maxHp = 500;

    // 1. Recovery cancel into sustained tap-parry
    startAttack(p, 'light');
    run(p, 0.34, exe);
    expect(p.state).toBe('recover');
    stepFighter(p, { ...NO_INTENT, parry: true }, 1 / 60, exe);
    expect(p.state).toBe('idle');
    expect(p.blocking).toBe(true);
    // Tap-parry sustains across subsequent NO_INTENT frames within parry window
    run(p, 0.14, exe, NO_INTENT);
    expect(p.blocking).toBe(true);
    expect(p.blockT).toBeLessThanOrEqual(parryWindowOf(p));

    // 2. Timed parry deflects Executioner heavy (even though held block breaks) & grants riposte
    exe.atk = 'heavy';
    const beforeExeStam = exe.stamina;
    const parryEv = resolveStrike(exe, [p]);
    expect(parryEv[0].type).toBe('parry');
    expect(exe.state).toBe('stagger');
    expect(exe.stagger).toBeGreaterThanOrEqual(1.3);
    expect(exe.stamina).toBeLessThan(beforeExeStam);
    expect(p.riposte).toBeGreaterThan(1.0);

    // 3. Riposte deals 1.65x amplified damage
    exe.state = 'idle'; exe.iframes = 0;
    const hpBefore = exe.hp;
    startAttack(p, 'light');
    expect(p.riposteActive).toBe(true);
    const ripEv = resolveStrike(p, [exe]);
    expect(ripEv[0].riposte).toBe(true);
    expect(hpBefore - exe.hp).toBeCloseTo(12 * styleOf('hoplomachus').dmgMul * RIPOSTE_DMG_MUL, 4);

    // 4. Bash still guard-breaks a parrying defender
    stepFighter(p, { ...NO_INTENT, parry: true }, 1 / 60, exe);
    exe.atk = 'bash';
    const bashEv = resolveStrike(exe, [p]);
    expect(bashEv[0].type).toBe('guardBreak');
  });

  it('early windup feint-cancels cleanly into parry', () => {
    const { p, e } = duel();
    startAttack(p, 'heavy');
    stepFighter(p, NO_INTENT, 0.05, e);
    expect(p.state).toBe('windup');
    stepFighter(p, { ...NO_INTENT, parry: true }, 1 / 60, e);
    expect(p.state).toBe('idle');
    expect(p.blocking).toBe(true);
    expect(p.parryHold).toBeGreaterThan(0.15);
  });

  it('revamped tactical AI dodges player windups, punishes blocking, and flanks cleanly', () => {
    const p = makeFighter(0, 'player', 0, 0, defaultMods(), 'murmillo');
    const e1 = makeFighter(1, 'skirmisher', 0, 2.5, defaultMods(), 'dimachaerus');
    const e2 = makeFighter(2, 'skirmisher', 0.5, 2.5, defaultMods(), 'retiarius');
    e1.yaw = Math.PI; e2.yaw = Math.PI;

    // 1. Agile AI dodges incoming player heavies reliably across multiple encounters
    let dodged = false;
    for (let trial = 0; trial < 20 && !dodged; trial++) {
      e1.state = 'idle'; e1.stamina = e1.maxStamina; e1.ai.reactedAtk = false; e1.ai.reactCd = 0;
      p.state = 'windup'; p.atk = 'heavy'; p.t = 0.05;
      const it = aiIntent(e1, p, 1 / 60, [e1]);
      if (it.dodge) dodged = true;
    }
    expect(dodged).toBe(true);

    // 2. AI breaks persistent turtle guard via bash / guardBreak
    e1.state = 'idle'; e1.stamina = e1.maxStamina; e1.x = 0; e1.z = 2.0;
    p.state = 'idle'; p.blocking = true;
    let antiTurtleUsed = false;
    for (let i = 0; i < 90 && !antiTurtleUsed; i++) {
      const it = aiIntent(e1, p, 1 / 60);
      if (it.bash || it.heavy) antiTurtleUsed = true;
    }
    expect(antiTurtleUsed).toBe(true);

    // 3. 2v1 flanking allies compute finite steering without NaN
    p.blocking = false;
    for (let i = 0; i < 120; i++) {
      const it1 = aiIntent(e1, p, 1 / 60, [e1, e2]);
      const it2 = aiIntent(e2, p, 1 / 60, [e1, e2]);
      stepFighter(e1, it1, 1 / 60, p);
      stepFighter(e2, it2, 1 / 60, p);
      expect(Number.isFinite(e1.x + e1.z + e2.x + e2.z)).toBe(true);
    }
  });
});
