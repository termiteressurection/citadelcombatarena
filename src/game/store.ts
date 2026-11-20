import { create } from 'zustand';
import type { StationId } from './world/layout';
import { LOOKS } from './arena/run';
import { STYLE_IDS, type StyleId } from './arena/styles';
import {
  BODIES, CAPES, DEFAULT_LOADOUT, HELMS, OFFHANDS, WEAPONS, resolveLoadout,
  type GearSlot, type Loadout,
} from './rpg/items';
import {
  CONSUMABLES, DEFAULT_STATS, MAX_FLASKS, applyXp,
  type ConsumableId, type DailyBuffId, type RpgStats, type StatKey,
} from './rpg/stats';
import { updateQuestProgress, type BoutSummary, type FightCard, type Quest } from './rpg/quests';

export type Scene = 'ludus' | 'arena';
export type TimeOfDay = 'morning' | 'dusk';
export interface Fallen { name: string; bouts: number; cause: string; date: string }

export interface BoutOutcome {
  victory: boolean;
  denariiDelta: number;
  fameDelta: number;
  xpEarned: number;
  levelsGained: number;
  healerFee: number;
  cause?: string;
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
}

const KEY_V2 = 'boneyard.save.v2';
const KEY_V1 = 'boneyard.save.v1';

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
});

function mergeOwned(base: string[], raw: unknown, validIds: Set<string>): string[] {
  const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && validIds.has(x)) : [];
  return Array.from(new Set([...base, ...arr]));
}

export function loadSave(): Save {
  const b = blank();
  if (typeof localStorage === 'undefined') return b;
  try {
    const raw2 = localStorage.getItem(KEY_V2);
    const raw1 = !raw2 ? localStorage.getItem(KEY_V1) : null;
    if (!raw2 && !raw1) return b;
    const p = JSON.parse((raw2 ?? raw1)!);

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
    };
  } catch {
    return b;
  }
}

interface GameState extends Save {
  scene: Scene;
  panel: StationId | null;
  near: StationId | null;
  selectedCard: FightCard | null;
  lastResult: BoutOutcome | null;
  setNear: (id: StationId | null) => void;
  openPanel: (id: StationId | null) => void;
  setScene: (s: Scene) => void;
  togglePs1Mode: () => void;
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
    };
    try { localStorage.setItem(KEY_V2, JSON.stringify(payload)); } catch { /* storage unavailable */ }
  };

  return {
    ...loadSave(),
    scene: typeof location !== 'undefined' && location.search.includes('arena') ? 'arena' : 'ludus',
    panel: null,
    near: null,
    selectedCard: null,
    lastResult: null,
    setNear: (near) => { if (get().near !== near) set({ near }); },
    openPanel: (panel) => set({ panel }),
    setScene: (scene) => set({ scene, panel: null, near: null }),
    togglePs1Mode: () => { set({ ps1Mode: !get().ps1Mode }); save(); },

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
      if (s.fame < item.reqFame || s.denarii < item.cost) return false;
      set({
        denarii: s.denarii - item.cost,
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
      if (!c || s.denarii < c.cost) return false;
      if (c.id === 'healing_flask') {
        if (s.flasks >= MAX_FLASKS) return false;
        set({ denarii: s.denarii - c.cost, flasks: s.flasks + 1 });
      } else {
        const buffId = c.id as DailyBuffId;
        if (s.dailyBuffs.includes(buffId)) return false;
        set({ denarii: s.denarii - c.cost, dailyBuffs: [...s.dailyBuffs, buffId] });
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
      save();
    },

    startCardBout: (card) => {
      set({ selectedCard: card, lastResult: null, scene: 'arena', panel: null, near: null });
    },

    settleBout: (summary) => {
      const s = get();
      const gear = resolveLoadout(s.loadout);
      const updatedQuests = updateQuestProgress(s.activeQuests, summary);
      const bonusCombatXp = summary.parries * 8 + summary.armorsBroken * 5 + summary.limbsSevered * 4;

      if (summary.victory) {
        const baseD = summary.card?.denarii ?? Math.max(40, summary.kills * 35);
        const baseX = summary.card?.xp ?? Math.max(45, summary.kills * 35);
        const baseF = summary.card?.fame ?? Math.max(25, summary.kills * 20);
        const fameGain = Math.round(baseF * gear.fameMul);
        const xpEarned = baseX + bonusCombatXp;
        const lv = applyXp(s.level, s.xp, s.statPoints, xpEarned);
        const outcome: BoutOutcome = {
          victory: true,
          denariiDelta: baseD,
          fameDelta: fameGain,
          xpEarned,
          levelsGained: lv.levelsGained,
          healerFee: 0,
        };
        set({
          denarii: s.denarii + baseD,
          fame: s.fame + fameGain,
          glory: s.glory + fameGain,
          level: lv.level,
          xp: lv.xp,
          statPoints: lv.statPoints,
          wins: s.wins + 1,
          champions: s.champions + (summary.card?.tier === 4 ? 1 : 0),
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
      };
      set({
        denarii: s.denarii - healerFee,
        fame: s.fame - lostFame,
        level: lv.level,
        xp: lv.xp,
        statPoints: lv.statPoints,
        losses: s.losses + 1,
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
