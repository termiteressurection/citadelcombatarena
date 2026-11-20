import { describe, expect, it } from 'vitest';
import { drinkFlask, makeFighter } from '../arena/combat';
import { resolveLoadout } from '../rpg/items';
import { generateDailyQuests, generateFightCards, updateQuestProgress } from '../rpg/quests';
import { applyXp, buildPlayerMods, xpForNextLevel } from '../rpg/stats';

describe('modular rpg loadout resolution', () => {
  it('resolves Spear + Energy Net hybrid with thrust light and net heavy override', () => {
    const g = resolveLoadout({
      weaponId: 'recruit_spear',
      offhandId: 'gladiator_net',
      helmId: 'horned_mask',
      bodyId: 'retiarius_galerus',
      capeId: 'tattered_scarf',
    });
    expect(g.netHeavy).toBe(true);
    expect(g.hasShield).toBe(false);
    expect(g.moves.light.motion).toBe('thrust');
    expect(g.moves.heavy.motion).toBe('netThrow');
    expect(g.visuals.weapon).toBe('spear');
    expect(g.visuals.offhand).toBe('net');
    expect(g.armor.helm).toBe(20);
    expect(g.armor.pauldron).toBe(24);
  });

  it('ignores offhand and disables shield when equipping a 2H warhammer', () => {
    const g = resolveLoadout({
      weaponId: 'iron_warhammer',
      offhandId: 'tower_scutum',
      helmId: 'iron_cage',
      bodyId: 'spiked_iron',
      capeId: 'none',
    });
    expect(g.hasShield).toBe(false);
    expect(g.armor.shield).toBe(0);
    expect(g.visuals.offhand).toBe('none');
    expect(g.heavyBreaksBlock).toBe(true);
    expect(g.blunt).toBe(true);
  });

  it('sets dualWield and ignores offhand when equipping twin sica', () => {
    const g = resolveLoadout({
      weaponId: 'twin_sica',
      offhandId: 'bronze_buckler',
      helmId: 'leather_cap',
      bodyId: 'recruit_tunic',
      capeId: 'none',
    });
    expect(g.dualWield).toBe(true);
    expect(g.hasShield).toBe(false);
    expect(g.visuals.offhand).toBe('none');
    expect(g.visuals.weapon).toBe('twinSica');
  });
});

describe('rpg progression, stats, and flasks', () => {
  it('handles multi-level XP rollovers and grants 3 stat points per level', () => {
    const need1 = xpForNextLevel(1);
    const need2 = xpForNextLevel(2);
    const res = applyXp(1, 0, 2, need1 + need2 + 12);
    expect(res.level).toBe(3);
    expect(res.xp).toBe(12);
    expect(res.levelsGained).toBe(2);
    expect(res.statPoints).toBe(8);
  });

  it('scales combat modifiers from attributes, armor bonuses, and daily buffs', () => {
    const g = resolveLoadout({
      weaponId: 'steel_gladius',
      offhandId: 'bronze_buckler',
      helmId: 'corinthian_gold',
      bodyId: 'champion_cuirass',
      capeId: 'imperial_mantle',
    });
    const m = buildPlayerMods(
      { vit: 3, str: 3, agi: 3, end: 3, tec: 3 },
      g,
      ['honey_bread', 'iron_wine', 'whetstone_oil'],
    );
    expect(m.maxHp).toBe(2 * 14 + g.bonusHp + 25);
    expect(m.dmg).toBeCloseTo(1 + 2 * 0.06 + 0.15);
    expect(m.speed).toBeCloseTo(1 + 2 * 0.035);
    expect(m.dodgeCost).toBeGreaterThan(0);
    expect(m.maxStamina).toBe(20);
    expect(m.stamRegen).toBeCloseTo(1 + 2 * 0.08 + 0.25);
    expect(m.parryWindow).toBeCloseTo(2 * 0.015);
    expect(m.riposteBonus).toBeCloseTo(2 * 0.03);
    expect(m.glory).toBeCloseTo(g.fameMul);
  });

  it('heals 45% HP and bruised limbs via drinkFlask without regrowing severed limbs', () => {
    const f = makeFighter(0, 'player', 0, 0);
    expect(drinkFlask(f)).toBe(false); // already full HP

    f.hp = 20;
    f.limbs.armL.hp = 5;
    f.limbs.legR.hp = 0;
    f.limbs.legR.severed = true;
    expect(drinkFlask(f)).toBe(true);
    expect(f.hp).toBeCloseTo(20 + f.maxHp * 0.45);
    expect(f.limbs.armL.hp).toBeGreaterThan(5);
    expect(f.limbs.legR.hp).toBe(0);
    expect(f.limbs.legR.severed).toBe(true);

    f.state = 'dead';
    f.hp = 10;
    expect(drinkFlask(f)).toBe(false);
  });
});

describe('daily quests and colosseum fight cards', () => {
  it('generates daily quests, tracks bout telemetry, and builds 4 fight cards', () => {
    const quests = generateDailyQuests(1);
    expect(quests).toHaveLength(3);

    const updated = updateQuestProgress(
      [
        { id: 'q_kill', title: 'K', desc: '', kind: 'kills', target: 2, progress: 0, denarii: 10, xp: 10, fame: 5, claimed: false },
        { id: 'q_wpn', title: 'W', desc: '', kind: 'win_weapon', weaponFamily: 'spear', target: 1, progress: 0, denarii: 10, xp: 10, fame: 5, claimed: false },
        { id: 'q_pure', title: 'P', desc: '', kind: 'no_flask', target: 1, progress: 0, denarii: 10, xp: 10, fame: 5, claimed: false },
      ],
      { victory: true, kills: 3, parries: 1, armorsBroken: 1, limbsSevered: 0, usedFlask: true, weaponFamily: 'spear' },
    );

    expect(updated[0].progress).toBe(2); // clamped to target
    expect(updated[1].progress).toBe(1); // spear win counted
    expect(updated[2].progress).toBe(0); // used flask -> not counted

    const cards = generateFightCards(1, 0);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.tier)).toEqual([1, 2, 3, 4]);
    expect(cards[3].enemies[0].loadout).toBeDefined();
  });
});
