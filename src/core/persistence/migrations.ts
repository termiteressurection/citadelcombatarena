import { compareLocalDay, toLocalDay, type LocalDay } from '../time/localDay';
import { buildFractalIndexV1 } from '../model/fractal';
import { createInitialCitadelState } from '../model/schema';
import type { CitadelStateModel, DayCell, MindNode, MindEdge, QuestionDeck, SynapticAnswer, SynapticVaultState, Mindmap3dState, Mindmap3dNode, Mindmap3dEdge } from '../model/types';
import { analyzeEntryDensity, categorizeEntry } from '../rules/librarian';
import { createInitialSynapticVaultState } from '@/features/synaptic-vault/seedVault';

export const CURRENT_STORAGE_VERSION = 1;
export const CURRENT_SCHEMA_VERSION = 2;

export interface StoredEnvelopeV1 {
  version: 1;
  state: CitadelStateModel;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asLocalDay(value: unknown, fallback: LocalDay): LocalDay {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? (value as LocalDay) : fallback;
}

function asConstellationCategory(value: unknown): CitadelStateModel['days'][LocalDay]['entries'][number]['chamberCategory'] {
  return value === 'WORK' ||
    value === 'RITUAL' ||
    value === 'MEMORY' ||
    value === 'BOSS_THREAT' ||
    value === 'GOLDEN_SIGNAL'
    ? value
    : undefined;
}

function normalizeDayCell(day: LocalDay, value: unknown, today: LocalDay): DayCell {
  if (!isRecord(value)) {
    return { day, entries: [], locked: compareLocalDay(day, today) < 0, dailyAnchorComplete: false };
  }
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const dailyAnchorComplete = Boolean(value.dailyAnchorComplete);
  return {
    day,
    entries: entries.filter(isRecord).map((entry) => {
      const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
      const baseEntry = {
        id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
        day,
        createdAt,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : createdAt,
        text: typeof entry.text === 'string' ? entry.text : '',
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      };
      const density = analyzeEntryDensity(baseEntry);
      return {
        id: baseEntry.id,
        day,
        createdAt,
        // backfill updatedAt for entries created before this field existed
        updatedAt: baseEntry.updatedAt,
        text: baseEntry.text,
        tags: baseEntry.tags,
        migrationConflict: entry.migrationConflict === true,
        originalId: typeof entry.originalId === 'string' ? entry.originalId : undefined,
        densityScore: density.score,
        densityLabel: density.label,
        chamberCategory: asConstellationCategory(entry.chamberCategory)
          ?? categorizeEntry({ ...baseEntry, densityLabel: density.label }),
      };
    }),
    locked: compareLocalDay(day, today) < 0,
    dailyAnchorComplete,
  };
}

function isQuestionDeck(value: unknown): value is QuestionDeck {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.version === 'string' &&
    Array.isArray(value.questions);
}

function normalizeSynapticVault(value: unknown): SynapticVaultState {
  const fallback = createInitialSynapticVaultState();
  if (!isRecord(value)) return fallback;
  const decks = Array.isArray(value.decks)
    ? value.decks.filter(isQuestionDeck)
    : fallback.decks;
  const answers: Record<string, SynapticAnswer> = {};
  if (isRecord(value.answers)) {
    for (const [questionId, answer] of Object.entries(value.answers)) {
      if (!isRecord(answer) || answer.questionId !== questionId || typeof answer.timestamp !== 'string') continue;
      if (typeof answer.value !== 'boolean' && typeof answer.value !== 'number' && typeof answer.value !== 'string' && !Array.isArray(answer.value)) continue;
      answers[questionId] = {
        questionId,
        timestamp: answer.timestamp,
        value: answer.value as SynapticAnswer['value'],
        depthTimeMs: typeof answer.depthTimeMs === 'number' && answer.depthTimeMs >= 0 ? answer.depthTimeMs : 0,
        dialecticNotes: typeof answer.dialecticNotes === 'string' ? answer.dialecticNotes : undefined,
      };
    }
  }
  const activeDeckId = typeof value.activeDeckId === 'string' && decks.some((deck) => deck.id === value.activeDeckId)
    ? value.activeDeckId
    : decks[0]?.id ?? fallback.activeDeckId;
  return {
    decks: decks.length > 0 ? decks : fallback.decks,
    activeDeckId,
    answers,
    synthesizedQuestions: Array.isArray(value.synthesizedQuestions) ? value.synthesizedQuestions as SynapticVaultState['synthesizedQuestions'] : [],
  };
}

export function normalizeState(value: unknown): CitadelStateModel {
  const fallback = createInitialCitadelState();
  if (!isRecord(value)) return fallback;

  const today = asLocalDay(value.today, fallback.today);
  const daysInput = isRecord(value.days) ? value.days : {};
  const days: CitadelStateModel['days'] = {};
  for (const [rawDay, rawCell] of Object.entries(daysInput)) {
    const day = asLocalDay(rawDay, today);
    days[day] = normalizeDayCell(day, rawCell, today);
  }
  if (!days[today]) {
    days[today] = normalizeDayCell(today, {}, today);
  }

  const ritualInput = isRecord(value.ritual) ? value.ritual : {};
  const ritualDay = asLocalDay(ritualInput.day, today);
  const ritualIsCurrentDay = ritualDay === today;
  const identityInput = isRecord(value.identity) ? value.identity : {};
  const syncInput = isRecord(value.sync) ? value.sync : {};
  const rawConflictLogs = Array.isArray(syncInput.conflictLogs) ? syncInput.conflictLogs : [];
  const conflictLogs = rawConflictLogs
    .filter(isRecord)
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
      entryId: typeof row.entryId === 'string' ? row.entryId : '',
      day: asLocalDay(row.day, today),
      at: typeof row.at === 'string' ? row.at : new Date().toISOString(),
      reason: 'lww_overwrite' as const,
      replaced: isRecord(row.replaced)
        ? {
            text: typeof row.replaced.text === 'string' ? row.replaced.text : '',
            updatedAt: typeof row.replaced.updatedAt === 'string' ? row.replaced.updatedAt : new Date().toISOString(),
          }
        : { text: '', updatedAt: new Date().toISOString() },
      incoming: isRecord(row.incoming)
        ? {
            text: typeof row.incoming.text === 'string' ? row.incoming.text : '',
            updatedAt: typeof row.incoming.updatedAt === 'string' ? row.incoming.updatedAt : new Date().toISOString(),
          }
        : { text: '', updatedAt: new Date().toISOString() },
    }))
    .filter((row) => row.entryId.length > 0);

  const globalMindMapInput = isRecord(value.globalMindMap) ? value.globalMindMap : {};
  const globalMindMap = {
    nodes: Array.isArray(globalMindMapInput.nodes) ? globalMindMapInput.nodes as MindNode[] : [],
    edges: Array.isArray(globalMindMapInput.edges) ? globalMindMapInput.edges as MindEdge[] : []
  };

  let mindmap3d: Mindmap3dState | undefined;
  if (isRecord(value.mindmap3d) && isRecord(value.mindmap3d.nodes)) {
    mindmap3d = {
      nodes: value.mindmap3d.nodes as Record<string, Mindmap3dNode>,
      edges: (isRecord(value.mindmap3d.edges) ? value.mindmap3d.edges : {}) as Record<string, Mindmap3dEdge>,
      order: Array.isArray(value.mindmap3d.order)
        ? (value.mindmap3d.order as string[])
        : Object.keys(value.mindmap3d.nodes),
      ...(typeof value.mindmap3d.activeMapId === 'string' && isRecord(value.mindmap3d.maps)
        ? {
            activeMapId: value.mindmap3d.activeMapId,
            maps: value.mindmap3d.maps as Mindmap3dState['maps'],
            stash: (isRecord(value.mindmap3d.stash) ? value.mindmap3d.stash : {}) as Mindmap3dState['stash'],
          }
        : {}),
    };
  }

  const next: CitadelStateModel = {
    today,
    days,
    ritual: {
      day: today,
      morning: ritualIsCurrentDay ? Boolean(ritualInput.morning) : false,
      evening: ritualIsCurrentDay ? Boolean(ritualInput.evening) : false,
    },
    identity: {
      name: typeof identityInput.name === 'string' ? identityInput.name : 'Traveler',
      streak: typeof identityInput.streak === 'number' ? identityInput.streak : 0,
      mbti: typeof identityInput.mbti === 'string' ? identityInput.mbti : undefined,
    },
    sync: {
      conflictLogs,
    },
    synapticVault: normalizeSynapticVault(value.synapticVault),
    fractal: buildFractalIndexV1(days),
    globalMindMap,
    ...(mindmap3d ? { mindmap3d } : {}),
  };
  return next;
}

export function migrateStoredState(raw: unknown): CitadelStateModel | null {
  if (!isRecord(raw)) return null;

  if (typeof raw.version === 'number' && raw.version >= 1 && isRecord(raw.state)) {
    return normalizeState(raw.state);
  }

  if ('today' in raw && 'days' in raw && 'ritual' in raw && 'identity' in raw) {
    return normalizeState(raw);
  }

  return null;
}

export function migrateOrFresh(raw: unknown): CitadelStateModel {
  const migrated = migrate(raw as UnknownRecord);
  return validateMigratedState(migrated) ?? createInitialCitadelState();
}

export function toStoredEnvelope(state: CitadelStateModel): StoredEnvelopeV1 {
  return {
    version: CURRENT_STORAGE_VERSION,
    state: normalizeState({ ...state, today: asLocalDay(state.today, toLocalDay()) }),
  };
}

export function migrate(raw: UnknownRecord): CitadelStateModel & { schemaVersion: number } {
  const core = migrateStoredState(raw) ?? normalizeState(raw);
  return {
    ...core,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function validateMigratedState(state: unknown): CitadelStateModel | null {
  if (!isRecord(state)) return null;
  if (typeof state.today !== 'string') return null;
  if (!isRecord(state.days)) return null;
  if (!isRecord(state.ritual)) return null;
  if (!isRecord(state.identity)) return null;
  return normalizeState(state);
}
