import type { Kind } from '../arena/combat';
import type { StyleId } from '../arena/styles';
import type { Loadout, WeaponFamily } from './items';

export type QuestKind = 'kills' | 'parries' | 'armors' | 'win_weapon' | 'no_flask';

export interface Quest {
  id: string;
  title: string;
  desc: string;
  kind: QuestKind;
  weaponFamily?: WeaponFamily;
  target: number;
  progress: number;
  denarii: number;
  xp: number;
  fame: number;
  claimed: boolean;
}

export interface BoutSummary {
  victory: boolean;
  kills: number;
  parries: number;
  armorsBroken: number;
  limbsSevered: number;
  usedFlask: boolean;
  weaponFamily: WeaponFamily;
}

export interface FightEnemy {
  name: string;
  kind: Kind;
  style: StyleId;
  loadout?: Loadout;
}

export interface FightCard {
  id: string;
  title: string;
  subtitle: string;
  tier: 1 | 2 | 3 | 4;
  reqFame: number;
  denarii: number;
  xp: number;
  fame: number;
  enemies: FightEnemy[];
}

const QUEST_POOL: Omit<Quest, 'id' | 'progress' | 'claimed'>[] = [
  { title: 'BLOOD ON THE SAND', desc: 'Defeat 2 gladiators in the Colosseum.', kind: 'kills', target: 2, denarii: 55, xp: 40, fame: 25 },
  { title: 'IRON TIMING', desc: 'Land 2 timed Parries [SHIFT] in battle.', kind: 'parries', target: 2, denarii: 70, xp: 50, fame: 35 },
  { title: 'SHATTER THEIR PRIDE', desc: 'Break 2 enemy helms, pauldrons, or shields.', kind: 'armors', target: 2, denarii: 75, xp: 55, fame: 35 },
  { title: 'PHALANX TRIAL', desc: 'Win a bout wielding any Spear.', kind: 'win_weapon', weaponFamily: 'spear', target: 1, denarii: 65, xp: 45, fame: 30 },
  { title: 'CRUSHING SHOW', desc: 'Win a bout wielding any Warhammer.', kind: 'win_weapon', weaponFamily: 'warhammer', target: 1, denarii: 80, xp: 55, fame: 40 },
  { title: 'TWIN FANGS', desc: 'Win a bout wielding Twin Curved Sica.', kind: 'win_weapon', weaponFamily: 'twinSica', target: 1, denarii: 70, xp: 50, fame: 35 },
  { title: 'PURIST VICTORY', desc: 'Win a bout without drinking a Healing Flask.', kind: 'no_flask', target: 1, denarii: 85, xp: 60, fame: 45 },
];

export function generateDailyQuests(day: number): Quest[] {
  const n = QUEST_POOL.length;
  const start = ((day - 1) * 3) % n;
  const picks = [0, 2, 5].map((off) => QUEST_POOL[(start + off) % n]);
  return picks.map((q, i) => ({
    ...q,
    id: `d${day}_q${i}_${q.kind}`,
    progress: 0,
    claimed: false,
  }));
}

export function updateQuestProgress(quests: Quest[], summary: BoutSummary): Quest[] {
  return quests.map((q) => {
    if (q.claimed || q.progress >= q.target) return q;
    let delta = 0;
    if (q.kind === 'kills') delta = summary.kills;
    else if (q.kind === 'parries') delta = summary.parries;
    else if (q.kind === 'armors') delta = summary.armorsBroken;
    else if (q.kind === 'win_weapon' && summary.victory && summary.weaponFamily === q.weaponFamily) delta = 1;
    else if (q.kind === 'no_flask' && summary.victory && !summary.usedFlask) delta = 1;
    if (delta <= 0) return q;
    return { ...q, progress: Math.min(q.target, q.progress + delta) };
  });
}

const RIVAL_NAMES = ['CASSIUS', 'TITUS', 'VEXAR', 'DRUSUS', 'SCORPIUS', 'OCTAVIUS', 'VALERIUS', 'BRUTUS'];

const TIER1_LOADOUTS: { style: StyleId; loadout: Loadout; tag: string }[] = [
  { style: 'murmillo', tag: 'Gladius & Buckler', loadout: { weaponId: 'iron_gladius', offhandId: 'wooden_buckler', helmId: 'leather_cap', bodyId: 'recruit_tunic', capeId: 'none' } },
  { style: 'dimachaerus', tag: 'Twin Sica Initiate', loadout: { weaponId: 'twin_sica', offhandId: 'none', helmId: 'horned_mask', bodyId: 'recruit_tunic', capeId: 'none' } },
  { style: 'hoplomachus', tag: 'Spear & Scarf', loadout: { weaponId: 'recruit_spear', offhandId: 'wooden_buckler', helmId: 'leather_cap', bodyId: 'retiarius_galerus', capeId: 'tattered_scarf' } },
];

const TIER2_LOADOUTS: { style: StyleId; loadout: Loadout; tag: string }[] = [
  { style: 'retiarius', tag: 'Spear & Energy Net Hybrid', loadout: { weaponId: 'recruit_spear', offhandId: 'gladiator_net', helmId: 'none', bodyId: 'retiarius_galerus', capeId: 'tattered_scarf' } },
  { style: 'murmillo', tag: 'Tempered Gladius & Scutum', loadout: { weaponId: 'steel_gladius', offhandId: 'tower_scutum', helmId: 'murmillo_galea', bodyId: 'bronze_manica', capeId: 'none' } },
  { style: 'executioner', tag: 'Warhammer Bruiser', loadout: { weaponId: 'iron_warhammer', offhandId: 'none', helmId: 'iron_cage', bodyId: 'spiked_iron', capeId: 'none' } },
];

export function generateFightCards(day: number, fame: number): FightCard[] {
  const r1 = TIER1_LOADOUTS[(day - 1) % TIER1_LOADOUTS.length];
  const r2 = TIER2_LOADOUTS[(day + 1) % TIER2_LOADOUTS.length];
  const name1 = RIVAL_NAMES[day % RIVAL_NAMES.length];
  const name2 = RIVAL_NAMES[(day + 3) % RIVAL_NAMES.length];
  const name3a = RIVAL_NAMES[(day + 2) % RIVAL_NAMES.length];
  const name3b = RIVAL_NAMES[(day + 5) % RIVAL_NAMES.length];
  const champScaleBonus = fame >= 550 ? 'LEGENDARY' : 'CROWNED';

  return [
    {
      id: `d${day}_pit`,
      title: 'PIT SKIRMISH',
      subtitle: `1v1 · ${name1} (${r1.tag})`,
      tier: 1,
      reqFame: 0,
      denarii: 45,
      xp: 45,
      fame: 25,
      enemies: [{ name: name1, kind: 'skirmisher', style: r1.style, loadout: r1.loadout }],
    },
    {
      id: `d${day}_rival`,
      title: 'RIVAL DUEL',
      subtitle: `1v1 · ${name2} (${r2.tag})`,
      tier: 2,
      reqFame: 0,
      denarii: 80,
      xp: 70,
      fame: 45,
      enemies: [{ name: name2, kind: 'brute', style: r2.style, loadout: r2.loadout }],
    },
    {
      id: `d${day}_gauntlet`,
      title: 'TWIN GAUNTLET',
      subtitle: `2v1 · ${name3a} (Trident & Net) + ${name3b} (Spear)`,
      tier: 3,
      reqFame: 60,
      denarii: 140,
      xp: 110,
      fame: 75,
      enemies: [
        { name: name3a, kind: 'skirmisher', style: 'retiarius' },
        { name: name3b, kind: 'skirmisher', style: 'hoplomachus' },
      ],
    },
    {
      id: `d${day}_main`,
      title: `${champScaleBonus} MAIN EVENT`,
      subtitle: 'Championship · Gilded Spear Champion + Warhammer Enforcer',
      tier: 4,
      reqFame: 150,
      denarii: 260,
      xp: 180,
      fame: 140,
      enemies: [
        {
          name: 'Crixus Imperator',
          kind: 'champion',
          style: 'hoplomachus',
          loadout: { weaponId: 'champion_spear', offhandId: 'bronze_buckler', helmId: 'corinthian_gold', bodyId: 'champion_cuirass', capeId: 'imperial_mantle' },
        },
        {
          name: 'THEOKOLES',
          kind: 'brute',
          style: 'executioner',
          loadout: { weaponId: 'maul_breaker', offhandId: 'none', helmId: 'iron_cage', bodyId: 'spiked_iron', capeId: 'none' },
        },
      ],
    },
  ];
}
