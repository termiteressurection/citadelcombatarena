import { proposePlayerRecord, isLearningPaused } from './playerModelStore';
import { PlayerModelCategory, PlayerSourceType } from './playerModelTypes';
import type { CitadelStateModel } from '../model/types';
import { seedVaultDeck } from '@/features/synaptic-vault/seedVault';

interface ExtractionCandidate {
  category: PlayerModelCategory;
  claim: string;
  confidence: number;
}

// Patterns for detecting commitments & open loops
const COMMITMENT_PATTERNS = [
  /\b(?:i need to|i have to|i must|i should|i will|i'm going to|i am going to)\s+([^.!?,\n]{4,80})/gi,
  /\b(?:i plan to|i promised to|i committed to|i agreed to)\s+([^.!?,\n]{4,80})/gi,
  /\b(?:due (?:on|by|this|next)?\s+[^.!?,\n]{3,40})/gi,
  /\b(?:waiting (?:for|on)\s+[^.!?,\n]{3,60})/gi,
  /\b(?:remind me to|don't let me forget to)\s+([^.!?,\n]{4,80})/gi,
];

// Patterns for preferences
const PREFERENCE_PATTERNS = [
  /\b(?:i prefer|i love|i really like|i enjoy|i hate|i can't stand|i dislike)\s+([^.!?,\n]{4,60})/gi,
  /\b(?:my favorite|my preferred)\s+([^.!?,\n]{4,60})/gi,
];

// Patterns for facts (projects, roles, places)
const FACT_PATTERNS = [
  /\b(?:i am working on|i'm working on|my project is|current project is)\s+([^.!?,\n]{4,60})/gi,
  /\b(?:i work (?:as|at|for)|my role is|i am a)\s+([^.!?,\n]{4,60})/gi,
  /\b(?:i live in|i moved to|based in)\s+([^.!?,\n]{3,50})/gi,
];

// People mention detection
const KNOWN_PEOPLE_TITLES = ['brother', 'sister', 'dad', 'mom', 'father', 'mother', 'boss', 'coworker', 'partner', 'friend'];

export function extractFromText(text: string): ExtractionCandidate[] {
  const candidates: ExtractionCandidate[] = [];
  const clean = text.trim();
  if (!clean || clean.length < 5) return candidates;

  // 1. Commitments & Open Loops
  for (const pattern of COMMITMENT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      const captured = match[1] || match[0];
      const claim = captured.trim();
      if (claim.length >= 4 && !candidates.some((c) => c.claim.toLowerCase() === claim.toLowerCase())) {
        // Format as natural commitment
        const formatted = match[0].trim();
        candidates.push({
          category: 'commitments',
          claim: formatted.charAt(0).toUpperCase() + formatted.slice(1),
          confidence: 0.85,
        });
      }
    }
  }

  // 2. Preferences
  for (const pattern of PREFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      const formatted = match[0].trim();
      if (formatted.length >= 5 && !candidates.some((c) => c.claim.toLowerCase() === formatted.toLowerCase())) {
        candidates.push({
          category: 'preferences',
          claim: formatted.charAt(0).toUpperCase() + formatted.slice(1),
          confidence: 0.80,
        });
      }
    }
  }

  // 3. Stated Facts
  for (const pattern of FACT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      const formatted = match[0].trim();
      if (formatted.length >= 5 && !candidates.some((c) => c.claim.toLowerCase() === formatted.toLowerCase())) {
        candidates.push({
          category: 'facts',
          claim: formatted.charAt(0).toUpperCase() + formatted.slice(1),
          confidence: 0.90,
        });
      }
    }
  }

  // 4. People (Named entities or relationship titles)
  for (const title of KNOWN_PEOPLE_TITLES) {
    const regex = new RegExp(`\\b(?:my\\s+${title}|call(?:ing)?\\s+${title}|talk(?:ing)?\\s+(?:to|with)\\s+${title})\\b`, 'i');
    const match = regex.exec(clean);
    if (match) {
      const claim = `Mentioned: ${match[0]}`;
      if (!candidates.some((c) => c.claim.toLowerCase() === claim.toLowerCase())) {
        candidates.push({
          category: 'people',
          claim,
          confidence: 0.80,
        });
      }
    }
  }

  // Proper noun names (e.g., "talking with Mara", "met with Alex")
  const properNameRegex = /\b(?:with|and|saw|met|called|texted)\s+([A-Z][a-z]{2,15})\b/g;
  let nameMatch;
  while ((nameMatch = properNameRegex.exec(clean)) !== null) {
    const name = nameMatch[1];
    if (!['The', 'Citadel', 'Sigma', 'Today', 'Friday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday'].includes(name)) {
      const claim = `Person: ${name}`;
      if (!candidates.some((c) => c.claim.toLowerCase() === claim.toLowerCase())) {
        candidates.push({
          category: 'people',
          claim,
          confidence: 0.75,
        });
      }
    }
  }

  return candidates;
}

/**
 * Runs an extraction pass on a completed chat session turn, journal entry, or content store item
 */
export async function runExtractionPass(props: {
  text: string;
  sourceId: string;
  sourceDate: string;
  sourceType: PlayerSourceType;
}): Promise<void> {
  if (isLearningPaused()) return;

  const candidates = extractFromText(props.text);
  for (const candidate of candidates) {
    await proposePlayerRecord({
      category: candidate.category,
      claim: candidate.claim,
      sourceId: props.sourceId,
      sourceDate: props.sourceDate,
      sourceType: props.sourceType,
      confidence: candidate.confidence,
    });
  }
}

/**
 * Extracts player model records across ALL Citadel content stores:
 * Synaptic Vault, Mind-map Graph, and Traveler Profile.
 */
export async function extractCitadelState(state: CitadelStateModel): Promise<void> {
  if (isLearningPaused()) return;
  const today = state.today || new Date().toISOString().slice(0, 10);

  // 1. Profile Data
  if (state.identity) {
    if (state.identity.mbti) {
      await proposePlayerRecord({
        category: 'facts',
        claim: `Personality archetype is ${state.identity.mbti}`,
        sourceId: 'profile:mbti',
        sourceDate: today,
        sourceType: 'profile',
        confidence: 0.95,
      });
    }
    if (state.identity.name && state.identity.name !== 'Traveler') {
      await proposePlayerRecord({
        category: 'facts',
        claim: `Prefers to be called ${state.identity.name}`,
        sourceId: 'profile:name',
        sourceDate: today,
        sourceType: 'profile',
        confidence: 0.95,
      });
    }
  }

  // 2. Synaptic Vault Dialectics
  if (state.synapticVault?.answers) {
    const qMap = new Map<string, string>();
    for (const q of seedVaultDeck.questions) {
      qMap.set(q.id, q.prompt);
    }
    if (Array.isArray(state.synapticVault.decks)) {
      for (const deck of state.synapticVault.decks) {
        for (const q of deck.questions) {
          qMap.set(q.id, q.prompt);
        }
      }
    }

    for (const [qId, ans] of Object.entries(state.synapticVault.answers)) {
      const qPrompt = qMap.get(qId);
      const ansDate = (ans.timestamp ? ans.timestamp.slice(0, 10) : today);
      const valStr = typeof ans.value === 'boolean' ? (ans.value ? 'Affirms' : 'Disputes') : String(ans.value);

      if (qPrompt) {
        await proposePlayerRecord({
          category: 'preferences',
          claim: `Synaptic Stance on "${qPrompt}": ${valStr}`,
          sourceId: `synaptic:${qId}`,
          sourceDate: ansDate,
          sourceType: 'synaptic',
          confidence: 0.88,
        });
      }

      if (ans.dialecticNotes) {
        await runExtractionPass({
          text: ans.dialecticNotes,
          sourceId: `synaptic:notes:${qId}`,
          sourceDate: ansDate,
          sourceType: 'synaptic',
        });
      }
    }
  }

  // 3. Global Mind Map
  if (state.globalMindMap?.nodes && Array.isArray(state.globalMindMap.nodes)) {
    for (const node of state.globalMindMap.nodes) {
      if (node.label && node.label.trim()) {
        await proposePlayerRecord({
          category: 'themes',
          claim: `Explores Mind Map theme: "${node.label}"`,
          sourceId: `mindmap:${node.id}`,
          sourceDate: today,
          sourceType: 'mindmap',
          confidence: 0.80,
        });

        if (Array.isArray(node.bullets)) {
          for (let i = 0; i < node.bullets.length; i++) {
            await runExtractionPass({
              text: node.bullets[i],
              sourceId: `mindmap:${node.id}:b${i}`,
              sourceDate: today,
              sourceType: 'mindmap',
            });
          }
        }
      }
    }
  }
}
