import type { Chamber, Thought } from './types';
import { localDateISO } from './localDate';
import { resolveWritableDay, isDayWritable } from './writablePath';

export type CalendarTier = 'root' | 'year' | 'season' | 'month' | 'week' | 'day' | 'other';

export const CALENDAR_TEMPLATES = new Set(['calendar-root', 'season', 'month', 'week', 'day']);

const CALENDAR_PATH_LIMIT = 14;
const DAY_RE = /The day of (\d{4}-\d{2}-\d{2})\./;

const STRESS_WORDS = [
  'stress', 'stressed', 'anxious', 'anxiety', 'afraid', 'fear', 'panic', 'overwhelmed',
  'worry', 'worried', 'deadline', 'debt', 'pressure', 'guilt', 'ashamed', 'anger',
  'angry', 'lonely', 'hurt', 'grief', 'grieving', 'tired', 'exhausted', 'burnout',
  'sad', 'heavy', 'doom', 'stuck', 'spiral', 'chaos', 'fight', 'failure', 'failing',
  'regret', 'regrets', 'resentment', 'resentful', 'dread', 'fearful',
];

const RELIEF_WORDS = [
  'calm', 'peace', 'peaceful', 'grateful', 'gratitude', 'joy', 'gentle', 'steady',
  'healed', 'healing', 'resolved', 'eased', 'rest', 'rested', 'safe', 'secure',
  'hope', 'hopeful', 'light', 'clear', 'clarity', 'soft', 'playful',
];

export function getCalendarTier(chamber?: Chamber | null): CalendarTier {
  if (!chamber) return 'other';
  if (chamber.id === 0) return 'root';
  switch (chamber.template) {
    case 'calendar-root': return 'year';
    case 'season': return 'season';
    case 'month': return 'month';
    case 'week': return 'week';
    case 'day': return 'day';
    default: return 'other';
  }
}

export function isCalendarChamber(chamber?: Chamber | null): boolean {
  return getCalendarTier(chamber) !== 'other';
}

export function isDayChamber(chamber?: Chamber | null): boolean {
  return getCalendarTier(chamber) === 'day';
}

export function parseLocalDateFromChamber(chamber?: Chamber | null): string | null {
  if (!chamber || chamber.template !== 'day') return null;
  const match = chamber.description?.match(DAY_RE);
  return match?.[1] ?? null;
}

/** Find generated calendar leaf whose description matches `The day of YYYY-MM-DD.` (local). */
export function findDayChamberIdByLocalDate(
  chambers: Record<number, Chamber>,
  dateIso: string,
): number | null {
  for (const ch of Object.values(chambers)) {
    if (ch.template !== 'day') continue;
    if (parseLocalDateFromChamber(ch) === dateIso) return ch.id;
  }
  return null;
}

export function hasDailyAnchorForToday(identity: { lastDailyAnchorLocalDate?: string }): boolean {
  return identity.lastDailyAnchorLocalDate === localDateISO();
}

export function getChamberPath(
  chambers: Record<number, Chamber>,
  chamberId: number,
): Chamber[] {
  const path: Chamber[] = [];
  const seen = new Set<number>();
  let cursor: number | undefined = chamberId;

  while (cursor !== undefined && chambers[cursor] && !seen.has(cursor) && path.length < CALENDAR_PATH_LIMIT) {
    seen.add(cursor);
    path.unshift(chambers[cursor]);
    cursor = chambers[cursor].parent;
  }

  return path;
}

export function isDescendantOf(
  chambers: Record<number, Chamber>,
  chamberId: number,
  ancestorId: number,
): boolean {
  let cursor: number | undefined = chamberId;
  let depth = 0;
  while (cursor !== undefined && chambers[cursor] && depth < CALENDAR_PATH_LIMIT) {
    if (cursor === ancestorId) return true;
    cursor = chambers[cursor].parent;
    depth += 1;
  }
  return false;
}

export function findDayDescendants(
  chambers: Record<number, Chamber>,
  chamberId: number,
): Chamber[] {
  const root = chambers[chamberId];
  if (!root) return [];
  const stack = [root.id];
  const seen = new Set<number>();
  const days: Chamber[] = [];

  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const chamber = chambers[id];
    if (!chamber) continue;
    if (chamber.template === 'day') {
      days.push(chamber);
      continue;
    }
    for (const childId of chamber.doors) {
      const child = chambers[childId];
      if (!child) continue;
      if (child.parent !== chamber.id) continue;
      stack.push(childId);
    }
  }

  return days.sort((a, b) => {
    const aDate = parseLocalDateFromChamber(a) ?? '';
    const bDate = parseLocalDateFromChamber(b) ?? '';
    return aDate.localeCompare(bDate);
  });
}

export function getNeighboringDayIds(
  chambers: Record<number, Chamber>,
  chamberId: number,
): number[] {
  const chamber = chambers[chamberId];
  if (!chamber || chamber.template !== 'day' || chamber.parent === undefined) return [];
  const week = chambers[chamber.parent];
  if (!week) return [];
  const days = week.doors
    .map(id => chambers[id])
    .filter((candidate): candidate is Chamber => candidate?.template === 'day')
    .sort((a, b) => (parseLocalDateFromChamber(a) ?? '').localeCompare(parseLocalDateFromChamber(b) ?? ''));
  const idx = days.findIndex(candidate => candidate.id === chamber.id);
  if (idx === -1) return [];
  return [days[idx - 1]?.id, days[idx + 1]?.id].filter((id): id is number => typeof id === 'number');
}

export function resolveJournalTargetChamberId(
  chambers: Record<number, Chamber>,
  currentChamberId: number,
  _dateIso?: string,
): number | null {
  const writableDay = resolveWritableDay();
  const current = chambers[currentChamberId];

  // If standing directly in today's day chamber, target it
  if (current && current.template === 'day') {
    const chamberDate = parseLocalDateFromChamber(current);
    if (chamberDate && isDayWritable(chamberDate)) {
      return current.id;
    }
  }

  // Otherwise, all journal entries target today's local day chamber
  return findDayChamberIdByLocalDate(chambers, writableDay);
}

export function getCalendarLineageForDay(
  chambers: Record<number, Chamber>,
  dayChamberId: number,
): Chamber[] {
  return getChamberPath(chambers, dayChamberId).filter(chamber => {
    const tier = getCalendarTier(chamber);
    return tier === 'year' || tier === 'season' || tier === 'month' || tier === 'week';
  });
}

export function getCalendarFocusLabel(
  chambers: Record<number, Chamber>,
  chamberId: number,
): string {
  const path = getChamberPath(chambers, chamberId).filter(chamber => getCalendarTier(chamber) !== 'root');
  if (path.length === 0) return 'ROOT HUB';
  return path.map(chamber => chamber.name).join(' / ');
}

export function summarizeThoughtText(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function analyzeThoughtStress(
  text: string,
  tags: string[] = [],
  mood?: string,
): { score: number; label: string } {
  const low = text.toLowerCase();
  const corpus = `${low} ${tags.join(' ').toLowerCase()} ${mood?.toLowerCase() ?? ''}`;
  let score = 8;

  for (const token of STRESS_WORDS) {
    if (corpus.includes(token)) score += 10;
  }
  for (const token of RELIEF_WORDS) {
    if (corpus.includes(token)) score -= 6;
  }
  if (/[!?]{2,}/.test(text)) score += 8;
  if (/\b(can't|cannot|won't|never|no way|stuck)\b/i.test(text)) score += 10;
  if (/\b(cry|crying|collapse|explode|breakdown|spiral)\b/i.test(text)) score += 14;

  const clamped = Math.max(0, Math.min(100, score));
  const label =
    clamped >= 70 ? 'boss threat'
      : clamped >= 52 ? 'stress rival'
      : clamped >= 34 ? 'charged thread'
      : 'calm echo';

  return { score: clamped, label };
}

export function getJournalSourceThoughts(
  chambers: Record<number, Chamber>,
): Array<{ chamber: Chamber; thought: Thought }> {
  const entries: Array<{ chamber: Chamber; thought: Thought }> = [];
  for (const chamber of Object.values(chambers)) {
    for (const thought of chamber.thoughts) {
      if (thought.derived) continue;
      entries.push({ chamber, thought });
    }
  }
  return entries;
}

const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function getMonthIndexFromChamber(chamber?: Chamber | null): number | null {
  if (!chamber || chamber.template !== 'month') return null;
  if (chamber.id >= 1010 && chamber.id < 1022) return chamber.id - 1010;
  const upper = chamber.name.toUpperCase();
  const idx = MONTH_ABBRS.findIndex(abbr => upper.includes(abbr));
  return idx >= 0 ? idx : null;
}

export function isOrganicUserThought(thought: Thought): boolean {
  if (thought.derived) return false;
  const tags = thought.tags || [];
  if (
    tags.includes('daily-anchor') ||
    tags.includes('sigma-chat') ||
    tags.includes('non-inscription') ||
    tags.includes('derived-mindmap') ||
    tags.includes('ai-response') ||
    tags.includes('system')
  ) {
    return false;
  }
  if (thought.text.startsWith('[User]:') || thought.text.startsWith('[Sigma]:')) return false;
  return true;
}

/**
 * Counts user inscriptions belonging to a specific calendar month (0 = JAN .. 11 = DEC).
 * Strictly scoped to Day Chambers belonging to that month. Hub thoughts (chamber 0)
 * are never leaked into future or unrelated months.
 */
export function getMonthThoughtCount(
  chambers: Record<number, Chamber>,
  monthIndex: number,
  year = new Date().getFullYear(),
): number {
  const clampedMonth = ((monthIndex % 12) + 12) % 12; // 0..11
  const m1to12 = clampedMonth + 1;
  const monthPrefix = `${year}-${String(m1to12).padStart(2, '0')}-`;
  const legacyMonthChamberId = 1010 + clampedMonth;
  const newMonthChamberId = 4_000_000 + year * 100 + m1to12;

  const legacyMonthChamber = chambers[legacyMonthChamberId];
  const newMonthChamber = chambers[newMonthChamberId];
  const monthDoorSet = new Set<number>([
    ...(legacyMonthChamber?.doors ?? []),
    ...(newMonthChamber?.doors ?? []),
  ]);
  const seenThoughtIds = new Set<number>();
  let count = 0;

  for (const chamber of Object.values(chambers)) {
    const dayIso = parseLocalDateFromChamber(chamber);
    const isMatchingDay =
      chamber.template === 'day' &&
      ((dayIso !== null && dayIso.startsWith(monthPrefix)) ||
        monthDoorSet.has(chamber.id) ||
        chamber.parent === newMonthChamberId ||
        chamber.parent === legacyMonthChamberId);
    const isMatchingMonth = chamber.id === newMonthChamberId || chamber.id === legacyMonthChamberId;

    if (isMatchingDay || isMatchingMonth) {
      for (const t of chamber.thoughts) {
        if (!isOrganicUserThought(t) || seenThoughtIds.has(t.id)) continue;
        seenThoughtIds.add(t.id);
        count++;
      }
    }
  }

  return count;
}

