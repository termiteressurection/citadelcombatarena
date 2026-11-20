/**
 * Fractal Eye navigation helpers only — no persistence shape change.
 * Year > Season > Month > Week > Day (CITADEL_V3_UX_PROPOSAL). Season/week are derived from calendar math.
 */

import type { FractalDayPointer, LocalDay } from '../model/types';

export interface LocalDayParts {
  year: number;
  month: number;
  day: number;
}

/** Parse `YYYY-MM-DD` into numeric parts (local calendar date string). */
export function parseLocalDayParts(iso: LocalDay): LocalDayParts {
  const [ys, ms, ds] = iso.split('-');
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Invalid LocalDay: ${iso}`);
  }
  return { year, month, day };
}

/** Meteorological season in the northern hemisphere (placeholder until user prefs). */
export function seasonFromMonth(month: number): 'winter' | 'spring' | 'summer' | 'autumn' {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

/** ISO week metadata for deterministic Week chamber IDs. */
export function isoWeekMeta(iso: LocalDay): { weekYear: number; week: number } {
  const { year, month, day } = parseLocalDayParts(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekYear, week };
}

/** Build fractal pointer IDs from a LocalDay without mutating state shape. */
export function toFractalPointer(day: LocalDay): FractalDayPointer {
  const { year, month } = parseLocalDayParts(day);
  const season = seasonFromMonth(month);
  return {
    year: `Y${year}`,
    season: `Y${year}-S${season}`,
    month: `Y${year}-M${String(month).padStart(2, '0')}`,
    day,
  };
}
