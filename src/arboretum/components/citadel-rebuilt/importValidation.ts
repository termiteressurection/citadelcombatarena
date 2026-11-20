import { assertImportedField, MAX_IMPORTED_RECORDS } from '@/core/persistence/importLimits';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertWorldImportWithinLimits(value: unknown): asserts value is RecordValue {
  if (!isRecord(value) || !isRecord(value.chambers)) throw new Error('World import must contain a chambers object.');
  const chambers = Object.entries(value.chambers);
  if (chambers.length > MAX_IMPORTED_RECORDS) throw new Error('World import exceeds the 10000-chamber limit.');

  let thoughtCount = 0;
  for (const [id, chamber] of chambers) {
    assertImportedField(id, 'chamber id');
    if (!isRecord(chamber)) throw new Error('World import contains an invalid chamber.');
    for (const field of ['name', 'description'] as const) {
      const text = chamber[field];
      if (typeof text !== 'string') throw new Error(`World import chamber ${field} must be text.`);
      assertImportedField(text, `chamber ${field}`);
    }
    if (!Array.isArray(chamber.thoughts) || !Array.isArray(chamber.doors)) throw new Error('World import chamber lists are invalid.');
    thoughtCount += chamber.thoughts.length;
    if (thoughtCount > MAX_IMPORTED_RECORDS) throw new Error('World import exceeds the 10000-thought limit.');
    if (chamber.doors.length > MAX_IMPORTED_RECORDS) throw new Error('World import chamber exceeds the 10000-door limit.');
    for (const thought of chamber.thoughts) {
      if (!isRecord(thought) || typeof thought.text !== 'string') throw new Error('World import contains an invalid thought.');
      assertImportedField(thought.text, 'thought text');
    }
  }
}
