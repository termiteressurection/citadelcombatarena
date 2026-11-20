export type SocraticState = 'reflect' | 'challenge' | 'reframe' | 'goDeeper';
export type SigmaArchetype = 'Sensorium' | 'Metaphysics' | 'Vector' | 'Reflection';

export interface DialogueSource {
  text: string;
  date: string;
  tags?: readonly string[];
}

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface DialoguePattern {
  statement: string;
  supportingEvidence: readonly DialogueSource[];
  counterexampleEvidence: readonly DialogueSource[];
}

export interface DialogueRequest {
  message: string;
  entries: readonly DialogueSource[];
  history?: readonly DialogueTurn[];
  patterns?: readonly DialoguePattern[];
}

export interface DialogueTemplate {
  id: string;
  state: SocraticState;
  archetype: SigmaArchetype;
  slots: readonly ['{evidence}', '{question}'];
  opener: string;
  question: string;
}

const ARCHETYPES: readonly SigmaArchetype[] = ['Sensorium', 'Metaphysics', 'Vector', 'Reflection'];
const STATES: readonly SocraticState[] = ['reflect', 'challenge', 'reframe', 'goDeeper'];

const ARCHETYPE_OPENERS: Record<SigmaArchetype, readonly string[]> = {
  Sensorium: ['The page has a texture here.', 'A small signal reaches the senses.', 'There is a sound in this detail.', 'The body left a useful mark.'],
  Metaphysics: ['A question of meaning sits here.', 'The larger shape remains open.', 'This thought leaves room around it.', 'The old riddle has fresh ink.'],
  Vector: ['A direction appears on the page.', 'There is a next step hiding here.', 'The path has a visible fork.', 'A practical thread is within reach.'],
  Reflection: ['A quiet thread surfaced.', 'Your own words make a good lantern.', 'One detail is worth turning over.', 'The page kept this small mark.'],
};

const STATE_OPENERS: Record<SocraticState, readonly string[]> = {
  reflect: ['Here is what the record holds:', 'Your inscription says:', 'This line came from your page:', 'The journal keeps this wording:'],
  challenge: ['The record holds a contrast:', 'These two entries read differently:', 'A change in wording appears here:', 'The dates preserve two different notes:'],
  reframe: ['Try holding the thought lightly:', 'A beginner’s view might start here:', 'For a moment, set the label down:', 'A Stoic pause leaves this question open:'],
  goDeeper: ['Let us stay with the detail:', 'There may be another layer to ask about:', 'The first answer can wait a moment:', 'One careful question remains:'],
};

const QUESTIONS: readonly string[] = [
  'What part feels most present now?', 'What changed between those days?', 'Which detail would you keep?',
  'What might you be assuming here?', 'What would a first-time observer notice?', 'Where does this meet today?',
  'What would count as enough evidence?', 'Which part is yours to choose?', 'What remains true if you simplify it?',
  'What question have you not asked yet?', 'What would you tell a friend in this place?', 'What can wait until tomorrow?',
  'What is the smallest next step?', 'Which word deserves a second look?', 'What did the page leave unsaid?',
  'What is within your reach today?', 'What would make this view more complete?', 'What did you notice first?',
  'What would you like to test gently?', 'What feels different as you read it now?', 'Which detail resists your first answer?',
  'What would you ask the earlier version of you?', 'What else belongs beside this line?', 'Where should we look next?',
];

/** 4 archetypes × 4 dialogue states × 24 slot combinations = 384 unique templates. */
export const SOCRATIC_TEMPLATE_BANK: readonly DialogueTemplate[] = ARCHETYPES.flatMap(archetype =>
  STATES.flatMap(state => Array.from({ length: QUESTIONS.length }, (_, variant) => ({
    id: `${archetype.toLowerCase()}-${state}-${String(variant).padStart(2, '0')}`,
    state,
    archetype,
    slots: ['{evidence}', '{question}'] as const,
    opener: `${ARCHETYPE_OPENERS[archetype][variant % ARCHETYPE_OPENERS[archetype].length]} ${STATE_OPENERS[state][variant % STATE_OPENERS[state].length]}`,
    question: QUESTIONS[variant],
  }))),
);

const TOKEN_RE = /[\p{L}\p{N}]+/gu;
const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'but', 'could', 'from', 'have', 'into', 'that', 'the', 'then', 'there', 'these', 'this', 'those', 'when', 'where', 'which', 'with', 'would', 'your']);
const POSITIVE = new Set(['calm', 'energized', 'good', 'happy', 'hopeful', 'enjoyed', 'rested', 'proud', 'relieved', 'peaceful', 'easy']);
const NEGATIVE = new Set(['anxious', 'dread', 'drained', 'exhausted', 'fail', 'hard', 'hated', 'lonely', 'sad', 'tired', 'worried', 'empty', 'difficult']);

function terms(text: string): string[] {
  return (text.toLocaleLowerCase('en-US').match(TOKEN_RE) ?? []).filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

function dateLabel(date: string): string {
  const day = date.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parsed.getTime())) return day || 'undated';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function extractKeySentence(entry: DialogueSource, queryTerms: readonly string[]): string {
  const parts = entry.text.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [entry.text];
  const needle = new Set(queryTerms);
  let best = parts[0] ?? entry.text;
  let bestScore = -1;
  for (const part of parts) {
    const score = terms(part).reduce((count, term) => count + Number(needle.has(term)), 0);
    if (score > bestScore) {
      best = part;
      bestScore = score;
    }
  }
  return best.trim();
}

function valence(entry: DialogueSource): -1 | 0 | 1 {
  const tokens = new Set(terms(entry.text));
  if ([...tokens].some(token => NEGATIVE.has(token))) return -1;
  if ([...tokens].some(token => POSITIVE.has(token))) return 1;
  return 0;
}

function selectState(message: string, entries: readonly DialogueSource[], history: readonly DialogueTurn[]): SocraticState {
  const low = message.toLocaleLowerCase('en-US');
  if (/\b(reframe|another perspective|stoic|beginner.?s mind|different lens)\b/.test(low)) return 'reframe';
  const polarities = new Set(entries.map(valence).filter(value => value !== 0));
  if (entries.length > 1 && (polarities.has(-1) && polarities.has(1) || /\b(changed|different|contrast|before|used to|compared)\b/.test(low))) return 'challenge';
  if (history.some(turn => turn.role === 'assistant')) return 'goDeeper';
  return 'reflect';
}

function selectArchetype(message: string): SigmaArchetype {
  const low = message.toLocaleLowerCase('en-US');
  if (/\b(sound|smell|taste|touch|body|color|weather|rain|heat|cold)\b/.test(low)) return 'Sensorium';
  if (/\b(meaning|existence|soul|universe|death|truth|god|consciousness|why)\b/.test(low)) return 'Metaphysics';
  if (/\b(goal|plan|work|build|next step|progress|practice|habit)\b/.test(low)) return 'Vector';
  return 'Reflection';
}

export class SocraticDialogueManager {
  private cursor = 0;
  private recentIds: string[] = [];

  reply(request: DialogueRequest, matchedEntries: readonly DialogueSource[]): string {
    const state = selectState(request.message, matchedEntries, request.history ?? []);
    const archetype = selectArchetype(request.message);
    const templates = SOCRATIC_TEMPLATE_BANK.filter(template => template.state === state && template.archetype === archetype);
    const template = this.nextTemplate(templates);
    const queryTerms = terms(request.message);
    const sources = matchedEntries.slice(0, state === 'challenge' ? 2 : 5);
    const evidence = request.patterns?.[0]
      ? [
        request.patterns[0].statement,
        ...request.patterns[0].supportingEvidence.slice(0, 1).map(entry => `Supporting stone, ${dateLabel(entry.date)}: “${entry.text}”`),
        ...request.patterns[0].counterexampleEvidence.slice(0, 1).map(entry => `A counterexample, ${dateLabel(entry.date)}: “${entry.text}”`),
      ].join('\n')
      : sources.length
      ? sources.map(entry => `You wrote on ${dateLabel(entry.date)}: “${extractKeySentence(entry, queryTerms)}”`).join('\n')
      : 'No matching stone surfaced in the journal yet.';
    return `${template.opener}\n${evidence}\n${template.question}`;
  }

  private nextTemplate(templates: readonly DialogueTemplate[]): DialogueTemplate {
    const cooled = new Set(this.recentIds);
    let selected = templates[this.cursor % templates.length];
    for (let step = 0; step < templates.length && cooled.has(selected.id); step += 1) {
      this.cursor += 1;
      selected = templates[this.cursor % templates.length];
    }
    this.cursor += 1;
    this.recentIds.push(selected.id);
    if (this.recentIds.length > 20) this.recentIds.shift();
    return selected;
  }
}

