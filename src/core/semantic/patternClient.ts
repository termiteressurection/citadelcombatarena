import { invoke } from '@tauri-apps/api/core';

export type HorizonType = 'day' | 'week' | 'month' | 'season' | 'year';

export interface PatternEvidence {
  eventId: string;
  entryId: string;
  day: string;
  text: string;
}

export interface PatternRecord {
  id: string;
  horizon: HorizonType;
  entity: string;
  outcome: string;
  observedCount: number;
  cohortCount: number;
  supportingEventIds: string[];
  counterexampleEventIds: string[];
  supportingEvidence: PatternEvidence[];
  counterexampleEvidence: PatternEvidence[];
  statement: string;
}

export interface HorizonPatterns {
  horizon: HorizonType;
  entriesRecorded: number;
  stillGathering: boolean;
  patterns: PatternRecord[];
}

export function getPatternsForHorizon(horizon: HorizonType): Promise<HorizonPatterns> {
  return invoke<HorizonPatterns>('get_patterns_for_horizon', { horizon });
}

export function getEntityPatterns(entity: string): Promise<PatternRecord[]> {
  return invoke<PatternRecord[]>('get_entity_patterns', { entity });
}
