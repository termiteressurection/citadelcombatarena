import { compareLocalDay, toLocalDay, type LocalDay } from '../time/localDay';
import { buildFractalIndexV1 } from '../model/fractal';
import { completeRitualStep } from '../rules/ritualEngine';
import { analyzeEntryDensity, categorizeEntry } from '../rules/librarian';
import { canWriteToDay } from '../rules/writeGate';
import {
  getClockNow,
  resolveWritableDay,
  assertPeriodWritable,
  type JournalLevel,
} from '@/arboretum/components/citadel-rebuilt/writablePath';
import type { CitadelStateModel, DayCell, WriteEntryInput, CellEntry } from '../model/types';

// Helpers

function ensureDayCell(state: CitadelStateModel, day: LocalDay): DayCell {
  const existing = state.days[day];
  if (existing) return { ...existing };
  return {
    day,
    entries: [],
    locked: compareLocalDay(day, state.today) < 0,
    dailyAnchorComplete: false,
    dailyTrialComplete: false,
  };
}

// Write Entry

export function writeEntry(
  state: CitadelStateModel,
  input: WriteEntryInput,
): CitadelStateModel {
  const dayCell = ensureDayCell(state, input.day);
  const gate = canWriteToDay({
    targetDay: input.day,
    today: state.today,
    text: input.text,
    crystallized: dayCell.crystallized,
  });
  if (!gate.allowed) return state;

  const now = new Date().toISOString();
  const entryBase = {
    id: crypto.randomUUID(),
    day: input.day,
    createdAt: now,
    updatedAt: now,
    text: input.text.trim(),
    tags: input.tags,
    level: input.level ?? 'day',
    period: input.period ?? input.day,
  };
  const density = analyzeEntryDensity(entryBase);
  const entry = {
    ...entryBase,
    densityScore: density.score,
    densityLabel: density.label,
    chamberCategory: categorizeEntry({ ...entryBase, densityLabel: density.label }),
  };

  const days = {
    ...state.days,
    [input.day]: {
      ...dayCell,
      entries: [...dayCell.entries, entry],
    },
  };
  return {
    ...state,
    days,
    fractal: buildFractalIndexV1(days),
  };
}

export function writeHierarchicalEntry(
  state: CitadelStateModel,
  level: JournalLevel,
  period: string,
  text: string,
  tags?: string[],
): CitadelStateModel {
  assertPeriodWritable(level, period);
  const now = new Date().toISOString();
  const today = resolveWritableDay();
  const entryBase = {
    id: crypto.randomUUID(),
    day: today,
    createdAt: now,
    updatedAt: now,
    text: text.trim(),
    tags,
    level,
    period,
  };
  const density = analyzeEntryDensity(entryBase);
  const entry: CellEntry = {
    ...entryBase,
    densityScore: density.score,
    densityLabel: density.label,
    chamberCategory: categorizeEntry({ ...entryBase, densityLabel: density.label }),
  };
  const hierarchicalEntries = {
    ...(state.hierarchicalEntries ?? {}),
    [period]: [...(state.hierarchicalEntries?.[period] ?? []), entry],
  };
  return {
    ...state,
    hierarchicalEntries,
  };
}

// Daily Anchor

export function submitDailyAnchor(
  state: CitadelStateModel,
  text: string,
): CitadelStateModel {
  const trimmed = text.trim();
  if (!trimmed) return state;

  const day = state.today;
  const dayCell = ensureDayCell(state, day);

  // Idempotent — don't double-grant if already anchored
  if (dayCell.dailyAnchorComplete) return state;

  const createdAt = new Date().toISOString();
  const anchorBase = {
    id: crypto.randomUUID(),
    day,
    createdAt,
    updatedAt: createdAt,
    text: trimmed,
    tags: ['daily-anchor'],
  };
  const anchorDensity = analyzeEntryDensity(anchorBase);
  const anchorEntry = {
    ...anchorBase,
    densityScore: anchorDensity.score,
    densityLabel: anchorDensity.label,
    chamberCategory: categorizeEntry({ ...anchorBase, densityLabel: anchorDensity.label }),
  };

  const days = {
    ...state.days,
    [day]: {
      ...dayCell,
      dailyAnchorComplete: true,
      entries: [anchorEntry, ...dayCell.entries],
    },
  };

  return {
    ...state,
    days,
    fractal: buildFractalIndexV1(days),
    identity: {
      ...state.identity,
    },
  };
}

// Daily Trial

export function completeDailyTrial(state: CitadelStateModel): CitadelStateModel {
  const day = state.today;
  const dayCell = ensureDayCell(state, day);
  if (dayCell.dailyTrialComplete) return state;
  const days = {
    ...state.days,
    [day]: { ...dayCell, dailyTrialComplete: true },
  };
  return { ...state, days, fractal: buildFractalIndexV1(days) };
}

/** Days where the altar loop closed: anchor set + trial completed. Oldest first. */
export function keptDays(state: CitadelStateModel): LocalDay[] {
  return (Object.keys(state.days) as LocalDay[])
    .filter((day) => {
      const cell = state.days[day];
      return !!cell && cell.dailyAnchorComplete && !!cell.dailyTrialComplete;
    })
    .sort(compareLocalDay);
}

/** The anchor text inscribed for a day (first entry tagged daily-anchor). */
export function dayAnchorText(state: CitadelStateModel, day: LocalDay): string {
  const cell = state.days[day];
  const anchor = cell?.entries.find((e) => e.tags?.includes('daily-anchor'));
  return anchor?.text ?? '';
}

// Ritual Completion

export function completeRitual(
  state: CitadelStateModel,
  step: 'morning' | 'evening',
): CitadelStateModel {
  const alreadyDone =
    step === 'morning' ? state.ritual.morning : state.ritual.evening;
  if (alreadyDone) return state;

  const nextRitual = completeRitualStep({
    today: state.today,
    ritual: state.ritual,
    step,
  });
  const bothDone = nextRitual.morning && nextRitual.evening;

  return {
    ...state,
    ritual: nextRitual,
    identity: {
      ...state.identity,
      // Streak increments when both rituals complete for the day
      streak: bothDone ? state.identity.streak + 1 : state.identity.streak,
    },
  };
}

// Crystallize Day (The Past is Stone)

export function crystallizeDay(
  state: CitadelStateModel,
  day: LocalDay = state.today,
): CitadelStateModel {
  const dayCell = ensureDayCell(state, day);
  if (dayCell.crystallized) return state;

  const now = new Date().toISOString();
  const days = {
    ...state.days,
    [day]: {
      ...dayCell,
      locked: true,
      crystallized: true,
      crystallizedAt: now,
    },
  };

  return {
    ...state,
    days,
    fractal: buildFractalIndexV1(days),
  };
}

// Midnight Rollover

export function rolloverToToday(
  state: CitadelStateModel,
  now?: Date,
): CitadelStateModel {
  const clockNow = now ?? getClockNow();
  const today = resolveWritableDay(clockNow);
  if (today === state.today) return state;

  // Lock and crystallize all past days
  const days = { ...state.days };
  const nowIso = clockNow.toISOString();
  for (const day of Object.keys(days) as LocalDay[]) {
    if (compareLocalDay(day, today) < 0) {
      days[day] = {
        ...days[day],
        locked: true,
        crystallized: true,
        crystallizedAt: days[day].crystallizedAt ?? nowIso,
      };
    }
  }

  // Ensure today's cell exists
  if (!days[today]) {
    days[today] = { day: today, entries: [], locked: false, dailyAnchorComplete: false, dailyTrialComplete: false };
  }

  // Streak: if yesterday's rituals were NOT both complete, break the streak
  const yesterday = state.today;
  const yesterdayRitual = state.ritual;
  const yesterdayComplete =
    yesterdayRitual.day === yesterday &&
    yesterdayRitual.morning &&
    yesterdayRitual.evening;

  const streak = yesterdayComplete ? state.identity.streak : 0;

  return {
    ...state,
    today,
    days,
    fractal: buildFractalIndexV1(days),
    ritual: { day: today, morning: false, evening: false },
    identity: {
      ...state.identity,
      streak,
    },
  };
}

