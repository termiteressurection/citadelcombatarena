import { useEffect } from 'react';
import { useCitadelStore } from './store';

/**
 * Dev shortcuts — `window.__citadel` helpers for exercising the daily-loop
 * state machine without waiting real time. Only mounts in Vite's dev build
 * (import.meta.env.DEV), so these vanish from the packaged .app.
 *
 * From the devtools console:
 *   __citadel.clearRituals()           — reset today's ritual slots
 *   __citadel.sealMorning()            — mark morning sealed
 *   __citadel.sealEvening()            — mark evening sealed
 *   __citadel.sealAll()                — mark both sealed (→ Commune mode)
 *   __citadel.advanceDays(n = 1)       — rewind `rituals.date` so the store
 *                                        believes the next press is a new day
 *   __citadel.status()                 — log current ritual record
 *   __citadel.identityContracts()      — log Phase-0 identity slices
 */

interface CitadelDevAPI {
  clearRituals: () => void;
  sealMorning: () => void;
  sealEvening: () => void;
  sealAll: () => void;
  advanceDays: (n?: number) => void;
  status: () => void;
  identityContracts: () => void;
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useDevShortcuts(): void {
  const updateIdentity = useCitadelStore(s => s.updateIdentity);

  useEffect(() => {
    const meta = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (!meta?.DEV) return;

    const api: CitadelDevAPI = {
      clearRituals: () => {
        updateIdentity(prev => {
          prev.rituals = { date: todayISO(), stars: 0, constellations: 0 };
        });
        console.log('[__citadel] rituals cleared for', todayISO());
      },
      sealMorning: () => {
        updateIdentity(prev => {
          if (!prev.rituals || prev.rituals.date !== todayISO()) {
            prev.rituals = { date: todayISO(), stars: 0, constellations: 0 };
          }
          prev.rituals.morning = true;
        });
        console.log('[__citadel] morning sealed');
      },
      sealEvening: () => {
        updateIdentity(prev => {
          if (!prev.rituals || prev.rituals.date !== todayISO()) {
            prev.rituals = { date: todayISO(), stars: 0, constellations: 0 };
          }
          prev.rituals.evening = true;
        });
        console.log('[__citadel] evening sealed');
      },
      sealAll: () => {
        updateIdentity(prev => {
          prev.rituals = {
            date: todayISO(), morning: true, midday: true, evening: true,
            stars: prev.rituals?.stars || 0,
            constellations: prev.rituals?.constellations || 0,
          };
        });
        console.log('[__citadel] full cycle sealed — commune mode');
      },
      advanceDays: (n = 1) => {
        updateIdentity(prev => {
          if (prev.rituals) prev.rituals.date = todayISO(-n);
        });
        console.log('[__citadel] rituals.date rewound', n, 'day(s)');
      },
      status: () => {
        const rituals = useCitadelStore.getState().identity.rituals;
        console.log('[__citadel] rituals =', rituals, 'today =', todayISO());
      },
      identityContracts: () => {
        const id = useCitadelStore.getState().identity;
        console.log('[__citadel] contracts', {
          calibration: id.calibration,
          altar: id.altar,
          combatSignature: id.combatSignature,
        });
      },
    };

    try {
      (window as unknown as { __citadel?: CitadelDevAPI }).__citadel = api;
    } catch {
      // Window may have restricted accessors
    }
    console.log(
      '[__citadel] dev shortcuts installed.',
      'Try __citadel.clearRituals() / sealMorning() / sealAll() / advanceDays(1) / status() / identityContracts()',
    );
    return () => {
      try {
        delete (window as unknown as { __citadel?: CitadelDevAPI }).__citadel;
      } catch {
        // Silently ignore delete failures on readonly global
      }
    };
  }, [updateIdentity]);
}
