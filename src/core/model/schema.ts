import { toLocalDay, type LocalDay } from '../time/localDay';
import { compareLocalDay } from '../time/localDay';
import type { CitadelStateModel, DayCell } from './types';
import { buildFractalIndexV1 } from './fractal';
import { createInitialSynapticVaultState } from '@/features/synaptic-vault/seedVault';

function makeDayCell(day: LocalDay, today: LocalDay): DayCell {
  return {
    day,
    entries: [],
    locked: compareLocalDay(day, today) < 0,
    dailyAnchorComplete: false,
  };
}

export function createInitialCitadelState(today = toLocalDay()): CitadelStateModel {
  const days = {
    [today]: makeDayCell(today, today),
  };
  return {
    today,
    days,
    ritual: {
      day: today,
      morning: false,
      evening: false,
    },
    identity: {
      name: 'Traveler',
      streak: 0,
    },
    globalMindMap: { nodes: [], edges: [] },
    sync: {
      conflictLogs: [],
    },
    synapticVault: createInitialSynapticVaultState(),
    fractal: buildFractalIndexV1(days),
  };
}
