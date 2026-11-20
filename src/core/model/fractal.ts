import type { FractalIndexV1, LocalDay } from './types';
import { toFractalPointer } from '../time/fractalNav';

/**
 * Migration-safe fractal stage:
 * - canonical source of truth remains `state.days`
 * - this index is derived/cacheable and can be regenerated any time
 */
export function buildFractalIndexV1(days: Record<LocalDay, unknown>): FractalIndexV1 {
  const byDay = {} as Record<LocalDay, FractalIndexV1['byDay'][LocalDay]>;
  for (const day of Object.keys(days) as LocalDay[]) {
    byDay[day] = toFractalPointer(day);
  }
  return { version: 1, byDay };
}
