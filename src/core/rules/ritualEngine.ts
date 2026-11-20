import type { LocalDay } from '../time/localDay';
import type { RitualPhase, RitualRecord } from '../model/types';

export interface RitualStatus {
  phase: RitualPhase;
  sealed: boolean;
  morningDone: boolean;
  eveningDone: boolean;
}

export interface RitualEngineInput {
  today: LocalDay;
  ritual: RitualRecord | null | undefined;
  hour24?: number;
  duskHour24?: number;
}

export function getRitualStatus(input: RitualEngineInput): RitualStatus {
  const { today, ritual } = input;
  const hour = input.hour24 ?? new Date().getHours();
  const dusk = input.duskHour24 ?? 15;

  const isTodayRecord = !!ritual && ritual.day === today;
  const morningDone = !!(isTodayRecord && ritual?.morning);
  const eveningDone = !!(isTodayRecord && ritual?.evening);

  let phase: RitualPhase = 'morning';
  if (!morningDone) phase = 'morning';
  else if (!eveningDone) phase = hour < dusk ? 'midday' : 'reflect';
  else phase = 'commune';

  return {
    phase,
    sealed: morningDone && eveningDone,
    morningDone,
    eveningDone,
  };
}

export function completeRitualStep(params: {
  today: LocalDay;
  ritual: RitualRecord | null | undefined;
  step: 'morning' | 'evening';
}): RitualRecord {
  const { today, ritual, step } = params;
  const base: RitualRecord =
    ritual && ritual.day === today
      ? ritual
      : { day: today, morning: false, evening: false };

  if (step === 'morning') return { ...base, morning: true };
  return { ...base, evening: true };
}
