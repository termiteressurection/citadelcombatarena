import { create } from 'zustand';

export interface WipeReceiptData {
  timestamp: string;
  clearedStores: string[];
  survivors: string[];
  unreachableStores: string[];
  sandboxNotice?: string;
  deletedEntriesCount?: number;
}

export interface FoliageDebugState {
  enabled: boolean;
  overrideE: number;
  overrideD: number;
  tunerOverlayOpen: boolean;
  isDissolving: boolean;
  dissolutionStartTime: number | null;
  dossierOpen: boolean;
  lastReceipt: WipeReceiptData | null;

  setEnabled: (enabled: boolean) => void;
  setOverrideE: (overrideE: number) => void;
  setOverrideD: (overrideD: number) => void;
  setOverrides: (overrideE: number, overrideD: number) => void;
  setTunerOverlayOpen: (open: boolean) => void;
  toggleTunerOverlay: () => void;
  triggerDissolution: () => void;
  endDissolution: () => void;
  openDossier: (receipt: WipeReceiptData) => void;
  closeDossier: () => void;
  resetOverrides: () => void;
}

export const useFoliageDebugStore = create<FoliageDebugState>((set) => ({
  enabled: false,
  overrideE: 0,
  overrideD: 0,
  tunerOverlayOpen: false,
  isDissolving: false,
  dissolutionStartTime: null,
  dossierOpen: false,
  lastReceipt: null,

  setEnabled: (enabled) => set({ enabled }),
  setOverrideE: (overrideE) => set({ overrideE: Math.max(0, Math.floor(overrideE)), enabled: true }),
  setOverrideD: (overrideD) => set({ overrideD: Math.max(0, Math.floor(overrideD)), enabled: true }),
  setOverrides: (overrideE, overrideD) =>
    set({
      overrideE: Math.max(0, Math.floor(overrideE)),
      overrideD: Math.max(0, Math.floor(overrideD)),
      enabled: true,
    }),
  setTunerOverlayOpen: (tunerOverlayOpen) => set({ tunerOverlayOpen }),
  toggleTunerOverlay: () => set((s) => ({ tunerOverlayOpen: !s.tunerOverlayOpen })),
  triggerDissolution: () => set({ isDissolving: true, dissolutionStartTime: performance.now() }),
  endDissolution: () => set({ isDissolving: false, dissolutionStartTime: null }),
  openDossier: (receipt) => set({ dossierOpen: true, lastReceipt: receipt }),
  closeDossier: () => set({ dossierOpen: false }),
  resetOverrides: () =>
    set({
      enabled: false,
      overrideE: 0,
      overrideD: 0,
    }),
}));

export function resetFoliageDebugOverrides(): void {
  useFoliageDebugStore.getState().resetOverrides();
}
