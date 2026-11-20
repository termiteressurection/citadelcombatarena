/**
 * LIBRARIAN LOGIC ENGINE (V3)
 * 
 * Lineage: Adapted from v1 `calendarChamberUtils.ts` and `SearchOverlay.tsx`.
 * Purpose: Analyzes entry content for "Stress/Relief" categorization and handles
 * fuzzy-search teleportation across the Fractal Eye.
 */

import type {
  CellEntry,
  CitadelStateModel,
  ConstellationCategory,
  DensityLabel,
  LocalDay,
} from '../model/types';

// Stress Corpus (§II of UX Proposal)

const STRESS_TOKENS = [
  'stress', 'anxious', 'afraid', 'fear', 'panic', 'overwhelmed', 'worry', 'debt',
  'pressure', 'guilt', 'anger', 'lonely', 'hurt', 'grief', 'exhausted', 'burnout',
  'doom', 'stuck', 'spiral', 'chaos', 'failure', 'regret', 'dread'
];

const RELIEF_TOKENS = [
  'calm', 'peace', 'grateful', 'gratitude', 'joy', 'gentle', 'steady', 'healed',
  'resolved', 'rest', 'safe', 'secure', 'hope', 'light', 'clarity', 'soft'
];

const WORK_TOKENS = [
  'work', 'project', 'deadline', 'meeting', 'client', 'ship', 'deliver', 'sprint', 'ticket',
];
const RITUAL_TOKENS = [
  'ritual', 'anchor', 'morning', 'evening', 'practice', 'breath', 'journal', 'meditate',
];
const MEMORY_TOKENS = [
  'memory', 'remember', 'childhood', 'family', 'friend', 'story', 'past', 'yesterday',
];
const GOLDEN_TOKENS = [
  'win', 'won', 'victory', 'breakthrough', 'gratitude', 'grateful', 'blessed', 'golden',
  'success', 'proud',
];

/**
 * [FORENSIC] Analyzes an entry to determine its "Mental Density".
 * Returns a score (0-100) and a V3 Category Label.
 */
export function analyzeEntryDensity(entry: CellEntry): { score: number; label: DensityLabel } {
  const low = entry.text.toLowerCase();
  const tags = (entry.tags || []).join(' ').toLowerCase();
  const corpus = `${low} ${tags}`;
  
  let score = 10; // Baseline

  for (const token of STRESS_TOKENS) {
    if (corpus.includes(token)) score += 12;
  }
  for (const token of RELIEF_TOKENS) {
    if (corpus.includes(token)) score -= 8;
  }

  // Syntax Echoes
  if (/[!?]{2,}/.test(entry.text)) score += 10;
  if (/\b(can't|cannot|won't|never|stuck)\b/i.test(entry.text)) score += 15;

  const clamped = Math.max(0, Math.min(100, score));
  
  // V3 Labels (The Mindscape Chambers)
  const label = 
    clamped >= 75 ? 'BOSS_THREAT' :
    clamped >= 50 ? 'CHARGED_THREAD' :
    clamped >= 25 ? 'CALM_ECHO' : 
    'SILENT_SIGNAL';

  return { score: clamped, label };
}

/** Locked v3.7 category set for Constellation indexing. */
export function categorizeEntry(entry: CellEntry): ConstellationCategory {
  const density = entry.densityLabel ?? analyzeEntryDensity(entry).label;
  if (density === 'BOSS_THREAT') return 'BOSS_THREAT';

  const low = entry.text.toLowerCase();
  const tags = (entry.tags ?? []).join(' ').toLowerCase();
  const corpus = `${low} ${tags}`;
  const hasAny = (tokens: string[]) => tokens.some((t) => corpus.includes(t));

  if (hasAny(GOLDEN_TOKENS) || density === 'CALM_ECHO') return 'GOLDEN_SIGNAL';
  if (hasAny(RITUAL_TOKENS) || entry.tags?.includes('daily-anchor')) return 'RITUAL';
  if (hasAny(WORK_TOKENS)) return 'WORK';
  if (hasAny(MEMORY_TOKENS)) return 'MEMORY';
  return 'WORK';
}

export interface MindMapCluster {
  label: DensityLabel;
  count: number;
  entryIds: string[];
  days: LocalDay[];
  chamberId: string;
  gatherReady: boolean;
}

export interface ConstellationNode {
  day: LocalDay;
  entryCount: number;
  dominantDensityLabel: DensityLabel;
  category: ConstellationCategory;
  hasAnchor: boolean;
  sampleText: string;
  countsByDensity: Record<DensityLabel, number>;
}

/**
 * Read-only star-chart data model:
 * one node per day with deterministic ordering and locked categories.
 */
export function buildConstellationNodes(state: CitadelStateModel): ConstellationNode[] {
  const out: ConstellationNode[] = [];
  const days = Object.keys(state.days).sort() as LocalDay[];
  for (const day of days) {
    const cell = state.days[day];
    if (!cell || cell.entries.length === 0) continue;
    const counts: Record<DensityLabel, number> = {
      BOSS_THREAT: 0,
      CHARGED_THREAD: 0,
      CALM_ECHO: 0,
      SILENT_SIGNAL: 0,
    };
    let hasAnchor = false;
    for (const entry of cell.entries) {
      if (entry.tags?.includes('daily-anchor')) {
        hasAnchor = true;
        continue;
      }
      const label = entry.densityLabel ?? analyzeEntryDensity(entry).label;
      counts[label] += 1;
    }
    const dominantDensityLabel = (Object.keys(counts) as DensityLabel[]).sort((a, b) => {
      if (counts[b] === counts[a]) return a.localeCompare(b);
      return counts[b] - counts[a];
    })[0];
    const sampleEntry =
      cell.entries.find((e) => !e.tags?.includes('daily-anchor')) ?? cell.entries[0];
    out.push({
      day,
      entryCount: cell.entries.length,
      dominantDensityLabel,
      category: categorizeEntry(sampleEntry),
      hasAnchor,
      sampleText: sampleEntry.text,
      countsByDensity: counts,
    });
  }
  return out;
}

/**
 * Groups entries by density label for Mind Map chambers.
 * `gatherReady` is true when a chamber reaches the threshold.
 */
export function clusterMindMapByDensity(
  state: CitadelStateModel,
  gatherThreshold = 5,
): MindMapCluster[] {
  const buckets: Record<DensityLabel, CellEntry[]> = {
    BOSS_THREAT: [],
    CHARGED_THREAD: [],
    CALM_ECHO: [],
    SILENT_SIGNAL: [],
  };

  for (const dayCell of Object.values(state.days)) {
    for (const entry of dayCell.entries) {
      const label = entry.densityLabel ?? analyzeEntryDensity(entry).label;
      buckets[label].push(entry);
    }
  }

  return (Object.keys(buckets) as DensityLabel[]).map((label) => {
    const entries = buckets[label];
    const uniqueDays = Array.from(new Set(entries.map((e) => e.day))).sort();
    return {
      label,
      count: entries.length,
      entryIds: entries.map((e) => e.id),
      days: uniqueDays,
      chamberId: `chamber:${label.toLowerCase()}`,
      gatherReady: entries.length >= gatherThreshold,
    };
  });
}

// Search & Teleportation (§III of UX Proposal)

export interface SearchResult {
  entryId: string;
  day: LocalDay;
  text: string;
  relevance: number;
}

/**
 * [FORENSIC] Fuzzy-search across all days in the model.
 * Returns results ranked by relevance (token matches).
 */
export function searchLibrarian(state: CitadelStateModel, query: string): SearchResult[] {
  if (!query.trim()) return [];
  
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const dayCell of Object.values(state.days)) {
    for (const entry of dayCell.entries) {
      if (entry.text.toLowerCase().includes(q)) {
        results.push({
          entryId: entry.id,
          day: entry.day,
          text: entry.text,
          relevance: 1 // Simple v0 relevance
        });
      }
    }
  }

  return results.slice(0, 20); // Top 20 for v0
}

/**
 * [FORENSIC] Teleportation Logic.
 * In v0, this returns the target day string if a query matches a date pattern or a high-density entry.
 */
export function resolveTeleport(state: CitadelStateModel, query: string): LocalDay | null {
  // 1. Exact Date Match (YYYY-MM-DD)
  const dateMatch = query.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) return dateMatch[1] as LocalDay;

  // 2. High-Density Entry Match
  const results = searchLibrarian(state, query);
  if (results.length > 0) return results[0].day;

  return null;
}
