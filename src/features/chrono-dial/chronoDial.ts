/**
 * Chrono Dial — date navigation logic.
 *
 * Provides pure functions for jumping between days in the citadel history.
 * All date arithmetic goes through core/time — no ad hoc date logic here.
 */

import { toLocalDay, compareLocalDay, parseLocalDay } from '@/core/time/localDay';
import type { LocalDay } from '@/core/model/types';

/**
 * Returns the day N steps before/after a given day.
 * Positive offset = forward in time, negative = backward.
 */
export function shiftDay(day: LocalDay, offsetDays: number): LocalDay {
  const base = parseLocalDay(day);
  base.setDate(base.getDate() + offsetDays);
  return toLocalDay(base);
}

/** Returns the previous day. */
export function prevDay(day: LocalDay): LocalDay {
  return shiftDay(day, -1);
}

/** Returns the next day, capped at today. */
export function nextDay(day: LocalDay, today: LocalDay): LocalDay {
  const candidate = shiftDay(day, 1);
  return compareLocalDay(candidate, today) <= 0 ? candidate : today;
}

/** Returns true if navigation backward is possible given the oldest known day. */
export function canGoBack(current: LocalDay, oldest: LocalDay): boolean {
  return compareLocalDay(current, oldest) > 0;
}

/** Returns true if navigation forward is possible (can't go past today). */
export function canGoForward(current: LocalDay, today: LocalDay): boolean {
  return compareLocalDay(current, today) < 0;
}

/**
 * Given a sorted list of known days and a target day,
 * returns the nearest day that exists in the list.
 */
export function nearestKnownDay(target: LocalDay, knownDays: LocalDay[]): LocalDay {
  if (knownDays.length === 0) return target;
  if (knownDays.includes(target)) return target;

  // Find closest by absolute distance
  return knownDays.reduce((best, day) => {
    const distBest = Math.abs(parseLocalDay(best).getTime() - parseLocalDay(target).getTime());
    const distDay = Math.abs(parseLocalDay(day).getTime() - parseLocalDay(target).getTime());
    return distDay < distBest ? day : best;
  });
}
