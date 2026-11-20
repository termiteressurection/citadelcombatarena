let epoch = 0;
const listeners = new Set<(epoch: number) => void>();

export function getWipeEpoch(): number {
  return epoch;
}

export function advanceWipeEpoch(): number {
  epoch += 1;
  for (const listener of listeners) listener(epoch);
  return epoch;
}

export function subscribeToWipeEpoch(listener: (epoch: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isCurrentWipeEpoch(captured: number): boolean {
  return captured === epoch;
}

/** Run a deferred state or persistence commit only if no wipe has started. */
export function commitAtWipeEpoch(captured: number, commit: () => void): boolean {
  if (!isCurrentWipeEpoch(captured)) return false;
  commit();
  return true;
}
