/**
 * proximityStore.ts — frame-rate-safe proximity flags for the HUD.
 *
 * Why this exists: PlayerController fires `onNearAltar/Termite/...`
 * every single frame. When those callbacks were React state setters
 * living in `RebuiltGame`, every threshold crossing triggered a full
 * re-render of the entire game tree (Canvas children, scene HUD, the
 * works). The state setters are also re-fired with the same value most
 * frames; React's identity bailout absorbs that, but the call itself
 * still costs an enqueue.
 *
 * This store moves the flags out of React's render path. Setters are
 * shallow-equality guarded so the store only notifies subscribers on
 * actual changes. Selectors mean only the leaf subscriber re-renders
 * (a small bridge component → SceneHUD), never RebuiltGame itself.
 */

import { create } from 'zustand';

export interface ProximityState {
  altar: boolean;
  termite: boolean;
  customize: boolean;
  portal: number | null;
  noticeBoard: boolean;
  mapTable: boolean;
  library: boolean;
  moodStone: boolean;
  bottlePost: boolean;
}

export const useProximityStore = create<ProximityState>(() => ({
  altar: false,
  termite: false,
  customize: false,
  portal: null,
  noticeBoard: false,
  mapTable: false,
  library: false,
  moodStone: false,
  bottlePost: false,
}));

// Stable, module-scoped setters. Identity is constant for the app's
// lifetime so passing them as props never breaks memoization.
function set<K extends keyof ProximityState>(key: K, value: ProximityState[K]): void {
  if (useProximityStore.getState()[key] !== value) {
    useProximityStore.setState({ [key]: value } as Pick<ProximityState, K>);
  }
}

export const setNearAltar       = (v: boolean): void        => set('altar', v);
export const setNearTermite     = (v: boolean): void        => set('termite', v);
export const setNearCustomize   = (v: boolean): void        => set('customize', v);
export const setNearPortal      = (v: number | null): void  => set('portal', v);
export const setNearNoticeBoard = (v: boolean): void        => set('noticeBoard', v);
export const setNearMapTable    = (v: boolean): void        => set('mapTable', v);
export const setNearLibrary     = (v: boolean): void        => set('library', v);
export const setNearMoodStone   = (v: boolean): void        => set('moodStone', v);
export const setNearBottlePost  = (v: boolean): void        => set('bottlePost', v);

export function resetProximity(): void {
  useProximityStore.setState({
    altar: false, termite: false,
    customize: false, portal: null,
    noticeBoard: false, mapTable: false, library: false,
    moodStone: false, bottlePost: false,
  });
}
