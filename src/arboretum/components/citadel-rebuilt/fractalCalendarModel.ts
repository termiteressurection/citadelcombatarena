/**
 * Fractal Calendar Core Model & Geometry Protocol
 *
 * Collision-Free ID Hierarchy:
 * - Root Hub:            0
 * - Day Chambers:        30,000 .. 129,999 (Deterministic date hash, kept untouched)
 * - Year Chambers:       2,000,000 + Y           (e.g., 2,002,026 for Year 2026)
 * - Season Chambers:     3,000,000 + (Y * 10) + s (s: 0=Winter, 1=Spring, 2=Summer, 3=Autumn)
 * - Month Chambers:      4,000,000 + (Y * 100) + m (m: 1..12)
 *
 * Season Grouping Rule (Dec–Feb grouped within the Calendar Year Y):
 * - WINTER (s=0): Jan (1), Feb (2), Dec (12) of Year Y
 * - SPRING (s=1): Mar (3), Apr (4), May (5) of Year Y
 * - SUMMER (s=2): Jun (6), Jul (7), Aug (8) of Year Y
 * - AUTUMN (s=3): Sep (9), Oct (10), Nov (11) of Year Y
 */

import type { Chamber, Thought } from './types';
import { parseLocalDateFromChamber, isOrganicUserThought } from './calendarChamberUtils';

export * from './writablePath';

export const CALENDAR_YEAR_ID_BASE = 2_000_000;
export const CALENDAR_SEASON_ID_BASE = 3_000_000;
export const CALENDAR_MONTH_ID_BASE = 4_000_000;

export const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

export const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type SeasonName = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

export interface SeasonDefinition {
  index: 0 | 1 | 2 | 3;
  name: SeasonName;
  abrv: string;
  months: [number, number, number]; // 1-indexed (e.g. [1, 2, 12] for Winter)
}

export const SEASONS: readonly SeasonDefinition[] = [
  { index: 0, name: 'WINTER', abrv: 'WIN', months: [1, 2, 12] },
  { index: 1, name: 'SPRING', abrv: 'SPR', months: [3, 4, 5] },
  { index: 2, name: 'SUMMER', abrv: 'SUM', months: [6, 7, 8] },
  { index: 3, name: 'AUTUMN', abrv: 'AUT', months: [9, 10, 11] },
] as const;

export type MonthFoliageState = 'bare' | 'germinating' | 'densifying' | 'crystallized';

export interface MonthJournalMetrics {
  year: number;
  month: number;
  entryCount: number;
  activeDays: number;
  aliveness: number;
  foliageCount: number;
  isCrystallized: boolean;
  foliageState: MonthFoliageState;
}

// ── Days in Month (Leap Year Aware) ──────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month1to12: number): number {
  if (month1to12 < 1 || month1to12 > 12) {
    throw new Error(`Invalid month: ${month1to12}. Expected 1..12`);
  }
  return new Date(year, month1to12, 0).getDate();
}

// ── Season Mapping ───────────────────────────────────────────────────────────

export function getSeasonForMonth(month1to12: number): SeasonDefinition {
  const m = ((month1to12 - 1) % 12 + 12) % 12 + 1;
  if (m === 1 || m === 2 || m === 12) return SEASONS[0]; // Winter
  if (m >= 3 && m <= 5) return SEASONS[1];               // Spring
  if (m >= 6 && m <= 8) return SEASONS[2];               // Summer
  return SEASONS[3];                                     // Autumn (9, 10, 11)
}

// ── ID Construction & Parsing ────────────────────────────────────────────────

export function getYearChamberId(year: number): number {
  return CALENDAR_YEAR_ID_BASE + year;
}

export function getSeasonChamberId(year: number, seasonIndex: number): number {
  const s = Math.max(0, Math.min(3, Math.floor(seasonIndex)));
  return CALENDAR_SEASON_ID_BASE + year * 10 + s;
}

export function getMonthChamberId(year: number, month1to12: number): number {
  const m = Math.max(1, Math.min(12, Math.floor(month1to12)));
  return CALENDAR_MONTH_ID_BASE + year * 100 + m;
}

export function isCalendarYearId(id: number): boolean {
  return id >= CALENDAR_YEAR_ID_BASE && id < CALENDAR_SEASON_ID_BASE;
}

export function isCalendarSeasonId(id: number): boolean {
  return id >= CALENDAR_SEASON_ID_BASE && id < CALENDAR_MONTH_ID_BASE;
}

export function isCalendarMonthId(id: number): boolean {
  return id >= CALENDAR_MONTH_ID_BASE && id < 5_000_000;
}

export function parseCalendarChamberId(id: number): {
  type: 'hub' | 'year' | 'season' | 'month' | 'day' | 'unknown';
  year?: number;
  seasonIndex?: number;
  month?: number;
} {
  if (id === 0) return { type: 'hub' };
  if (isCalendarYearId(id)) {
    return { type: 'year', year: id - CALENDAR_YEAR_ID_BASE };
  }
  if (isCalendarSeasonId(id)) {
    const raw = id - CALENDAR_SEASON_ID_BASE;
    const year = Math.floor(raw / 10);
    const seasonIndex = raw % 10;
    return { type: 'season', year, seasonIndex };
  }
  if (isCalendarMonthId(id)) {
    const raw = id - CALENDAR_MONTH_ID_BASE;
    const year = Math.floor(raw / 100);
    const month = raw % 100;
    return { type: 'month', year, month };
  }
  if (id >= 30_000 && id < 130_000) {
    return { type: 'day' };
  }
  return { type: 'unknown' };
}

/**
 * Diagnostic tool to detect hash collisions among generated Day Chamber IDs.
 */
export function detectDayIdCollisions(
  dates: string[],
  hashFn: (d: string) => number,
): Array<{ dateA: string; dateB: string; hashId: number }> {
  const seen = new Map<number, string>();
  const collisions: Array<{ dateA: string; dateB: string; hashId: number }> = [];

  for (const date of dates) {
    const hash = hashFn(date);
    const existing = seen.get(hash);
    if (existing && existing !== date) {
      collisions.push({ dateA: existing, dateB: date, hashId: hash });
    } else {
      seen.set(hash, date);
    }
  }

  return collisions;
}

// ── Foliage Aliveness & Density Formulas ──────────────────────────────────────

/**
 * Aliveness Formula: A = 2E + 3D
 * E = total user journal inscriptions in the month
 * D = number of active distinct days written to in the month
 */
export function computeAliveness(entryCount: number, activeDays: number): number {
  const e = Math.max(0, Math.floor(entryCount));
  const d = Math.max(0, Math.floor(activeDays));
  return 2 * e + 3 * d;
}

/**
 * Foliage Instance Count Formula:
 * FoliageCount(A) = 0 if A = 0 else min(180, 4 + floor(12 * sqrt(A)))
 */
export function computeFoliageCount(aliveness: number): number {
  const a = Math.max(0, Math.floor(aliveness));
  if (a === 0) return 0;
  return Math.min(180, 4 + Math.floor(12 * Math.sqrt(a)));
}

export function getMonthFoliageState(
  aliveness: number,
  isCrystallized: boolean,
): MonthFoliageState {
  if (isCrystallized) return 'crystallized';
  if (aliveness === 0) return 'bare';
  if (aliveness <= 5) return 'germinating';
  return 'densifying';
}

// ── Thought Scoping & Monthly Metrics (Hub Leak Fix) ─────────────────────────

/**
 * Strictly scopes thought counting to the month's own Day Chambers.
 * Fixes the bug where chamber.id === 0 (the Hub) leaked into all future months.
 */
export function countMonthJournalMetrics(
  chambers: Record<number, Chamber>,
  year: number,
  month1to12: number,
  isCrystallizedOverride?: boolean,
): MonthJournalMetrics {
  const m = ((month1to12 - 1) % 12 + 12) % 12 + 1;
  const monthPrefix = `${year}-${String(m).padStart(2, '0')}-`;
  const monthChamberId = getMonthChamberId(year, m);
  const legacyMonthId = 1010 + (m - 1);

  let entryCount = 0;
  const activeDaysSet = new Set<string>();
  const seenThoughtIds = new Set<number>();

  for (const ch of Object.values(chambers)) {
    // Strictly accept day chambers belonging to this year and month
    if (ch.template !== 'day') continue;

    const dayIso = parseLocalDateFromChamber(ch);
    const belongsToMonth =
      (dayIso !== null && dayIso.startsWith(monthPrefix)) ||
      ch.parent === monthChamberId ||
      ch.parent === legacyMonthId;

    if (!belongsToMonth) continue;

    for (const t of ch.thoughts) {
      if (!isOrganicUserThought(t) || seenThoughtIds.has(t.id)) continue;
      seenThoughtIds.add(t.id);
      entryCount++;
      if (dayIso) activeDaysSet.add(dayIso);
    }
  }

  const activeDays = activeDaysSet.size;
  const aliveness = computeAliveness(entryCount, activeDays);
  const foliageCount = computeFoliageCount(aliveness);

  const monthChamber = chambers[monthChamberId] ?? chambers[legacyMonthId];
  const isCrystallized =
    isCrystallizedOverride ??
    Boolean((monthChamber?.thoughts || []).some(t => t.tags?.includes('crystallized-month')));

  const foliageState = getMonthFoliageState(aliveness, isCrystallized);

  return {
    year,
    month: m,
    entryCount,
    activeDays,
    aliveness,
    foliageCount,
    isCrystallized,
    foliageState,
  };
}

// ── Safe Chamber Hierarchy Migration ─────────────────────────────────────────

export interface CalendarMigrationReceipt {
  timestamp: string;
  legacyYearMigrated: boolean;
  legacySeasonsMigrated: number[];
  legacyMonthsMigrated: number[];
  dayChambersReconnected: number;
  orphansDetected: number;
}

/**
 * Migrates legacy year (1000), seasons (1001..1004), and months (1010..1021)
 * into collision-free year-specific IDs (2_000_000+, 3_000_000+, 4_000_000+).
 *
 * Guarantees:
 * 1. Day chambers keep identical IDs and identical thoughts.
 * 2. Day chamber parent pointers and return doors are remapped to new month IDs.
 * 3. Hub door sets are cleanly upgraded with zero orphaned day chambers.
 */
export function migrateCalendarChambers(
  sourceChambers: Record<number, Chamber>,
  targetYear = new Date().getFullYear(),
): {
  migratedChambers: Record<number, Chamber>;
  didMigrate: boolean;
  receipt: CalendarMigrationReceipt;
} {
  const next: Record<number, Chamber> = {};
  // Deep clone all chambers to ensure save rollback safety
  for (const [k, v] of Object.entries(sourceChambers)) {
    next[Number(k)] = JSON.parse(JSON.stringify(v));
  }

  const receipt: CalendarMigrationReceipt = {
    timestamp: new Date().toISOString(),
    legacyYearMigrated: false,
    legacySeasonsMigrated: [],
    legacyMonthsMigrated: [],
    dayChambersReconnected: 0,
    orphansDetected: 0,
  };

  const legacyYearChamber = next[1000];
  const hasLegacyYear = Boolean(legacyYearChamber && legacyYearChamber.template === 'calendar-root');
  const hasLegacyMonths = Object.keys(next).some(k => {
    const id = Number(k);
    return id >= 1010 && id <= 1021 && next[id].template === 'month';
  });

  if (!hasLegacyYear && !hasLegacyMonths) {
    return { migratedChambers: next, didMigrate: false, receipt };
  }

  // 1. Create or adopt Year Chamber
  const yearChamberId = getYearChamberId(targetYear);
  if (!next[yearChamberId]) {
    next[yearChamberId] = {
      id: yearChamberId,
      name: `YEAR ${targetYear}`,
      description: `The timeline of ${targetYear}.`,
      depth: 1,
      parent: 0,
      template: 'calendar-root',
      doors: [],
      thoughts: legacyYearChamber?.thoughts ?? [],
    };
  }
  if (hasLegacyYear) {
    receipt.legacyYearMigrated = true;
    delete next[1000];
  }

  // Ensure Hub links to new Year Chamber
  if (next[0]) {
    next[0].doors = next[0].doors
      .filter(d => d !== 1000)
      .concat(next[0].doors.includes(yearChamberId) ? [] : [yearChamberId]);
  }

  // 2. Create or adopt Season Chambers (0=WINTER, 1=SPRING, 2=SUMMER, 3=AUTUMN)
  const seasonIdMap = new Map<number, number>(); // legacySeasonId (1001..1004) -> newSeasonId
  for (let s = 0; s < 4; s++) {
    const legacySeasonId = 1001 + s;
    const newSeasonId = getSeasonChamberId(targetYear, s);
    seasonIdMap.set(legacySeasonId, newSeasonId);

    const legacySeason = next[legacySeasonId];
    if (!next[newSeasonId]) {
      next[newSeasonId] = {
        id: newSeasonId,
        name: SEASONS[s].name,
        description: `The season of ${SEASONS[s].name.toLowerCase()}.`,
        depth: 2,
        parent: yearChamberId,
        template: 'season',
        doors: [yearChamberId],
        thoughts: legacySeason?.thoughts ?? [],
      };
    }
    if (legacySeason) {
      receipt.legacySeasonsMigrated.push(legacySeasonId);
      delete next[legacySeasonId];
    }

    if (!next[yearChamberId].doors.includes(newSeasonId)) {
      next[yearChamberId].doors.push(newSeasonId);
    }
  }

  // 3. Create or adopt Month Chambers (1..12)
  const monthIdMap = new Map<number, number>(); // legacyMonthId (1010..1021) -> newMonthId
  for (let m = 1; m <= 12; m++) {
    const legacyMonthId = 1010 + (m - 1);
    const newMonthId = getMonthChamberId(targetYear, m);
    monthIdMap.set(legacyMonthId, newMonthId);

    const seasonDef = getSeasonForMonth(m);
    const seasonChamberId = getSeasonChamberId(targetYear, seasonDef.index);
    const legacyMonth = next[legacyMonthId];

    if (!next[newMonthId]) {
      next[newMonthId] = {
        id: newMonthId,
        name: MONTH_NAMES[m - 1],
        description: `The month of ${MONTH_FULL_NAMES[m - 1]}.`,
        depth: 3,
        parent: seasonChamberId,
        template: 'month',
        doors: [0, seasonChamberId],
        thoughts: legacyMonth?.thoughts ?? [],
      };
    }
    if (legacyMonth) {
      receipt.legacyMonthsMigrated.push(legacyMonthId);
      delete next[legacyMonthId];
    }

    // Connect Season <-> Month
    if (next[seasonChamberId] && !next[seasonChamberId].doors.includes(newMonthId)) {
      next[seasonChamberId].doors.push(newMonthId);
    }
  }

  // 4. Reconnect all Day Chambers
  for (const ch of Object.values(next)) {
    if (ch.template !== 'day') continue;

    const dayIso = parseLocalDateFromChamber(ch);
    let resolvedMonthId: number | null = null;

    if (dayIso) {
      const parts = dayIso.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        resolvedMonthId = getMonthChamberId(y, m);
      }
    }

    if (!resolvedMonthId && ch.parent && monthIdMap.has(ch.parent)) {
      resolvedMonthId = monthIdMap.get(ch.parent)!;
    }

    if (resolvedMonthId) {
      ch.parent = resolvedMonthId;
      // Remap return doors
      ch.doors = ch.doors
        .filter(d => !monthIdMap.has(d))
        .concat(ch.doors.includes(resolvedMonthId) ? [] : [resolvedMonthId]);

      // Connect Month -> Day
      if (next[resolvedMonthId] && !next[resolvedMonthId].doors.includes(ch.id)) {
        next[resolvedMonthId].doors.push(ch.id);
      }
      receipt.dayChambersReconnected++;
    } else {
      receipt.orphansDetected++;
    }
  }

  return { migratedChambers: next, didMigrate: true, receipt };
}
