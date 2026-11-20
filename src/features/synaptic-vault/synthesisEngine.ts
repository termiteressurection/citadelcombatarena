import type { SynapticQuestion, SynapticVaultState } from '@/core/model/types';
import { calculateNeuralProfile, unansweredQuestions } from './scoringEngine';

export function generateSynthesisPrompt(vault: SynapticVaultState): SynapticQuestion | null {
  const unanswered = unansweredQuestions(vault);
  if (unanswered.length === 0) return null;
  const profile = calculateNeuralProfile(vault);
  const leastExploredSector = ['Sensorium', 'Metaphysics', 'Vector', 'Reflection']
    .sort((left, right) => (profile.sectorDensities[left] ?? 0) - (profile.sectorDensities[right] ?? 0))[0];
  const candidate = unanswered.find((question) => question.sector === leastExploredSector) ?? unanswered[0];
  return {
    ...candidate,
    id: `synthesis-${candidate.id}-${profile.totalAnswered}`,
    deckId: 'citadel-synthesis',
    prompt: profile.totalAnswered < 4
      ? candidate.prompt
      : `Given your current signal, ${candidate.prompt.charAt(0).toLowerCase()}${candidate.prompt.slice(1)}`,
    tags: [...candidate.tags, 'synthesized'],
  };
}