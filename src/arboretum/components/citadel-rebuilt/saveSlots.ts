import { get, set as idbSet, del, clear as idbClear, keys as idbKeys } from 'idb-keyval';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import {
  isPortableModeEnabled,
  portableReadText,
  portableRemoveFile,
  portableWriteText,
  isTauriRuntime,
} from '@/core/persistence/portableMode';
import { Chamber, GridIdentity } from './types';

export interface SaveSlot {
  slotId: string;
  name: string;
  identityName: string;
  timestamp: string;
  chamberCount: number;
  thoughtCount: number;
  maxDepth: number;
}

interface SaveData {
  chambers: Record<number, Chamber>;
  identity: GridIdentity;
}

// Compressed envelope. Old uncompressed records still load via the
// fallback branch in `loadSaveData` so existing players keep their data.
interface CompressedEnvelope {
  __v: 2;
  __c: 'lz16';
  payload: string;
}

const SAVES_KEY = 'citadel_saves_index';
const PORTABLE_WORLD_INDEX = 'citadel-runtime/world/save-index.json';
const TAURI_IDB_PREFIX = 'citadel-idb:';

async function dataStoreGet<T>(key: IDBValidKey): Promise<T | undefined> {
  if (isTauriRuntime() && typeof key === 'string') {
    const raw = localStorage.getItem(`${TAURI_IDB_PREFIX}${key}`);
    if (raw === null) return undefined;
    try { return JSON.parse(raw) as T; } catch { return undefined; }
  }
  return get<T>(key);
}

async function dataStoreSet(key: IDBValidKey, value: unknown): Promise<void> {
  if (isTauriRuntime() && typeof key === 'string') {
    localStorage.setItem(`${TAURI_IDB_PREFIX}${key}`, JSON.stringify(value));
    return;
  }
  await idbSet(key, value);
}

async function dataStoreDelete(key: IDBValidKey): Promise<void> {
  if (isTauriRuntime() && typeof key === 'string') {
    localStorage.removeItem(`${TAURI_IDB_PREFIX}${key}`);
    return;
  }
  await del(key);
}

async function dataStoreKeys(): Promise<IDBValidKey[]> {
  if (isTauriRuntime()) {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(TAURI_IDB_PREFIX)) keys.push(key.slice(TAURI_IDB_PREFIX.length));
    }
    return keys;
  }
  return idbKeys();
}

async function dataStoreClear(): Promise<void> {
  if (isTauriRuntime()) {
    for (const key of await dataStoreKeys()) await dataStoreDelete(key);
    return;
  }
  await idbClear();
}

function portableSavePath(slotId: string): string {
  return `citadel-runtime/world/saves/${slotId}.json`;
}

async function loadPortableJson<T>(relativePath: string): Promise<T | null> {
  const raw = await portableReadText(relativePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writePortableJson(relativePath: string, value: unknown): Promise<boolean> {
  return portableWriteText(relativePath, JSON.stringify(value, null, 2));
}

/** Single-player profile — all data lives under this slot id. */
export const CANONICAL_SLOT_ID = 'citadel-main';

/**
 * Collapse any legacy multi-slot index into one `citadel-main` save.
 * Picks the newest slot by `timestamp`, copies its payload to main, deletes
 * other slot blobs, rewrites the index to a single row.
 */
export async function ensureCanonicalSlotMigration(): Promise<void> {
  let index = await loadSaveIndex();
  const mainRow = index.find(s => s.slotId === CANONICAL_SLOT_ID);
  if (mainRow && index.length <= 1) return;

  if (mainRow && index.length > 1) {
    for (const s of index) {
      if (s.slotId !== CANONICAL_SLOT_ID) await deleteSave(s.slotId);
    }
    await persistSaveIndex([mainRow]);
    return;
  }

  if (index.length === 0) return;

  const sorted = [...index].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const pick = sorted[0];
  const data = await loadSaveData(pick.slotId);
  if (!data) return;

  for (const s of index) {
    await deleteSave(s.slotId);
  }
  await persistSaveData(CANONICAL_SLOT_ID, data.chambers, data.identity);
}

function encodeSave(data: SaveData): CompressedEnvelope {
  return { __v: 2, __c: 'lz16', payload: compressToUTF16(JSON.stringify(data)) };
}

function isCompressed(value: unknown): value is CompressedEnvelope {
  return !!value && typeof value === 'object'
    && (value as { __c?: unknown }).__c === 'lz16';
}

function decodeSave(value: SaveData | CompressedEnvelope): SaveData | null {
  if (isCompressed(value)) {
    try {
      const json = decompressFromUTF16(value.payload);
      if (!json) return null;
      return JSON.parse(json) as SaveData;
    } catch {
      return null;
    }
  }
  return value;
}

export function generateSlotId(): string {
  const ts = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 8);
  return `slot_${ts}_${rand}`;
}

export async function loadSaveIndex(): Promise<SaveSlot[]> {
  const portableIndex = await loadPortableJson<SaveSlot[]>(PORTABLE_WORLD_INDEX);
  if (portableIndex) return portableIndex;

  // Migration check for index
  const localIndex = localStorage.getItem(SAVES_KEY);
  if (localIndex) {
    const slots = JSON.parse(localIndex);
    const wrotePortable = await writePortableJson(PORTABLE_WORLD_INDEX, slots);
    if (!wrotePortable) await dataStoreSet(SAVES_KEY, slots);
    localStorage.removeItem(SAVES_KEY);
    return slots;
  }

  const raw = await dataStoreGet<SaveSlot[]>(SAVES_KEY);
  return raw || [];
}

export async function persistSaveIndex(slots: SaveSlot[]): Promise<boolean> {
  if (await writePortableJson(PORTABLE_WORLD_INDEX, slots)) return true;

  try {
    await dataStoreSet(SAVES_KEY, slots);
    return true;
  } catch (err) {
    console.error('[Citadel] Failed to save index', err);
    return false;
  }
}

export async function loadSaveData(slotId: string): Promise<SaveData | null> {
  const portableData = await loadPortableJson<SaveData | CompressedEnvelope>(portableSavePath(slotId));
  if (portableData) return decodeSave(portableData);

  // Migration check for data
  const localData = localStorage.getItem(`citadel_save_${slotId}`);
  if (localData) {
    const parsed = JSON.parse(localData) as SaveData | CompressedEnvelope;
    const wrotePortable = await writePortableJson(portableSavePath(slotId), parsed);
    if (!wrotePortable) await idbSet(`citadel_save_${slotId}`, parsed);
    localStorage.removeItem(`citadel_save_${slotId}`);
    return decodeSave(parsed);
  }

  const raw = await dataStoreGet<SaveData | CompressedEnvelope>(`citadel_save_${slotId}`);
  if (!raw) return null;
  return decodeSave(raw);
}

export async function persistSaveData(slotId: string, chambers: Record<number, Chamber>, identity: GridIdentity): Promise<boolean> {
  const data: SaveData = { chambers, identity };
  const encoded = encodeSave(data);

  if (!(await writePortableJson(portableSavePath(slotId), encoded))) {
  try {
    // lz16-compressed envelope. ~4–8× smaller for typical chamber graphs.
    // Compression happens on the JS thread but is microseconds for any
    // realistic save (10s of KB), well under any frame budget.
      await dataStoreSet(`citadel_save_${slotId}`, encoded);
  } catch (err) {
    console.error('[Citadel] Failed to write save', err);
    return false;
  }
  }

  const index = await loadSaveIndex();
  const all = Object.values(chambers);
  const meta: SaveSlot = {
    slotId,
    name: chambers[0]?.name || 'The Citadel',
    identityName: identity.name,
    timestamp: new Date().toISOString(),
    chamberCount: all.length,
    thoughtCount: all.reduce((sum, chamber) => sum + chamber.thoughts.length, 0),
    maxDepth: Math.max(...all.map(chamber => chamber.depth), 0),
  };
  const indexOfExisting = index.findIndex(slot => slot.slotId === slotId);
  if (indexOfExisting >= 0) index[indexOfExisting] = meta;
  else index.push(meta);
  await persistSaveIndex(index);
  return true;
}

export async function deleteSave(slotId: string) {
  if (!(await portableRemoveFile(portableSavePath(slotId)))) {
    await del(`citadel_save_${slotId}`);
  }
  const index = await loadSaveIndex();
  const nextIndex = index.filter(slot => slot.slotId !== slotId);
  await persistSaveIndex(nextIndex);
}

/**
 * Erase every persisted world save, including historical browser keys that
 * could otherwise be re-imported by the legacy migration on next launch.
 */
export async function clearAllWorldSaveData(): Promise<string[]> {
  const survivors: string[] = [];
  let portableEnabled = false;
  try {
    portableEnabled = await isPortableModeEnabled();
  } catch (error) {
    survivors.push(`portable:mode-query-failed:${String(error)}`);
  }
  let index: SaveSlot[] = [];
  try {
    index = await loadSaveIndex();
  } catch (error) {
    survivors.push(`save-index:query-failed:${String(error)}`);
  }
  if (!Array.isArray(index)) index = [];
  index = index.filter((slot): slot is SaveSlot => Boolean(slot && typeof slot.slotId === 'string'));
  const slotIds = new Set([...index.map((slot) => slot.slotId), CANONICAL_SLOT_ID]);

  for (const slotId of slotIds) {
    const portablePath = portableSavePath(slotId);
    const portableRemoved = await portableRemoveFile(portablePath);
    if (portableEnabled && !portableRemoved) survivors.push(`portable:${portablePath}:delete-failed`);
    try {
      await dataStoreDelete(`citadel_save_${slotId}`);
    } catch (error) {
      survivors.push(`idb:citadel_save_${slotId}:delete-failed:${String(error)}`);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`citadel_save_${slotId}`);
      } catch (error) {
        survivors.push(`localStorage:citadel_save_${slotId}:delete-failed:${String(error)}`);
      }
    }
  }

  const indexRemoved = await portableRemoveFile(PORTABLE_WORLD_INDEX);
  if (portableEnabled && !indexRemoved) survivors.push(`portable:${PORTABLE_WORLD_INDEX}:delete-failed`);
  try {
    await del(SAVES_KEY);
  } catch (error) {
    survivors.push(`idb:${SAVES_KEY}:delete-failed:${String(error)}`);
  }
  let allIdbKeys: IDBValidKey[] = [];
  try {
    allIdbKeys = await dataStoreKeys();
  } catch (error) {
    survivors.push(`idb:pre-clear-query-failed:${String(error)}`);
  }
  for (const key of allIdbKeys) {
    try {
      await dataStoreDelete(key);
    } catch (error) {
      survivors.push(`idb:${String(key)}:delete-failed:${String(error)}`);
    }
  }
  try {
    await dataStoreClear();
  } catch (error) {
    survivors.push(`idb:clear-failed:${String(error)}`);
  }
  try {
    const remaining = await dataStoreKeys();
    for (const key of remaining) survivors.push(`idb:${String(key)}:survived-delete`);
  } catch (error) {
    survivors.push(`idb:post-clear-query-failed:${String(error)}`);
  }

  if (typeof localStorage !== 'undefined') {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === SAVES_KEY || k.startsWith('citadel_save_'))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      try {
        localStorage.removeItem(k);
      } catch (error) {
        survivors.push(`localStorage:${k}:delete-failed:${String(error)}`);
      }
    }
    try {
      localStorage.removeItem(SAVES_KEY);
      localStorage.removeItem('citadel_data');
      localStorage.removeItem('citadel_identity');
    } catch (error) {
      survivors.push(`localStorage:legacy-world-keys:delete-failed:${String(error)}`);
    }
  }
  return survivors;
}

export async function migrateLegacySave(): Promise<string | null> {
  const legacyData = localStorage.getItem('citadel_data');
  const legacyId = localStorage.getItem('citadel_identity');
  if (!legacyData) return null;

  try {
    const chambers = JSON.parse(legacyData);
    const identity = legacyId
      ? JSON.parse(legacyId)
      : { name: 'Traveler', createdAt: new Date().toISOString(), sessionStart: Date.now() };
    await persistSaveData(CANONICAL_SLOT_ID, chambers, identity);
    localStorage.removeItem('citadel_data');
    localStorage.removeItem('citadel_identity');
    return CANONICAL_SLOT_ID;
  } catch {
    return null;
  }
}
