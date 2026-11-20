import type { QuestionDeck, SynapticQuestion, SynapticQuestionType } from '@/core/model/types';
import { assertImportTextSize, assertImportedField, MAX_IMPORTED_RECORDS } from '@/core/persistence/importLimits';

type InputFormat = 'json' | 'csv' | 'txt';
const questionTypes = new Set<SynapticQuestionType>(['binary', 'spectrum', 'prism', 'inscription']);

function parseOptions(value: string): string[] {
  const options = value.split('|').map((option) => option.trim()).filter(Boolean);
  if (options.length > 256) throw new Error('Deck question has too many options.');
  options.forEach((option) => assertImportedField(option, 'deck option'));
  return options;
}

function csvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && source[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) {
        if (rows.length >= MAX_IMPORTED_RECORDS + 1) throw new Error('Deck exceeds the 10000-question import limit.');
        if (row.length > 64) throw new Error('Deck row has too many fields.');
        rows.push(row);
      }
      row = []; value = '';
    } else value += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function validateDeck(value: unknown): QuestionDeck {
  if (!value || typeof value !== 'object') throw new Error('Deck JSON must be an object.');
  const deck = value as Partial<QuestionDeck>;
  if (!deck.id || !deck.title || !deck.description || !deck.version || !Array.isArray(deck.questions)) {
    throw new Error('Deck requires id, title, description, version, and questions.');
  }
  if (deck.questions.length > MAX_IMPORTED_RECORDS) throw new Error('Deck exceeds the 10000-question import limit.');
  for (const [field, value] of [['deck id', deck.id], ['deck title', deck.title], ['deck description', deck.description], ['deck version', deck.version]] as const) {
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    assertImportedField(value, field);
  }
  const questions = deck.questions.map((question, index) => validateQuestion(question, deck.id!, index + 1));
  if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new Error('Deck question ids must be unique.');
  return { id: deck.id, title: deck.title, description: deck.description, version: deck.version, author: deck.author, questions };
}

function validateQuestion(value: unknown, deckId: string, row: number): SynapticQuestion {
  if (!value || typeof value !== 'object') throw new Error(`Question ${row} must be an object.`);
  const question = value as Partial<SynapticQuestion>;
  if (!question.id || !question.sector || !question.prompt || !question.type || !questionTypes.has(question.type)) {
    throw new Error(`Question ${row} requires id, sector, valid type, and prompt.`);
  }
  for (const [field, text] of [['question id', question.id], ['question sector', question.sector], ['question prompt', question.prompt]] as const) {
    if (typeof text !== 'string') throw new Error(`${field} must be text.`);
    assertImportedField(text, field);
  }
  if (question.options && (!Array.isArray(question.options) || question.options.length > 256)) throw new Error(`Question ${row} has too many options.`);
  const options = question.options?.filter((option): option is string => typeof option === 'string') ?? [];
  if (question.tags && (!Array.isArray(question.tags) || question.tags.length > 256)) throw new Error(`Question ${row} has too many tags.`);
  const tags = question.tags ?? [];
  for (const tag of tags) {
    if (typeof tag !== 'string') throw new Error(`Question ${row} has an invalid tag.`);
    assertImportedField(tag, 'deck tag');
  }
  if ((question.type === 'binary' || question.type === 'spectrum' || question.type === 'prism') && options.length < 2) {
    throw new Error(`Question ${row} needs at least two options.`);
  }
  return { ...question, deckId, options: options.length ? options : undefined, difficulty: Number(question.difficulty) || 1, tags } as SynapticQuestion;
}

function generatedDeck(questions: SynapticQuestion[]): QuestionDeck {
  return { id: `import-${Date.now().toString(36)}`, title: 'Imported Synaptic Deck', description: 'Imported question deck.', version: '1.0.0', questions };
}

function parseCsv(source: string): QuestionDeck {
  const [header, ...rows] = csvRows(source);
  if (rows.length > MAX_IMPORTED_RECORDS) throw new Error('Deck exceeds the 10000-question import limit.');
  const indexes = Object.fromEntries(header.map((name, index) => [name.trim().toLowerCase(), index]));
  for (const name of ['sector', 'type', 'prompt']) if (indexes[name] === undefined) throw new Error(`CSV is missing the ${name} column.`);
  const questions = rows.map((row, index) => validateQuestion({
    id: `csv-${index + 1}`, sector: row[indexes.sector], type: row[indexes.type]?.toLowerCase(), prompt: row[indexes.prompt],
    options: parseOptions(row[indexes.options] ?? ''), difficulty: Number(row[indexes.difficulty] ?? 1), tags: parseOptions(row[indexes.tags] ?? ''),
  }, 'csv-import', index + 2));
  return { ...generatedDeck(questions), id: 'csv-import' };
}

function parseText(source: string): QuestionDeck {
  let separators = 0;
  for (const match of source.matchAll(/^---\s*$/gm)) {
    separators += 1;
    if (separators > MAX_IMPORTED_RECORDS) throw new Error('Deck exceeds the 10000-question import limit.');
  }
  const chunks = source.split(/^---\s*$/m).map((chunk) => chunk.trim()).filter(Boolean);
  const questions = chunks.map((chunk, index) => {
    const fields = Object.fromEntries(chunk.split(/\r?\n/).map((line) => {
      const colon = line.indexOf(':');
      return colon < 0 ? ['', ''] : [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
    }));
    return validateQuestion({ id: fields.id || `txt-${index + 1}`, sector: fields.sector, type: fields.type?.toLowerCase(), prompt: fields.prompt, options: parseOptions(fields.options ?? ''), difficulty: Number(fields.difficulty ?? 1), tags: parseOptions(fields.tags ?? '') }, 'txt-import', index + 1);
  });
  if (questions.length === 0) throw new Error('TXT deck needs at least one --- delimited question.');
  return { ...generatedDeck(questions), id: 'txt-import' };
}

export function parseSynapticDeck(source: string, format: InputFormat): QuestionDeck {
  assertImportTextSize(source, 'Synaptic deck');
  if (!source.trim()) throw new Error('Deck file is empty.');
  if (format === 'json') {
    try { return validateDeck(JSON.parse(source)); } catch (error) { throw new Error(`Invalid Synaptic JSON deck: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return format === 'csv' ? parseCsv(source) : parseText(source);
}

export const deckTemplates = {
  csv: 'Sector,Type,Prompt,Options,Difficulty,Tags\nSensorium,binary,Does this signal feel true?,Yes|No,1,signal|binary',
  txt: '---\nSector: Reflection\nType: inscription\nPrompt: What has changed in your map?\nDifficulty: 1\nTags: reflection|writing',
};
