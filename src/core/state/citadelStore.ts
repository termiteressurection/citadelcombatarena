import { create } from 'zustand';
import { createInitialCitadelState } from '../model/schema';
import type { CitadelStateModel, LocalDay, MindNode, MindEdge, Mindmap3dState } from '../model/types';
import {
  buildCartridgeJson,
  importCartridgeJsonString,
} from '../persistence/cartridge';
import {
  loadStateAsync,
  saveState,
  waitForPersistenceIdle,
} from '../persistence/storage';
import {
  completeDailyTrial,
  completeRitual,
  crystallizeDay as crystallizeDayAction,
  rolloverToToday,
  submitDailyAnchor,
  writeEntry,
  writeHierarchicalEntry,
} from './stateActions';
import {
  resolveWritableDay,
  assertDayWritable,
  assertPeriodWritable,
  resolveWritablePeriod,
  type JournalLevel,
} from '@/arboretum/components/citadel-rebuilt/writablePath';
import { crystallizeDay as crystallizeDayBackend } from '../semantic/crystallizationClient';
import {
  bindGlobalNodeToChamber,
  createGlobalEdge,
  createGlobalNode,
  removeGlobalEdge as removeGlobalMindEdge,
  removeGlobalNode as removeGlobalMindNode,
  setGlobalMindMap as replaceGlobalMindMap,
  toggleGlobalNodeStar,
  updateGlobalNode as patchGlobalMindNode,
} from './mindmapActions';
import {
  deleteSynapticDeck,
  importSynapticDeck,
  recordSynapticAnswer,
  resetSynapticDeckProgress,
  saveCustomSynapticQuestion,
  synthesizeSynapticPrompt,
} from './synapticActions';
import type { QuestionDeck, SynapticAnswer, SynapticQuestion } from '../model/types';
import { buildFractalIndexV1 } from '../model/fractal';

function uid(prefix = "n"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function persist(next: CitadelStateModel): { state: CitadelStateModel } {
  saveState(next);
  return { state: next };
}

type CitadelStore = {
  state: CitadelStateModel;
  hydrated: boolean;
  writeToday: (text: string, tags?: string[]) => void;
  writeToDay: (day: LocalDay, text: string, tags?: string[]) => void;
  writeToPeriod: (level: JournalLevel, period: string, text: string, tags?: string[]) => void;
  submitAnchor: (text: string) => void;
  completeTrial: () => void;
  completeRitualStep: (step: 'morning' | 'evening') => void;
  crystallizeDay: (day?: LocalDay) => Promise<void>;
  rollover: () => void;
  setState: (next: CitadelStateModel) => void;
  reset: () => void;
  wipeAllInMemory: () => void;
  // Global mindmap
  addGlobalNode: (label: string, at?: { x: number; y: number }) => string;
  updateGlobalNode: (id: string, patch: Partial<MindNode>) => void;
  removeGlobalNode: (id: string) => void;
  createMindNode: (label: string, at?: { x: number; y: number }) => string;
  updateMindNodePosition: (id: string, x: number, y: number) => void;
  deleteMindNode: (id: string) => void;
  toggleMindNodeStar: (id: string) => void;
  addGlobalEdge: (fromId: string, toId: string) => void;
  removeGlobalEdge: (edgeId: string) => void;
  setGlobalMindMap: (m: { nodes: MindNode[]; edges: MindEdge[] }) => void;
  /** Star/unstar a node (manifests/removes a torii gate in the Hub). */
  toggleStarNode: (id: string) => void;
  /** Bind a node to a chamber so its starred gate teleports there. */
  bindNodeToChamber: (id: string, chamberId: string | null) => void;
  recordSynapticAnswer: (answer: SynapticAnswer) => void;
  importSynapticDeck: (deck: QuestionDeck) => void;
  deleteSynapticDeck: (deckId: string) => void;
  saveCustomSynapticQuestion: (question: SynapticQuestion) => void;
  generateSynapticSynthesis: () => void;
  resetSynapticDeckProgress: (deckId: string) => void;

  /** §VII Floppy Path — full state export (JSON string). */
  exportCartridgeJson: () => Promise<string>;
  /** §VII — verify hash + LWW merge + persist. */
  applyCartridgeImportJson: (json: string) => Promise<void>;
  setMindmap3d: (m: Mindmap3dState) => void;
  _hydrate: (loaded: CitadelStateModel | null) => void;
  /** Re-read the native journal after Rust appended entries outside the store (phone import). */
  reloadFromDisk: () => Promise<void>;
};

const initial = createInitialCitadelState();

export type CitadelHydrationCallback = (state: CitadelStateModel) => void;
const hydrationCallbacks = new Set<CitadelHydrationCallback>();

export function registerCitadelHydrationCallback(cb: CitadelHydrationCallback): () => void {
  hydrationCallbacks.add(cb);
  const current = useCitadelStore.getState();
  if (current.hydrated) {
    try {
      cb(current.state);
    } catch (e) {
      console.error('[citadel] Hydration callback failed:', e);
    }
  }
  return () => {
    hydrationCallbacks.delete(cb);
  };
}

export const useCitadelStore = create<CitadelStore>((set, get) => ({
  state: initial,
  hydrated: false,

  reloadFromDisk: async () => {
    await waitForPersistenceIdle();
    const loaded = await loadStateAsync();
    if (loaded) get()._hydrate(loaded);
  },

  _hydrate: (loaded) => {
    const base = loaded ?? createInitialCitadelState();
    const next = rolloverToToday(base);
    if (next !== base) saveState(next);
    set({ state: next, hydrated: true });
    for (const cb of hydrationCallbacks) {
      try {
        cb(next);
      } catch (e) {
        console.error('[citadel] Hydration callback failed:', e);
      }
    }
  },

  setMindmap3d: (mindmap) => {
    set((store) => {
      const next: CitadelStateModel = {
        ...store.state,
        mindmap3d: mindmap,
      };
      return persist(next);
    });
  },

  writeToday: (text, tags) => {
    const today = resolveWritableDay();
    set((store) => {
      const next = writeEntry(store.state, { day: today, text, tags });
      return persist(next);
    });
  },

  writeToDay: (day, text, tags) => {
    assertPeriodWritable('day', day);
    set((store) => {
      const activeToday = resolveWritableDay();
      const baseState = store.state.today !== activeToday
        ? { ...store.state, today: activeToday }
        : store.state;
      const next = writeEntry(baseState, { day, text, tags, level: 'day', period: day });
      return persist(next);
    });
  },

  writeToPeriod: (level, period, text, tags) => {
    assertPeriodWritable(level, period);
    if (level === 'day') {
      const targetDay = period as LocalDay;
      set((store) => {
        const activeToday = resolveWritableDay();
        const baseState = store.state.today !== activeToday
          ? { ...store.state, today: activeToday }
          : store.state;
        const next = writeEntry(baseState, { day: targetDay, text, tags, level: 'day', period });
        return persist(next);
      });
    } else {
      set((store) => {
        const next = writeHierarchicalEntry(store.state, level, period, text, tags);
        return persist(next);
      });
    }
  },

  submitAnchor: (text) => {
    const today = resolveWritableDay();
    assertDayWritable(today);
    set((store) => {
      const next = submitDailyAnchor(store.state, text);
      return persist(next);
    });
  },

  completeTrial: () => {
    set((store) => {
      const next = completeDailyTrial(store.state);
      return persist(next);
    });
  },

  completeRitualStep: (step) => {
    set((store) => {
      const next = completeRitual(store.state, step);
      return persist(next);
    });
  },

  crystallizeDay: async (day) => {
    const targetDay = day ?? get().state.today;
    try {
      await crystallizeDayBackend(targetDay);
    } catch (e) {
      console.warn('[citadel] backend crystallization error, preserving local stone:', e);
    }
    set((store) => {
      const next = crystallizeDayAction(store.state, targetDay);
      return persist(next);
    });
  },

  rollover: (now?: Date) => {
    set((store) => {
      const next = rolloverToToday(store.state, now);
      return persist(next);
    });
  },

  setState: (next) => {
    saveState(next);
    set({ state: next });
  },

  reset: () => {
    const current = get().state;
    const fresh = createInitialCitadelState();
    const days: CitadelStateModel['days'] = { ...fresh.days };
    for (const day of Object.values(current.days)) {
      if (day.entries.length === 0) continue;
      days[day.day] = {
        day: day.day,
        entries: day.entries,
        locked: day.day < fresh.today,
        dailyAnchorComplete: false,
        dailyTrialComplete: false,
      };
    }
    fresh.days = days;
    fresh.fractal = buildFractalIndexV1(days);
    saveState(fresh);
    set({ state: fresh, hydrated: true });
  },

  wipeAllInMemory: () => {
    const fresh = createInitialCitadelState();
    set({ state: fresh, hydrated: true });
  },

  // Global mindmap actions
  addGlobalNode: (label, at) => {
    const id = uid("gn");
    set((store) => {
      const next = createGlobalNode(store.state, id, label, at);
      return persist(next);
    });
    return id;
  },
  createMindNode: (label, at) => {
    return get().addGlobalNode(label, at);
  },
  updateMindNodePosition: (id, x, y) => {
    get().updateGlobalNode(id, { x, y });
  },
  deleteMindNode: (id) => {
    get().removeGlobalNode(id);
  },
  toggleMindNodeStar: (id) => {
    get().toggleStarNode(id);
  },
  updateGlobalNode: (id, patch) =>
    set((store) => {
      const next = patchGlobalMindNode(store.state, id, patch);
      return persist(next);
    }),
  removeGlobalNode: (id) =>
    set((store) => {
      const next = removeGlobalMindNode(store.state, id);
      return persist(next);
    }),
  addGlobalEdge: (fromId, toId) =>
    set((store) => {
      const next = createGlobalEdge(store.state, uid("ge"), fromId, toId);
      if (next === store.state) return store;
      return persist(next);
    }),
  removeGlobalEdge: (edgeId) =>
    set((store) => {
      const next = removeGlobalMindEdge(store.state, edgeId);
      return persist(next);
    }),
  setGlobalMindMap: (m) =>
    set((store) => {
      const next = replaceGlobalMindMap(store.state, m);
      return persist(next);
    }),
  toggleStarNode: (id) =>
    set((store) => {
      const next = toggleGlobalNodeStar(store.state, id);
      return persist(next);
    }),
  bindNodeToChamber: (id, chamberId) =>
    set((store) => {
      const next = bindGlobalNodeToChamber(store.state, id, chamberId);
      return persist(next);
    }),
  recordSynapticAnswer: (answer) =>
    set((store) => persist(recordSynapticAnswer(store.state, answer))),
  importSynapticDeck: (deck) =>
    set((store) => persist(importSynapticDeck(store.state, deck))),
  deleteSynapticDeck: (deckId) =>
    set((store) => persist(deleteSynapticDeck(store.state, deckId))),
  saveCustomSynapticQuestion: (question) =>
    set((store) => persist(saveCustomSynapticQuestion(store.state, question))),
  generateSynapticSynthesis: () =>
    set((store) => persist(synthesizeSynapticPrompt(store.state))),
  resetSynapticDeckProgress: (deckId) =>
    set((store) => persist(resetSynapticDeckProgress(store.state, deckId))),

  exportCartridgeJson: async () => buildCartridgeJson(get().state),

  applyCartridgeImportJson: async (json) => {
    const next = await importCartridgeJsonString(get().state, json);
    saveState(next);
    set({ state: next });
  },

}));

let hydrationPromise: Promise<void> | null = null;

export function hydrateCitadelStore(): Promise<void> {
  if (useCitadelStore.getState().hydrated) return Promise.resolve();
  if (!hydrationPromise) {
    hydrationPromise = loadStateAsync()
      .then((loaded) => {
        useCitadelStore.getState()._hydrate(loaded);
      })
      .catch((error) => {
        hydrationPromise = null;
        throw error;
      });
  }
  return hydrationPromise;
}
