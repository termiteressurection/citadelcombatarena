import { invoke } from '@tauri-apps/api/core';

type Values = Record<string, string>;

const STORAGE_PREFIX = 'citadel-idb:';
const proto = typeof Storage === 'undefined' ? null : Storage.prototype;
const native = proto ? {
  getItem: proto.getItem,
  setItem: proto.setItem,
  removeItem: proto.removeItem,
  clear: proto.clear,
  key: proto.key,
  length: Object.getOwnPropertyDescriptor(proto, 'length')?.get,
} : null;

let installed = false;
let enabled = false;
let values = new Map<string, string>();
let writeQueue: Promise<void> = Promise.resolve();
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let lastWriteError: unknown;

function isBridgedStorage(storage: Storage): boolean {
  return installed && typeof window !== 'undefined' && storage === window.localStorage;
}

function enqueueSnapshot(snapshot: Values): void {
  writeQueue = writeQueue
    .then(() => Object.keys(snapshot).length === 0
      ? invoke('vault_storage_clear')
      : invoke('vault_storage_replace', { values: snapshot }))
    .then(() => { lastWriteError = undefined; })
    .catch(error => { lastWriteError = error; });
}

function scheduleSnapshot(): void {
  if (!enabled) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = undefined;
    enqueueSnapshot(Object.fromEntries(values));
  }, 40);
}

export function flushVaultStorage(): void {
  if (!enabled) return;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
    enqueueSnapshot(Object.fromEntries(values));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushVaultStorage);
  window.addEventListener('pagehide', flushVaultStorage);
}

function installStorageMethods(): void {
  if (!proto || !native || installed) return;
  Object.defineProperties(proto, {
    getItem: {
      configurable: true,
      value(this: Storage, key: string): string | null {
        if (isBridgedStorage(this)) return enabled ? values.get(String(key)) ?? null : null;
        return native.getItem.call(this, key);
      },
    },
    setItem: {
      configurable: true,
      value(this: Storage, key: string, value: string): void {
        if (isBridgedStorage(this)) {
          if (enabled) {
            values.set(String(key), String(value));
            scheduleSnapshot();
          }
          return;
        }
        native.setItem.call(this, key, value);
      },
    },
    removeItem: {
      configurable: true,
      value(this: Storage, key: string): void {
        if (isBridgedStorage(this)) {
          if (enabled) {
            values.delete(String(key));
            scheduleSnapshot();
          }
          return;
        }
        native.removeItem.call(this, key);
      },
    },
    clear: {
      configurable: true,
      value(this: Storage): void {
        if (isBridgedStorage(this)) {
          if (enabled) {
            values.clear();
            scheduleSnapshot();
          }
          return;
        }
        native.clear.call(this);
      },
    },
    key: {
      configurable: true,
      value(this: Storage, index: number): string | null {
        if (isBridgedStorage(this)) {
          if (!enabled) return null;
          return [...values.keys()][index] ?? null;
        }
        return native.key.call(this, index);
      },
    },
    length: {
      configurable: true,
      get(this: Storage): number {
        if (isBridgedStorage(this)) return enabled ? values.size : 0;
        return native.length?.call(this) ?? 0;
      },
    },
  });
  installed = true;
}

function readLegacyLocalStorage(): Values {
  const result: Values = {};
  if (!native || typeof window === 'undefined') return result;
  const storage = window.localStorage;
  const length = native.length?.call(storage) ?? 0;
  for (let index = 0; index < length; index += 1) {
    const key = native.key.call(storage, index);
    if (key !== null) {
      const value = native.getItem.call(storage, key);
      if (value !== null) result[key] = value;
    }
  }
  return result;
}

/** Migrate legacy WebView stores into the encrypted Rust vault before rendering user data. */
export async function activateTauriVaultStorage(): Promise<void> {
  if (installed && enabled) return;
  const encrypted = await invoke<Values>('vault_storage_read');
  const merged: Values = { ...encrypted };
  let migrated = false;

  const legacyLocalStorage = readLegacyLocalStorage();
  for (const [key, value] of Object.entries(legacyLocalStorage)) {
    if (!(key in merged)) merged[key] = value;
    migrated = true;
  }

  const idb = await import('idb-keyval');
  const oldKeys = await idb.keys();
  for (const key of oldKeys) {
    if (typeof key !== 'string') continue;
    const value = await idb.get(key);
    const serialized = JSON.stringify(value);
    if (serialized !== undefined) {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      if (!(storageKey in merged)) merged[storageKey] = serialized;
      migrated = true;
    }
  }

  if (migrated) await invoke('vault_storage_replace', { values: merged });
  if (native && typeof window !== 'undefined') native.clear.call(window.localStorage);
  if (oldKeys.length > 0) await idb.clear();

  values = new Map(Object.entries(merged));
  installStorageMethods();
  enabled = true;
}

/** Flush and suspend while the native vault is locked or being wiped. */
export async function suspendTauriVaultStorage(discardOnError = false): Promise<void> {
  if (!installed) return;
  const snapshot = Object.fromEntries(values);
  enabled = false;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
  }
  enqueueSnapshot(snapshot);
  await writeQueue;
  if (lastWriteError !== undefined) {
    enabled = !discardOnError;
    if (discardOnError) values.clear();
    throw new Error(`Could not persist encrypted WebView storage: ${String(lastWriteError)}`);
  }
  values.clear();
}

/** Re-open the bridge after a wipe, when the native store is expected to be empty. */
export async function resumeTauriVaultStorage(): Promise<void> {
  if (!installed) return;
  const restored = await invoke<Values>('vault_storage_read');
  values = new Map(Object.entries(restored));
  enabled = true;
}

export async function flushTauriVaultStorage(): Promise<void> {
  if (!installed || !enabled) return;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
    enqueueSnapshot(Object.fromEntries(values));
  }
  await writeQueue;
  if (lastWriteError !== undefined) {
    throw new Error(`Could not persist encrypted WebView storage: ${String(lastWriteError)}`);
  }
}
