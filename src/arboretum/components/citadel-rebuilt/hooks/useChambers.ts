import { useCallback } from 'react';
import { useCitadelStore } from '../store';
import { Chamber, FurnitureItem, NamePlate, FutureLetter } from '../types';
import { isCalendarChamber } from '../calendarChamberUtils';

const SHORT_NAMES = [
  'Nexus','Void','Echo','Flux','Aura','Drift','Haze','Veil',
  'Pulse','Glow','Rift','Bloom','Spire','Node','Arc','Ember',
  'Shard','Prism','Orbit','Dusk','Nova','Loom','Crux','Eddy',
  'Wisp','Apex','Root','Wake','Coil','Sigil','Rune','Mote',
];

function pickShortName(usedNames: Set<string>): string {
  const available = SHORT_NAMES.filter(n => !usedNames.has(n));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  const base = SHORT_NAMES[Math.floor(Math.random() * SHORT_NAMES.length)];
  let i = 2;
  while (usedNames.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function useChambers(_enterChamber: (id: number) => void) {
  const currentChamberId = useCitadelStore(state => state.currentChamberId);
  const chambers = useCitadelStore(state => state.chambers);
  const updateChamber = useCitadelStore(state => state.updateChamber);
  const setChambers = useCitadelStore(state => state.setChambers);

  const createSubChamber = useCallback((name?: string) => {
    if (isCalendarChamber(chambers[currentChamberId])) {
      return null;
    }
    const usedNames = new Set(Object.values(chambers).map(c => c.name));
    const newId = Math.max(...Object.keys(chambers).map(Number)) + 1;
    const chamberName = name || pickShortName(usedNames);
    const parent = chambers[currentChamberId];

    const newChamber: Chamber = {
      id: newId,
      name: chamberName,
      description: `A new branch of ${parent.name}`,
      depth: (parent.depth || 0) + 1,
      parent: currentChamberId,
      thoughts: [],
      doors: []
    };

    setChambers(prev => ({
      ...prev,
      [currentChamberId]: {
        ...parent,
        doors: [...parent.doors, newId]
      },
      [newId]: newChamber
    }));
    return newId;
  }, [currentChamberId, chambers, setChambers]);

  const createMindMap = useCallback((input: string) => {
    if (isCalendarChamber(chambers[currentChamberId])) {
      return {
        created: 0,
        summary: 'Calendar chambers are fixed. Use the day, week, month, season, and year lattice instead of new portals.',
      };
    }
    const branches = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (branches.length === 0) {
      return { created: 0, summary: 'No valid branches were provided.' };
    }
    branches.forEach(b => createSubChamber(b));
    return { created: branches.length, summary: `Propagated ${branches.length} legacy branch${branches.length === 1 ? '' : 'es'}.` };
  }, [chambers, createSubChamber, currentChamberId]);

  const renameChamber = useCallback((id: number, name: string) => {
    updateChamber(id, (c) => {
      c.name = name;
    });
  }, [updateChamber]);

  const deleteBranch = useCallback((id: number) => {
    if (id === 0) return;
    setChambers(prev => {
      if (!prev[id] || isCalendarChamber(prev[id])) return prev;
      const next = { ...prev };
      
      const toDelete = new Set<number>();
      const collectChildren = (targetId: number) => {
        if (targetId === 0 || (next[targetId] && isCalendarChamber(next[targetId]))) return;
        toDelete.add(targetId);
        Object.values(next).forEach(ch => {
          if (ch.parent === targetId && !toDelete.has(ch.id)) {
            collectChildren(ch.id);
          }
        });
      };
      collectChildren(id);

      Object.keys(next).forEach(keyStr => {
        const cid = Number(keyStr);
        if (!toDelete.has(cid)) {
          const ch = next[cid];
          if (ch.doors.some(d => toDelete.has(d))) {
            next[cid] = {
              ...ch,
              doors: ch.doors.filter(d => !toDelete.has(d))
            };
          }
        }
      });

      toDelete.forEach(targetId => {
        delete next[targetId];
      });

      return next;
    });
  }, [setChambers]);

  const mergeChambers = useCallback((srcId: number, targetId: number) => {
    if (srcId === targetId || srcId === 0 || targetId === 0) return;
    setChambers(prev => {
      const src = prev[srcId];
      const target = prev[targetId];
      if (!src || !target || isCalendarChamber(src) || isCalendarChamber(target)) return prev;
      const next = { ...prev };

      const mergedThoughts = [...target.thoughts, ...src.thoughts.map(t => ({ ...t, chamberId: targetId }))];

      const newDoors = Array.from(new Set([
        ...target.doors.filter(d => d !== srcId && d !== targetId),
        ...src.doors.filter(d => d !== srcId && d !== targetId)
      ]));

      Object.values(next).forEach(ch => {
        if (ch.parent === srcId) {
          next[ch.id] = { ...ch, parent: targetId };
        }
      });

      Object.keys(next).forEach(keyStr => {
        const cid = Number(keyStr);
        if (cid !== srcId) {
          const ch = next[cid];
          if (ch.doors.includes(srcId)) {
            next[cid] = {
              ...ch,
              doors: Array.from(new Set(ch.doors.map(d => (d === srcId ? targetId : d)).filter(d => d !== cid)))
            };
          }
        }
      });

      next[targetId] = {
        ...target,
        thoughts: mergedThoughts,
        doors: newDoors
      };

      delete next[srcId];
      return next;
    });
  }, [setChambers]);

  const toggleBookmark = useCallback((id: number) => {
    updateChamber(id, (c) => {
      c.bookmarked = !c.bookmarked;
    });
  }, [updateChamber]);

  const addFurniture = useCallback((kind: string, x: number, z: number, color?: number) => {
    updateChamber(currentChamberId, (c) => {
      const item: FurnitureItem = { id: Date.now(), kind, x, z, color };
      if (!c.furniture) c.furniture = [];
      c.furniture.push(item);
    });
  }, [currentChamberId, updateChamber]);

  const removeFurniture = useCallback((itemId: number) => {
    updateChamber(currentChamberId, (c) => {
      if (c.furniture) c.furniture = c.furniture.filter(f => f.id !== itemId);
    });
  }, [currentChamberId, updateChamber]);

  const addNamePlate = useCallback((text: string, x: number, z: number) => {
    updateChamber(currentChamberId, (c) => {
      const plate: NamePlate = { id: Date.now(), text, x, z };
      if (!c.namePlates) c.namePlates = [];
      c.namePlates.push(plate);
    });
  }, [currentChamberId, updateChamber]);

  const removeNamePlate = useCallback((plateId: number) => {
    updateChamber(currentChamberId, (c) => {
      if (c.namePlates) c.namePlates = c.namePlates.filter(p => p.id !== plateId);
    });
  }, [currentChamberId, updateChamber]);

  const logCommand = useCallback((cmd: string) => {
    updateChamber(currentChamberId, (c) => {
      if (!c.commandLog) c.commandLog = [];
      c.commandLog.push(cmd);
      if (c.commandLog.length > 10) c.commandLog.shift();
    }, true); // skipUndo for logs
  }, [currentChamberId, updateChamber]);

  const setSkybox = useCallback((data: string) => {
    updateChamber(currentChamberId, (c) => {
      c.skyboxData = data;
    });
  }, [currentChamberId, updateChamber]);

  const writeFutureLetter = useCallback((text: string, revealAt: string) => {
    updateChamber(currentChamberId, (c) => {
      const letter: FutureLetter = { id: Date.now(), text, writtenAt: new Date().toISOString(), revealAt };
      if (!c.letters) c.letters = [];
      c.letters.push(letter);
    });
  }, [currentChamberId, updateChamber]);

  const revealLetters = useCallback(() => {
    updateChamber(currentChamberId, (c) => {
      const now = new Date().toISOString();
      if (c.letters) {
        c.letters = c.letters.map(l => l.revealAt <= now ? { ...l, revealed: true } : l);
      }
    }, true);
  }, [currentChamberId, updateChamber]);

  const getBookmarks = useCallback(() => {
    return Object.values(chambers).filter(c => c.bookmarked);
  }, [chambers]);

  const getOrphans = useCallback(() => {
    // "Orphans" are leaf chambers with no thoughts: likely abandoned branches.
    return Object.values(chambers).filter(c => c.id !== 0 && c.doors.length === 0 && c.thoughts.length === 0);
  }, [chambers]);

  const getChamberSummary = useCallback((id: number) => {
    const c = chambers[id];
    if (!c) return "Unknown chamber.";
    return `${c.name}: ${c.thoughts.length} thoughts, ${c.doors.length} sub-branches.`;
  }, [chambers]);

  const findSimilar = useCallback((thoughtId: number) => {
    const all = Object.values(chambers);
    let sourceThought: { text: string; chamberId: number } | null = null;

    for (const chamber of all) {
      const t = chamber.thoughts.find(th => th.id === thoughtId);
      if (t) {
        sourceThought = { text: t.text, chamberId: chamber.id };
        break;
      }
    }
    if (!sourceThought) return [];

    const tokens = sourceThought.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    const tokenSet = new Set(tokens);
    if (tokenSet.size === 0) return [];

    const results: { chamberId: number; chamberName: string; thought: any; score: number }[] = [];
    for (const chamber of all) {
      for (const thought of chamber.thoughts) {
        if (thought.id === thoughtId) continue;
        const tks = thought.text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2);
        let overlap = 0;
        for (const tk of tks) {
          if (tokenSet.has(tk)) overlap += 1;
        }
        if (overlap > 0) {
          results.push({
            chamberId: chamber.id,
            chamberName: chamber.name,
            thought,
            score: overlap,
          });
        }
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [chambers]);

  return { createSubChamber, createMindMap, renameChamber, deleteBranch, mergeChambers, toggleBookmark, addFurniture, removeFurniture, addNamePlate, removeNamePlate, logCommand, setSkybox, writeFutureLetter, revealLetters, getBookmarks, getOrphans, getChamberSummary, findSimilar };
}
