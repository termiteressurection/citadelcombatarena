import {
  PlayerModelRecord,
  PlayerModelCategory,
  PlayerModelStoreData,
  GrowthFeedEvent,
  PlayerSourceType,
} from './playerModelTypes';
import {
  getWipeEpoch,
  isCurrentWipeEpoch,
  subscribeToWipeEpoch,
} from '@/core/security/wipeEpoch';

const STORAGE_KEY = 'citadel_player_model_v1';

const INITIAL_STORE_DATA: PlayerModelStoreData = {
  version: 1,
  records: [],
  growthFeed: [],
  rejectedClaims: [],
  learningPaused: false,
};

let memoryStore: PlayerModelStoreData = { ...INITIAL_STORE_DATA };
let isLoaded = false;

// Wipe epoch tracking to ensure memory wipe compliance
subscribeToWipeEpoch(() => {
  memoryStore = {
    version: 1,
    records: [],
    growthFeed: [],
    rejectedClaims: [],
    learningPaused: false,
  };
  isLoaded = true;
});

function normalizeClaim(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/** Applies natural confidence decay for themes and preferences that haven't been reinforced */
export function applyConfidenceDecay(records: PlayerModelRecord[], nowIso: string = new Date().toISOString()): PlayerModelRecord[] {
  const now = new Date(nowIso).getTime();
  return records.map((record) => {
    if (record.status !== 'active') return record;
    if (record.category !== 'themes' && record.category !== 'preferences') return record;

    const lastReinforcedTime = new Date(record.lastReinforced).getTime();
    const daysElapsed = Math.max(0, (now - lastReinforcedTime) / (1000 * 60 * 60 * 24));
    
    // Decay by 0.02 per day elapsed without reinforcement, capped at floor 0.20
    const decayedConfidence = Math.max(0.20, Number((record.confidence - (daysElapsed * 0.02)).toFixed(2)));
    return {
      ...record,
      confidence: decayedConfidence,
    };
  });
}

export async function loadPlayerModel(): Promise<PlayerModelStoreData> {
  if (isLoaded) return memoryStore;

  const currentEpoch = getWipeEpoch();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (isCurrentWipeEpoch(currentEpoch) && raw) {
      const parsed = JSON.parse(raw) as PlayerModelStoreData;
      if (parsed.version === 1 && Array.isArray(parsed.records)) {
        memoryStore = {
          ...parsed,
          records: applyConfidenceDecay(parsed.records),
        };
        isLoaded = true;
        return memoryStore;
      }
    }
  } catch {
    // Fallback to initial state
  }

  memoryStore = { ...INITIAL_STORE_DATA };
  isLoaded = true;
  return memoryStore;
}

export async function savePlayerModel(): Promise<void> {
  const currentEpoch = getWipeEpoch();
  try {
    const serialized = JSON.stringify(memoryStore);
    if (isCurrentWipeEpoch(currentEpoch) && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch (err) {
    console.error('[citadel] Failed to persist player model:', err);
  }
}

export function getPlayerModelSync(): PlayerModelStoreData {
  return memoryStore;
}

export function isLearningPaused(): boolean {
  return memoryStore.learningPaused;
}

export async function setLearningPaused(paused: boolean): Promise<void> {
  await loadPlayerModel();
  memoryStore.learningPaused = paused;
  await savePlayerModel();
}

/**
 * Proposed new records must not match rejected claims from the player.
 * Player corrections outrank extraction!
 */
export function isClaimRejected(claim: string, sourceId?: string): boolean {
  const norm = normalizeClaim(claim);
  return memoryStore.rejectedClaims.some((rej) => {
    const rejNorm = normalizeClaim(rej.claim);
    const claimOverlap = norm === rejNorm || norm.includes(rejNorm) || rejNorm.includes(norm);
    if (!claimOverlap) return false;
    if (!sourceId || !rej.sourceId) return true;
    return sourceId === rej.sourceId || rej.sourceId === '*';
  });
}

/** Propose a new record or reinforce an existing record (Append-Only) */
export async function proposePlayerRecord(props: {
  category: PlayerModelCategory;
  claim: string;
  sourceId: string;
  sourceDate: string;
  sourceType: PlayerSourceType;
  confidence?: number;
}): Promise<PlayerModelRecord | null> {
  await loadPlayerModel();
  if (memoryStore.learningPaused) return null;

  const cleanClaim = props.claim.trim();
  if (!cleanClaim) return null;

  // RULE: Player corrections outrank extraction!
  if (isClaimRejected(cleanClaim, props.sourceId)) {
    return null;
  }

  const norm = normalizeClaim(cleanClaim);
  const now = new Date().toISOString();

  // Check if an existing active record in the same category covers this exact claim
  const existingActive = memoryStore.records.find(
    (r) => r.status === 'active' && r.category === props.category && normalizeClaim(r.claim) === norm,
  );

  if (existingActive) {
    // Reinforce existing record
    existingActive.lastReinforced = now;
    existingActive.confidence = Math.min(1.0, Number((existingActive.confidence + 0.1).toFixed(2)));

    const event: GrowthFeedEvent = {
      id: `evt_grow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      type: 'reinforced',
      recordId: existingActive.id,
      summary: `Reinforced ${props.category.slice(0, -1)}: “${cleanClaim}”`,
      category: props.category,
      sourceDate: props.sourceDate,
    };
    memoryStore.growthFeed.unshift(event);
    memoryStore.growthFeed = memoryStore.growthFeed.slice(0, 100);

    await savePlayerModel();
    return existingActive;
  }

  // Create new append-only record
  const newRecord: PlayerModelRecord = {
    id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    category: props.category,
    claim: cleanClaim,
    sourceId: props.sourceId,
    sourceDate: props.sourceDate,
    sourceType: props.sourceType,
    confidence: props.confidence ?? 0.8,
    firstSeen: now,
    lastReinforced: now,
    status: 'active',
  };

  memoryStore.records.push(newRecord);

  const event: GrowthFeedEvent = {
    id: `evt_grow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    type: 'created',
    recordId: newRecord.id,
    summary: `New ${props.category.slice(0, -1)} recorded — from your ${props.sourceType} on ${props.sourceDate}`,
    category: props.category,
    sourceDate: props.sourceDate,
  };
  memoryStore.growthFeed.unshift(event);
  memoryStore.growthFeed = memoryStore.growthFeed.slice(0, 100);

  await savePlayerModel();
  return newRecord;
}

/** Player corrects a record: old record superseded/marked player-corrected, new record created */
export async function correctPlayerRecord(
  recordId: string,
  newClaim: string,
  correctionNote?: string,
): Promise<PlayerModelRecord | null> {
  await loadPlayerModel();
  const target = memoryStore.records.find((r) => r.id === recordId);
  if (!target) return null;

  const now = new Date().toISOString();

  // Remember the rejected claim so extraction never re-derives it
  memoryStore.rejectedClaims.push({
    sourceId: target.sourceId,
    claim: target.claim,
    timestamp: now,
  });

  // Mark old record player-corrected (never silently overwritten)
  target.status = 'player-corrected';
  target.correctionNote = correctionNote;

  const cleanClaim = newClaim.trim();
  let replacementRecord: PlayerModelRecord | null = null;

  if (cleanClaim) {
    replacementRecord = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: target.category,
      claim: cleanClaim,
      sourceId: target.sourceId,
      sourceDate: target.sourceDate,
      sourceType: target.sourceType,
      confidence: 1.0, // High confidence since user explicitly corrected it
      firstSeen: target.firstSeen,
      lastReinforced: now,
      status: 'active',
      correctionNote: `User correction for record ${target.id}`,
    };
    target.supersededBy = replacementRecord.id;
    memoryStore.records.push(replacementRecord);
  }

  const event: GrowthFeedEvent = {
    id: `evt_grow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    type: 'corrected',
    recordId: recordId,
    summary: `Corrected ${target.category.slice(0, -1)}: “${target.claim}” → “${cleanClaim}”`,
    category: target.category,
    sourceDate: target.sourceDate,
  };
  memoryStore.growthFeed.unshift(event);
  memoryStore.growthFeed = memoryStore.growthFeed.slice(0, 100);

  await savePlayerModel();
  return replacementRecord;
}

/** Player deletes a record: marked player-deleted, claim remembered to prevent re-extraction */
export async function deletePlayerRecord(recordId: string): Promise<boolean> {
  await loadPlayerModel();
  const target = memoryStore.records.find((r) => r.id === recordId);
  if (!target) return false;

  const now = new Date().toISOString();

  // RULE: Register rejected claim so extraction never re-derives it!
  memoryStore.rejectedClaims.push({
    sourceId: target.sourceId,
    claim: target.claim,
    timestamp: now,
  });

  target.status = 'player-deleted';

  const event: GrowthFeedEvent = {
    id: `evt_grow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    type: 'deleted',
    recordId: recordId,
    summary: `Removed ${target.category.slice(0, -1)}: “${target.claim}”`,
    category: target.category,
    sourceDate: target.sourceDate,
  };
  memoryStore.growthFeed.unshift(event);
  memoryStore.growthFeed = memoryStore.growthFeed.slice(0, 100);

  await savePlayerModel();
  return true;
}

/** Forget a specific conversation session and purge any records derived solely from it */
export async function forgetConversation(sessionId: string): Promise<{
  removedRecordIds: string[];
  removedFeedIds: string[];
}> {
  await loadPlayerModel();

  // Find records sourced solely from this session ID
  const affectedRecords = memoryStore.records.filter(
    (r) => r.sourceId === sessionId || r.sourceId.startsWith(`${sessionId}:`),
  );

  const removedRecordIds = affectedRecords.map((r) => r.id);
  const now = new Date().toISOString();

  // Mark all affected records as player-deleted
  for (const r of affectedRecords) {
    r.status = 'player-deleted';
    memoryStore.rejectedClaims.push({
      sourceId: r.sourceId,
      claim: r.claim,
      timestamp: now,
    });
  }

  // Remove corresponding growth feed items
  const feedBefore = memoryStore.growthFeed.length;
  memoryStore.growthFeed = memoryStore.growthFeed.filter(
    (item) => !removedRecordIds.includes(item.recordId),
  );
  const removedFeedCount = feedBefore - memoryStore.growthFeed.length;

  const event: GrowthFeedEvent = {
    id: `evt_grow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    type: 'deleted',
    recordId: sessionId,
    summary: `Conversation purged: ${removedRecordIds.length} derived record(s) removed`,
    category: 'facts',
  };
  memoryStore.growthFeed.unshift(event);

  await savePlayerModel();
  return {
    removedRecordIds,
    removedFeedIds: [`purged-${removedFeedCount}`],
  };
}

/** Export the Player Model as structured JSON */
export function exportPlayerModelJson(): string {
  return JSON.stringify(memoryStore, null, 2);
}

/** Export the Player Model as a clean, readable Markdown report */
export function exportPlayerModelMarkdown(): string {
  const activeRecords = memoryStore.records.filter((r) => r.status === 'active');
  const grouped: Record<PlayerModelCategory, PlayerModelRecord[]> = {
    commitments: [],
    facts: [],
    preferences: [],
    people: [],
    themes: [],
  };

  for (const r of activeRecords) {
    if (grouped[r.category]) {
      grouped[r.category].push(r);
    }
  }

  const lines: string[] = [
    '# Citadel — Player Model Export',
    `Generated: ${new Date().toISOString()}`,
    `Total Active Records: ${activeRecords.length}`,
    '',
    '## Active Commitments & Open Loops',
    grouped.commitments.length === 0 ? '_No active commitments._' : '',
    ...grouped.commitments.map((r) => `- **${r.claim}** (Source: ${r.sourceType} ${r.sourceDate}, confidence: ${(r.confidence * 100).toFixed(0)}%)`),
    '',
    '## Stated Facts',
    grouped.facts.length === 0 ? '_No stated facts._' : '',
    ...grouped.facts.map((r) => `- **${r.claim}** (Source: ${r.sourceType} ${r.sourceDate})`),
    '',
    '## Preferences & Working Style',
    grouped.preferences.length === 0 ? '_No recorded preferences._' : '',
    ...grouped.preferences.map((r) => `- **${r.claim}** (Source: ${r.sourceType} ${r.sourceDate}, confidence: ${(r.confidence * 100).toFixed(0)}%)`),
    '',
    '## People & Context',
    grouped.people.length === 0 ? '_No people recorded._' : '',
    ...grouped.people.map((r) => `- **${r.claim}** (Source: ${r.sourceType} ${r.sourceDate})`),
    '',
    '## Recurring Themes',
    grouped.themes.length === 0 ? '_No recurring themes._' : '',
    ...grouped.themes.map((r) => `- **${r.claim}** (First seen: ${r.firstSeen.slice(0, 10)}, confidence: ${(r.confidence * 100).toFixed(0)}%)`),
    '',
    '## History & Superseded Records',
    ...memoryStore.records
      .filter((r) => r.status !== 'active')
      .map((r) => `- [${r.status.toUpperCase()}] ${r.category}: “${r.claim}” (Source: ${r.sourceId})`),
  ];

  return lines.filter(Boolean).join('\n');
}

/** Reset store in-memory (for testing) */
export function _resetPlayerModelForTesting(): void {
  memoryStore = {
    version: 1,
    records: [],
    growthFeed: [],
    rejectedClaims: [],
    learningPaused: false,
  };
  isLoaded = true;
}
