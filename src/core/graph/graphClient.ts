import { invoke } from '@tauri-apps/api/core';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function queryJournalGraph(query: string): Promise<unknown> {
  if (!isTauriRuntime()) throw new Error('Journal graph queries require the Tauri desktop runtime.');
  return invoke('graph_query', { query });
}
