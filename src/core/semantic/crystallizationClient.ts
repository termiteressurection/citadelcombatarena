import { invoke } from '@tauri-apps/api/core';

function requireTauriRuntime(): void {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    throw new Error('Journal crystallization requires the Tauri desktop runtime.');
  }
}

export interface DayStatus {
  day: string;
  isCrystallized: boolean;
  eventCount: number;
  sealEventId?: string;
}

export interface JournalEvent {
  eventId: string;
  parentHash: string;
  timestamp: string;
  timezoneOffset: number;
  authorPubkey: string;
  payload: {
    entryId: string;
    day: string;
    createdAt: string;
    updatedAt: string;
    text: string;
    tags: string[];
    metadata: Record<string, any>;
  };
  signature: string;
  eventHash: string;
}

export async function crystallizeDay(day: string): Promise<JournalEvent> {
  requireTauriRuntime();
  return invoke<JournalEvent>('journal_crystallize_day', { day });
}

export async function getDayStatus(day: string): Promise<DayStatus> {
  requireTauriRuntime();
  return invoke<DayStatus>('journal_get_day_status', { day });
}
