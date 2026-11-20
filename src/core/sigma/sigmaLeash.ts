import { semanticSearch, type ScoredEntryMatch } from '@/core/semantic/semanticClient';
import { loadPlayerModel, getPlayerModelSync } from '@/core/player-model/playerModelStore';
import { streamGenerativeVoice, getGenerativeVoiceStatus } from './sigmaVoiceClient';
import { PlayerModelRecord } from '@/core/player-model/playerModelTypes';
import type { HarvestedCitadelItem } from './citadelStoreHarvester';

export type CitationSourceType =
  | 'journal'
  | 'chat'
  | 'synaptic'
  | 'mindmap'
  | 'activity'
  | 'profile';

export interface CitationChipData {
  id: string;
  sourceId: string;
  sourceDate: string;
  sourceType: CitationSourceType;
  snippet: string;
  eventId?: string;
  timestamp?: string;
  provenance?: string;
  level?: string;
  period?: string;
}

export interface SigmaReplyResult {
  text: string;
  citations: CitationChipData[];
  mode: 'layer2-generative' | 'layer1-retrieval';
}

const RELEVANCE_SCORE_THRESHOLD = 0.35;

/** Checks if a message is an explicit question asking about the player's past entries or memories */
function isRecallQuery(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes('what did i write') ||
    low.includes('what did i say') ||
    low.includes('did i write') ||
    low.includes('did i mention') ||
    low.includes('when did i') ||
    low.includes('what was i working on') ||
    low.includes('what am i supposed to') ||
    low.includes('remind me') ||
    low.includes('yesterday') ||
    low.includes('last week') ||
    low.includes('in my journal') ||
    low.includes('earlier') ||
    low.includes('synaptic') ||
    low.includes('mind map') ||
    low.includes('mindmap') ||
    low.includes('my streak') ||
    low.includes('my profile') ||
    low.includes('what did i answer')
  );
}

/** Sanitize output to guarantee zero raw database leakage (Hard Rule 4 & Grep Test) */
export function sanitizeMessageBody(raw: string): string {
  return raw
    .replace(/<\|im_start\|>[\s\S]*?(?:<\|im_end\|>|$)/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .replace(/<\|im_start\|>\s*\w*/gi, '')
    .replace(/<\|endoftext\|>/gi, '')
    .replace(/<\/s>/gi, '')
    .replace(/<\/?p>/gi, '')
    .replace(/Verified journal records:?/gi, '')
    .replace(/\[event\s+evt_[a-zA-Z0-9_-]+[^\]]*\]/gi, '')
    .replace(/evt_[a-zA-Z0-9_-]{8,}/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/gi, '')
    .replace(/^(?:player|user|assistant|sigma)\s*:\s*/gim, '')
    .replace(/^[\s\n]+/, '')
    .trim();
}

/** Format a date string into readable short text (e.g. "Oct 19") */
export function formatCitationDate(dateStr: string): string {
  if (!dateStr) return 'Past Stone';
  const clean = dateStr.slice(0, 10);
  try {
    const d = new Date(clean + 'T12:00:00Z');
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return clean;
  }
}

/** Formats citation provenance naming hierarchy level + period (e.g. "October 2026, month entry") */
export function formatCitationProvenance(pass: { day: string; level?: string; period?: string }): string {
  const level = pass.level ?? (pass.day && pass.day.length === 10 ? 'day' : 'entry');
  const period = pass.period ?? pass.day;

  if (level === 'month' || (period && /^\d{4}-\d{2}$/.test(period))) {
    const [y, m] = period.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, 1));
    const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${monthName} ${y}, month entry`;
  }

  if (level === 'season' || (period && period.includes('-') && (period.includes('WINTER') || period.includes('SPRING') || period.includes('SUMMER') || period.includes('AUTUMN')))) {
    const parts = period.split('-');
    const year = parts[0];
    const sName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    return `${sName} ${year}, season entry`;
  }

  if (level === 'year' || (period && /^\d{4}$/.test(period))) {
    return `${period}, year entry`;
  }

  return `${formatCitationDate(pass.day)}, day entry`;
}

export function formatSourceLabel(sourceType?: string): string {
  switch (sourceType) {
    case 'synaptic':
      return 'Synaptic Vault';
    case 'mindmap':
      return 'Mind Map';
    case 'activity':
      return 'Chamber Altar';
    case 'profile':
      return 'Traveler Profile';
    case 'chat':
    case 'chat.log':
      return 'prior conversation';
    case 'journal':
    default:
      return 'journal';
  }
}

/**
 * Filter semantic search results to only those that genuinely meet the relevance threshold,
 * sorted by relevance score descending.
 */
export function filterRelevantPassages(
  records: ScoredEntryMatch[] = [],
  query: string,
): ScoredEntryMatch[] {
  if (!Array.isArray(records)) return [];
  const queryTerms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);

  return records
    .filter((rec) => {
      if (!rec.text || !rec.text.trim()) return false;
      // Semantic score check
      if (rec.score >= RELEVANCE_SCORE_THRESHOLD) return true;

      // Keyword overlap check for exact terms
      const textLow = rec.text.toLowerCase();
      const matches = queryTerms.filter((term) => textLow.includes(term));
      return matches.length >= 2;
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Find player model records that bear on the current query or recent commitments
 */
export function findRelevantPlayerRecords(
  records: PlayerModelRecord[],
  query: string,
): PlayerModelRecord[] {
  const lowQuery = query.toLowerCase();
  const queryTerms = lowQuery.split(/\W+/).filter((w) => w.length > 2);

  return records.filter((rec) => {
    if (rec.status !== 'active') return false;
    const claimLow = rec.claim.toLowerCase();

    // Direct term match
    if (queryTerms.some((term) => claimLow.includes(term))) return true;

    // If query is about days/commitments
    if (
      (lowQuery.includes('friday') && claimLow.includes('friday')) ||
      (lowQuery.includes('tomorrow') && claimLow.includes('tomorrow')) ||
      (lowQuery.includes('supposed to') && rec.category === 'commitments')
    ) {
      return true;
    }

    return false;
  });
}

/**
 * Core reply generator with structural grounding and the Leash Protocol
 */
export async function generateLeashedSigmaReply(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  onStreamToken?: (token: string) => void,
  harvestedCitadelItems?: HarvestedCitadelItem[],
): Promise<SigmaReplyResult> {
  const cleanInput = userMessage.trim();
  const isRecall = isRecallQuery(cleanInput);

  // 1. Fetch episodic memory from semantic store
  let rawRecords: ScoredEntryMatch[] = [];
  try {
    const res = await semanticSearch(cleanInput, 5);
    if (Array.isArray(res)) rawRecords = res;
  } catch {
    rawRecords = [];
  }

  // Cross-reference with all harvested Citadel content stores
  if (harvestedCitadelItems && harvestedCitadelItems.length > 0) {
    const queryTerms = cleanInput.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    for (const item of harvestedCitadelItems) {
      const textLow = item.text.toLowerCase();
      const tagMatches = item.tags ? item.tags.filter((t) => queryTerms.includes(t.toLowerCase())).length : 0;
      const termMatches = queryTerms.filter((term) => textLow.includes(term)).length;

      let score = 0;
      if (termMatches >= 2 || (termMatches >= 1 && tagMatches >= 1)) {
        score = 0.5 + Math.min(0.4, (termMatches + tagMatches) * 0.1);
      } else if (
        termMatches === 1 &&
        (textLow.includes('synaptic') ||
          textLow.includes('mind map') ||
          textLow.includes('profile'))
      ) {
        score = 0.46;
      }

      if (score >= RELEVANCE_SCORE_THRESHOLD) {
        if (!rawRecords.some((r) => r.text.trim() === item.text.trim())) {
          rawRecords.push({
            id: String(item.id),
            eventId: `cit_${item.sourceType}_${item.id}`,
            text: item.text,
            day: item.sourceDate,
            score,
            source: item.sourceType,
            timestamp: item.timestamp,
            tags: item.tags || [],
            method: 'keyword',
          });
        }
      }
    }
  }

  // Relevance gating: only keep records that bear on the conversation
  const relevantPassages = isRecall
    ? filterRelevantPassages(rawRecords, cleanInput)
    : filterRelevantPassages(rawRecords, cleanInput).filter((r) => r.score >= 0.45);

  // 2. Fetch Player Model records
  await loadPlayerModel();
  const pmStore = getPlayerModelSync();
  const relevantPM = findRelevantPlayerRecords(pmStore.records, cleanInput);

  // 3. Check for Empty Retrieval Test on explicit recall queries
  if (isRecall && relevantPassages.length === 0 && relevantPM.length === 0) {
    const cleanReply = "I don't have anything in your journal or chat history on that.";
    if (onStreamToken) onStreamToken(cleanReply);
    return {
      text: cleanReply,
      citations: [],
      mode: 'layer1-retrieval',
    };
  }

  // 4. Check Generative Layer 2 status
  const genStatus = await getGenerativeVoiceStatus();

  if (genStatus.isAvailable) {
    // LAYER 2 GENERATIVE VOICE
    const prompt = buildLeashedPrompt(cleanInput, history, relevantPassages, relevantPM);

    try {
      let accumulated = '';
      const voiceResult = await streamGenerativeVoice(
        prompt,
        (token) => {
          accumulated += token;
          if (onStreamToken) onStreamToken(token);
        },
        { maxTokens: 256, temperature: 0.65 },
      );

      const sanitized = sanitizeMessageBody(voiceResult || accumulated);

      // Assemble structural citation chips
      const citations = buildCitationChips(relevantPassages, relevantPM);

      return {
        text: sanitized,
        citations,
        mode: 'layer2-generative',
      };
    } catch (err) {
      console.warn('[citadel] Generative voice inference failed, falling back to Layer 1:', err);
    }
  }

  // LAYER 1 GROUNDED FALLBACK (When model is unavailable or in non-generative mode)
  const layer1Result = generateLayer1Fallback(cleanInput, relevantPassages, relevantPM);
  if (onStreamToken) onStreamToken(layer1Result.text);

  return {
    text: sanitizeMessageBody(layer1Result.text),
    citations: layer1Result.citations,
    mode: 'layer1-retrieval',
  };
}

/** Build the prompt for Layer 2 with the non-negotiable leash */
function buildLeashedPrompt(
  query: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  passages: ScoredEntryMatch[],
  pmRecords: PlayerModelRecord[],
): string {
  const recordContext: string[] = [];

  for (const pm of pmRecords) {
    const catLabel = pm.category.toUpperCase();
    recordContext.push(`- Player Model [${catLabel}] (${pm.sourceDate}): "${pm.claim}"`);
  }

  for (const pass of passages) {
    const srcLabel = formatSourceLabel(pass.source).toUpperCase();
    const prov = formatCitationProvenance(pass);
    recordContext.push(`- Verified Record [${srcLabel}] (${prov}): "${pass.text.trim()}"`);
  }

  const contextBlock =
    recordContext.length > 0
      ? `VERIFIED RECORDS ABOUT THE PLAYER:\n${recordContext.join('\n')}`
      : 'NO VERIFIED HISTORICAL RECORDS FOR THIS TOPIC.';

  let prompt = `<|im_start|>system
You are SIGMA — art director and sovereign philosophical companion of Citadel.
Voice & Tone:
- Sharp, loyal peer, reflective, amoral witness. Direct, real, authentic.
- No corporate helper speak (no "How can I help you?", "As an AI...").
- No exaggerated 90s slang (do NOT use "dude", "bro", "man", or canned greetings).
- Conversational, thoughtful, concise (2 to 4 sentences).

THE LEASH (NON-NEGOTIABLE):
1. Never invent or hallucinate the player's past, earlier writings, or commitments.
2. If the player asks about past writings, commitments, readings, or records, use ONLY the VERIFIED RECORDS below.
3. If no records exist on a past question, say plainly: "I don't have anything in your journal or records on that."
4. If the player states a present need (like focus, discipline, or feeling stuck), engage their immediate words directly: reflect it, ask a clarifying question, or offer a concrete next step.
5. NEVER print raw event IDs (e.g. evt_...), ISO timestamps, or "Verified journal records:".
${contextBlock}
<|im_end|>
`;

  // Each past conversation turn formatted as proper ChatML
  for (const h of history.slice(-6)) {
    const cleanContent = sanitizeMessageBody(h.content);
    if (cleanContent) {
      const role = h.role === 'user' ? 'user' : 'assistant';
      prompt += `<|im_start|>${role}\n${cleanContent}<|im_end|>\n`;
    }
  }

  // Current turn
  prompt += `<|im_start|>user\n${query}<|im_end|>\n<|im_start|>assistant\n`;

  return prompt;
}

/** Build structured citation chips for referenced material */
function buildCitationChips(
  passages: ScoredEntryMatch[],
  pmRecords: PlayerModelRecord[],
): CitationChipData[] {
  const chips: CitationChipData[] = [];
  const seenIds = new Set<string>();

  for (const pm of pmRecords) {
    if (!seenIds.has(pm.id)) {
      seenIds.add(pm.id);
      chips.push({
        id: pm.id,
        sourceId: pm.sourceId,
        sourceDate: pm.sourceDate,
        sourceType: pm.sourceType,
        snippet: pm.claim,
      });
    }
  }

  for (const pass of passages.slice(0, 3)) {
    if (!seenIds.has(pass.id)) {
      seenIds.add(pass.id);
      let sType: CitationSourceType = 'journal';
      if (pass.source === 'chat.log' || pass.source === 'chat') {
        sType = 'chat';
      } else if (
        pass.source &&
        ['synaptic', 'mindmap', 'activity', 'profile'].includes(pass.source)
      ) {
        sType = pass.source as CitationSourceType;
      }

      chips.push({
        id: pass.id,
        sourceId: pass.id,
        sourceDate: pass.day,
        sourceType: sType,
        snippet: pass.text.length > 80 ? pass.text.slice(0, 80) + '…' : pass.text,
        eventId: pass.eventId,
        timestamp: pass.timestamp,
        provenance: formatCitationProvenance(pass),
        level: pass.level,
        period: pass.period,
      });
    }
  }

  return chips;
}

/** Fallback grounded Layer-1 response with zero raw internals */
function generateLayer1Fallback(
  query: string,
  passages: ScoredEntryMatch[],
  pmRecords: PlayerModelRecord[],
): { text: string; citations: CitationChipData[] } {
  const low = query.toLowerCase();

  // 1. Commitments & Schedule Query
  if (pmRecords.length > 0) {
    const commitments = pmRecords.filter((r) => r.category === 'commitments');
    if (commitments.length > 0) {
      const top = commitments[0];
      const text = `According to what you stated earlier, you noted: “${top.claim}”.`;
      return {
        text,
        citations: buildCitationChips([], [top]),
      };
    }
  }

  // 2. Verified Records with matching passages across any Citadel store
  if (passages.length > 0) {
    const top = passages[0];
    const srcName = formatSourceLabel(top.source);
    const provenance = formatCitationProvenance(top);
    const text = `According to your ${srcName} from ${provenance}: “${top.text.trim()}”`;
    return {
      text,
      citations: buildCitationChips([top], []),
    };
  }

  // 3. Conversational present-need engagement (Focus, discipline, fatigue, etc.)
  if (low.includes('focus') || low.includes('discipline')) {
    return {
      text: 'Focus starts with stripping the noise. What is the single highest-priority task in front of you right now, and what can we clear off your desk?',
      citations: [],
    };
  }

  if (low.includes('tired') || low.includes('exhausted') || low.includes('rest')) {
    return {
      text: 'The work will be here when you return. If you need to step away from the keys, step away. What is the smallest clean stopping point?',
      citations: [],
    };
  }

  // 4. Default reflective presence
  return {
    text: 'I hear you. Where do you want to direct your attention next?',
    citations: [],
  };
}
