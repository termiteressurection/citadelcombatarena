import type { Chamber, GridIdentity, Thought } from '../types';
import {
  generateLeashedSigmaReply,
  type CitationChipData,
} from '@/core/sigma/sigmaLeash';
import type { CitadelContentSourceType, HarvestedCitadelItem } from '@/core/sigma/citadelStoreHarvester';

export type Topic = string;

export interface SigmaState {
  turnCount: number;
  topicHistory: string[];
  userMessages: string[];
}

export const INITIAL_SIGMA_STATE: SigmaState = {
  turnCount: 0,
  topicHistory: [],
  userMessages: [],
};

export function detectTopic(message: string): Topic {
  const text = message.toLocaleLowerCase('en-US');
  if (/\b(hello|hey|hi|yo)\b/.test(text)) return 'greeting';
  if (/\b(how are you|how's it going|how are things)\b/.test(text)) return 'checkin';
  if (/\b(story|parable)\b/.test(text)) return 'story';
  if (/\b(poem|poetry)\b/.test(text)) return 'poem';
  if (/\b(work|focus|discipline|code|project)\b/.test(text)) return 'work';
  if (/\b(stress|stressed|burned out|overwhelm)\b/.test(text)) return 'stress';
  if (/\b(game|play)\b/.test(text)) return 'games';
  if (/\b(death|die|dying)\b/.test(text)) return 'death';
  if (/\b(fear|afraid|scared)\b/.test(text)) return 'fear';
  return 'fallback';
}

/**
 * Rebuilt Sigma reply engine with the Leash Protocol and structured citations.
 * Never outputs raw database IDs or ISO timestamps into the reply text.
 */
export async function generateSigmaReplyAsync(
  message: string,
  _chamber?: Chamber,
  _identity?: GridIdentity,
  _thoughts?: Thought[],
  state: SigmaState = INITIAL_SIGMA_STATE,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  _allJournalThoughts?: Thought[],
  onStreamToken?: (token: string) => void,
): Promise<{ reply: string; newState: SigmaState; citations: CitationChipData[] }> {
  const pool = _allJournalThoughts && _allJournalThoughts.length > 0 ? _allJournalThoughts : _thoughts || [];
  const harvestedItems: HarvestedCitadelItem[] = [];

  for (const t of pool) {
    let sType: CitadelContentSourceType = 'journal';
    if (t.text.startsWith('[Synaptic Vault')) sType = 'synaptic';
    else if (t.text.startsWith('[Mind Map')) sType = 'mindmap';
    else if (t.text.startsWith('[Citadel Altar') || t.text.startsWith('[Daily Rituals')) sType = 'activity';
    else if (t.text.startsWith('[Traveler Profile')) sType = 'profile';

    harvestedItems.push({
      id: t.id,
      text: t.text,
      sourceDate: t.sourceDate || (t.timestamp ? t.timestamp.slice(0, 10) : 'Past Stone'),
      sourceType: sType,
      timestamp: t.timestamp,
      tags: t.tags,
    });
  }

  const { text, citations } = await generateLeashedSigmaReply(
    message,
    history,
    onStreamToken,
    harvestedItems,
  );

  const topic = detectTopic(message);
  const newState: SigmaState = {
    turnCount: state.turnCount + 1,
    topicHistory: [...state.topicHistory, topic].slice(-20),
    userMessages: [...state.userMessages, message.trim()].slice(-20),
  };

  return { reply: text, newState, citations };
}
