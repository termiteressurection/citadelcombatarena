import { afterEach, describe, expect, it } from 'vitest';
import {
  finisherChoreoForWeapon, makeFighter, reactionForZone, resolveStrike, startAttack, stepFighter,
  tryExecute, NO_INTENT,
} from '../arena/combat';
import { sfx } from '../art/sfx';
import { ECHO_CORES, resolveLoadout } from '../rpg/items';
import { createDefaultNemesisRoster, nemesisFightCardFor, recordNemesisEncounter } from '../rpg/nemesis';
import { COMPANIONS, REGIONAL_STORIES, nearestStoryStage } from '../rpg/stories';
import { useGame } from '../store';
import { createCityPopulation, stepNpcTrafficYield } from '../world/citizens';
import { isFree } from '../world/colliders';
import { PROPERTIES, propertyRentPayout } from '../world/properties';
import {
  HIGHWAY_SEGMENTS, WORLD_BOUNDS, collidersNear, isGhostVillage, nearestHighwayPoint,
} from '../world/universe';

const initialState = useGame.getState();
afterEach(() => {
  useGame.setState(initialState, true);
});

describe('BONEYARD v3.0 — Pillar 1: Hit Reactions & 5 Finisher Choreographies', () => {
  it('maps every target zone to directional hit reactions and weapon families to unique finishers', () => {
    expect(reactionForZone('head', false)).toBe('head_snap');
    expect(reactionForZone('legL', false)).toBe('leg_trip');
    expect(reactionForZone('torso', true)).toBe('gut_crunch');
    expect(reactionForZone('armR', false)).toBe('chest_recoil');

    expect(finisherChoreoForWeapon('gladius')).toBe('gladius_throat');
    expect(finisherChoreoForWeapon('spear')).toBe('spear_impale');
    expect(finisherChoreoForWeapon('twinSica')).toBe('twin_scissor');
    expect(finisherChoreoForWeapon('warhammer')).toBe('hammer_flatten');
    expect(finisherChoreoForWeapon('trident')).toBe('trident_pin');

    const gear = resolveLoadout({
      weaponId: 'iron_warhammer', offhandId: 'none', helmId: 'none', bodyId: 'recruit_tunic', capeId: 'none',
    });
    const a = makeFighter(0, 'player', 0, 0, undefined, 'executioner', gear);
    const v = makeFighter(1, 'skirmisher', 0, 1.5);
    v.dazed = 2.0;
    const exec = tryExecute(a, [v]);
    expect(exec?.finisherChoreo).toBe('hammer_flatten');
    expect(a.finisherChoreo).toBe('hammer_flatten');
    expect(a.finisherT).toBeGreaterThan(0);
  });

  it('assigns hitReaction on strike impact and applies Echo Core weapon socket traits', () => {
    const freezeGear = resolveLoadout({
      weaponId: 'iron_gladius', offhandId: 'none', helmId: 'none', bodyId: 'recruit_tunic', capeId: 'none',
      coreId: 'frame_freeze',
    });
    const siphonGear = resolveLoadout({
      weaponId: 'iron_gladius', offhandId: 'none', helmId: 'none', bodyId: 'recruit_tunic', capeId: 'none',
      coreId: 'cycle_siphon',
    });
    expect(freezeGear.coreColor).toBe('#a78bfa');

    const a = makeFighter(0, 'player', 0, 0, undefined, 'murmillo', freezeGear);
    const v = makeFighter(1, 'brute', 0, 1.8);
    a.yaw = 0;
    startAttack(a, 'heavy');
    const evs = resolveStrike(a, [v]);
    expect(evs).toHaveLength(1);
    expect(evs[0].hitReaction).toBe('head_snap');
    expect(evs[0].coreEffect).toBe('frame_freeze');
    expect(v.snared).toBeGreaterThanOrEqual(1.5);
    expect(v.hitReactionT).toBeGreaterThan(0);

    const a2 = makeFighter(2, 'player', 0, 0, undefined, 'murmillo', siphonGear);
    a2.hp = 50;
    a2.stamina = 40;
    const v2 = makeFighter(3, 'brute', 0, 1.8);
    startAttack(a2, 'heavy');
    const evs2 = resolveStrike(a2, [v2]);
    expect(evs2[0].coreEffect).toBe('cycle_siphon');
    expect(a2.hp).toBe(56);
    expect(a2.stamina).toBe(24);

    stepFighter(v, NO_INTENT, 0.1, null);
    expect(v.hitReactionT).toBeLessThan(0.42);
  });
});

describe('BONEYARD v3.0 — Pillar 2: Data-Highways, Traffic Yielding & Walk-Inside Trophy Homes', () => {
  it('connects capitals & satellites via curved Data-Highways and opens property doorways for interior entry', () => {
    expect(HIGHWAY_SEGMENTS.length).toBeGreaterThanOrEqual(25);
    for (const seg of HIGHWAY_SEGMENTS) {
      expect(seg.length).toBeGreaterThan(5);
      expect(Math.hypot(seg.ux, seg.uz)).toBeCloseTo(1, 3);
    }
    const nearHw = nearestHighwayPoint(0, 200);
    expect(nearHw.dist).toBeLessThan(200);

    // Every property interior center (x, z + 0.2) is walkable through the front doorway
    for (const prop of PROPERTIES.slice(0, 10)) {
      const solids = collidersNear(prop.x, prop.z);
      expect(isFree(prop.x, prop.z + 0.2, 0.55, solids, WORLD_BOUNDS)).toBe(true);
    }
  });

  it('enforces right-hand highway lane offsets and smooth yielding behind slower vehicles or player', () => {
    const npcs = createCityPopulation();
    const rider = npcs.find((n) => n.onVehicle) ?? npcs[0];
    rider.onVehicle = true;
    rider.x = 0;
    rider.z = 0;
    rider.yaw = 0; // facing +Z
    const clear = stepNpcTrafficYield(rider, 0, -50, npcs);
    expect(clear.laneOffset).toBeCloseTo(1.8);
    expect(clear.speedMul).toBe(1);

    const yielding = stepNpcTrafficYield(rider, 0.4, 2.5, npcs);
    expect(yielding.speedMul).toBeLessThan(0.5);
  });
});

describe('BONEYARD v3.0 — Pillar 3: Fable × RDR2 Stories & Recruitable Wingmen', () => {
  it('defines 5 two-stage regional stories with HELP/EXTORT/EXPOSE/DUEL choices and recruits Wingmen', () => {
    expect(REGIONAL_STORIES).toHaveLength(5);
    expect(COMPANIONS.length).toBeGreaterThanOrEqual(4);
    for (const st of REGIONAL_STORIES) {
      expect(st.stages).toHaveLength(2);
      for (const stage of st.stages) {
        expect(stage.choices.map((c) => c.verb)).toEqual(['HELP', 'EXTORT', 'EXPOSE', 'DUEL']);
      }
    }

    const first = REGIONAL_STORIES[0];
    const hit = nearestStoryStage(first.stages[0].x, first.stages[0].z, useGame.getState().storyProgress);
    expect(hit?.story.id).toBe(first.id);

    const beforeC = useGame.getState().denarii;
    const res1 = useGame.getState().chooseStoryOption(first.id, 'HELP');
    expect(res1?.completed).toBe(false);
    expect(useGame.getState().denarii).toBeGreaterThan(beforeC);

    const res2 = useGame.getState().chooseStoryOption(first.id, 'DUEL');
    expect(res2?.completed).toBe(true);
    expect(useGame.getState().unlockedCompanions).toContain('zip_wing');
    expect(useGame.getState().pendingStoryDuel).not.toBeNull();
    useGame.getState().clearPendingStoryDuel();
  });
});

describe('BONEYARD v3.0 — Pillar 4 & 5: Nemesis League, Core Socketing, Audio & Restore Protocol', () => {
  it('adapts Nemesis Rivals with prosthetic cyber-limbs & counter-gear and builds Nemesis Fight Cards', () => {
    const roster = createDefaultNemesisRoster();
    const updated = recordNemesisEncounter(roster, 'cache_city', {
      victory: true,
      weaponFamily: 'spear',
      severedLimbs: ['armL'],
      executed: true,
    });
    const rival = updated.cache_city;
    expect(rival.level).toBe(2);
    expect(rival.cyberLimbs.armL).toBe(true);
    expect(rival.adaptedAgainst).toBe('spear');
    expect(rival.counterLabel).toBe('TRAP-NET ANTI-LANCE');

    const card = nemesisFightCardFor(rival);
    expect(card.denarii).toBeGreaterThanOrEqual(350);
  });

  it('sockets Echo Cores, settles Grand Prix Parlays, defeats V0.1 Boss, and completes Restore Protocol endings', () => {
    expect(ECHO_CORES.length).toBeGreaterThanOrEqual(5);
    expect(useGame.getState().buyOrEquipCore('volt_arc')).toBe(true);
    expect(useGame.getState().loadout.coreId).toBe('volt_arc');

    // Grand Prix 3.8× Parlay bracket wager
    useGame.setState({ denarii: 500 });
    expect(useGame.getState().startGrandPrixParlay('cache_city', 100)).toBe(true);
    expect(useGame.getState().denarii).toBe(400);
    const gpCard = useGame.getState().selectedCard!;
    const gpOut = useGame.getState().settleBout({
      victory: true, kills: 2, parries: 1, armorsBroken: 0, limbsSevered: 0, usedFlask: false,
      weaponFamily: 'gladius', card: gpCard,
    });
    expect(gpOut.denariiDelta).toBe(380);
    expect(useGame.getState().denarii).toBe(780);
    useGame.getState().setScene('ludus');

    // Audio synthesizer runs safely in Node headless tests
    sfx.stepMusic({ biome: 'kernel', combat: true, onCycle: true, dt: 0.25 });
    sfx.taunt();
    sfx.restoreWave();

    // Version 0.1 Wireframe Boss victory unlocks proto_wire_blade & +2 Spec Points
    const prevSpecs = useGame.getState().statPoints;
    useGame.getState().startV01BossBout();
    const v01Card = useGame.getState().selectedCard!;
    useGame.getState().settleBout({
      victory: true, kills: 1, parries: 1, armorsBroken: 0, limbsSevered: 0, usedFlask: false,
      weaponFamily: 'gladius', card: v01Card,
    });
    expect(useGame.getState().v01BossDefeated).toBe(true);
    expect(useGame.getState().ownedWeapons).toContain('proto_wire_blade');
    expect(useGame.getState().statPoints).toBeGreaterThanOrEqual(prevSpecs + 2);
    useGame.getState().setScene('ludus');

    // Restore Protocol Finale Boss + Ghost Village / Sovereign Root endings
    expect(isGhostVillage('wreck_v01')).toBe(true);
    expect(isGhostVillage('cache_city')).toBe(false);

    useGame.getState().startRestoreProtocolBout();
    const gcCard = useGame.getState().selectedCard!;
    useGame.getState().settleBout({
      victory: true, kills: 2, parries: 2, armorsBroken: 1, limbsSevered: 1, usedFlask: false,
      weaponFamily: 'gladius', card: gcCard,
    });
    expect(useGame.getState().activeSpecialModal).toBe('restore_choice');
    useGame.getState().setScene('ludus');
    expect(useGame.getState().activeSpecialModal).toBe('restore_choice');

    useGame.getState().completeRestoreProtocol('sovereign');
    expect(useGame.getState().restoreProtocolState).toBe('sovereign');

    // Sovereign Root +50% property rent boost check
    const prop = PROPERTIES[0];
    useGame.setState({ ownedProperties: { [prop.id]: { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 1 } } });
    const beforeRent = useGame.getState().denarii;
    const rentRes = useGame.getState().collectPropertyRent();
    const basePay = propertyRentPayout(prop, { id: prop.id, mode: 'rent', rentRate: 'fair', tier: 1 });
    expect(rentRes.total).toBe(Math.round(basePay * 1.5));
    expect(useGame.getState().denarii).toBe(beforeRent + rentRes.total);
  });
});
