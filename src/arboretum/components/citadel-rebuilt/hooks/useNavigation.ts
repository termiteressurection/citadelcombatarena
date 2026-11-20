import { useCallback, useRef } from 'react';
import { useCitadelStore } from '../store';

export function useNavigation() {
  const chambers = useCitadelStore(state => state.chambers);
  const currentChamberId = useCitadelStore(state => state.currentChamberId);
  const setCurrentChamberId = useCitadelStore(state => state.setCurrentChamberId);
  const updateChamber = useCitadelStore(state => state.updateChamber);

  const historyStack = useRef<number[]>([0]);
  const historyIndex = useRef(0);

  const enterChamber = useCallback((id: number) => {
    if (chambers[id]) {
      setCurrentChamberId(id);
      historyStack.current = [...historyStack.current.slice(0, historyIndex.current + 1), id];
      if (historyStack.current.length > 50) historyStack.current = historyStack.current.slice(-50);
      historyIndex.current = historyStack.current.length - 1;

      updateChamber(id, (c) => {
        c.lastVisited = Date.now();
      }, true); // skipUndo for simple navigation visits
    }
  }, [chambers, setCurrentChamberId, updateChamber]);

  const goToParent = useCallback(() => {
    const chamber = chambers[currentChamberId];
    if (chamber && chamber.parent !== undefined) {
      enterChamber(chamber.parent);
    }
  }, [chambers, currentChamberId, enterChamber]);

  const historyBack = useCallback(() => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      setCurrentChamberId(historyStack.current[historyIndex.current]);
    }
  }, [setCurrentChamberId]);

  const historyForward = useCallback(() => {
    if (historyIndex.current < historyStack.current.length - 1) {
      historyIndex.current++;
      setCurrentChamberId(historyStack.current[historyIndex.current]);
    }
  }, [setCurrentChamberId]);

  const getBreadcrumb = useCallback(() => {
    const path: { id: number; name: string }[] = [];
    let curId: number | undefined = currentChamberId;
    while (curId !== undefined && chambers[curId]) {
      path.unshift({ id: curId, name: chambers[curId].name });
      curId = chambers[curId].parent;
    }
    return path;
  }, [chambers, currentChamberId]);

  const fuzzyJump = useCallback((query: string): number | null => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    const found = Object.values(chambers).find(c => c.name.toLowerCase().includes(q));
    if (found) {
      enterChamber(found.id);
      return found.id;
    }
    return null;
  }, [chambers, enterChamber]);

  return { enterChamber, goToParent, historyBack, historyForward, getBreadcrumb, fuzzyJump };
}
