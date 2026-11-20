import type { CitadelStateModel, QuestionDeck, SynapticAnswer, SynapticQuestion } from '../model/types';
import { generateSynthesisPrompt } from '@/features/synaptic-vault/synthesisEngine';

function vaultOf(state: CitadelStateModel) {
  if (!state.synapticVault) throw new Error('Synaptic Vault state is unavailable');
  return state.synapticVault;
}

export function recordSynapticAnswer(state: CitadelStateModel, answer: SynapticAnswer): CitadelStateModel {
  const vault = vaultOf(state);
  return { ...state, synapticVault: { ...vault, answers: { ...vault.answers, [answer.questionId]: answer } } };
}

export function importSynapticDeck(state: CitadelStateModel, deck: QuestionDeck): CitadelStateModel {
  const vault = vaultOf(state);
  const decks = vault.decks.filter((existing) => existing.id !== deck.id);
  return { ...state, synapticVault: { ...vault, decks: [...decks, deck], activeDeckId: deck.id } };
}

export function deleteSynapticDeck(state: CitadelStateModel, deckId: string): CitadelStateModel {
  const vault = vaultOf(state);
  if (deckId === 'citadel-seed-v1') return state;
  const decks = vault.decks.filter((deck) => deck.id !== deckId);
  return { ...state, synapticVault: { ...vault, decks, activeDeckId: vault.activeDeckId === deckId ? decks[0]?.id ?? '' : vault.activeDeckId } };
}

export function saveCustomSynapticQuestion(state: CitadelStateModel, question: SynapticQuestion): CitadelStateModel {
  const vault = vaultOf(state);
  const deck = vault.decks.find((candidate) => candidate.id === question.deckId);
  if (!deck) throw new Error(`Unknown Synaptic deck: ${question.deckId}`);
  const questions = [...deck.questions.filter((candidate) => candidate.id !== question.id), question];
  return importSynapticDeck(state, { ...deck, questions });
}

export function synthesizeSynapticPrompt(state: CitadelStateModel): CitadelStateModel {
  const vault = vaultOf(state);
  const question = generateSynthesisPrompt(vault);
  if (!question) return state;
  return { ...state, synapticVault: { ...vault, synthesizedQuestions: [...vault.synthesizedQuestions, question] } };
}

export function resetSynapticDeckProgress(state: CitadelStateModel, deckId: string): CitadelStateModel {
  const vault = vaultOf(state);
  const questionIds = new Set(vault.decks.find((deck) => deck.id === deckId)?.questions.map((question) => question.id) ?? []);
  const answers = Object.fromEntries(Object.entries(vault.answers).filter(([questionId]) => !questionIds.has(questionId)));
  return { ...state, synapticVault: { ...vault, answers } };
}