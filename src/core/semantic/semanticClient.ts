import { invoke } from '@tauri-apps/api/core';

export interface ScoredEntryMatch {
  id: string;
  eventId: string;
  source: string;
  timestamp: string;
  day: string;
  text: string;
  tags: string[];
  score: number;
  method: 'semantic' | 'keyword';
  level?: string;
  period?: string;
}

export interface SemanticTextInput {
  id: string;
  text: string;
}

export interface SemanticPairScore {
  leftId: string;
  rightId: string;
  similarity: number;
  method: 'semantic' | 'keyword';
}

export function semanticSearch(query: string, topK: number): Promise<ScoredEntryMatch[]> {
  return invoke<ScoredEntryMatch[]>('semantic_search', { query, topK });
}

export function rebuildSemanticIndex(): Promise<void> {
  return invoke<void>('rebuild_semantic_index');
}

export function getSemanticStatus() {
  return invoke<{
    engineAvailable: boolean;
    backend: string;
    modelRevision: string;
    vectorDimensions: number;
    indexedEntries: number;
    indexCurrent: boolean;
    logHeadHash: string;
    lastError: string | null;
  }>('get_semantic_status');
}

export function semanticPairScores(items: SemanticTextInput[]): Promise<SemanticPairScore[]> {
  return invoke<SemanticPairScore[]>('semantic_pair_scores', { items });
}
