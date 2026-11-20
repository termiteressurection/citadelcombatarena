import { useCallback } from 'react';
import { useCitadelStore } from '../store';
import { Chamber, Thought } from '../types';
import {
  analyzeThoughtStress,
  getCalendarLineageForDay,
  getCalendarTier,
  parseLocalDateFromChamber,
  resolveJournalTargetChamberId,
  summarizeThoughtText,
} from '../calendarChamberUtils';
import { localDateISO } from '../localDate';
import { resolveWritableDay, assertDayWritable } from '../writablePath';
import { resolveAltarDestination } from '../altarRouter';
import { useMindmap } from '@/features/world/mindmap3d/store';

function manifestTypeForThought(source: Thought, stressScore: number): Thought['type'] {
  if (source.pinned || stressScore >= 52) return 'monolith';
  if (source.mood) return 'orb';
  if (source.type === 'seed') return 'seed';
  return 'gem';
}

function manifestHeadline(sourceDate: string, chamberName: string, tier: string): string {
  if (tier === 'week') return `${sourceDate} · ${chamberName}`;
  if (tier === 'month') return `${chamberName} · month pulse`;
  if (tier === 'season') return `${chamberName} · seasonal weather`;
  if (tier === 'year') return `${chamberName} · yearly echo`;
  return chamberName;
}

function buildManifestText(source: Thought, sourceDate: string, sourceChamber: Chamber, targetChamber: Chamber): string {
  const tier = getCalendarTier(targetChamber);
  const headline = manifestHeadline(sourceDate, targetChamber.name, tier);
  const summary = summarizeThoughtText(source.text, 88);
  return `${headline}\n${sourceChamber.name} // ${summary}`;
}

export function useThoughts() {
  const currentChamberId = useCitadelStore(state => state.currentChamberId);
  const chambers = useCitadelStore(state => state.chambers);
  const updateChamber = useCitadelStore(state => state.updateChamber);
  const setChambers = useCitadelStore(state => state.setChambers);

  const addThought = useCallback((text: string, type: Thought['type'] = 'gem', extra: Partial<Thought> = {}) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const snapshot = useCitadelStore.getState().chambers;
    const current = snapshot[currentChamberId];
    const destination = resolveAltarDestination(current);

    // Context-aware Mind Map Node Chamber routing (immune to calendar timelock)
    if (destination.kind === 'node') {
      useMindmap.getState().addBullet(destination.nodeId, trimmed);
      const sourceId = Date.now() + Math.random();
      const nodeThought: Thought = {
        id: sourceId,
        text: trimmed,
        timestamp: new Date().toISOString(),
        chamberId: destination.chamberId,
        sourceChamberId: destination.chamberId,
        type: 'monolith',
        tags: ['derived-mindmap', 'mindmap-bullet'],
        ...extra,
      };
      updateChamber(destination.chamberId, (chamber) => {
        chamber.thoughts.push(nodeThought);
      });
      return;
    }

    if (destination.kind === 'error') {
      console.error(`[CITADEL_ERROR] ${destination.message}`);
      return;
    }

    const targetChamberId = resolveJournalTargetChamberId(snapshot, currentChamberId) ?? currentChamberId;
    const targetChamber = snapshot[targetChamberId] ?? snapshot[currentChamberId];
    if (!targetChamber) return;

    // Single source of truth writability enforcement
    const writableDay = resolveWritableDay();
    const sourceDate = parseLocalDateFromChamber(targetChamber) ?? writableDay;
    if (targetChamber.template === 'day') {
      assertDayWritable(sourceDate);
    }
    const stress = analyzeThoughtStress(trimmed, extra.tags, extra.mood);
    const sourceId = Date.now() + Math.random();
    const sourceThought: Thought = {
      id: sourceId,
      text: trimmed,
      timestamp: new Date().toISOString(),
      chamberId: targetChamberId,
      sourceChamberId: targetChamberId,
      sourceDate,
      stressScore: stress.score,
      stressLabel: stress.label,
      type,
      ...extra,
    };

    updateChamber(targetChamberId, (chamber) => {
      chamber.thoughts.push(sourceThought);
    });

    if (targetChamber.template !== 'day') return;

    const lineage = getCalendarLineageForDay(useCitadelStore.getState().chambers, targetChamberId);
    lineage.forEach((ancestor, index) => {
      const manifestId = sourceId + (index + 1) / 1000;
      updateChamber(
        ancestor.id,
        (chamber) => {
          chamber.thoughts.push({
            id: manifestId,
            text: buildManifestText(sourceThought, sourceDate, targetChamber, ancestor),
            timestamp: sourceThought.timestamp,
            chamberId: ancestor.id,
            sourceThoughtId: sourceThought.id,
            sourceChamberId: targetChamberId,
            sourceDate,
            derived: true,
            manifestTier: getCalendarTier(ancestor) as Thought['manifestTier'],
            stressScore: stress.score,
            stressLabel: stress.label,
            mood: sourceThought.mood,
            tags: ['manifest', ancestor.template || 'calendar', `src:${targetChamberId}`],
            type: manifestTypeForThought(sourceThought, stress.score),
          });
        },
        true,
      );
    });
  }, [currentChamberId, updateChamber]);

  const editThought = useCallback((id: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setChambers(prev => {
      let sourceThought: Thought | null = null;
      let sourceChamber: Chamber | null = null;

      for (const chamber of Object.values(prev)) {
        const found = chamber.thoughts.find(th => th.id === id);
        if (found) {
          sourceThought = found;
          sourceChamber = chamber;
          break;
        }
      }
      if (!sourceThought || !sourceChamber) return prev;

      const sourceId = sourceThought.sourceThoughtId ?? sourceThought.id;
      const actualSourceChamberId = sourceThought.sourceChamberId ?? sourceChamber.id;
      const actualSourceChamber = prev[actualSourceChamberId] ?? sourceChamber;
      const sourceDate = parseLocalDateFromChamber(actualSourceChamber) ?? sourceThought.sourceDate ?? localDateISO();
      const stress = analyzeThoughtStress(trimmed, sourceThought.tags, sourceThought.mood);
      let changed = false;
      const next = { ...prev };

      for (const chamber of Object.values(prev)) {
        let chamberChanged = false;
        const thoughts = chamber.thoughts.map((thought) => {
          if (thought.id !== sourceId && thought.sourceThoughtId !== sourceId) return thought;
          chamberChanged = true;
          changed = true;
          if (thought.derived) {
            return {
              ...thought,
              text: buildManifestText(
                { ...sourceThought!, id: sourceId, text: trimmed, mood: sourceThought!.mood, pinned: sourceThought!.pinned },
                sourceDate,
                actualSourceChamber,
                chamber,
              ),
              stressScore: stress.score,
              stressLabel: stress.label,
              type: manifestTypeForThought(sourceThought!, stress.score),
            };
          }
          return {
            ...thought,
            text: trimmed,
            stressScore: stress.score,
            stressLabel: stress.label,
            sourceDate,
          };
        });
        if (chamberChanged) {
          next[chamber.id] = { ...chamber, thoughts };
        }
      }

      return changed ? next : prev;
    });
  }, [setChambers]);

  const deleteThought = useCallback((id: number) => {
    setChambers(prev => {
      let sourceId = id;
      for (const chamber of Object.values(prev)) {
        const found = chamber.thoughts.find(th => th.id === id);
        if (found) {
          sourceId = found.sourceThoughtId ?? found.id;
          break;
        }
      }

      let changed = false;
      const next = { ...prev };
      for (const chamber of Object.values(prev)) {
        const thoughts = chamber.thoughts.filter((thought) => thought.id !== sourceId && thought.sourceThoughtId !== sourceId);
        if (thoughts.length !== chamber.thoughts.length) {
          next[chamber.id] = { ...chamber, thoughts };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [setChambers]);

  const togglePinThought = useCallback((id: number) => {
    setChambers(prev => {
      let sourceId = id;
      let sourceThought: Thought | null = null;
      for (const chamber of Object.values(prev)) {
        const found = chamber.thoughts.find(th => th.id === id);
        if (found) {
          sourceId = found.sourceThoughtId ?? found.id;
          sourceThought = found;
          break;
        }
      }
      if (!sourceThought) return prev;

      const nextPinned = !(sourceThought.pinned ?? false);
      let changed = false;
      const next = { ...prev };
      for (const chamber of Object.values(prev)) {
        let chamberChanged = false;
        const thoughts = chamber.thoughts.map((thought) => {
          if (thought.id !== sourceId && thought.sourceThoughtId !== sourceId) return thought;
          chamberChanged = true;
          changed = true;
          return {
            ...thought,
            pinned: nextPinned,
            type: (nextPinned ? 'monolith' : 'gem') as Thought['type'],
          };
        });
        if (chamberChanged) {
          next[chamber.id] = { ...chamber, thoughts };
        }
      }
      return changed ? next : prev;
    });
  }, [setChambers]);

  const addTag = useCallback((id: number, tag: string) => {
    updateChamber(currentChamberId, (chamber) => {
      const t = chamber.thoughts.find(th => th.id === id);
      if (t) {
        if (!t.tags) t.tags = [];
        if (!t.tags.includes(tag)) t.tags.push(tag);
      }
    });
  }, [currentChamberId, updateChamber]);

  const removeTag = useCallback((id: number, tag: string) => {
    updateChamber(currentChamberId, (chamber) => {
      const t = chamber.thoughts.find(th => th.id === id);
      if (t && t.tags) {
        t.tags = t.tags.filter(tg => tg !== tag);
      }
    });
  }, [currentChamberId, updateChamber]);

  const addReply = useCallback((parentId: number, text: string) => {
    addThought(text, 'scroll', { replyTo: parentId });
  }, [addThought]);

  const setThoughtMood = useCallback((id: number, mood: string) => {
    updateChamber(currentChamberId, (chamber) => {
      const t = chamber.thoughts.find(th => th.id === id);
      if (t) {
        t.mood = mood;
        t.type = 'orb';
      }
    });
  }, [currentChamberId, updateChamber]);

  const searchThoughts = useCallback((query: string) => {
    const q = query.toLowerCase();
    const results: { chamberId: number; chamberName: string; thought: Thought }[] = [];
    Object.values(chambers).forEach(ch => {
      ch.thoughts.forEach(t => {
        if (t.derived) return;
        if (t.text.toLowerCase().includes(q)) {
          results.push({ chamberId: ch.id, chamberName: ch.name, thought: t });
        }
      });
    });
    return results;
  }, [chambers]);

  const getSortedThoughts = useCallback((chamber: Chamber, mode: 'date' | 'date-rev' | 'alpha' | 'pinned' = 'date') => {
    const ts = [...chamber.thoughts];
    switch (mode) {
      case 'date-rev': return ts.reverse();
      case 'alpha': return ts.sort((a, b) => a.text.localeCompare(b.text));
      case 'pinned': return ts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      default: return ts;
    }
  }, []);

  return { addThought, editThought, deleteThought, togglePinThought, addTag, removeTag, addReply, setThoughtMood, searchThoughts, getSortedThoughts };
}
