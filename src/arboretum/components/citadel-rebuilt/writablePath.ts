/**
 * Citadel — One Writable Path (Fractal Journal Hierarchies)
 *
 * Core Laws:
 * - At any instant, exactly one period is writable PER LEVEL:
 *   Day (YYYY-MM-DD), Month (YYYY-MM), Season (YYYY-NAME), Year (YYYY).
 * - Writability is a function of *now*, never a stored per-chamber property,
 *   never a prop a caller can pass or override.
 * - Past periods at EVERY level are sealed — readable, searchable, navigable, not writable.
 * - Future periods at EVERY level have not arrived — viewable, not writable, labelled as not-yet.
 * - As time passes, the writable path moves on its own without migration or flag-flipping.
 * - A new entry's period is derived from the system clock at write time and chamber level.
 */

import type { LocalDay } from '@/core/model/types';

export type JournalLevel = 'day' | 'month' | 'season' | 'year';

export type ClockFn = () => Date;

let activeClock: ClockFn = () => new Date();

/** Set an injectable clock source (for testing, time simulation, or custom environments). */
export function setClock(clock: ClockFn): void {
  activeClock = clock;
}

/** Reset clock source to standard system clock. */
export function resetClock(): void {
  activeClock = () => new Date();
}

/** Returns the current Date from the active clock. */
export function getClockNow(): Date {
  return activeClock();
}

export type SeasonName = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

export const SEASONS_LIST: readonly { index: 0 | 1 | 2 | 3; name: SeasonName; months: [number, number, number] }[] = [
  { index: 0, name: 'WINTER', months: [1, 2, 12] },
  { index: 1, name: 'SPRING', months: [3, 4, 5] },
  { index: 2, name: 'SUMMER', months: [6, 7, 8] },
  { index: 3, name: 'AUTUMN', months: [9, 10, 11] },
] as const;

export function getSeasonForMonthNumber(month1to12: number): (typeof SEASONS_LIST)[number] {
  const m = ((month1to12 - 1) % 12 + 12) % 12 + 1;
  if (m === 1 || m === 2 || m === 12) return SEASONS_LIST[0]; // Winter (Jan, Feb, Dec)
  if (m >= 3 && m <= 5) return SEASONS_LIST[1];               // Spring (Mar, Apr, May)
  if (m >= 6 && m <= 8) return SEASONS_LIST[2];               // Summer (Jun, Jul, Aug)
  return SEASONS_LIST[3];                                     // Autumn (Sep, Oct, Nov)
}

function resolveDateObject(now?: Date | string | number): Date {
  if (now === undefined || now === null) {
    return getClockNow();
  }
  if (now instanceof Date) {
    return Number.isNaN(now.getTime()) ? getClockNow() : now;
  }
  if (typeof now === 'string') {
    const trimmed = now.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  }
  const parsed = new Date(now);
  return Number.isNaN(parsed.getTime()) ? getClockNow() : parsed;
}

/**
 * Returns the clock-derived canonical writable period for a given hierarchy level.
 */
export function resolveWritablePeriod(level: JournalLevel, now?: Date | string | number): string {
  const d = resolveDateObject(now);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  switch (level) {
    case 'day': {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
    case 'month': {
      const mm = String(month).padStart(2, '0');
      return `${year}-${mm}`;
    }
    case 'season': {
      const seasonDef = getSeasonForMonthNumber(month);
      return `${year}-${seasonDef.name}`;
    }
    case 'year': {
      return String(year);
    }
    default: {
      throw new Error(`[CITADEL_ERROR] Unknown journal level: ${level}`);
    }
  }
}

/**
 * Returns the single writable local day key (YYYY-MM-DD). Backward-compatible alias.
 */
export function resolveWritableDay(now?: Date | string | number): LocalDay {
  return resolveWritablePeriod('day', now) as LocalDay;
}

export type PeriodTemporalStatus = 'current' | 'past' | 'future' | 'dormant';
export type PeriodWritabilityReason =
  | 'OK'
  | 'PAST_PERIOD_SEALED'
  | 'FUTURE_PERIOD_NOT_ARRIVED'
  | 'PERIOD_DORMANT'
  | 'INVALID_PERIOD_FORMAT';

export interface PeriodWritability {
  level: JournalLevel;
  period: string;
  writablePeriod: string;
  isWritable: boolean;
  status: PeriodTemporalStatus;
  reason: PeriodWritabilityReason;
  label: string;
  badge: string;
  description: string;
}

/**
 * Normalizes season strings: e.g. "2026-AUTUMN", "Autumn 2026", "2026-autumn" -> { year: 2026, seasonIndex: 3, canonical: "2026-AUTUMN" }
 */
export function parseSeasonPeriod(periodStr: string): { year: number; seasonIndex: number; canonical: string } | null {
  const clean = periodStr.trim().toUpperCase();
  // Format: "YYYY-NAME" or "YYYY NAME"
  let match = clean.match(/^(\d{4})[-/\s]+(WINTER|SPRING|SUMMER|AUTUMN)$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const name = match[2] as SeasonName;
    const seasonIndex = SEASONS_LIST.find((s) => s.name === name)!.index;
    return { year, seasonIndex, canonical: `${year}-${name}` };
  }
  // Format: "NAME YYYY" or "NAME-YYYY"
  match = clean.match(/^(WINTER|SPRING|SUMMER|AUTUMN)[-/\s]+(\d{4})$/);
  if (match) {
    const year = parseInt(match[2], 10);
    const name = match[1] as SeasonName;
    const seasonIndex = SEASONS_LIST.find((s) => s.name === name)!.index;
    return { year, seasonIndex, canonical: `${year}-${name}` };
  }
  return null;
}

/**
 * Single source of truth for period writability across Citadel hierarchies.
 */
export function getPeriodWritability(
  level: JournalLevel,
  period: string,
  now?: Date | string | number,
): PeriodWritability {
  const d = resolveDateObject(now);
  const writablePeriod = resolveWritablePeriod(level, now);
  const normalized = period.trim();

  let status: PeriodTemporalStatus = 'current';

  switch (level) {
    case 'day': {
      // Must be YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return {
          level,
          period: normalized,
          writablePeriod,
          isWritable: false,
          status: 'past',
          reason: 'INVALID_PERIOD_FORMAT',
          label: 'INVALID DAY PERIOD',
          badge: 'INVALID',
          description: `Day period must be formatted as YYYY-MM-DD. Received: ${normalized}`,
        };
      }
      if (normalized === writablePeriod) status = 'current';
      else if (normalized < writablePeriod) status = 'past';
      else status = 'future';
      break;
    }
    case 'month': {
      // Must be YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(normalized)) {
        return {
          level,
          period: normalized,
          writablePeriod,
          isWritable: false,
          status: 'past',
          reason: 'INVALID_PERIOD_FORMAT',
          label: 'INVALID MONTH PERIOD',
          badge: 'INVALID',
          description: `Month period must be formatted as YYYY-MM. Received: ${normalized}`,
        };
      }
      if (normalized === writablePeriod) status = 'current';
      else if (normalized < writablePeriod) status = 'past';
      else status = 'future';
      break;
    }
    case 'season': {
      const parsedTarget = parseSeasonPeriod(normalized);
      const parsedWritable = parseSeasonPeriod(writablePeriod);
      if (!parsedTarget || !parsedWritable) {
        return {
          level,
          period: normalized,
          writablePeriod,
          isWritable: false,
          status: 'past',
          reason: 'INVALID_PERIOD_FORMAT',
          label: 'INVALID SEASON PERIOD',
          badge: 'INVALID',
          description: `Season period must be formatted as YYYY-NAME (e.g. 2026-AUTUMN). Received: ${normalized}`,
        };
      }
      const nowYear = d.getFullYear();
      const nowMonth = d.getMonth() + 1;

      if (parsedTarget.seasonIndex === 0) {
        // WINTER: Jan, Feb, Dec of calendar year Y
        if (parsedTarget.year < nowYear) {
          status = 'past';
        } else if (parsedTarget.year > nowYear) {
          status = 'future';
        } else {
          // Same calendar year
          if (nowMonth === 1 || nowMonth === 2 || nowMonth === 12) {
            status = 'current';
          } else {
            // March 1 – November 30: Winter sleeps until December
            status = 'dormant';
          }
        }
      } else {
        // SPRING (1), SUMMER (2), AUTUMN (3): Contiguous single-block seasons
        if (parsedTarget.year < nowYear) {
          status = 'past';
        } else if (parsedTarget.year > nowYear) {
          status = 'future';
        } else {
          // Same calendar year
          const currentSeasonDef = getSeasonForMonthNumber(nowMonth);
          if (currentSeasonDef.name === 'WINTER') {
            if (nowMonth <= 2) {
              // Jan or Feb: Spring, Summer, Autumn have not arrived yet
              status = 'future';
            } else {
              // December: Spring, Summer, Autumn have all sealed
              status = 'past';
            }
          } else {
            if (parsedTarget.seasonIndex === currentSeasonDef.index) {
              status = 'current';
            } else if (parsedTarget.seasonIndex < currentSeasonDef.index) {
              status = 'past';
            } else {
              status = 'future';
            }
          }
        }
      }
      break;
    }
    case 'year': {
      if (!/^\d{4}$/.test(normalized)) {
        return {
          level,
          period: normalized,
          writablePeriod,
          isWritable: false,
          status: 'past',
          reason: 'INVALID_PERIOD_FORMAT',
          label: 'INVALID YEAR PERIOD',
          badge: 'INVALID',
          description: `Year period must be formatted as YYYY (e.g. 2026). Received: ${normalized}`,
        };
      }
      const targetYear = parseInt(normalized, 10);
      const writableYear = parseInt(writablePeriod, 10);
      if (targetYear === writableYear) status = 'current';
      else if (targetYear < writableYear) status = 'past';
      else status = 'future';
      break;
    }
  }

  const levelName = level.toUpperCase();
  if (status === 'current') {
    return {
      level,
      period: normalized,
      writablePeriod,
      isWritable: true,
      status: 'current',
      reason: 'OK',
      label:
        level === 'day'
          ? 'ACTIVE CRUCIBLE · TODAY IS WRITABLE'
          : `ACTIVE ${levelName} CRUCIBLE · CURRENT ${levelName} IS WRITABLE`,
      badge: 'WRITABLE',
      description: `The living crucible for this ${level}. Inscribe reflection into the permanent record.`,
    };
  }

  if (status === 'dormant') {
    return {
      level,
      period: normalized,
      writablePeriod,
      isWritable: false,
      status: 'dormant',
      reason: 'PERIOD_DORMANT',
      label: 'WINTER SLEEPS · WAKES IN DECEMBER',
      badge: 'DORMANT',
      description: 'Winter sleeps. This crucible wakes in December.',
    };
  }

  if (status === 'past') {
    return {
      level,
      period: normalized,
      writablePeriod,
      isWritable: false,
      status: 'past',
      reason: 'PAST_PERIOD_SEALED',
      label:
        level === 'day'
          ? 'THE PAST IS STONE · SEALED IN STONE'
          : `THE PAST IS STONE · ${levelName} SEALED IN STONE`,
      badge: 'SEALED',
      description: `The past is stone. Past ${level} records are permanent and cannot be modified or added to.`,
    };
  }

  return {
    level,
    period: normalized,
    writablePeriod,
    isWritable: false,
    status: 'future',
    reason: 'FUTURE_PERIOD_NOT_ARRIVED',
    label:
      level === 'day'
        ? 'TIME HAS NOT DAWNED · HAS NOT ARRIVED YET'
        : `TIME HAS NOT DAWNED · ${levelName} HAS NOT ARRIVED YET`,
    badge: 'NOT YET',
    description: `This ${level} has not arrived yet. Time only flows forward from now. You cannot write into the future.`,
  };
}

/**
 * Returns true if and only if target (level, period) is the current clock-derived period.
 */
export function isPeriodWritable(level: JournalLevel, period: string, now?: Date | string | number): boolean {
  return getPeriodWritability(level, period, now).isWritable;
}

/**
 * Enforces period writability. Throws a descriptive Error if period is not writable.
 */
export function assertPeriodWritable(level: JournalLevel, period: string, now?: Date | string | number): void {
  const result = getPeriodWritability(level, period, now);
  if (!result.isWritable) {
    const levelCap = result.level.charAt(0).toUpperCase() + result.level.slice(1);
    throw new Error(
      `[CITADEL_ERROR] WRITE_REJECTED: ${levelCap} ${result.period} is not writable (${result.reason}). ` +
      `Exactly one ${result.level} is writable: current ${result.level} ${result.writablePeriod}. ` +
      `(${result.description})`
    );
  }
}

// ── Backward-compatible Day-level aliases ────────────────────────────────────

export type DayTemporalStatus = 'today' | 'past' | 'future';
export type DayWritabilityReason = 'OK' | 'PAST_DAY_SEALED' | 'FUTURE_DAY_NOT_ARRIVED';

export interface DayWritability {
  day: string;
  writableDay: LocalDay;
  isWritable: boolean;
  status: DayTemporalStatus;
  reason: DayWritabilityReason;
  label: string;
  badge: string;
  description: string;
}

export function getDayWritability(day: string, now?: Date | string | number): DayWritability {
  const pw = getPeriodWritability('day', day, now);
  return {
    day: pw.period,
    writableDay: pw.writablePeriod as LocalDay,
    isWritable: pw.isWritable,
    status: pw.status === 'current' ? 'today' : pw.status === 'past' ? 'past' : 'future',
    reason: pw.reason === 'OK' ? 'OK' : pw.reason === 'PAST_PERIOD_SEALED' ? 'PAST_DAY_SEALED' : 'FUTURE_DAY_NOT_ARRIVED',
    label: pw.label,
    badge: pw.badge,
    description: pw.description,
  };
}

export function isDayWritable(day: string, now?: Date | string | number): boolean {
  return getDayWritability(day, now).isWritable;
}

export function assertDayWritable(day: string, now?: Date | string | number): void {
  const result = getDayWritability(day, now);
  if (!result.isWritable) {
    throw new Error(
      `[CITADEL_ERROR] WRITE_REJECTED: Day ${result.day} is not writable (${result.reason}). ` +
      `Exactly one day is writable: current local day ${result.writableDay}. ` +
      `(${result.description})`
    );
  }
}
