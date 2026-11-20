import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Chamber, GridIdentity } from './types';
import { withIdentityDefaults } from './identityDefaults';

interface CitadelState {
  chambers: Record<number, Chamber>;
  identity: GridIdentity;
  currentChamberId: number;
  modalOpen: boolean;

  // Setters
  setChambers: (
    chambers: Record<number, Chamber> | ((prev: Record<number, Chamber>) => Record<number, Chamber>),
    skipUndo?: boolean,
  ) => void;
  setIdentity: (
    identity: GridIdentity | ((prev: GridIdentity) => GridIdentity),
  ) => void;
  setCurrentChamberId: (id: number) => void;
  setModalOpen: (open: boolean) => void;

  // Immer-powered granular updaters
  updateChamber: (
    id: number,
    updater: (chamber: Chamber) => void,
    skipUndo?: boolean,
  ) => void;
  updateIdentity: (updater: (identity: GridIdentity) => void) => void;
}

export const useCitadelStore = create<CitadelState>()(
  immer((set) => ({
    chambers: {},
    identity: withIdentityDefaults({
      name: 'Traveler',
      createdAt: new Date().toISOString(),
      sessionStart: Date.now(),
    }),
    currentChamberId: 0,
    modalOpen: false,

    // ── setChambers ──────────────────────────────────────────────────────────
    setChambers: (chambers, _skipUndo = false) =>
      set(state => {
        const resolved =
          typeof chambers === 'function' ? chambers(state.chambers) : chambers;
        state.chambers = resolved;
      }),

    // ── setIdentity ──────────────────────────────────────────────────────────
    setIdentity: (identity) =>
      set(state => {
        state.identity =
          typeof identity === 'function' ? identity(state.identity) : identity;
      }),

    setCurrentChamberId: (id) =>
      set(state => { state.currentChamberId = id; }),

    setModalOpen: (open) =>
      set(state => { state.modalOpen = open; }),

    // ── updateChamber — Immer mutation on a single chamber ───────────────────
    updateChamber: (id, updater, _skipUndo = false) =>
      set(state => {
        if (!state.chambers[id]) return;
        updater(state.chambers[id]);
      }),

    // ── updateIdentity — Immer mutation on identity ──────────────────────────
    updateIdentity: (updater) =>
      set(state => { updater(state.identity); }),
  })),
);
