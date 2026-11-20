import { useCallback, useMemo } from 'react';
import { useCitadelStore } from '../store';
import { findDayChamberIdByLocalDate, isOrganicUserThought } from '../calendarChamberUtils';
import { getChamberIdForDate } from './useCitadelState';

export type RitualMode = 'transport-day' | 'focus-altar';

export interface RitualStatus {
  mode: RitualMode;
  label: string;
  longLabel: string;
  inTodayChamber: boolean;
  todayChamberId: number;
  todayEntryCount: number;
}

function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useRitualStatus(): RitualStatus {
  const chambers = useCitadelStore(s => s.chambers);
  const currentChamberId = useCitadelStore(s => s.currentChamberId);

  return useMemo(() => {
    const today = todayISO();
    const todayChamberId =
      findDayChamberIdByLocalDate(chambers, today) ?? getChamberIdForDate(today);
    const todayChamber = chambers[todayChamberId];
    const todayEntryCount = (todayChamber?.thoughts ?? []).filter(isOrganicUserThought).length;
    const inTodayChamber = currentChamberId === todayChamberId;

    const mode: RitualMode = inTodayChamber ? 'focus-altar' : 'transport-day';
    const label = inTodayChamber ? 'Day Altar [R]' : "Today's Chamber [R]";
    const longLabel = inTodayChamber
      ? 'Open the Day Chamber Altar to inscribe today’s memories.'
      : 'Transport to today’s Day Chamber.';

    return {
      mode,
      label,
      longLabel,
      inTodayChamber,
      todayChamberId,
      todayEntryCount,
    };
  }, [chambers, currentChamberId]);
}

type OpenAltarFeature = (
  id: 'altar',
  props?: Record<string, unknown>,
) => void;

export function useRitualRouter(
  openFeature: OpenAltarFeature,
  enterChamber?: (id: number) => void,
) {
  const status = useRitualStatus();

  const trigger = useCallback(() => {
    if (!status.inTodayChamber && enterChamber) {
      enterChamber(status.todayChamberId);
      return;
    }
    openFeature('altar', { day: todayISO() });
  }, [status.inTodayChamber, status.todayChamberId, enterChamber, openFeature]);

  return { status, trigger };
}
