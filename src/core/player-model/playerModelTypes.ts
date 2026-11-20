export type PlayerModelCategory = 'facts' | 'preferences' | 'commitments' | 'people' | 'themes';

export type PlayerModelStatus = 'active' | 'superseded' | 'player-corrected' | 'player-deleted';

export type PlayerSourceType =
  | 'chat'
  | 'journal'
  | 'synaptic'
  | 'mindmap'
  | 'activity'
  | 'profile';

export interface PlayerModelRecord {
  id: string;
  category: PlayerModelCategory;
  claim: string;
  sourceId: string;
  sourceDate: string;
  sourceType: PlayerSourceType;
  confidence: number; // 0.0 to 1.0
  firstSeen: string; // ISO
  lastReinforced: string; // ISO
  status: PlayerModelStatus;
  supersededBy?: string;
  correctionNote?: string;
}

export type GrowthEventType = 'created' | 'reinforced' | 'superseded' | 'corrected' | 'deleted';

export interface GrowthFeedEvent {
  id: string;
  timestamp: string; // ISO
  type: GrowthEventType;
  recordId: string;
  summary: string;
  category: PlayerModelCategory;
  sourceDate?: string;
}

export interface PlayerModelStoreData {
  version: 1;
  records: PlayerModelRecord[];
  growthFeed: GrowthFeedEvent[];
  rejectedClaims: Array<{ sourceId: string; claim: string; timestamp: string }>;
  learningPaused: boolean;
}
