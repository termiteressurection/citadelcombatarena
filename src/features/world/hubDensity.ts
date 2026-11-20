/**
 * Hub Density Calculator
 *
 * Derives a density score (0–1) from accumulated entry history.
 * Used to drive visual consequence in the world/hub panel.
 *
 * Density is a pure function of state — never stored, always derived.
 */

import type { CitadelStateModel, DayCell } from '@/core/model/types';

export interface HubDensityResult {
  /** Normalized density score 0–1 */
  score: number;
  /** Total entries across all days */
  totalEntries: number;
  /** Number of days with at least one entry */
  activeDays: number;
  /** Total days in the record */
  totalDays: number;
  /** Average entries per active day */
  avgEntriesPerDay: number;
  /** Density tier label */
  tier: 'empty' | 'sparse' | 'growing' | 'dense' | 'saturated';
}

const SATURATION_ENTRIES = 100; // entry count that maps to score = 1.0

export function calcHubDensity(state: CitadelStateModel): HubDensityResult {
  const cells: DayCell[] = Object.values(state.days);
  const totalDays = cells.length;
  const totalEntries = cells.reduce((sum, c) => sum + c.entries.length, 0);
  const activeDays = cells.filter((c) => c.entries.length > 0).length;
  const avgEntriesPerDay = activeDays > 0 ? totalEntries / activeDays : 0;

  // Score: logarithmic curve so early entries feel impactful
  const raw = totalEntries / SATURATION_ENTRIES;
  const score = Math.min(1, Math.log1p(raw * Math.E));

  return {
    score,
    totalEntries,
    activeDays,
    totalDays,
    avgEntriesPerDay,
    tier: scoreTier(score),
  };
}

function scoreTier(score: number): HubDensityResult['tier'] {
  if (score === 0) return 'empty';
  if (score < 0.2) return 'sparse';
  if (score < 0.5) return 'growing';
  if (score < 0.8) return 'dense';
  return 'saturated';
}
