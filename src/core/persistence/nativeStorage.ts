import { invoke } from '@tauri-apps/api/core';
import type { CitadelStateModel, CellEntry, LocalDay } from '../model/types';
import { createInitialCitadelState } from '../model/schema';
import { migrateOrFresh, toStoredEnvelope } from './migrations';
import { extractJournalConcepts } from '../graph/extractor';
import { assertPeriodWritable, type JournalLevel } from '@/arboretum/components/citadel-rebuilt/writablePath';

export const TAURI_STATE_BASENAME = 'journal.log';
const LEGACY_STORAGE_KEY = 'citadel-v2-state';
const PROFILE_BASENAME = 'citadel-profile.json';

interface NativeJournalEntry {
  id: string;
  day: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  tags: string[];
  migrationProvenance?: { originalId: string; collision: boolean } | null;
  level?: JournalLevel;
  period?: string;
}

function localLegacySnapshot(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function allEntries(state: CitadelStateModel): CellEntry[] {
  const dayEntries = Object.values(state.days).flatMap((day) => day.entries);
  const hierEntries = state.hierarchicalEntries
    ? Object.values(state.hierarchicalEntries).flat()
    : [];
  return [...dayEntries, ...hierEntries];
}

function assertEntryMatchesLog(entry: CellEntry, existing: NativeJournalEntry): void {
  const sameTags = JSON.stringify(entry.tags ?? []) === JSON.stringify(existing.tags ?? []);
  if (
    entry.day !== existing.day ||
    entry.createdAt !== existing.createdAt ||
    entry.updatedAt !== existing.updatedAt ||
    entry.text !== existing.text ||
    !sameTags
  ) {
    throw new Error(
      `Journal entry ${entry.id} is immutable. Append a linked continuation or correction instead of changing it.`,
    );
  }
}

function toNativeEntry(entry: CellEntry): Record<string, unknown> {
  return {
    id: entry.id,
    day: entry.day,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    text: entry.text,
    tags: entry.tags ?? [],
    metadata: {
      concepts: extractJournalConcepts(entry.text, entry.tags ?? []),
    },
    timezoneOffset: -new Date(entry.createdAt).getTimezoneOffset(),
    level: entry.level ?? 'day',
    period: entry.period ?? entry.day,
  };
}

function stateProfile(state: CitadelStateModel): unknown {
  const envelope = toStoredEnvelope(state);
  for (const cell of Object.values(envelope.state.days)) {
    cell.entries = [];
  }
  return envelope;
}

function restoreEntries(profile: unknown, entries: NativeJournalEntry[]): CitadelStateModel {
  const base = profile ? migrateOrFresh(profile) : createInitialCitadelState();
  const days: CitadelStateModel['days'] = { ...base.days };
  const hierarchicalEntries: Record<string, CellEntry[]> = {};

  for (const item of entries) {
    const level: JournalLevel = item.level ?? 'day';
    const period = item.period ?? item.day;
    const entry: CellEntry = {
      id: item.id,
      day: item.day as LocalDay,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      text: item.text,
      tags: item.tags,
      migrationConflict: item.migrationProvenance?.collision ?? false,
      originalId: item.migrationProvenance?.originalId,
      level,
      period,
    };

    if (level === 'day') {
      const day = item.day as LocalDay;
      const cell = days[day] ?? {
        day,
        entries: [],
        locked: day < base.today,
        dailyAnchorComplete: false,
      };
      if (cell.entries.some((e) => e.id === item.id)) continue;
      cell.entries.push(entry);
      days[day] = cell;
    } else {
      if (!hierarchicalEntries[period]) hierarchicalEntries[period] = [];
      if (!hierarchicalEntries[period].some((e) => e.id === item.id)) {
        hierarchicalEntries[period].push(entry);
      }
    }
  }
  return migrateOrFresh({ ...base, days, hierarchicalEntries });
}

/**
 * Append journal entries to the native signed log and save only non-journal
 * profile state through Tauri. No user journal is written as a JSON snapshot.
 */
export async function saveNativeStateAtomic(
  state: CitadelStateModel,
  _revision: number,
): Promise<void> {
  const logged = await invoke<NativeJournalEntry[]>('journal_read_entries');
  const byId = new Map(logged.map((entry) => [entry.id, entry]));
  for (const entry of allEntries(state)) {
    const existing = byId.get(entry.id);
    if (existing) {
      assertEntryMatchesLog(entry, existing);
      continue;
    }
    assertPeriodWritable(entry.level ?? 'day', entry.period ?? entry.day);
    await invoke('journal_append_entry', { entry: toNativeEntry(entry) });
    byId.set(entry.id, {
      id: entry.id,
      day: entry.day,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      text: entry.text,
      tags: entry.tags ?? [],
      level: entry.level ?? 'day',
      period: entry.period ?? entry.day,
    });
  }
  await invoke('journal_save_profile', { profile: stateProfile(state) });
}

/** Load legacy app-data and WebView snapshots through the one-time Rust importer. */
export async function loadNativeStateFromDisk(): Promise<CitadelStateModel | null> {
  const legacy = localLegacySnapshot();
  if (legacy) {
    await invoke('journal_migrate_browser_snapshot', { rawJson: legacy });
    // Rust has durably snapshotted the bytes and verified the resulting chain.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  const [profile, entries] = await Promise.all([
    invoke<unknown | null>('journal_read_profile'),
    invoke<NativeJournalEntry[]>('journal_read_entries'),
  ]);
  if (!profile && entries.length === 0) return null;
  return restoreEntries(profile, entries);
}

export async function verifyNativeJournal(): Promise<{
  valid: boolean;
  eventCount: number;
  headHash: string;
}> {
  return invoke('journal_verify');
}

export async function readNativeMigrationReceipt(): Promise<unknown | null> {
  return invoke('journal_migration_receipt');
}

export const NATIVE_PROFILE_BASENAME = PROFILE_BASENAME;
