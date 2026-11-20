import { useState, useCallback, useRef, useEffect } from 'react';
import { Chamber, GridIdentity } from '../types';
import { persistSaveData } from '../saveSlots';

const activeCancelFns = new Set<() => void>();
let wipedSnapshot: { chambers: Record<number, Chamber>; identity: GridIdentity } | null = null;

/**
 * Cancel all pending debounced world saves so an in-game wipe cannot be
 * overwritten by a queued 800ms timer or unmount flush.
 */
export function cancelPendingWorldSaves(): void {
  for (const cancel of activeCancelFns) {
    cancel();
  }
}

/**
 * Record the fresh post-wipe object references so the reactive useEffect in
 * `useCitadelState` does not immediately re-persist the empty post-wipe state
 * before the user actually makes a new change.
 */
export function recordWipedWorldSnapshot(
  chambers: Record<number, Chamber>,
  identity: GridIdentity,
): void {
  wipedSnapshot = { chambers, identity };
  cancelPendingWorldSaves();
}

/**
 * Debounced persistence hook.
 * Call save(chambers, identity) from anywhere — it will wait 800ms of
 * inactivity before actually writing to IndexedDB, and expose a
 * `saving` boolean that is true during that window.
 */
export function usePersistence(slotId: string) {
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ chambers: Record<number, Chamber>; identity: GridIdentity } | null>(null);

  useEffect(() => {
    const cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      latestRef.current = null;
      setSaving(false);
    };
    activeCancelFns.add(cancel);
    return () => {
      activeCancelFns.delete(cancel);
    };
  }, []);

  const save = useCallback((chambers: Record<number, Chamber>, identity: GridIdentity) => {
    if (
      wipedSnapshot &&
      wipedSnapshot.chambers === chambers &&
      wipedSnapshot.identity === identity
    ) {
      return;
    }
    wipedSnapshot = null;
    latestRef.current = { chambers, identity };

    if (timerRef.current) clearTimeout(timerRef.current);

    setSaving(true);
    timerRef.current = setTimeout(() => {
      if (latestRef.current) {
        persistSaveData(slotId, latestRef.current.chambers, latestRef.current.identity);
      }
      setSaving(false);
      timerRef.current = null;
    }, 800);
  }, [slotId]);

  // Flush on unmount so we never lose the last write
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestRef.current) {
          persistSaveData(slotId, latestRef.current.chambers, latestRef.current.identity);
        }
      }
    };
  }, [slotId]);

  return { saving, save };
}
