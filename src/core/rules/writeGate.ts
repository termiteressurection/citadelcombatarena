import type { LocalDay } from '../time/localDay';
import { getDayWritability } from '@/arboretum/components/citadel-rebuilt/writablePath';

export type WriteGateReason =
  | 'OK'
  | 'PAST_DAY_LOCKED'
  | 'FUTURE_DAY_FORBIDDEN'
  | 'DAY_CRYSTALLIZED'
  | 'EMPTY_TEXT';

export interface WriteGateResult {
  allowed: boolean;
  reason: WriteGateReason;
}

export function canWriteToDay(params: {
  targetDay: LocalDay;
  today?: LocalDay;
  text: string;
  crystallized?: boolean;
  now?: Date | string | number;
}): WriteGateResult {
  const { targetDay, today, text, crystallized, now } = params;

  if (!text.trim()) return { allowed: false, reason: 'EMPTY_TEXT' };
  if (crystallized) return { allowed: false, reason: 'DAY_CRYSTALLIZED' };

  // Single source of truth delegates to getDayWritability
  const writability = getDayWritability(targetDay, now ?? today);
  if (writability.status === 'past') return { allowed: false, reason: 'PAST_DAY_LOCKED' };
  if (writability.status === 'future') return { allowed: false, reason: 'FUTURE_DAY_FORBIDDEN' };
  return { allowed: true, reason: 'OK' };
}
