import type { Kind } from '../arena/combat';
import type { StyleId } from '../arena/styles';
import type { CapitalId } from '../world/universe';
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
  { title: 'GARBAGE COLLECTION', desc: 'De-rez 2 deleted-file fighters on the Purge Grid.', kind: 'kills', target: 2, denarii: 55, xp: 40, fame: 25 },
  { title: 'ZERO-LATENCY PARRY', desc: 'Land 2 timed Parries [SHIFT] in battle.', kind: 'parries', target: 2, denarii: 70, xp: 50, fame: 35 },
  { title: 'SHATTER THEIR SHELLS', desc: 'Break 2 enemy visors, plates, or holo-shields.', kind: 'armors', target: 2, denarii: 75, xp: 55, fame: 35 },
  { title: 'VECTOR PROTOCOL', desc: 'Win a Purge bout wielding any Vector Spear.', kind: 'win_weapon', weaponFamily: 'spear', target: 1, denarii: 65, xp: 45, fame: 30 },
  { title: 'KERNEL SMASH', desc: 'Win a Purge bout wielding any Hex Maul.', kind: 'win_weapon', weaponFamily: 'warhammer', target: 1, denarii: 80, xp: 55, fame: 40 },
  { title: 'TWIN DAEMONS', desc: 'Win a Purge bout wielding Twin Glitch-Sicas.', kind: 'win_weapon', weaponFamily: 'twinSica', target: 1, denarii: 70, xp: 50, fame: 35 },
  { title: 'UNPATCHED CLEAR', desc: 'Win a Purge bout without drinking a Restore Flask.', kind: 'no_flask', target: 1, denarii: 85, xp: 60, fame: 45 },
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

const RIVAL_NAMES = ['cassius_04.exe', 'titus_old.dll', 'vexar.bin', 'drusus.sys', 'scorpius.tmp', 'octavius.dat', 'valerius.bak', 'brutus.img'];

const TIER1_LOADOUTS: { style: StyleId; loadout: Loadout; tag: string }[] = [
  { style: 'murmillo', tag: 'Pulse Gladius & Buckler', loadout: { weaponId: 'iron_gladius', offhandId: 'wooden_buckler', helmId: 'leather_cap', bodyId: 'recruit_tunic', capeId: 'none' } },
  { style: 'dimachaerus', tag: 'Twin Glitch-Sicas', loadout: { weaponId: 'twin_sica', offhandId: 'none', helmId: 'horned_mask', bodyId: 'recruit_tunic', capeId: 'none' } },
  { style: 'hoplomachus', tag: 'Vector Spear & Streamer', loadout: { weaponId: 'recruit_spear', offhandId: 'wooden_buckler', helmId: 'leather_cap', bodyId: 'retiarius_galerus', capeId: 'tattered_scarf' } },
];

const TIER2_LOADOUTS: { style: StyleId; loadout: Loadout; tag: string }[] = [
  { style: 'retiarius', tag: 'Vector Spear & Trap Net', loadout: { weaponId: 'recruit_spear', offhandId: 'gladiator_net', helmId: 'none', bodyId: 'retiarius_galerus', capeId: 'tattered_scarf' } },
  { style: 'murmillo', tag: 'Circuit Gladius & Holo Scutum', loadout: { weaponId: 'steel_gladius', offhandId: 'tower_scutum', helmId: 'murmillo_galea', bodyId: 'bronze_manica', capeId: 'none' } },
  { style: 'executioner', tag: 'Hex Maul Enforcer', loadout: { weaponId: 'iron_warhammer', offhandId: 'none', helmId: 'iron_cage', bodyId: 'spiked_iron', capeId: 'none' } },
];

const COLOSSEUM_THEMES: Record<CapitalId, {
  mul: number;
  offset: number;
  titles: [string, string, string, string];
  bossName: string;
  wingName: string;
}> = {
  cache_city: {
    mul: 1.0,
    offset: 0,
    titles: ['CACHE SKIRMISH', 'MEMORY DUEL', 'DUAL PROCESS', 'PURGE'],
    bossName: 'crixus_root.sys',
    wingName: 'theokoles_00.img',
  },
  drift_bazaars: {
    mul: 1.1,
    offset: 1,
    titles: ['SCRAP-RING BRAWL', 'AMBER CAGE MATCH', 'TWIN-SCAFFOLD CLASH', 'BAZAAR KINGPIN'],
    bossName: 'torque_v8.tmp',
    wingName: 'brass_jaw.dat',
  },
  cold_vaults: {
    mul: 1.2,
    offset: 2,
    titles: ['SILENT TRIAL', 'CRYSTAL LITURGY', 'CHORUS OF TWO', 'ARCHIVE CHAMPION'],
    bossName: 'solstice_01.sav',
    wingName: 'warden_frost.bin',
  },
  rust_citadel: {
    mul: 1.35,
    offset: 3,
    titles: ['HEAP AMBUSH', 'OVERFLOW SLAUGHTER', 'CRIMSON CROSSFIRE', 'WARLORD PURGE'],
    bossName: 'segfault_rex.err',
    wingName: 'iron_null.bad',
  },
  kernel_spire: {
    mul: 1.5,
    offset: 4,
    titles: ['CHECKSUM DUEL', 'GOLDEN COMPILER', 'ROOT GUARDIANS', 'SOVEREIGN ASCENSION'],
    bossName: 'kernel_prime.sys',
    wingName: 'aegis_00.rom',
  },
};

export function generateFightCards(day: number, fame: number, colosseumId: CapitalId = 'cache_city'): FightCard[] {
  const theme = COLOSSEUM_THEMES[colosseumId] ?? COLOSSEUM_THEMES.cache_city;
  const seed = day + theme.offset;
  const r1 = TIER1_LOADOUTS[(seed - 1) % TIER1_LOADOUTS.length];
  const r2 = TIER2_LOADOUTS[(seed + 1) % TIER2_LOADOUTS.length];
  const name1 = RIVAL_NAMES[seed % RIVAL_NAMES.length];
  const name2 = RIVAL_NAMES[(seed + 3) % RIVAL_NAMES.length];
  const name3a = RIVAL_NAMES[(seed + 2) % RIVAL_NAMES.length];
  const name3b = RIVAL_NAMES[(seed + 5) % RIVAL_NAMES.length];
  const champScaleBonus = fame >= 550 ? 'ROOT-LEVEL' : 'CROWNED';
  const mainTitle = colosseumId === 'cache_city' ? `${champScaleBonus} ${theme.titles[3]}` : theme.titles[3];
  const m = theme.mul;
  const sc = (n: number) => Math.round(n * m);

  return [
    {
      id: `${colosseumId}_d${day}_pit`,
      title: theme.titles[0],
      subtitle: `1v1 · ${name1} (${r1.tag})`,
      tier: 1,
      reqFame: 0,
      denarii: sc(45),
      xp: sc(45),
      fame: sc(25),
      enemies: [{ name: name1, kind: 'skirmisher', style: r1.style, loadout: r1.loadout }],
    },
    {
      id: `${colosseumId}_d${day}_rival`,
      title: theme.titles[1],
      subtitle: `1v1 · ${name2} (${r2.tag})`,
      tier: 2,
      reqFame: 0,
      denarii: sc(80),
      xp: sc(70),
      fame: sc(45),
      enemies: [{ name: name2, kind: 'brute', style: r2.style, loadout: r2.loadout }],
    },
    {
      id: `${colosseumId}_d${day}_gauntlet`,
      title: theme.titles[2],
      subtitle: `2v1 · ${name3a} (Trident & Net) + ${name3b} (Vector Spear)`,
      tier: 3,
      reqFame: 60,
      denarii: sc(140),
      xp: sc(110),
      fame: sc(75),
      enemies: [
        { name: name3a, kind: 'skirmisher', style: 'retiarius' },
        { name: name3b, kind: 'skirmisher', style: 'hoplomachus' },
      ],
    },
    {
      id: `${colosseumId}_d${day}_main`,
      title: mainTitle,
      subtitle: `Main Event · ${theme.bossName} + ${theme.wingName}`,
      tier: 4,
      reqFame: 150,
      denarii: sc(260),
      xp: sc(180),
      fame: sc(140),
      enemies: [
        {
          name: theme.bossName,
          kind: 'champion',
          style: 'hoplomachus',
          loadout: { weaponId: 'champion_spear', offhandId: 'bronze_buckler', helmId: 'corinthian_gold', bodyId: 'champion_cuirass', capeId: 'imperial_mantle' },
        },
        {
          name: theme.wingName,
          kind: 'brute',
          style: 'executioner',
          loadout: { weaponId: 'maul_breaker', offhandId: 'none', helmId: 'iron_cage', bodyId: 'spiked_iron', capeId: 'none' },
        },
      ],
    },
  ];
}
