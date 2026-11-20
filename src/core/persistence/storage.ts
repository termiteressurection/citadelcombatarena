/** Native journal log and sanitized profile persistence for the Tauri app. */

import type { CitadelStateModel } from '../model/types';
import {
  loadNativeStateFromDisk,
  saveNativeStateAtomic,
  TAURI_STATE_BASENAME,
} from './nativeStorage';
import { PersistenceQueue, type StateWriter } from './persistenceQueue';

export { TAURI_STATE_BASENAME };

// Runtime detection

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Default serialized persistence queue

const defaultWriter: StateWriter = async (state, revision) => {
  if (!isTauri()) throw new Error('Citadel persistence requires the Tauri desktop runtime.');
  await saveNativeStateAtomic(state, revision);
};

const defaultSaveQueue = new PersistenceQueue(defaultWriter);

// Public API

/**
 * Save state synchronously into the serialized persistence queue.
 * Channelled into a FIFO atomic queue with monotonic revisions.
 */
export function saveState(state: CitadelStateModel): void {
  defaultSaveQueue.enqueue(state);
}

/**
 * Wait for all pending writes in the default persistence queue to finish.
 */
export function waitForPersistenceIdle(): Promise<void> {
  return defaultSaveQueue.flush();
}

export async function loadStateAsync(): Promise<CitadelStateModel | null> {
  if (!isTauri()) throw new Error('Citadel persistence requires the Tauri desktop runtime.');
  return loadNativeStateFromDisk();
}
