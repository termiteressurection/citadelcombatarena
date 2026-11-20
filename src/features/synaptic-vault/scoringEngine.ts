import type { ArchetypeName, NeuralProfile, SynapticAnswer, SynapticQuestion, SynapticVaultState } from '@/core/model/types';

const archetypes: ArchetypeName[] = ['Sensorium', 'Metaphysics', 'Vector', 'Reflection'];

function answerKey(answer: SynapticAnswer): string {
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (typeof answer.value === 'number') return String(Math.round(answer.value));
  if (Array.isArray(answer.value)) return answer.value.join('|');
  return answer.value;
}

export function calculateNeuralProfile(vault: SynapticVaultState): NeuralProfile {
  const questions = vault.decks.flatMap((deck) => deck.questions);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const sectorDensities: Record<string, number> = {};
  const archetypeScores = Object.fromEntries(archetypes.map((name) => [name, 0])) as NeuralProfile['archetypeScores'];
  const answers = Object.values(vault.answers);
  let totalDepth = 0;
  let spectrumTotal = 0;
  let spectrumCount = 0;

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) continue;
    sectorDensities[question.sector] = (sectorDensities[question.sector] ?? 0) + 1;
    totalDepth += answer.depthTimeMs;
    if (question.type === 'spectrum' && typeof answer.value === 'number') {
      spectrumTotal += answer.value;
      spectrumCount += 1;
    }
    const weights = question.archetypeWeights?.[answerKey(answer)];
    for (const archetype of archetypes) archetypeScores[archetype] += weights?.[archetype] ?? 0;
  }

  return {
    sectorDensities,
    archetypeScores,
    resonantFrequency: spectrumCount === 0 ? 0 : spectrumTotal / spectrumCount,
    totalAnswered: answers.length,
    averageDepthTimeMs: answers.length === 0 ? 0 : Math.round(totalDepth / answers.length),
  };
}

export function unansweredQuestions(vault: SynapticVaultState): SynapticQuestion[] {
  const activeDeck = vault.decks.find((deck) => deck.id === vault.activeDeckId);
  return (activeDeck?.questions ?? []).filter((question) => !vault.answers[question.id]);
}