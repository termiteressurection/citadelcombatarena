/**
 * Data-Cartridge (Floppy Path) — CITADEL_V3_SYNC_SPEC §VII.
 * Export/import JSON with stable SHA-256 and LWW merge into CitadelStateModel.
 */

import { compareLocalDay, type LocalDay } from '../time/localDay';
import type { CellEntry, CitadelStateModel, EntryConflictLog } from '../model/types';
import { normalizeState } from './migrations';
import { analyzeEntryDensity, categorizeEntry } from '../rules/librarian';
import { assertImportTextSize, assertImportedField, MAX_IMPORTED_RECORDS } from './importLimits';

export const CARTRIDGE_EXPORT_VERSION = '0.1.0' as const;
export const CARTRIDGE_SOURCE_DESKTOP = 'CITADEL_DESKTOP' as const;
export const CARTRIDGE_SOURCE_MOBILE = 'CITADEL_MOBILE' as const;

export type CartridgeSource = typeof CARTRIDGE_SOURCE_DESKTOP | typeof CARTRIDGE_SOURCE_MOBILE;

/** Wire row per CITADEL_V3_SYNC_SPEC §VII.1 (before mapping to CellEntry). */
export interface CartridgeWireEntry {
  uuid: string;
  day: LocalDay;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CartridgeExportEnvelope {
  version: typeof CARTRIDGE_EXPORT_VERSION;
  exportTimestamp: string;
  source: CartridgeSource;
  entries: CartridgeWireEntry[];
  manifest: { count: number; hash: string };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/** §VII.3 — recursive key sort, no whitespace (reference implementation). */
export function stableStringify(val: unknown): string {
  if (Array.isArray(val)) return '[' + val.map(stableStringify).join(',') + ']';
  if (val && typeof val === 'object') {
    const keys = Object.keys(val as object).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + stableStringify((val as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(val);
}

export async function sha256HexUtf8(utf8String: string): Promise<string> {
  const buf = new TextEncoder().encode(utf8String);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(id: string): boolean {
  return UUID_V4.test(id);
}

function sortWireEntriesByUuid(entries: CartridgeWireEntry[]): CartridgeWireEntry[] {
  return [...entries].sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
}

function collectWireEntries(state: CitadelStateModel): CartridgeWireEntry[] {
  const out: CartridgeWireEntry[] = [];
  for (const day of Object.keys(state.days) as LocalDay[]) {
    for (const e of state.days[day].entries) {
      out.push({
        uuid: e.id,
        day: e.day,
        content: e.text,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
    }
  }
  return sortWireEntriesByUuid(out);
}

function assertUniqueUuids(entries: CartridgeWireEntry[]): void {
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.uuid)) throw new Error(`Duplicate cartridge uuid: ${e.uuid}`);
    seen.add(e.uuid);
  }
}

/** Build canonical export JSON (sorted entries + manifest hash). */
export async function buildCartridgeJson(
  state: CitadelStateModel,
  options?: { source?: CartridgeSource; exportAt?: Date },
): Promise<string> {
  const entries = collectWireEntries(state);
  assertUniqueUuids(entries);
  const hashInput = stableStringify(entries);
  const hash = await sha256HexUtf8(hashInput);
  const exportTimestamp = (options?.exportAt ?? new Date()).toISOString();
  const envelope: CartridgeExportEnvelope = {
    version: CARTRIDGE_EXPORT_VERSION,
    exportTimestamp,
    source: options?.source ?? CARTRIDGE_SOURCE_DESKTOP,
    entries,
    manifest: { count: entries.length, hash },
  };
  return stableStringify(envelope);
}

function effectiveWireTime(e: CartridgeWireEntry): string {
  return e.updatedAt && e.updatedAt.length > 0 ? e.updatedAt : e.createdAt;
}

function effectiveCellTime(e: CellEntry): string {
  return e.updatedAt && e.updatedAt.length > 0 ? e.updatedAt : e.createdAt;
}

/** Strict ISO string ordering (UTC Z). Incoming wins only if strictly newer. */
export function compareLwwIso(aIso: string, bIso: string): number {
  if (aIso < bIso) return -1;
  if (aIso > bIso) return 1;
  return 0;
}

function wireToCell(e: CartridgeWireEntry): CellEntry {
  const createdAt = e.createdAt;
  const updatedAt = e.updatedAt && e.updatedAt.length > 0 ? e.updatedAt : createdAt;
  const base: CellEntry = {
    id: e.uuid,
    day: e.day,
    createdAt,
    updatedAt,
    text: e.content,
  };
  const density = analyzeEntryDensity(base);
  return {
    ...base,
    densityScore: density.score,
    densityLabel: density.label,
    chamberCategory: categorizeEntry({ ...base, densityLabel: density.label }),
  };
}

function findEntryIndex(state: CitadelStateModel, id: string): { day: LocalDay; index: number } | undefined {
  for (const day of Object.keys(state.days) as LocalDay[]) {
    const idx = state.days[day].entries.findIndex((x) => x.id === id);
    if (idx >= 0) return { day, index: idx };
  }
  return undefined;
}

function ensureDayCell(state: CitadelStateModel, day: LocalDay): CitadelStateModel['days'][LocalDay] {
  const existing = state.days[day];
  if (existing) return { ...existing, entries: [...existing.entries] };
  return {
    day,
    entries: [],
    locked: compareLocalDay(day, state.today) < 0,
    dailyAnchorComplete: false,
  };
}

/**
 * Merge verified wire entries into state (§IV LWW). Tie → desktop (existing) kept.
 * Import may touch past days for same-id updates per sync contract.
 */
export function mergeCartridgeWireIntoState(
  state: CitadelStateModel,
  wireEntries: CartridgeWireEntry[],
): CitadelStateModel {
  return mergeCartridgeWireIntoStateWithConflicts(state, wireEntries).state;
}

export function mergeCartridgeWireIntoStateWithConflicts(
  state: CitadelStateModel,
  wireEntries: CartridgeWireEntry[],
): { state: CitadelStateModel; conflictLogs: EntryConflictLog[] } {
  let next: CitadelStateModel = {
    ...state,
    days: { ...state.days },
  };
  const conflictLogs: EntryConflictLog[] = [];
  for (const day of Object.keys(next.days) as LocalDay[]) {
    next.days[day] = { ...next.days[day], entries: [...next.days[day].entries] };
  }

  for (const w of wireEntries) {
    if (!isUuidV4(w.uuid)) throw new Error(`Invalid uuid in cartridge: ${w.uuid}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.day)) throw new Error(`Invalid day in cartridge: ${w.day}`);
    const incoming = wireToCell(w);
    const loc = findEntryIndex(next, incoming.id);

    if (!loc) {
      const cell = ensureDayCell(next, incoming.day);
      next.days[incoming.day] = { ...cell, entries: [...cell.entries, incoming] };
      continue;
    }

    const cell = next.days[loc.day];
    const existing = cell.entries[loc.index];
    const cmp = compareLwwIso(effectiveWireTime(w), effectiveCellTime(existing));
    if (cmp > 0) {
      conflictLogs.push({
        id: crypto.randomUUID(),
        entryId: existing.id,
        day: existing.day,
        at: new Date().toISOString(),
        reason: 'lww_overwrite',
        replaced: {
          text: existing.text,
          updatedAt: effectiveCellTime(existing),
        },
        incoming: {
          text: incoming.text,
          updatedAt: effectiveWireTime(w),
        },
      });
      const without = cell.entries.filter((_, i) => i !== loc.index);
      next.days[loc.day] = { ...cell, entries: without };
      const targetCell = ensureDayCell(next, incoming.day);
      next.days[incoming.day] = { ...targetCell, entries: [...targetCell.entries, incoming] };
    }
    // cmp <= 0: keep desktop (existing wins on tie)
  }

  const normalized = normalizeState(next);
  const mergedLogs = [...(normalized.sync?.conflictLogs ?? []), ...conflictLogs].slice(-500);
  normalized.sync = { conflictLogs: mergedLogs };
  return { state: normalized, conflictLogs };
}

function parseWireEntries(raw: unknown): CartridgeWireEntry[] {
  if (!Array.isArray(raw)) throw new Error('cartridge: entries must be an array');
  if (raw.length > MAX_IMPORTED_RECORDS) {
    throw new Error(`cartridge: entries exceed the ${MAX_IMPORTED_RECORDS}-event import limit`);
  }
  const out: CartridgeWireEntry[] = [];
  for (const row of raw) {
    if (!isRecord(row)) throw new Error('cartridge: entry must be an object');
    const uuid = row.uuid;
    const day = row.day;
    const content = row.content;
    const createdAt = row.createdAt;
    const updatedAt = row.updatedAt;
    if (typeof uuid !== 'string') throw new Error('cartridge: uuid required');
    if (typeof day !== 'string') throw new Error('cartridge: day required');
    if (typeof content !== 'string') throw new Error('cartridge: content required');
    if (typeof createdAt !== 'string') throw new Error('cartridge: createdAt required');
    assertImportedField(uuid, 'cartridge uuid');
    assertImportedField(day, 'cartridge day');
    assertImportedField(content, 'cartridge content');
    assertImportedField(createdAt, 'cartridge createdAt');
    if (typeof updatedAt === 'string') assertImportedField(updatedAt, 'cartridge updatedAt');
    const e: CartridgeWireEntry = {
      uuid,
      day: day as LocalDay,
      content,
      createdAt,
    };
    if (typeof updatedAt === 'string' && updatedAt.length > 0) e.updatedAt = updatedAt;
    out.push(e);
  }
  return out;
}

/** Parse JSON, verify version + manifest hash (§V), return merged state. */
export async function importCartridgeJsonString(
  state: CitadelStateModel,
  json: string,
): Promise<CitadelStateModel> {
  const result = await importCartridgeJsonStringWithConflicts(state, json);
  return result.state;
}

export async function importCartridgeJsonStringWithConflicts(
  state: CitadelStateModel,
  json: string,
): Promise<{ state: CitadelStateModel; conflictLogs: EntryConflictLog[] }> {
  assertImportTextSize(json, 'cartridge');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('cartridge: invalid JSON');
  }
  if (!isRecord(parsed)) throw new Error('cartridge: root must be an object');

  if (parsed.version !== CARTRIDGE_EXPORT_VERSION) {
    throw new Error(`cartridge: unsupported version ${String(parsed.version)}`);
  }
  if (typeof parsed.exportTimestamp !== 'string') throw new Error('cartridge: exportTimestamp required');
  const source = parsed.source;
  if (source !== CARTRIDGE_SOURCE_DESKTOP && source !== CARTRIDGE_SOURCE_MOBILE) {
    throw new Error('cartridge: invalid source');
  }
  const entries = parseWireEntries(parsed.entries);
  assertUniqueUuids(entries);
  const sorted = sortWireEntriesByUuid(entries);
  const manifest = parsed.manifest;
  if (!isRecord(manifest)) throw new Error('cartridge: manifest required');
  const count = manifest.count;
  const hash = manifest.hash;
  if (typeof count !== 'number' || count !== sorted.length) {
    throw new Error('cartridge: manifest.count mismatch');
  }
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) {
    throw new Error('cartridge: manifest.hash invalid');
  }
  const expected = await sha256HexUtf8(stableStringify(sorted));
  if (expected.toLowerCase() !== hash.toLowerCase()) {
    throw new Error('cartridge: manifest hash mismatch');
  }

  return mergeCartridgeWireIntoStateWithConflicts(state, sorted);
}
