/**
 * Zustand selector scaffolding — Phase 4 adoption hub.
 *
 * Components should prefer these selector hooks over receiving the full
 * CitadelState from a parent. Each hook subscribes to the narrowest
 * store slice possible, which keeps re-renders surgical.
 */
import { useCitadelStore } from '../store';
import type { Chamber, GridIdentity } from '../types';

export const useChambersMap = (): Record<number, Chamber> =>
  useCitadelStore(s => s.chambers);

export const useIdentitySlice = (): GridIdentity =>
  useCitadelStore(s => s.identity);

export const useCurrentChamberId = (): number =>
  useCitadelStore(s => s.currentChamberId);

export const useCurrentChamber = (): Chamber | undefined =>
  useCitadelStore(s => s.chambers[s.currentChamberId] ?? s.chambers[0]);

export const useModalOpen = (): boolean =>
  useCitadelStore(s => s.modalOpen);

export const useUndoRedoSizes = (): { undo: number; redo: number } =>
  useCitadelStore(() => ({ undo: 0, redo: 0 }));

/**
 * Generic escape hatch — pick any slice with full type inference.
 * Example: const name = usePick(s => s.identity.name);
 */
export function usePick<T>(selector: (s: ReturnType<typeof useCitadelStore.getState>) => T): T {
  return useCitadelStore(selector);
}
