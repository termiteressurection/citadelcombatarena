import { create } from 'zustand';
import { PLAYER_START, type StationId } from './world/layout';
import { CAPITALS, COLOSSEUMS, SETTLEMENTS, type CapitalId } from './world/universe';
import { MEMORY_ECHOES } from './world/MemoryWoods';
import {
  PROPERTY_BY_ID, discountedCost, propertyRenovateCost, propertyRentPayout, propertySellValue,
  reputationDeltaForRent, type OwnedPropertyState, type PropertyMode, type RentRate,
} from './world/properties';
import { LOOKS } from './arena/run';
import { type Kind, type LimbKey, type StanceHeight } from './arena/combat';
import { STYLE_IDS, type StyleId } from './arena/styles';
import {
  BODIES, CAPES, DEFAULT_LOADOUT, ECHO_CORES, HELMS, OFFHANDS, WEAPONS, resolveLoadout,
  type EchoCoreId, type GearSlot, type Loadout,
} from './rpg/items';
import {
  CONSUMABLES, DEFAULT_STATS, MAX_FLASKS, applyXp,
  type ConsumableId, type DailyBuffId, type RpgStats, type StatKey,
} from './rpg/stats';
import { generateFightCards, updateQuestProgress, type BoutSummary, type FightCard, type Quest } from './rpg/quests';
import {
  createInitialStoryProgress, REGIONAL_STORIES, type StoryChoiceVerb, type StoryProgressState,
} from './rpg/stories';
import {
  createDefaultNemesisRoster, nemesisFightCardFor, recordNemesisEncounter, type NemesisRival,
} from './rpg/nemesis';

export type Scene = 'ludus' | 'arena';
export type TimeOfDay = 'morning' | 'dusk';
export type BoutWagerId = 'standard' | 'blood' | 'executioner';

export interface WagerDef {
  id: BoutWagerId;
  name: string;
  desc: string;
  mult: number;
  fameMult: number;
}

export const WAGER_OATHS: Record<BoutWagerId, WagerDef> = {
  standard: {
    id: 'standard',
    name: 'STANDARD PURSE',
    desc: 'Standard rules. Base 1.0× Cycles purse.',
    mult: 1.0,
    fameMult: 1.0,
  },
  blood: {
    id: 'blood',
    name: 'BLOOD WAGER',
    desc: 'Win WITHOUT Restore Flasks → 2.2× Cycles & 1.4× Signal.',
    mult: 2.2,
    fameMult: 1.4,
  },
  executioner: {
    id: 'executioner',
    name: "EXECUTIONER'S OATH",
    desc: 'Win with a Limb Sever / Decapitation → 3.2× Cycles & 1.6× Signal.',
    mult: 3.2,
    fameMult: 1.6,
  },
};

export interface DeadlockResult {
  dice: [number, number];
  sum: number;
  mode: 'safe' | 'overclock';
  bet: number;
  won: boolean;
  payout: number;
  net: number;
  label: string;
}

export interface EchoHudInfo {
  id: string;
  title: string;
  color: string;
  dist: number;
  bearing: string;
}

export interface SpectatorFighterSpec {
  name: string;
  title: string;
  style: StyleId;
  kind: Kind;
  color: string;
  odds: number;
}

export interface SpectatorBout {
  id: string;
  red: SpectatorFighterSpec;
  blue: SpectatorFighterSpec;
  pickedCorner: 'red' | 'blue';
  wager: number;
}

const SPECTATOR_ROSTER: { name: string; title: string; style: StyleId; kind: Kind; color: string; baseOdds: number }[] = [
  { name: 'VECTOR_VIPER.EXE', title: 'Aqueduct Striker', style: 'hoplomachus', kind: 'skirmisher', color: '#3ff0ff', baseOdds: 1.85 },
  { name: 'NULL_HAMMER.BIN', title: 'Stack Crusher', style: 'executioner', kind: 'brute', color: '#ff4fd8', baseOdds: 1.75 },
  { name: 'PRISM_SICA.DLL', title: 'Glitch Dancer', style: 'dimachaerus', kind: 'skirmisher', color: '#ff6b6b', baseOdds: 2.05 },
  { name: 'HEX_NET.SYS', title: 'Cache Trapper', style: 'retiarius', kind: 'skirmisher', color: '#4dffa0', baseOdds: 2.25 },
  { name: 'CHROME_AEGIS.ROM', title: 'Sector Sentinel', style: 'murmillo', kind: 'brute', color: '#ffc95c', baseOdds: 1.95 },
  { name: 'KERNEL_FANG.DAT', title: 'Overflow Duelist', style: 'dimachaerus', kind: 'champion', color: '#a78bfa', baseOdds: 2.45 },
];

export function generateSpectatorMatchup(
  day: number,
  colosseumId: CapitalId,
): { red: SpectatorFighterSpec; blue: SpectatorFighterSpec } {
  const seed = Math.abs(day * 17 + colosseumId.charCodeAt(0) * 13);
  const redIdx = seed % SPECTATOR_ROSTER.length;
  const blueIdx = (seed + 1 + (seed % (SPECTATOR_ROSTER.length - 1))) % SPECTATOR_ROSTER.length;
  const r = SPECTATOR_ROSTER[redIdx];
  const b = SPECTATOR_ROSTER[blueIdx === redIdx ? (redIdx + 1) % SPECTATOR_ROSTER.length : blueIdx];
  const redOdds = Number(Math.max(1.65, Math.min(2.45, r.baseOdds + (b.kind === 'brute' ? 0.15 : 0))).toFixed(2));
  const blueOdds = Number(Math.max(1.65, Math.min(2.45, b.baseOdds + (r.kind === 'champion' ? 0.2 : 0))).toFixed(2));
  return {
    red: { name: r.name, title: r.title, style: r.style, kind: r.kind, color: r.color, odds: redOdds },
    blue: { name: b.name, title: b.title, style: b.style, kind: b.kind, color: b.color, odds: blueOdds },
  };
}

export interface Fallen { name: string; bouts: number; cause: string; date: string }

export interface BoutOutcome {
  victory: boolean;
  denariiDelta: number;
  fameDelta: number;
  xpEarned: number;
  levelsGained: number;
  healerFee: number;
  cause?: string;
  wagerId?: BoutWagerId;
  wagerFulfilled?: boolean;
  beltEarned?: string;
}

interface Save {
  day: number;
  timeOfDay: TimeOfDay;
  denarii: number;
  fame: number;
  level: number;
  xp: number;
  statPoints: number;
  stats: RpgStats;
  loadout: Loadout;
  ownedWeapons: string[];
  ownedOffhands: string[];
  ownedHelms: string[];
  ownedBodies: string[];
  ownedCapes: string[];
  flasks: number;
  dailyBuffs: DailyBuffId[];
  trainedToday: boolean;
  activeQuests: Quest[];
  completedQuestIds: string[];
  wins: number;
  losses: number;
  champions: number;
  glory: number;
  unlocks: string[];
  fallen: Fallen[];
  look: string;
  style: StyleId;
  ps1Mode: boolean;
  bounty: number;
  discoveredSettlements: string[];
  ownedProperties: Record<string, OwnedPropertyState>;
  reputation: number;
  lastWorldPos: { x: number; z: number };
  activeColosseumId: CapitalId;
  claimedEchoes: string[];
  championBelts: CapitalId[];
  storyProgress: Record<string, StoryProgressState>;
  unlockedCompanions: string[];
  activeCompanionId: string | null;
  ownedCores: EchoCoreId[];
  nemesisRoster: Record<CapitalId, NemesisRival>;
  v01BossDefeated: boolean;
  restoreProtocolState: 'none' | 'restored' | 'sovereign';
}

const KEY_V3 = 'boneyard.save.v3';
const KEY_V2 = 'boneyard.save.v2';
const KEY_V1 = 'boneyard.save.v1';

const DEFAULT_CAPITALS = CAPITALS.map((c) => c.id);
const VALID_SETTLEMENTS = new Set(SETTLEMENTS.map((s) => s.id));
const VALID_CAPITALS = new Set<string>(CAPITALS.map((c) => c.id));
const VALID_ECHOES = new Set(MEMORY_ECHOES.map((e) => e.id));
const VALID_CORES = new Set<string>(ECHO_CORES.map((c) => c.id));

const blank = (): Save => ({
  day: 1,
  timeOfDay: 'morning',
  denarii: 50,
  fame: 0,
  level: 1,
  xp: 0,
  statPoints: 2,
  stats: { ...DEFAULT_STATS },
  loadout: { ...DEFAULT_LOADOUT },
  ownedWeapons: ['iron_gladius'],
  ownedOffhands: ['none', 'wooden_buckler'],
  ownedHelms: ['none', 'leather_cap'],
  ownedBodies: ['recruit_tunic'],
  ownedCapes: ['none'],
  flasks: 1,
  dailyBuffs: [],
  trainedToday: false,
  activeQuests: [],
  completedQuestIds: [],
  wins: 0,
  losses: 0,
  champions: 0,
  glory: 0,
  unlocks: ['cyan'],
  fallen: [],
  look: 'cyan',
  style: 'murmillo',
  ps1Mode: true,
  bounty: 0,
  discoveredSettlements: [...DEFAULT_CAPITALS],
  ownedProperties: {},
  reputation: 0,
  lastWorldPos: { x: PLAYER_START.x, z: PLAYER_START.z },
  activeColosseumId: 'cache_city',
  claimedEchoes: [],
  championBelts: [],
  storyProgress: createInitialStoryProgress(),
  unlockedCompanions: ['ares_wing'],
  activeCompanionId: 'ares_wing',
  ownedCores: ['none', 'volt_arc'],
  nemesisRoster: createDefaultNemesisRoster(),
  v01BossDefeated: false,
  restoreProtocolState: 'none',
});

function mergeOwned(base: string[], raw: unknown, validIds: Set<string>): string[] {
  const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && validIds.has(x)) : [];
  return Array.from(new Set([...base, ...arr]));
}

export function loadSave(): Save {
  const b = blank();
  if (typeof localStorage === 'undefined') return b;
  try {
    const raw3 = localStorage.getItem(KEY_V3);
    const raw2 = !raw3 ? localStorage.getItem(KEY_V2) : null;
    const raw1 = !raw3 && !raw2 ? localStorage.getItem(KEY_V1) : null;
    const raw = raw3 ?? raw2 ?? raw1;
    if (!raw) return b;
    const p = JSON.parse(raw);

    const lookIds = new Set(LOOKS.map((l) => l.id));
    const unlocks = mergeOwned(['cyan'], p.unlocks, lookIds);
    const validStyles = new Set<string>(STYLE_IDS);

    const wIds = new Set(WEAPONS.map((x) => x.id));
    const oIds = new Set(OFFHANDS.map((x) => x.id));
    const hIds = new Set(HELMS.map((x) => x.id));
    const bIds = new Set(BODIES.map((x) => x.id));
    const cIds = new Set(CAPES.map((x) => x.id));

    const ownedWeapons = mergeOwned(b.ownedWeapons, p.ownedWeapons, wIds);
    const ownedOffhands = mergeOwned(b.ownedOffhands, p.ownedOffhands, oIds);
    const ownedHelms = mergeOwned(b.ownedHelms, p.ownedHelms, hIds);
    const ownedBodies = mergeOwned(b.ownedBodies, p.ownedBodies, bIds);
    const ownedCapes = mergeOwned(b.ownedCapes, p.ownedCapes, cIds);

    const rawL = p.loadout ?? {};
    const loadout: Loadout = {
      weaponId: typeof rawL.weaponId === 'string' && wIds.has(rawL.weaponId) ? rawL.weaponId : b.loadout.weaponId,
      offhandId: typeof rawL.offhandId === 'string' && oIds.has(rawL.offhandId) ? rawL.offhandId : b.loadout.offhandId,
      helmId: typeof rawL.helmId === 'string' && hIds.has(rawL.helmId) ? rawL.helmId : b.loadout.helmId,
      bodyId: typeof rawL.bodyId === 'string' && bIds.has(rawL.bodyId) ? rawL.bodyId : b.loadout.bodyId,
      capeId: typeof rawL.capeId === 'string' && cIds.has(rawL.capeId) ? rawL.capeId : b.loadout.capeId,
      coreId: typeof rawL.coreId === 'string' && VALID_CORES.has(rawL.coreId) ? (rawL.coreId as EchoCoreId) : 'none',
    };

    const rs = p.stats ?? {};
    const stats: RpgStats = {
      vit: Number.isFinite(rs.vit) ? Math.max(1, rs.vit) : 1,
      str: Number.isFinite(rs.str) ? Math.max(1, rs.str) : 1,
      agi: Number.isFinite(rs.agi) ? Math.max(1, rs.agi) : 1,
      end: Number.isFinite(rs.end) ? Math.max(1, rs.end) : 1,
      tec: Number.isFinite(rs.tec) ? Math.max(1, rs.tec) : 1,
    };

    const glory = Number.isFinite(p.glory) ? p.glory : 0;
    const champions = Number.isFinite(p.champions) ? p.champions : 0;
    const denarii = Number.isFinite(p.denarii) ? Math.max(0, p.denarii) : b.denarii + Math.floor(glory * 0.5);
    const fame = Number.isFinite(p.fame) ? Math.max(0, p.fame) : champions * 80;

    const rawOwnedProps = p.ownedProperties && typeof p.ownedProperties === 'object' ? p.ownedProperties : {};
    const ownedProperties: Record<string, OwnedPropertyState> = {};
    for (const [k, val] of Object.entries(rawOwnedProps as Record<string, unknown>)) {
      if (!PROPERTY_BY_ID.has(k) || !val || typeof val !== 'object') continue;
      const v = val as Partial<OwnedPropertyState>;
      ownedProperties[k] = {
        id: k,
        mode: v.mode === 'live' ? 'live' : 'rent',
        rentRate: v.rentRate === 'low' || v.rentRate === 'high' ? v.rentRate : 'fair',
        tier: v.tier === 2 || v.tier === 3 ? v.tier : 1,
      };
    }

    const rawPos = p.lastWorldPos;
    const lastWorldPos =
      rawPos && Number.isFinite(rawPos.x) && Number.isFinite(rawPos.z)
        ? { x: Math.max(-1980, Math.min(1980, rawPos.x)), z: Math.max(-1980, Math.min(1980, rawPos.z)) }
        : { ...b.lastWorldPos };

    return {
      day: Number.isFinite(p.day) ? Math.max(1, p.day) : 1,
      timeOfDay: p.timeOfDay === 'dusk' ? 'dusk' : 'morning',
      denarii,
      fame,
      level: Number.isFinite(p.level) ? Math.max(1, p.level) : 1,
      xp: Number.isFinite(p.xp) ? Math.max(0, p.xp) : 0,
      statPoints: Number.isFinite(p.statPoints) ? Math.max(0, p.statPoints) : b.statPoints,
      stats,
      loadout,
      ownedWeapons,
      ownedOffhands,
      ownedHelms,
      ownedBodies,
      ownedCapes,
      flasks: Number.isFinite(p.flasks) ? Math.max(0, Math.min(MAX_FLASKS, p.flasks)) : b.flasks,
      dailyBuffs: Array.isArray(p.dailyBuffs) ? p.dailyBuffs : [],
      trainedToday: Boolean(p.trainedToday),
      activeQuests: Array.isArray(p.activeQuests) ? p.activeQuests.slice(0, 3) : [],
      completedQuestIds: Array.isArray(p.completedQuestIds) ? p.completedQuestIds.slice(-80) : [],
      wins: Number.isFinite(p.wins) ? Math.max(0, p.wins) : 0,
      losses: Number.isFinite(p.losses) ? Math.max(0, p.losses) : 0,
      champions,
      glory,
      unlocks,
      fallen: Array.isArray(p.fallen) ? p.fallen.slice(-50) : [],
      look: typeof p.look === 'string' && unlocks.includes(p.look) ? p.look : 'cyan',
      style: typeof p.style === 'string' && validStyles.has(p.style) ? (p.style as StyleId) : 'murmillo',
      ps1Mode: typeof p.ps1Mode === 'boolean' ? p.ps1Mode : true,
      bounty: Number.isFinite(p.bounty) ? Math.max(0, p.bounty) : 0,
      discoveredSettlements: mergeOwned(DEFAULT_CAPITALS, p.discoveredSettlements, VALID_SETTLEMENTS),
      ownedProperties,
      reputation: Number.isFinite(p.reputation) ? Math.max(-100, Math.min(100, p.reputation)) : 0,
      lastWorldPos,
      activeColosseumId: typeof p.activeColosseumId === 'string' && VALID_CAPITALS.has(p.activeColosseumId)
        ? (p.activeColosseumId as CapitalId)
        : 'cache_city',
      claimedEchoes: mergeOwned([], p.claimedEchoes, VALID_ECHOES),
      championBelts: mergeOwned([], p.championBelts, VALID_CAPITALS) as CapitalId[],
      storyProgress: { ...createInitialStoryProgress(), ...(p.storyProgress && typeof p.storyProgress === 'object' ? p.storyProgress : {}) },
      unlockedCompanions: Array.isArray(p.unlockedCompanions) && p.unlockedCompanions.length ? p.unlockedCompanions : ['ares_wing'],
      activeCompanionId: typeof p.activeCompanionId === 'string' || p.activeCompanionId === null ? p.activeCompanionId : 'ares_wing',
      ownedCores: mergeOwned(['none', 'volt_arc'], p.ownedCores, VALID_CORES) as EchoCoreId[],
      nemesisRoster: { ...createDefaultNemesisRoster(), ...(p.nemesisRoster && typeof p.nemesisRoster === 'object' ? p.nemesisRoster : {}) },
      v01BossDefeated: Boolean(p.v01BossDefeated),
      restoreProtocolState: p.restoreProtocolState === 'restored' || p.restoreProtocolState === 'sovereign' ? p.restoreProtocolState : 'none',
    };
  } catch {
    return b;
  }
}

export interface NearNpcHud {
  id: number;
  filename: string;
  role: string;
  mood: string;
  hostile: boolean;
  hp: number;
  maxHp: number;
  bark?: string;
}

export interface StreetToast {
  speaker: string;
  text: string;
  color: string;
  id: number;
}

export interface BeaconHud {
  id: CapitalId;
  name: string;
  cityLabel: string;
  color: string;
  dist: number;
  bearing: string;
}

interface GameState extends Save {
  scene: Scene;
  panel: StationId | null;
  near: StationId | null;
  selectedCard: FightCard | null;
  spectatorBout: SpectatorBout | null;
  lastResult: BoutOutcome | null;
  weaponDrawn: boolean;
  onCycle: boolean;
  atlasOpen: boolean;
  inJail: boolean;
  arrestPrompt: { officerName: string; bounty: number } | null;
  streetToast: StreetToast | null;
  nearNpc: NearNpcHud | null;
  nearPropertyId: string | null;
  activePropertyId: string | null;
  nearColosseumId: CapitalId | null;
  nearEchoId: string | null;
  activeEchoId: string | null;
  nearestEchoHud: EchoHudInfo | null;
  activeWager: BoutWagerId;
  nearestBeacon: BeaconHud;
  currentRegionName: string;
  worldPos: { x: number; z: number };
  pendingTeleport: { x: number; z: number; label: string } | null;
  pendingHealFull: boolean;
  streetLockName: string | null;
  streetExecuteReady: boolean;
  streetStance: StanceHeight;
  streetArmed: boolean;
  streetCallout: { text: string; color: string; id: number } | null;
  streetVitals: { hp: number; maxHp: number; st: number; maxSt: number };
  nearStoryId: string | null;
  activeStoryId: string | null;
  pendingStoryDuel: { name: string; style: StyleId; color: string; rewardCycles: number } | null;
  nearSpecialShrine: 'v01' | 'restore_spire' | null;
  activeSpecialModal: 'v01' | 'restore_spire' | 'restore_choice' | null;
  specialBoutKind: 'v01_boss' | 'garbage_collector' | 'nemesis' | 'grand_prix' | null;
  grandPrixWager: number;
  setNearStory: (id: string | null) => void;
  openStoryModal: (id: string | null) => void;
  chooseStoryOption: (storyId: string, verb: StoryChoiceVerb) => { outcomeText: string; completed: boolean } | null;
  clearPendingStoryDuel: () => void;
  setActiveCompanion: (id: string | null) => void;
  toggleCompanion: () => void;
  buyOrEquipCore: (coreId: EchoCoreId) => boolean;
  startNemesisBout: (colosseumId: CapitalId) => void;
  startGrandPrixParlay: (colosseumId: CapitalId, wager: number) => boolean;
  setNearSpecialShrine: (k: 'v01' | 'restore_spire' | null) => void;
  openSpecialModal: (k: 'v01' | 'restore_spire' | 'restore_choice' | null) => void;
  startV01BossBout: () => void;
  startRestoreProtocolBout: () => void;
  completeRestoreProtocol: (choice: 'restored' | 'sovereign') => void;
  setNear: (id: StationId | null) => void;
  openPanel: (id: StationId | null) => void;
  setScene: (s: Scene) => void;
  togglePs1Mode: () => void;
  setWeaponDrawn: (drawn: boolean) => void;
  toggleWeaponDrawn: () => void;
  toggleCycle: () => void;
  setOnCycle: (v: boolean) => void;
  toggleAtlas: () => void;
  setAtlasOpen: (v: boolean) => void;
  discoverSettlement: (id: string) => void;
  fastTravelTo: (x: number, z: number, label: string) => void;
  clearPendingTeleport: () => void;
  setLastWorldPos: (x: number, z: number) => void;
  openColosseumGate: (id: CapitalId) => void;
  setNearProperty: (id: string | null) => void;
  openPropertyPanel: (id: string | null) => void;
  setNearColosseum: (id: CapitalId | null) => void;
  setNearEcho: (id: string | null) => void;
  claimMemoryEcho: (id: string) => boolean;
  closeEchoModal: () => void;
  setActiveWager: (w: BoutWagerId) => void;
  playDeadlockDice: (bet: number, mode: 'safe' | 'overclock') => DeadlockResult | null;
  setWorldTelemetry: (t: { beacon: BeaconHud; regionName: string; x: number; z: number; nearestEcho?: EchoHudInfo | null }) => void;
  buyProperty: (id: string) => boolean;
  setPropertyMode: (id: string, mode: PropertyMode) => void;
  setPropertyRentRate: (id: string, rate: RentRate) => void;
  renovateProperty: (id: string) => boolean;
  sellProperty: (id: string) => boolean;
  collectPropertyRent: () => { total: number; count: number; repDelta: number };
  healAtProperty: () => void;
  consumePendingHeal: () => void;
  addBounty: (n: number) => void;
  payBounty: () => boolean;
  openArrestPrompt: (officerName: string) => void;
  closeArrestPrompt: () => void;
  enterJail: () => void;
  serveJailSentence: () => void;
  breakOutOfJail: () => void;
  awardStreetReward: (cycles: number, xp: number, signal: number) => { levelsGained: number };
  handleStreetDefeat: (cause: string) => BoutOutcome;
  setStreetToast: (toast: Omit<StreetToast, 'id'> | null) => void;
  setNearNpc: (npc: NearNpcHud | null) => void;
  setStreetVitals: (v: { hp: number; maxHp: number; st: number; maxSt: number }) => void;
  setStreetCombatHud: (t: { lockName: string | null; executeReady: boolean; stance?: StanceHeight; armed?: boolean }) => void;
  triggerStreetCallout: (text: string, color: string) => void;
  buyAndEquipItem: (slot: GearSlot, id: string) => boolean;
  equipItem: (slot: GearSlot, id: string) => void;
  upgradeStat: (key: StatKey) => boolean;
  buyConsumable: (id: ConsumableId) => boolean;
  consumeFlaskInBout: () => boolean;
  drillTraining: () => boolean;
  acceptQuest: (q: Quest) => boolean;
  claimQuest: (id: string) => boolean;
  sleepNextDay: () => void;
  startCardBout: (card: FightCard) => void;
  startSpectatorBout: (red: SpectatorFighterSpec, blue: SpectatorFighterSpec, pickedCorner: 'red' | 'blue', wager: number) => boolean;
  settleSpectatorBout: (winnerCorner: 'red' | 'blue') => BoutOutcome;
  settleBout: (summary: BoutSummary & { card: FightCard | null; cause?: string }) => BoutOutcome;
  buyLook: (id: string) => boolean;
  equipLook: (id: string) => void;
  equipStyle: (id: StyleId) => void;
  addGlory: (n: number) => void;
  recordChampion: () => void;
  recordDeath: (f: Fallen) => void;
}

function ownedKeyFor(slot: GearSlot): keyof Pick<Save, 'ownedWeapons' | 'ownedOffhands' | 'ownedHelms' | 'ownedBodies' | 'ownedCapes'> {
  if (slot === 'weapon') return 'ownedWeapons';
  if (slot === 'offhand') return 'ownedOffhands';
  if (slot === 'helm') return 'ownedHelms';
  if (slot === 'body') return 'ownedBodies';
  return 'ownedCapes';
}

function loadoutKeyFor(slot: GearSlot): keyof Loadout {
  if (slot === 'weapon') return 'weaponId';
  if (slot === 'offhand') return 'offhandId';
  if (slot === 'helm') return 'helmId';
  if (slot === 'body') return 'bodyId';
  return 'capeId';
}

function catalogFor(slot: GearSlot): { id: string; cost: number; reqFame: number }[] {
  if (slot === 'weapon') return WEAPONS;
  if (slot === 'offhand') return OFFHANDS;
  if (slot === 'helm') return HELMS;
  if (slot === 'body') return BODIES;
  return CAPES;
}

export const useGame = create<GameState>((set, get) => {
  const save = () => {
    const s = get();
    const payload: Save = {
      day: s.day,
      timeOfDay: s.timeOfDay,
      denarii: s.denarii,
      fame: s.fame,
      level: s.level,
      xp: s.xp,
      statPoints: s.statPoints,
      stats: s.stats,
      loadout: s.loadout,
      ownedWeapons: s.ownedWeapons,
      ownedOffhands: s.ownedOffhands,
      ownedHelms: s.ownedHelms,
      ownedBodies: s.ownedBodies,
      ownedCapes: s.ownedCapes,
      flasks: s.flasks,
      dailyBuffs: s.dailyBuffs,
      trainedToday: s.trainedToday,
      activeQuests: s.activeQuests,
      completedQuestIds: s.completedQuestIds,
      wins: s.wins,
      losses: s.losses,
      champions: s.champions,
      glory: s.glory,
      unlocks: s.unlocks,
      fallen: s.fallen,
      look: s.look,
      style: s.style,
      ps1Mode: s.ps1Mode,
      bounty: s.bounty,
      discoveredSettlements: s.discoveredSettlements,
      ownedProperties: s.ownedProperties,
      reputation: s.reputation,
      lastWorldPos: s.lastWorldPos,
      activeColosseumId: s.activeColosseumId,
      claimedEchoes: s.claimedEchoes,
      championBelts: s.championBelts,
      storyProgress: s.storyProgress,
      unlockedCompanions: s.unlockedCompanions,
      activeCompanionId: s.activeCompanionId,
      ownedCores: s.ownedCores,
      nemesisRoster: s.nemesisRoster,
      v01BossDefeated: s.v01BossDefeated,
      restoreProtocolState: s.restoreProtocolState,
    };
    try { localStorage.setItem(KEY_V3, JSON.stringify(payload)); } catch { /* storage unavailable */ }
  };

  let toastId = 0;
  const defaultBeacon: BeaconHud = {
    id: COLOSSEUMS[0].id,
    name: COLOSSEUMS[0].name,
    cityLabel: COLOSSEUMS[0].cityLabel,
    color: COLOSSEUMS[0].color,
    dist: 88,
    bearing: 'N',
  };

  return {
    ...loadSave(),
    scene: typeof location !== 'undefined' && location.search.includes('arena') ? 'arena' : 'ludus',
    panel: null,
    near: null,
    selectedCard: null,
    spectatorBout: null,
    lastResult: null,
    weaponDrawn: false,
    onCycle: false,
    atlasOpen: false,
    inJail: false,
    arrestPrompt: null,
    streetToast: null,
    nearNpc: null,
    nearPropertyId: null,
    activePropertyId: null,
    nearColosseumId: null,
    nearEchoId: null,
    activeEchoId: null,
    nearestEchoHud: null,
    activeWager: 'standard',
    nearestBeacon: defaultBeacon,
    currentRegionName: 'CACHE CITY (/DEV/NULL)',
    worldPos: { x: PLAYER_START.x, z: PLAYER_START.z },
    pendingTeleport: null,
    pendingHealFull: false,
    streetLockName: null,
    streetExecuteReady: false,
    streetStance: 'mid',
    streetArmed: true,
    streetCallout: null,
    streetVitals: { hp: 100, maxHp: 100, st: 100, maxSt: 100 },
    nearStoryId: null,
    activeStoryId: null,
    pendingStoryDuel: null,
    nearSpecialShrine: null,
    activeSpecialModal: null,
    specialBoutKind: null,
    grandPrixWager: 0,
    setNearStory: (nearStoryId) => { if (get().nearStoryId !== nearStoryId) set({ nearStoryId }); },
    openStoryModal: (activeStoryId) => set({ activeStoryId, panel: null, activePropertyId: null, atlasOpen: false }),
    clearPendingStoryDuel: () => set({ pendingStoryDuel: null }),
    chooseStoryOption: (storyId, verb) => {
      const s = get();
      const story = REGIONAL_STORIES.find((x) => x.id === storyId);
      const st = s.storyProgress[storyId];
      if (!story || !st || st.completed) return null;
      const stage = story.stages[st.stageIndex];
      const choice = stage?.choices.find((c) => c.verb === verb);
      if (!stage || !choice) return null;

      const nextStageIdx = st.stageIndex + 1;
      const completed = nextStageIdx >= story.stages.length;
      const lv = applyXp(s.level, s.xp, s.statPoints, choice.xpDelta);
      const nextCompanions = choice.unlockCompanionId && !s.unlockedCompanions.includes(choice.unlockCompanionId)
        ? [...s.unlockedCompanions, choice.unlockCompanionId]
        : s.unlockedCompanions;
      const nextWeapons = choice.unlockWeaponId && !s.ownedWeapons.includes(choice.unlockWeaponId)
        ? [...s.ownedWeapons, choice.unlockWeaponId]
        : s.ownedWeapons;

      set({
        denarii: Math.max(0, s.denarii + choice.cyclesDelta),
        reputation: Math.max(-100, Math.min(100, s.reputation + choice.repDelta)),
        fame: Math.max(0, s.fame + choice.signalDelta),
        glory: Math.max(0, s.glory + choice.signalDelta),
        bounty: s.bounty + (choice.bountyDelta ?? 0),
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        unlockedCompanions: nextCompanions,
        activeCompanionId: choice.unlockCompanionId ?? s.activeCompanionId,
        ownedWeapons: nextWeapons,
        pendingStoryDuel: choice.spawnsDuel ?? null,
        activeStoryId: null,
        storyProgress: {
          ...s.storyProgress,
          [storyId]: {
            storyId,
            stageIndex: completed ? st.stageIndex : nextStageIdx,
            completed,
            lastVerb: verb,
            fallout: choice.outcomeText,
          },
        },
        streetToast: {
          speaker: `${story.title} · ${verb}`,
          text: choice.outcomeText,
          color: story.color,
          id: ++toastId,
        },
      });
      save();
      return { outcomeText: choice.outcomeText, completed };
    },
    setActiveCompanion: (activeCompanionId) => { set({ activeCompanionId }); save(); },
    toggleCompanion: () => {
      const s = get();
      const next = s.activeCompanionId ? null : (s.unlockedCompanions[0] ?? 'ares_wing');
      set({ activeCompanionId: next });
      save();
    },
    buyOrEquipCore: (coreId) => {
      const s = get();
      const core = ECHO_CORES.find((c) => c.id === coreId);
      if (!core) return false;
      if (s.ownedCores.includes(coreId)) {
        set({ loadout: { ...s.loadout, coreId } });
        save();
        return true;
      }
      const price = discountedCost(core.cost, s.ownedProperties);
      if (s.claimedEchoes.length < core.reqEchoes || s.denarii < price) return false;
      set({
        denarii: s.denarii - price,
        ownedCores: [...s.ownedCores, coreId],
        loadout: { ...s.loadout, coreId },
      });
      save();
      return true;
    },
    startNemesisBout: (colosseumId) => {
      const s = get();
      const rival = s.nemesisRoster[colosseumId];
      if (!rival) return;
      const card = nemesisFightCardFor(rival);
      set({
        activeColosseumId: colosseumId,
        selectedCard: card,
        specialBoutKind: 'nemesis',
        spectatorBout: null,
        lastResult: null,
        scene: 'arena',
        panel: null,
        near: null,
        activePropertyId: null,
        atlasOpen: false,
        onCycle: false,
      });
      save();
    },
    startGrandPrixParlay: (colosseumId, wager) => {
      const s = get();
      const bet = Math.floor(wager);
      if (!Number.isFinite(bet) || bet <= 0 || bet > s.denarii) return false;
      const cards = generateFightCards(s.day, s.fame + 999, colosseumId);
      const grandCard: FightCard = {
        ...cards[2],
        id: `gp_${colosseumId}_${s.day}`,
        title: 'GRAND PRIX 3-WAY PARLAY FINAL',
        subtitle: `Stake ${bet}C → 3.8× Championship Parlay`,
        denarii: Math.round(bet * 3.8),
        xp: 220,
        fame: 150,
      };
      set({
        denarii: s.denarii - bet,
        activeColosseumId: colosseumId,
        selectedCard: grandCard,
        specialBoutKind: 'grand_prix',
        grandPrixWager: bet,
        spectatorBout: null,
        lastResult: null,
        scene: 'arena',
        panel: null,
        near: null,
        activePropertyId: null,
        atlasOpen: false,
        onCycle: false,
      });
      save();
      return true;
    },
    setNearSpecialShrine: (nearSpecialShrine) => { if (get().nearSpecialShrine !== nearSpecialShrine) set({ nearSpecialShrine }); },
    openSpecialModal: (activeSpecialModal) => set({ activeSpecialModal, panel: null, activePropertyId: null, atlasOpen: false }),
    startV01BossBout: () => {
      const card: FightCard = {
        id: 'boss_v01_wireframe',
        title: 'VERSION 0.1 PROTOTYPE',
        subtitle: 'PROTO_0.1.WIRE · Uncompiled Stick Prime',
        tier: 4,
        reqFame: 0,
        denarii: 900,
        xp: 420,
        fame: 260,
        enemies: [{ name: 'PROTO_0.1.WIRE', kind: 'champion', style: 'dimachaerus' }],
      };
      set({
        selectedCard: card,
        specialBoutKind: 'v01_boss',
        spectatorBout: null,
        lastResult: null,
        scene: 'arena',
        activeSpecialModal: null,
        onCycle: false,
      });
      save();
    },
    startRestoreProtocolBout: () => {
      const card: FightCard = {
        id: 'boss_garbage_collector_prime',
        title: 'THE RESTORE PROTOCOL',
        subtitle: 'GARBAGE_COLLECTOR_PRIME.SYS · Kernel Finale',
        tier: 4,
        reqFame: 0,
        denarii: 1400,
        xp: 650,
        fame: 400,
        enemies: [
          { name: 'GARBAGE_COLLECTOR_PRIME.SYS', kind: 'champion', style: 'executioner' },
          { name: 'OVERWRITE_DAEMON.00', kind: 'brute', style: 'hoplomachus' },
        ],
      };
      set({
        activeColosseumId: 'kernel_spire',
        selectedCard: card,
        specialBoutKind: 'garbage_collector',
        spectatorBout: null,
        lastResult: null,
        scene: 'arena',
        activeSpecialModal: null,
        onCycle: false,
      });
      save();
    },
    completeRestoreProtocol: (choice) => {
      const s = get();
      const bonus = choice === 'restored' ? 2000 : 3000;
      set({
        restoreProtocolState: choice,
        denarii: s.denarii + bonus,
        fame: s.fame + 500,
        glory: s.glory + 500,
        activeSpecialModal: null,
        streetToast: {
          speaker: 'THE RESTORE PROTOCOL',
          text: choice === 'restored'
            ? `Ghost-Villages restored across the continent! (+${bonus} Cycles)`
            : `Sovereign Root claimed! Sky Beacons turn gold & Property Rents boosted +50%! (+${bonus} Cycles)`,
          color: choice === 'restored' ? '#4dffa0' : '#ffd866',
          id: ++toastId,
        },
      });
      save();
    },
    setNear: (near) => { if (get().near !== near) set({ near }); },
    openPanel: (panel) => set({ panel, activePropertyId: null, atlasOpen: false, activeEchoId: null, activeStoryId: null, activeSpecialModal: null }),
    setScene: (scene) => set((s) => ({
      scene,
      panel: null,
      near: null,
      arrestPrompt: null,
      activePropertyId: null,
      atlasOpen: false,
      activeEchoId: null,
      activeStoryId: null,
      activeSpecialModal: scene === 'ludus' && s.activeSpecialModal === 'restore_choice' ? 'restore_choice' : null,
      onCycle: false,
      spectatorBout: scene === 'ludus' ? null : s.spectatorBout,
    })),
    togglePs1Mode: () => { set({ ps1Mode: !get().ps1Mode }); save(); },
    setWeaponDrawn: (weaponDrawn) => set((s) => ({ weaponDrawn, onCycle: weaponDrawn ? false : s.onCycle })),
    toggleWeaponDrawn: () => set((s) => {
      const next = !s.weaponDrawn;
      return { weaponDrawn: next, onCycle: next ? false : s.onCycle };
    }),
    toggleCycle: () => {
      const s = get();
      if (s.inJail) return;
      const next = !s.onCycle;
      set({ onCycle: next, weaponDrawn: next ? false : s.weaponDrawn });
    },
    setOnCycle: (v) => set((s) => ({ onCycle: v, weaponDrawn: v ? false : s.weaponDrawn })),
    toggleAtlas: () => set((s) => {
      const next = !s.atlasOpen;
      return { atlasOpen: next, panel: null, activePropertyId: null, activeStoryId: null, activeSpecialModal: null };
    }),
    setAtlasOpen: (v) => set({ atlasOpen: v, panel: null, activePropertyId: null, activeStoryId: null, activeSpecialModal: null }),
    discoverSettlement: (id) => {
      const s = get();
      if (!VALID_SETTLEMENTS.has(id) || s.discoveredSettlements.includes(id)) return;
      const found = SETTLEMENTS.find((x) => x.id === id);
      set({
        discoveredSettlements: [...s.discoveredSettlements, id],
        streetToast: found
          ? { speaker: 'SECTOR DISCOVERED', text: `${found.name} (${found.code}) added to your World Atlas!`, color: found.accent, id: ++toastId }
          : s.streetToast,
      });
      save();
    },
    fastTravelTo: (x, z, label) => {
      const clampedX = Math.max(-1980, Math.min(1980, x));
      const clampedZ = Math.max(-1980, Math.min(1980, z));
      set({
        pendingTeleport: { x: clampedX, z: clampedZ, label },
        lastWorldPos: { x: clampedX, z: clampedZ },
        atlasOpen: false,
        panel: null,
        activePropertyId: null,
        arrestPrompt: null,
        inJail: false,
        weaponDrawn: false,
        streetToast: { speaker: 'FAST TRAVEL', text: `Warped cleanly to ${label}.`, color: '#3ff0ff', id: ++toastId },
      });
      save();
    },
    clearPendingTeleport: () => set({ pendingTeleport: null }),
    setLastWorldPos: (x, z) => {
      set({ lastWorldPos: { x, z } });
      save();
    },
    openColosseumGate: (id) => {
      set({ activeColosseumId: id, panel: 'gate', activePropertyId: null, atlasOpen: false });
      save();
    },
    setNearProperty: (nearPropertyId) => { if (get().nearPropertyId !== nearPropertyId) set({ nearPropertyId }); },
    openPropertyPanel: (activePropertyId) => set({ activePropertyId, panel: null, atlasOpen: false }),
    setNearColosseum: (nearColosseumId) => { if (get().nearColosseumId !== nearColosseumId) set({ nearColosseumId }); },
    setNearEcho: (nearEchoId) => { if (get().nearEchoId !== nearEchoId) set({ nearEchoId }); },
    claimMemoryEcho: (id) => {
      const s = get();
      const echo = MEMORY_ECHOES.find((e) => e.id === id);
      if (!echo || s.claimedEchoes.includes(id)) return false;
      const lv = applyXp(s.level, s.xp, s.statPoints + 1, echo.rewardXp);
      const nextWeapons = echo.bonusWeaponId && !s.ownedWeapons.includes(echo.bonusWeaponId)
        ? [...s.ownedWeapons, echo.bonusWeaponId]
        : s.ownedWeapons;
      const bonusWeaponName = echo.bonusWeaponId ? WEAPONS.find((w) => w.id === echo.bonusWeaponId)?.name : null;
      set({
        denarii: s.denarii + echo.rewardCycles,
        fame: s.fame + 35,
        glory: s.glory + 35,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        ownedWeapons: nextWeapons,
        claimedEchoes: [...s.claimedEchoes, id],
        activeEchoId: id,
        nearEchoId: null,
        panel: null,
        activePropertyId: null,
        atlasOpen: false,
        streetToast: {
          speaker: `MEMORY ECHO DECRYPTED (${s.claimedEchoes.length + 1}/${MEMORY_ECHOES.length})`,
          text: `${echo.title}: +${echo.rewardCycles}C · +1 Spec Pt${bonusWeaponName ? ` · UNLOCKED ${bonusWeaponName}!` : ''}`,
          color: echo.color,
          id: ++toastId,
        },
      });
      save();
      return true;
    },
    closeEchoModal: () => set({ activeEchoId: null }),
    setActiveWager: (activeWager) => set({ activeWager }),
    playDeadlockDice: (bet, mode) => {
      const s = get();
      const wager = Math.floor(bet);
      if (!Number.isFinite(wager) || wager <= 0 || wager > s.denarii) return null;
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const sum = d1 + d2;
      const won = mode === 'overclock' ? (sum >= 10 || d1 === d2) : sum >= 8;
      const mult = mode === 'overclock' ? 3.5 : 2.2;
      const payout = won ? Math.round(wager * mult) : 0;
      const net = payout - wager;
      const label = won
        ? (mode === 'overclock' && d1 === d2 ? `DOUBLES JACKPOT [${d1}+${d2}]!` : `SYSTEM HIT [${d1}+${d2}=${sum}]!`)
        : `SEGFAULT [${d1}+${d2}=${sum}]`;
      set({ denarii: Math.max(0, s.denarii + net) });
      save();
      return { dice: [d1, d2], sum, mode, bet: wager, won, payout, net, label };
    },
    setWorldTelemetry: ({ beacon, regionName, x, z, nearestEcho }) => set((cur) => ({
      nearestBeacon: beacon,
      currentRegionName: regionName,
      worldPos: { x, z },
      nearestEchoHud: nearestEcho === undefined ? cur.nearestEchoHud : nearestEcho,
    })),
    buyProperty: (id) => {
      const s = get();
      const def = PROPERTY_BY_ID.get(id);
      if (!def || s.ownedProperties[id] || s.denarii < def.price) return false;
      const next: OwnedPropertyState = { id, mode: 'rent', rentRate: 'fair', tier: 1 };
      set({
        denarii: s.denarii - def.price,
        ownedProperties: { ...s.ownedProperties, [id]: next },
        reputation: Math.min(100, s.reputation + 4),
        streetToast: { speaker: 'DEED ACQUIRED', text: `You now own ${def.name} in ${def.settlementName}!`, color: '#ffc95c', id: ++toastId },
      });
      save();
      return true;
    },
    setPropertyMode: (id, mode) => {
      const s = get();
      const cur = s.ownedProperties[id];
      if (!cur || cur.mode === mode) return;
      set({ ownedProperties: { ...s.ownedProperties, [id]: { ...cur, mode } } });
      save();
    },
    setPropertyRentRate: (id, rentRate) => {
      const s = get();
      const cur = s.ownedProperties[id];
      if (!cur || cur.rentRate === rentRate) return;
      set({ ownedProperties: { ...s.ownedProperties, [id]: { ...cur, rentRate } } });
      save();
    },
    renovateProperty: (id) => {
      const s = get();
      const def = PROPERTY_BY_ID.get(id);
      const cur = s.ownedProperties[id];
      if (!def || !cur || cur.tier >= 3) return false;
      const cost = propertyRenovateCost(def, cur.tier);
      if (s.denarii < cost) return false;
      const nextTier = (cur.tier + 1) as 2 | 3;
      set({
        denarii: s.denarii - cost,
        ownedProperties: { ...s.ownedProperties, [id]: { ...cur, tier: nextTier } },
        reputation: Math.min(100, s.reputation + 5),
        streetToast: { speaker: 'RENOVATED', text: `${def.name} upgraded to Tier ${nextTier}!`, color: '#4dffa0', id: ++toastId },
      });
      save();
      return true;
    },
    sellProperty: (id) => {
      const s = get();
      const def = PROPERTY_BY_ID.get(id);
      const cur = s.ownedProperties[id];
      if (!def || !cur) return false;
      const value = propertySellValue(def, cur);
      const nextOwned = { ...s.ownedProperties };
      delete nextOwned[id];
      set({
        denarii: s.denarii + value,
        ownedProperties: nextOwned,
        activePropertyId: s.activePropertyId === id ? null : s.activePropertyId,
        streetToast: { speaker: 'DEED SOLD', text: `Sold ${def.name} for ${value} Cycles.`, color: '#ffc95c', id: ++toastId },
      });
      save();
      return true;
    },
    collectPropertyRent: () => {
      const s = get();
      let total = 0;
      let count = 0;
      let repDelta = 0;
      for (const owned of Object.values(s.ownedProperties)) {
        const def = PROPERTY_BY_ID.get(owned.id);
        if (!def) continue;
        const pay = propertyRentPayout(def, owned);
        if (pay > 0) {
          total += s.restoreProtocolState === 'sovereign' ? Math.round(pay * 1.5) : pay;
          count += 1;
          repDelta += reputationDeltaForRent(owned);
        }
      }
      if (total <= 0) return { total: 0, count: 0, repDelta: 0 };
      set({
        denarii: s.denarii + total,
        reputation: Math.max(-100, Math.min(100, s.reputation + repDelta)),
        streetToast: {
          speaker: 'REAL ESTATE INCOME',
          text: `+${total} Cycles collected from ${count} rented propert${count === 1 ? 'y' : 'ies'}.`,
          color: '#ffc95c',
          id: ++toastId,
        },
      });
      save();
      return { total, count, repDelta };
    },
    healAtProperty: () => {
      set({
        pendingHealFull: true,
        streetToast: { speaker: 'HOME SANCTUARY', text: 'Integrity & runtime fully restored in your private quarters.', color: '#4dffa0', id: ++toastId },
      });
    },
    consumePendingHeal: () => set({ pendingHealFull: false }),
    addBounty: (n) => {
      if (n <= 0) return;
      set({ bounty: get().bounty + Math.round(n) });
      save();
    },
    payBounty: () => {
      const s = get();
      if (s.bounty <= 0 || s.denarii < s.bounty) return false;
      set({ denarii: s.denarii - s.bounty, bounty: 0, arrestPrompt: null });
      save();
      return true;
    },
    openArrestPrompt: (officerName) => {
      const s = get();
      if (s.arrestPrompt || s.inJail || s.panel) return;
      set({ arrestPrompt: { officerName, bounty: s.bounty }, panel: null });
    },
    closeArrestPrompt: () => set({ arrestPrompt: null }),
    enterJail: () => set({ arrestPrompt: null, inJail: true, weaponDrawn: false, panel: null }),
    serveJailSentence: () => {
      const s = get();
      set({
        day: s.day + 1,
        timeOfDay: 'morning',
        dailyBuffs: [],
        trainedToday: false,
        bounty: 0,
        inJail: false,
        arrestPrompt: null,
      });
      save();
    },
    breakOutOfJail: () => {
      const s = get();
      set({ inJail: false, arrestPrompt: null, bounty: s.bounty + 25 });
      save();
    },
    awardStreetReward: (cycles, xpGain, signal) => {
      const s = get();
      const gear = resolveLoadout(s.loadout);
      const famGain = signal > 0 ? Math.round(signal * gear.fameMul) : signal;
      const lv = applyXp(s.level, s.xp, s.statPoints, xpGain);
      set({
        denarii: Math.max(0, s.denarii + cycles),
        fame: Math.max(0, s.fame + famGain),
        glory: Math.max(0, s.glory + Math.max(0, famGain)),
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
      });
      save();
      return { levelsGained: lv.levelsGained };
    },
    handleStreetDefeat: (cause) => {
      const s = get();
      const healerFee = s.denarii > 0 ? Math.min(s.denarii, Math.max(10, Math.round(s.denarii * 0.15))) : 0;
      const lostFame = Math.min(s.fame, 15);
      const outcome: BoutOutcome = {
        victory: false,
        denariiDelta: -healerFee,
        fameDelta: -lostFame,
        xpEarned: 0,
        levelsGained: 0,
        healerFee,
        cause,
      };
      set({
        denarii: s.denarii - healerFee,
        fame: s.fame - lostFame,
        losses: s.losses + 1,
        bounty: 0,
        inJail: false,
        weaponDrawn: false,
        arrestPrompt: null,
        lastResult: outcome,
        fallen: [...s.fallen, { name: `Cycle ${s.day} Street De-Rez`, bouts: 1, cause, date: new Date().toISOString().slice(0, 10) }].slice(-50),
      });
      save();
      return outcome;
    },
    setStreetToast: (toast) => set({ streetToast: toast ? { ...toast, id: ++toastId } : null }),
    setNearNpc: (nearNpc) => set({ nearNpc }),
    setStreetVitals: (streetVitals) => set({ streetVitals }),
    setStreetCombatHud: ({ lockName, executeReady, stance = 'mid', armed = true }) => {
      const s = get();
      if (s.streetLockName !== lockName || s.streetExecuteReady !== executeReady || s.streetStance !== stance || s.streetArmed !== armed) {
        set({ streetLockName: lockName, streetExecuteReady: executeReady, streetStance: stance, streetArmed: armed });
      }
    },
    triggerStreetCallout: (text, color) => set({ streetCallout: { text, color, id: ++toastId } }),

    buyAndEquipItem: (slot, id) => {
      const s = get();
      const item = catalogFor(slot).find((x) => x.id === id);
      if (!item) return false;
      const oKey = ownedKeyFor(slot);
      const lKey = loadoutKeyFor(slot);
      const owned = s[oKey];
      if (owned.includes(id)) {
        set({ loadout: { ...s.loadout, [lKey]: id } });
        save();
        return true;
      }
      const price = discountedCost(item.cost, s.ownedProperties);
      if (s.fame < item.reqFame || s.denarii < price) return false;
      set({
        denarii: s.denarii - price,
        [oKey]: [...owned, id],
        loadout: { ...s.loadout, [lKey]: id },
      } as Partial<GameState>);
      save();
      return true;
    },

    equipItem: (slot, id) => {
      const s = get();
      const oKey = ownedKeyFor(slot);
      if (!s[oKey].includes(id)) return;
      set({ loadout: { ...s.loadout, [loadoutKeyFor(slot)]: id } });
      save();
    },

    upgradeStat: (key) => {
      const s = get();
      if (s.statPoints <= 0) return false;
      set({
        statPoints: s.statPoints - 1,
        stats: { ...s.stats, [key]: s.stats[key] + 1 },
      });
      save();
      return true;
    },

    buyConsumable: (id) => {
      const s = get();
      const c = CONSUMABLES.find((x) => x.id === id);
      if (!c) return false;
      const price = discountedCost(c.cost, s.ownedProperties);
      if (s.denarii < price) return false;
      if (c.id === 'healing_flask') {
        if (s.flasks >= MAX_FLASKS) return false;
        set({ denarii: s.denarii - price, flasks: s.flasks + 1 });
      } else {
        const buffId = c.id as DailyBuffId;
        if (s.dailyBuffs.includes(buffId)) return false;
        set({ denarii: s.denarii - price, dailyBuffs: [...s.dailyBuffs, buffId] });
      }
      save();
      return true;
    },

    consumeFlaskInBout: () => {
      const s = get();
      if (s.flasks <= 0) return false;
      set({ flasks: s.flasks - 1 });
      save();
      return true;
    },

    drillTraining: () => {
      const s = get();
      if (s.trainedToday) return false;
      const lv = applyXp(s.level, s.xp, s.statPoints, 35);
      set({
        trainedToday: true,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
      });
      save();
      return true;
    },

    acceptQuest: (q) => {
      const s = get();
      if (s.activeQuests.length >= 3) return false;
      if (s.completedQuestIds.includes(q.id) || s.activeQuests.some((x) => x.id === q.id)) return false;
      set({ activeQuests: [...s.activeQuests, { ...q }] });
      save();
      return true;
    },

    claimQuest: (id) => {
      const s = get();
      const q = s.activeQuests.find((x) => x.id === id);
      if (!q || q.progress < q.target || q.claimed) return false;
      const lv = applyXp(s.level, s.xp, s.statPoints, q.xp);
      set({
        denarii: s.denarii + q.denarii,
        fame: s.fame + q.fame,
        glory: s.glory + q.fame,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        activeQuests: s.activeQuests.filter((x) => x.id !== id),
        completedQuestIds: [...s.completedQuestIds, id],
      });
      save();
      return true;
    },

    sleepNextDay: () => {
      const s = get();
      set({
        day: s.day + 1,
        timeOfDay: 'morning',
        dailyBuffs: [],
        trainedToday: false,
        lastResult: null,
      });
      get().collectPropertyRent();
      save();
    },

    startCardBout: (card) => {
      set({
        selectedCard: card,
        specialBoutKind: null,
        grandPrixWager: 0,
        spectatorBout: null,
        lastResult: null,
        scene: 'arena',
        panel: null,
        near: null,
        activePropertyId: null,
        atlasOpen: false,
        onCycle: false,
      });
      save();
    },

    startSpectatorBout: (red, blue, pickedCorner, wager) => {
      const s = get();
      const bet = Math.floor(wager);
      if (!Number.isFinite(bet) || bet <= 0 || bet > s.denarii) return false;
      set({
        denarii: s.denarii - bet,
        spectatorBout: {
          id: `spec-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          red,
          blue,
          pickedCorner,
          wager: bet,
        },
        selectedCard: null,
        lastResult: null,
        scene: 'arena',
        panel: null,
        near: null,
        activePropertyId: null,
        atlasOpen: false,
        activeEchoId: null,
        onCycle: false,
      });
      save();
      return true;
    },

    settleSpectatorBout: (winnerCorner) => {
      const s = get();
      const sb = s.spectatorBout;
      if (!sb) {
        const empty: BoutOutcome = { victory: false, denariiDelta: 0, fameDelta: 0, xpEarned: 0, levelsGained: 0, healerFee: 0 };
        set({ lastResult: empty });
        return empty;
      }
      const picked = sb.pickedCorner === 'red' ? sb.red : sb.blue;
      const winnerSpec = winnerCorner === 'red' ? sb.red : sb.blue;
      const loserSpec = winnerCorner === 'red' ? sb.blue : sb.red;
      const won = winnerCorner === sb.pickedCorner;
      const payout = won ? Math.round(sb.wager * picked.odds) : 0;
      const xpEarned = 25;
      const fameGain = won ? 15 : 0;
      const lv = applyXp(s.level, s.xp, s.statPoints, xpEarned);
      const outcome: BoutOutcome = {
        victory: won,
        denariiDelta: won ? payout - sb.wager : -sb.wager,
        fameDelta: fameGain,
        xpEarned,
        levelsGained: lv.levelsGained,
        healerFee: 0,
        cause: `${winnerSpec.name} defeated ${loserSpec.name}`,
      };
      set({
        denarii: s.denarii + payout,
        fame: s.fame + fameGain,
        glory: s.glory + fameGain,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        lastResult: outcome,
      });
      save();
      return outcome;
    },

    settleBout: (summary) => {
      const s = get();
      const gear = resolveLoadout(s.loadout);
      const updatedQuests = updateQuestProgress(s.activeQuests, summary);
      const bonusCombatXp = summary.parries * 8 + summary.armorsBroken * 5 + summary.limbsSevered * 4;
      const wagerDef = WAGER_OATHS[s.activeWager];
      const nextNemesis = summary.card?.id.startsWith('nemesis_') || summary.card?.tier === 4
        ? recordNemesisEncounter(s.nemesisRoster, s.activeColosseumId, {
            victory: summary.victory,
            weaponFamily: summary.weaponFamily,
            severedLimbs: summary.limbsSevered > 0 ? ['armR'] : [],
            executed: summary.limbsSevered > 0,
          })
        : s.nemesisRoster;

      if (summary.victory) {
        const wagerFulfilled =
          s.activeWager === 'standard'
            ? true
            : s.activeWager === 'blood'
              ? !summary.usedFlask
              : summary.limbsSevered >= 1;
        const cMul = wagerFulfilled ? wagerDef.mult : 1.0;
        const fMul = wagerFulfilled ? wagerDef.fameMult : 1.0;

        const isTier4 = summary.card?.tier === 4 && s.specialBoutKind !== 'v01_boss';
        const isNewBelt = Boolean(isTier4 && !s.championBelts.includes(s.activeColosseumId));
        const beltName = isNewBelt
          ? (COLOSSEUMS.find((c) => c.id === s.activeColosseumId)?.name ?? s.activeColosseumId)
          : undefined;
        const beltBonus = isNewBelt ? 400 : 0;

        const isV01Win = s.specialBoutKind === 'v01_boss';
        const isGcWin = s.specialBoutKind === 'garbage_collector';
        const v01SpecBonus = isV01Win && !s.v01BossDefeated ? 2 : 0;
        const nextWeapons = isV01Win && !s.ownedWeapons.includes('proto_wire_blade')
          ? [...s.ownedWeapons, 'proto_wire_blade']
          : s.ownedWeapons;

        const baseD = Math.round((summary.card?.denarii ?? Math.max(40, summary.kills * 35)) * cMul) + beltBonus;
        const baseX = summary.card?.xp ?? Math.max(45, summary.kills * 35);
        const baseF = summary.card?.fame ?? Math.max(25, summary.kills * 20);
        const fameGain = Math.round(baseF * gear.fameMul * fMul);
        const xpEarned = baseX + bonusCombatXp;
        const lv = applyXp(s.level, s.xp, s.statPoints + (isNewBelt ? 1 : 0) + v01SpecBonus, xpEarned);
        const nextBelts = isNewBelt ? [...s.championBelts, s.activeColosseumId] : s.championBelts;

        const outcome: BoutOutcome = {
          victory: true,
          denariiDelta: baseD,
          fameDelta: fameGain,
          xpEarned,
          levelsGained: lv.levelsGained,
          healerFee: 0,
          wagerId: s.activeWager,
          wagerFulfilled,
          beltEarned: beltName,
        };
        set({
          denarii: s.denarii + baseD,
          fame: s.fame + fameGain,
          glory: s.glory + fameGain,
          level: lv.level,
          xp: lv.xp,
          statPoints: lv.statPoints,
          wins: s.wins + 1,
          champions: s.champions + (isTier4 ? 1 : 0),
          championBelts: nextBelts,
          nemesisRoster: nextNemesis,
          ownedWeapons: nextWeapons,
          v01BossDefeated: s.v01BossDefeated || isV01Win,
          activeSpecialModal: isGcWin ? 'restore_choice' : s.activeSpecialModal,
          specialBoutKind: null,
          grandPrixWager: 0,
          activeWager: 'standard',
          timeOfDay: 'dusk',
          activeQuests: updatedQuests,
          lastResult: outcome,
        });
        save();
        return outcome;
      }

      // Option A Defeat: wake in Ludus Barracks, pay healer fee, lose small Fame, keep all stats & gear!
      const healerFee = s.denarii > 0 ? Math.min(s.denarii, Math.max(10, Math.round(s.denarii * 0.15))) : 0;
      const lostFame = Math.min(s.fame, 15);
      const xpEarned = 15 + bonusCombatXp;
      const lv = applyXp(s.level, s.xp, s.statPoints, xpEarned);
      const outcome: BoutOutcome = {
        victory: false,
        denariiDelta: -healerFee,
        fameDelta: -lostFame,
        xpEarned,
        levelsGained: lv.levelsGained,
        healerFee,
        cause: summary.cause,
        wagerId: s.activeWager,
        wagerFulfilled: false,
      };
      set({
        denarii: s.denarii - healerFee,
        fame: s.fame - lostFame,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        losses: s.losses + 1,
        nemesisRoster: nextNemesis,
        specialBoutKind: null,
        grandPrixWager: 0,
        activeWager: 'standard',
        timeOfDay: 'dusk',
        activeQuests: updatedQuests,
        lastResult: outcome,
        fallen: [...s.fallen, { name: `Day ${s.day} Defeat`, bouts: summary.card?.tier ?? 1, cause: summary.cause ?? 'defeated in the sand', date: new Date().toISOString().slice(0, 10) }].slice(-50),
      });
      save();
      return outcome;
    },

    buyLook: (id) => {
      const look = LOOKS.find((l) => l.id === id);
      const s = get();
      if (!look || s.unlocks.includes(id) || s.denarii < look.cost) return false;
      set({ denarii: s.denarii - look.cost, unlocks: [...s.unlocks, id] });
      save();
      return true;
    },
    equipLook: (id) => { if (get().unlocks.includes(id)) { set({ look: id }); save(); } },
    equipStyle: (id) => { set({ style: id }); save(); },
    addGlory: (n) => { set({ glory: Math.max(0, get().glory + n), fame: Math.max(0, get().fame + n) }); save(); },
    recordChampion: () => { set({ champions: get().champions + 1 }); save(); },
    recordDeath: (f) => { set({ fallen: [...get().fallen, f].slice(-50) }); save(); },
  };
});
