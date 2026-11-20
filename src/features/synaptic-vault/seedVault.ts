import type { QuestionDeck, SynapticQuestion, SynapticVaultState } from '@/core/model/types';

const ARCHETYPES = ['Sensorium', 'Metaphysics', 'Vector', 'Reflection'] as const;

function question(
  id: string,
  sector: string,
  type: SynapticQuestion['type'],
  prompt: string,
  options: string[] = [],
): SynapticQuestion {
  const archetype = ARCHETYPES[(Number(id.slice(-1)) || 0) % ARCHETYPES.length];
  return {
    id,
    sector,
    type,
    prompt,
    options: options.length > 0 ? options : undefined,
    difficulty: 1,
    tags: [sector.toLowerCase(), type],
    deckId: 'citadel-seed-v1',
    archetypeWeights: Object.fromEntries(
      (options.length > 0 ? options : ['true', 'false']).map((option, index) => [
        option,
        { [archetype]: index === 0 ? 2 : 1 },
      ]),
    ),
  };
}

const sensorium = [
  'Does silence have a texture?', 'Do you trust a first bodily signal?', 'Does a room change before words do?',
  'Is intuition a form of evidence?', 'Do dreams retain useful weather?', 'Can attention be trained like balance?',
  'Do you notice the tone beneath a conversation?',
].map((prompt, index) => question(`seed-s-${index + 1}`, 'Sensorium', 'binary', prompt, ['Yes', 'No']));

const metaphysics = [
  'Meaning is discovered rather than made.', 'A contradiction can be productive.', 'The self is continuous across change.',
  'Order emerges without a central author.', 'Mystery is a useful category.', 'A map can change its territory.',
  'A belief should survive contact with doubt.',
].map((prompt, index) => question(`seed-m-${index + 1}`, 'Metaphysics', 'spectrum', prompt, ['1', '2', '3', '4', '5']));

const vectors = [
  ['Which power feels most native?', ['Witness', 'Build', 'Transform', 'Connect']],
  ['When a system fails, you first...', ['Observe', 'Repair', 'Reframe', 'Gather']],
  ['Your preferred frontier is...', ['Perception', 'Theory', 'Action', 'Relationship']],
  ['A difficult truth calls for...', ['Patience', 'Precision', 'Courage', 'Care']],
  ['Choose a working element.', ['Signal', 'Lattice', 'Vector', 'Horizon']],
  ['A legacy is best measured by...', ['Clarity', 'Structure', 'Momentum', 'Resonance']],
  ['A new problem asks you to...', ['Listen', 'Model', 'Experiment', 'Invite']],
] as const;
const prism = vectors.map(([prompt, options], index) => question(`seed-v-${index + 1}`, 'Vector', 'prism', prompt, [...options]));

const horizons = [
  'Describe a question that has followed you for years.', 'What does a life with enough attention look like?',
  'Name a pattern you are ready to interrupt.', 'What signal are you learning to trust?',
  'Write an instruction your future self would recognize.', 'Where does your current map become uncertain?',
  'What would you protect even if no one noticed?',
].map((prompt, index) => question(`seed-r-${index + 1}`, 'Reflection', 'inscription', prompt));

export const seedVaultDeck: QuestionDeck = {
  id: 'citadel-seed-v1',
  title: 'Citadel Seed Vault',
  description: 'Twenty-eight foundational dialectics across four sectors.',
  version: '1.0.0',
  author: 'Citadel',
  questions: [...sensorium, ...metaphysics, ...prism, ...horizons],
};

export function createInitialSynapticVaultState(): SynapticVaultState {
  return {
    decks: [seedVaultDeck],
    activeDeckId: seedVaultDeck.id,
    answers: {},
    synthesizedQuestions: [],
  };
}