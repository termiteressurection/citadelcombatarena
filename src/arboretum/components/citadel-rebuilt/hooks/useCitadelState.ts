import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Chamber, Thought, type GridIdentity } from '../types';
import { loadSaveData } from '../saveSlots';
import { useCitadelStore } from '../store';
import { useCitadelStore as useCanonicalStore } from '@/core/state/citadelStore';
import { projectDayEntriesToChamber } from '../adapters/canonicalProjection';
import { useNavigation } from './useNavigation';
import { useThoughts } from './useThoughts';
import { useChambers } from './useChambers';
import { useIdentity } from './useIdentity';
import { useExport } from './useExport';
import { usePersistence } from './usePersistence';
import { withIdentityDefaults } from '../identityDefaults';
import { findDayChamberIdByLocalDate, parseLocalDateFromChamber } from '../calendarChamberUtils';
import { localDateISO } from '../localDate';
import { resolveWritableDay, assertDayWritable } from '../writablePath';
import { resolveAltarDestination } from '../altarRouter';
import { getNumericId } from '@/features/world/mindmap3d/ids';
import { useMindmap, type Node } from '@/features/world/mindmap3d/store';
import {
  getYearChamberId,
  getSeasonChamberId,
  getMonthChamberId,
  getSeasonForMonth,
  getDaysInMonth,
  SEASONS,
  MONTH_NAMES,
  MONTH_FULL_NAMES,
  migrateCalendarChambers,
} from '../fractalCalendarModel';
export { getNumericId };

function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getChamberIdForDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100000 + 30000;
}

interface DateMetadata {
  dayId: number;
  monthId: number;
  seasonId: number;
  yearId: number;
}

function getCalendarMetadataForDate(dateStr: string): DateMetadata {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10); // 1..12

  const yearId = getYearChamberId(y);
  const seasonDef = getSeasonForMonth(m);
  const seasonId = getSeasonChamberId(y, seasonDef.index);
  const monthId = getMonthChamberId(y, m);
  const dayId = getChamberIdForDate(dateStr);

  return { dayId, monthId, seasonId, yearId };
}

function mergeDoorSets(primary: number[], secondary: number[]): number[] {
  const seen = new Set<number>();
  return [...primary, ...secondary].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function syncSigmaEngineChambers(
  base: Record<number, Chamber>
): { chambers: Record<number, Chamber>; didInject: boolean } {
  // 1. Run migration if legacy IDs are detected
  const { migratedChambers, didMigrate } = migrateCalendarChambers(base);
  const workingBase = didMigrate ? migratedChambers : base;

  const next: Record<number, Chamber> = {};
  let didInject = didMigrate;

  // Deep-clone/shallow-clone clean dictionary so Immer frozen objects are NEVER mutated
  for (const [k, v] of Object.entries(workingBase)) {
    next[Number(k)] = {
      ...v,
      doors: [...(v.doors || [])],
      thoughts: [...(v.thoughts || [])],
    };
  }

  // Ensure root hub exists
  if (!next[0]) {
    next[0] = {
      id: 0,
      name: 'The Citadel',
      description: 'Your inner fortress — the root of the Grid.',
      depth: 0,
      thoughts: [],
      doors: [],
      parent: undefined,
    };
    didInject = true;
  }

  const today = todayISO();
  const currentYear = parseInt(today.split('-')[0], 10);
  const yearId = getYearChamberId(currentYear);

  // Ensure Year Chamber exists
  if (!next[yearId]) {
    next[yearId] = {
      id: yearId,
      name: `YEAR ${currentYear}`,
      description: `The timeline of ${currentYear}.`,
      depth: 1,
      parent: 0,
      template: 'calendar-root',
      doors: [0],
      thoughts: [],
    };
  }

  // Ensure Season Chambers (0=WINTER, 1=SPRING, 2=SUMMER, 3=AUTUMN) exist
  const seasonIds: number[] = [];
  for (let s = 0; s < 4; s++) {
    const sId = getSeasonChamberId(currentYear, s);
    seasonIds.push(sId);
    if (!next[sId]) {
      next[sId] = {
        id: sId,
        name: SEASONS[s].name,
        description: `The season of ${SEASONS[s].name.toLowerCase()}.`,
        depth: 2,
        parent: yearId,
        template: 'season',
        doors: [yearId, 0],
        thoughts: [],
      };
    }
    next[yearId] = {
      ...next[yearId],
      doors: mergeDoorSets(next[yearId].doors, [sId]),
    };
  }

  // Ensure Month Chambers (1..12) and their Day Chambers exist in chronological order
  for (let m = 1; m <= 12; m++) {
    const monthId = getMonthChamberId(currentYear, m);
    const seasonDef = getSeasonForMonth(m);
    const seasonChamberId = getSeasonChamberId(currentYear, seasonDef.index);
    const daysInMonth = getDaysInMonth(currentYear, m);
    const monthDayIds: number[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = `${currentYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dId = getChamberIdForDate(dayDate);
      monthDayIds.push(dId);

      if (!next[dId]) {
        next[dId] = {
          id: dId,
          name: dayDate === today ? 'TODAY' : `DAY ${d}`,
          description: `The day of ${dayDate}.`,
          depth: 4,
          parent: monthId,
          template: 'day',
          doors: [monthId, 0],
          thoughts: [],
        };
      } else {
        next[dId] = {
          ...next[dId],
          parent: monthId,
          doors: mergeDoorSets(next[dId].doors, [monthId]),
        };
      }
    }

    if (!next[monthId]) {
      next[monthId] = {
        id: monthId,
        name: MONTH_NAMES[m - 1],
        description: `The month of ${MONTH_FULL_NAMES[m - 1]}.`,
        depth: 3,
        parent: seasonChamberId,
        template: 'month',
        doors: [0, seasonChamberId, ...monthDayIds],
        thoughts: [],
      };
    } else {
      next[monthId] = {
        ...next[monthId],
        doors: mergeDoorSets(next[monthId].doors, [0, seasonChamberId, ...monthDayIds]),
      };
    }

    // Connect Season -> Month
    if (next[seasonChamberId]) {
      next[seasonChamberId] = {
        ...next[seasonChamberId],
        doors: mergeDoorSets(next[seasonChamberId].doors, [monthId]),
      };
    }
  }

  // Connect Hub -> Year
  next[0] = {
    ...next[0],
    doors: mergeDoorSets(next[0].doors, [yearId]),
  };

  // Ensure any other day chambers present in workingBase from historical/future years are preserved
  for (const [key, chamber] of Object.entries(workingBase)) {
    const id = Number(key);
    if (!next[id]) {
      next[id] = {
        ...chamber,
        doors: [...(chamber.doors || [])],
        thoughts: [...(chamber.thoughts || [])],
      };
    }

    if (chamber.template === 'day') {
      const dateStr = parseLocalDateFromChamber(chamber);
      if (dateStr) {
        const meta = getCalendarMetadataForDate(dateStr);
        if (next[meta.monthId]) {
          next[meta.monthId] = {
            ...next[meta.monthId],
            doors: mergeDoorSets(next[meta.monthId].doors, [id]),
          };
        }
      }
    }
  }

  // Sync nodes from the global 3D mind map store into R3F chambers
  const mmStore = useMindmap.getState();
  const nodes = Object.values(mmStore.nodes || {});

  nodes.forEach((node) => {
    const chamberId = getNumericId(node.id);
    const existing = base[chamberId];
    const userThoughts = (existing?.thoughts || []).filter(t => !t.tags?.includes('derived-mindmap'));
    const incomingThoughts = (node.bullets || []).map((text: string, idx: number) => ({
      id: chamberId + (idx + 1) / 1000,
      text,
      timestamp: new Date().toISOString(),
      chamberId,
      type: 'monolith' as const,
      tags: ['derived-mindmap']
    }));
    const mergedThoughts = [...userThoughts, ...incomingThoughts];

    next[chamberId] = {
      ...existing,
      id: chamberId,
      name: node.title,
      description: node.body || `Mindscape chamber for topic: ${node.title}`,
      depth: 1,
      parent: 0,
      template: 'mindmap-node',
      nodeId: node.id,
      doors: existing?.doors ?? [],
      thoughts: mergedThoughts,
      furniture: existing?.furniture,
      namePlates: existing?.namePlates,
      commandLog: existing?.commandLog,
      bottles: existing?.bottles,
      letters: existing?.letters,
      skyboxData: existing?.skyboxData,
      bookmarked: existing?.bookmarked,
      lastVisited: existing?.lastVisited,
      isLighthouse: existing?.isLighthouse,
      wormholes: existing?.wormholes,
    };
    if (!existing) didInject = true;
  });

  // Sync links into bidirectional portal doorways between mindmap 3D chambers
  nodes.forEach((node) => {
    const fromChamberId = getNumericId(node.id);
    (node.links || []).forEach((toId) => {
      const targetNode = mmStore.nodes[toId];
      if (targetNode) {
        const toChamberId = getNumericId(toId);
        if (next[fromChamberId] && next[toChamberId]) {
          if (!next[fromChamberId].doors.includes(toChamberId)) {
            next[fromChamberId] = {
              ...next[fromChamberId],
              doors: [...next[fromChamberId].doors, toChamberId]
            };
            didInject = true;
          }
          if (!next[toChamberId].doors.includes(fromChamberId)) {
            next[toChamberId] = {
              ...next[toChamberId],
              doors: [...next[toChamberId].doors, fromChamberId]
            };
            didInject = true;
          }
        }
      }
    });
  });

  return { chambers: next, didInject };
}

// ── Store initializer — hydrates from disk every session (menu → game) ─────
async function initStoreFromSlot(slotId: string) {
  const store = useCitadelStore.getState();
  const data = await loadSaveData(slotId);
  const { chambers } = syncSigmaEngineChambers(data?.chambers ?? {});
  const rawIdentity: GridIdentity = data?.identity ?? {
    name: 'Traveler',
    createdAt: new Date().toISOString(),
    sessionStart: Date.now(),
  };

  store.setChambers(chambers, true /* skipUndo */);
  store.setIdentity({ ...withIdentityDefaults(rawIdentity), sessionStart: Date.now() });
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useCitadelState(slotId: string) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize store from persisted save on first call
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      try {
        await initStoreFromSlot(slotId);
      } catch (err) {
        console.error('[citadel] Rebuilt slot hydration failed; using fresh in-memory defaults.', err);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }
    void setup();
    return () => {
      cancelled = true;
    };
  }, [slotId]);

  // Pull reactive state from store
  const chambers    = useCitadelStore(s => s.chambers);
  const identity    = useCitadelStore(s => s.identity);
  const currentChamberId = useCitadelStore(s => s.currentChamberId);
  const modalOpen   = useCitadelStore(s => s.modalOpen);
  const setModalOpen = useCitadelStore(s => s.setModalOpen);

  const mmNodes = useMindmap(s => s.nodes);

  // Sync global mind map updates reactively into 3D chambers
  useEffect(() => {
    if (!isLoaded) return;
    const store = useCitadelStore.getState();
    const { chambers: synced } = syncSigmaEngineChambers(store.chambers);
    if (JSON.stringify(store.chambers) !== JSON.stringify(synced)) {
      store.setChambers(synced);
    }
  }, [isLoaded, mmNodes]);

  // Domain hooks — all read/write through the store
  const navigation  = useNavigation();
  const thoughts    = useThoughts();
  const chambersHook = useChambers(navigation.enterChamber);
  const identityHook = useIdentity();
  const exportHook  = useExport();
  const { saving, save }  = usePersistence(slotId);

  // ── Persist to IndexedDB whenever store state changes ──────────────────
  const lastSaved = useRef({ chambers, identity });
  useEffect(() => {
    if (!isLoaded) return;
    if (chambers !== lastSaved.current.chambers || identity !== lastSaved.current.identity) {
      save(chambers, identity);
      lastSaved.current = { chambers, identity };
    }
  }, [chambers, identity, save, isLoaded]);

  // ── Ritual Status logic: Derives current mode from identity.rituals ──
  const ritualStatus = useMemo(() => {
    const today = todayISO();
    const rituals = identity.rituals;
    const isTodayRecord = rituals && rituals.date === today;
    const morningDone = !!(isTodayRecord && rituals?.morning);
    const eveningDone = !!(isTodayRecord && rituals?.evening);
    const hour = new Date().getHours();

    let mode: 'morning' | 'midday' | 'reflect' | 'commune' = 'morning';
    if (!morningDone) {
      mode = 'morning';
    } else if (!eveningDone) {
      // DUSK_HOUR = 15
      mode = hour < 15 ? 'midday' : 'reflect';
    } else {
      mode = 'commune';
    }

    return {
      mode,
      sealed: morningDone && eveningDone,
      morningDone,
      eveningDone,
    };
  }, [identity.rituals]);

  // ── Update streak once on mount ───────────────────────────────────────────
  const streakUpdated = useRef(false);
  useEffect(() => {
    if (!isLoaded || streakUpdated.current) return;
    streakUpdated.current = true;
    identityHook.updateStreak();
  }, [identityHook, isLoaded]);

  const currentChamber = chambers[currentChamberId] ?? chambers[0];

  // ── addThought wrapper ────────
  const addThought = useCallback((text: string, type?: Thought['type']) => {
    thoughts.addThought(text, type);
    const destination = resolveAltarDestination(currentChamber);
    // Write-through to canonical Citadel state only for Day journal chambers
    if (destination.kind === 'journal' && destination.level === 'day') {
      const canonical = useCanonicalStore.getState();
      canonical.writeToday(text, ['3d-world-thought', type ?? 'gem']);
    }
  }, [thoughts, identityHook, currentChamber]);

  const inscribeThoughtToChamber = useCallback((chamberId: number, text: string, tags: string[] = ['user-inscription']) => {
    const store = useCitadelStore.getState();
    const chamber = store.chambers[chamberId];
    const destination = resolveAltarDestination(chamber);

    // Mind Map node chamber routing: immune to timelock, appends as bullet
    if (destination.kind === 'node') {
      useMindmap.getState().addBullet(destination.nodeId, text);
      store.updateChamber(
        chamberId,
        c => {
          c.thoughts.push({
            id: Date.now() + Math.random(),
            text,
            timestamp: new Date().toISOString(),
            chamberId,
            sourceChamberId: chamberId,
            type: 'monolith',
            tags: ['derived-mindmap', 'mindmap-bullet', ...tags],
          });
        },
        true
      );
      return;
    }

    if (destination.kind === 'error') {
      console.error(`[CITADEL_ERROR] ${destination.message}`);
      return;
    }

    const chamberDate = parseLocalDateFromChamber(chamber) ?? resolveWritableDay();
    if (chamber?.template === 'day') {
      assertDayWritable(chamberDate);
    }

    store.updateChamber(
      chamberId,
      c => {
        c.thoughts.push({
          id: Date.now() + Math.random(),
          text,
          timestamp: new Date().toISOString(),
          chamberId,
          type: 'gem',
          tags,
        });
      },
      true
    );
    // Write-through to canonical Citadel state only for Day chambers
    const canonical = useCanonicalStore.getState();
    canonical.writeToday(text, tags);
  }, [identityHook]);

  /** Root "Today is …" gate — writes today's date chamber leaf, stamps identity, jumps to today's day leaf. */
  const submitDailyAnchor = useCallback(
    (body: string) => {
      const dateStr = resolveWritableDay();
      assertDayWritable(dateStr);
      const trimmed = body.trim();
      if (!trimmed) return;
      const text = `Today is ${dateStr}\n\n${trimmed}`;
      const store = useCitadelStore.getState();
      const dayId = getChamberIdForDate(dateStr);

      // Write-through to canonical store anchor
      const canonical = useCanonicalStore.getState();
      canonical.submitAnchor(trimmed);

      store.updateChamber(
        dayId,
        c => {
          c.thoughts.push({
            id: Date.now() + Math.random(),
            text,
            timestamp: new Date().toISOString(),
            chamberId: dayId,
            type: 'monolith',
            tags: ['daily-anchor', 'morning', 'user-inscription', dateStr],
          });
        },
        true,
      );

      store.setChambers(prev => {
        const next = { ...prev };
        if (!next[dayId]) {
          next[dayId] = {
            id: dayId,
            name: 'TODAY',
            description: `The day of ${dateStr}.`,
            depth: 1,
            parent: 0,
            template: 'day',
            doors: [0],
            thoughts: []
          };
        }
        return next;
      });

      store.updateIdentity(prev => {
        prev.lastDailyAnchorLocalDate = dateStr;
      });
      navigation.enterChamber(dayId);
    },
    [navigation, identityHook],
  );

  // ── Convenience wrappers that need currentChamberId injected ──────────────
  const sendBottle    = useCallback((text: string) => identityHook.sendBottle(text, currentChamberId), [identityHook, currentChamberId]);
  const searchThoughts = useCallback((query: string) => thoughts.searchThoughts(query), [thoughts]);
  const getSortedThoughts = useCallback((mode: 'date' | 'date-rev' | 'alpha' | 'pinned' = 'date') =>
    thoughts.getSortedThoughts(currentChamber, mode), [thoughts, currentChamber]);

  return {
    // State
    isLoaded,
    chambers,
    currentChamber,
    currentChamberId,
    modalOpen,
    setModalOpen,
    identity,
    saving,

    // Navigation
    ...navigation,

    // Thoughts (addThought overridden above)
    ...thoughts,
    addThought,
    inscribeThoughtToChamber,
    submitDailyAnchor,
    searchThoughts,
    getSortedThoughts,

    // Chambers
    ...chambersHook,

    // Identity
    ...identityHook,
    sendBottle,

    // Export
    ...exportHook,
    ritualStatus,
  };
}

export type CitadelState = ReturnType<typeof useCitadelState>;
