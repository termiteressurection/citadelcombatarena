import type { CitadelStateModel, LocalDay, SynapticQuestion } from '../model/types';
import { seedVaultDeck } from '@/features/synaptic-vault/seedVault';
import type { Thought } from '@/arboretum/components/citadel-rebuilt/types';

export type CitadelContentSourceType =
  | 'journal'
  | 'chat'
  | 'synaptic'
  | 'mindmap'
  | 'activity'
  | 'profile';

export interface HarvestedCitadelItem {
  id: string | number;
  text: string;
  sourceDate: string;
  sourceType: CitadelContentSourceType;
  timestamp: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Maps all content stores in the Citadel into indexed records with accurate source types.
 */
export function harvestCitadelContent(state: CitadelStateModel): HarvestedCitadelItem[] {
  const items: HarvestedCitadelItem[] = [];
  const today = state.today || new Date().toISOString().slice(0, 10);

  // 1. Journal entries from all Days
  if (state.days) {
    for (const [dayKey, dayCell] of Object.entries(state.days)) {
      const dayStr = dayCell.day || dayKey;
      if (Array.isArray(dayCell.entries)) {
        dayCell.entries.forEach((entry, idx) => {
          items.push({
            id: entry.id || `entry_${dayStr}_${idx}`,
            text: entry.text,
            sourceDate: entry.day || dayStr,
            sourceType: 'journal',
            timestamp: entry.createdAt || `${dayStr}T12:00:00.000Z`,
            tags: entry.tags ? [...entry.tags] : undefined,
          });
        });
      }

      // Altar activity per day
      if (dayCell.dailyAnchorComplete) {
        items.push({
          id: `act_anchor_${dayStr}`,
          text: `[Citadel Altar] Daily Anchor submitted and sealed for day ${dayStr}.`,
          sourceDate: dayStr,
          sourceType: 'activity',
          timestamp: `${dayStr}T09:00:00.000Z`,
          tags: ['altar', 'anchor'],
        });
      }

      if (dayCell.dailyTrialComplete) {
        items.push({
          id: `act_trial_${dayStr}`,
          text: `[Citadel Altar] Stoic Daily Trial completed at the altar on ${dayStr}.`,
          sourceDate: dayStr,
          sourceType: 'activity',
          timestamp: `${dayStr}T18:00:00.000Z`,
          tags: ['altar', 'trial'],
        });
      }

      if (dayCell.crystallized) {
        items.push({
          id: `act_cryst_${dayStr}`,
          text: `[Citadel Altar] Day ${dayStr} crystallized into permanent memory stone${dayCell.crystallizedAt ? ` at ${dayCell.crystallizedAt}` : ''}.`,
          sourceDate: dayStr,
          sourceType: 'activity',
          timestamp: dayCell.crystallizedAt || `${dayStr}T23:59:59.000Z`,
          tags: ['altar', 'crystallization'],
        });
      }
    }
  }

  // 2. Synaptic Vault (Decks, Dialectic Q&A, Dialectic Notes, Syntheses)
  if (state.synapticVault) {
    const questionMap = new Map<string, SynapticQuestion>();

    // Seed questions
    for (const q of seedVaultDeck.questions) {
      questionMap.set(q.id, q);
    }
    // Custom deck questions
    if (Array.isArray(state.synapticVault.decks)) {
      for (const deck of state.synapticVault.decks) {
        for (const q of deck.questions) {
          questionMap.set(q.id, q);
        }
      }
    }
    // Synthesized questions
    if (Array.isArray(state.synapticVault.synthesizedQuestions)) {
      for (const q of state.synapticVault.synthesizedQuestions) {
        questionMap.set(q.id, q);
      }
    }

    // Answers
    if (state.synapticVault.answers) {
      for (const [qId, ans] of Object.entries(state.synapticVault.answers)) {
        const q = questionMap.get(qId);
        const sector = q?.sector || 'Dialectic';
        const prompt = q?.prompt || `Dialectic query ${qId}`;
        const valStr = typeof ans.value === 'boolean' ? (ans.value ? 'Affirmative' : 'Negative') : String(ans.value);
        const notesStr = ans.dialecticNotes ? ` — Dialectic notes: "${ans.dialecticNotes}"` : '';

        const date = (ans.timestamp ? ans.timestamp.slice(0, 10) : today) as LocalDay;

        items.push({
          id: `synaptic_ans_${qId}`,
          text: `[Synaptic Vault // ${sector}] "${prompt}" -> Response: "${valStr}"${notesStr}`,
          sourceDate: date,
          sourceType: 'synaptic',
          timestamp: ans.timestamp || `${date}T12:00:00.000Z`,
          tags: ['synaptic-vault', sector.toLowerCase(), ...(q?.tags || [])],
          metadata: { questionId: qId, sector, value: ans.value },
        });
      }
    }

    // Synthesized questions
    if (Array.isArray(state.synapticVault.synthesizedQuestions)) {
      state.synapticVault.synthesizedQuestions.forEach((sq, idx) => {
        items.push({
          id: `synaptic_synth_${sq.id || idx}`,
          text: `[Synaptic Vault // Synthesis] Inquiry for ${sq.sector}: "${sq.prompt}"`,
          sourceDate: today,
          sourceType: 'synaptic',
          timestamp: `${today}T12:00:00.000Z`,
          tags: ['synaptic-vault', 'synthesis', sq.sector.toLowerCase()],
        });
      });
    }
  }

  // 3. Global Mind-Map Graph (Nodes & Edges)
  if (state.globalMindMap) {
    const nodeMap = new Map<string, string>();

    if (Array.isArray(state.globalMindMap.nodes)) {
      state.globalMindMap.nodes.forEach((node) => {
        nodeMap.set(node.id, node.label);
        const bulletsStr = node.bullets && node.bullets.length > 0 ? ` (Notes: ${node.bullets.join('; ')})` : '';
        const starredStr = node.starred ? ' [Starred Torii Gate]' : '';
        const chamberStr = node.boundChamberId ? ` [Bound to Chamber: ${node.boundChamberId}]` : '';

        items.push({
          id: `mind_node_${node.id}`,
          text: `[Mind Map // Node] Concept: "${node.label}"${bulletsStr}${chamberStr}${starredStr}`,
          sourceDate: today,
          sourceType: 'mindmap',
          timestamp: `${today}T12:00:00.000Z`,
          tags: ['mindmap', 'node'],
          metadata: { nodeId: node.id, label: node.label },
        });
      });
    }

    if (Array.isArray(state.globalMindMap.edges)) {
      state.globalMindMap.edges.forEach((edge) => {
        const fromLabel = nodeMap.get(edge.from) || edge.from;
        const toLabel = nodeMap.get(edge.to) || edge.to;

        items.push({
          id: `mind_edge_${edge.id}`,
          text: `[Mind Map // Link] Connected thoughts: "${fromLabel}" <—> "${toLabel}"`,
          sourceDate: today,
          sourceType: 'mindmap',
          timestamp: `${today}T12:00:00.000Z`,
          tags: ['mindmap', 'edge'],
        });
      });
    }
  }

  // 4. Rituals
  if (state.ritual) {
    const ritDay = state.ritual.day || today;
    const morningStatus = state.ritual.morning ? 'completed' : 'pending';
    const eveningStatus = state.ritual.evening ? 'completed' : 'pending';

    items.push({
      id: `ritual_${ritDay}`,
      text: `[Daily Rituals] Morning reflection: ${morningStatus}, Evening reflection: ${eveningStatus} for ${ritDay}.`,
      sourceDate: ritDay,
      sourceType: 'activity',
      timestamp: `${ritDay}T12:00:00.000Z`,
      tags: ['ritual', 'discipline'],
    });
  }

  // 6. Identity & Profile
  if (state.identity) {
    const profileParts = [
      `Traveler Name: ${state.identity.name || 'Traveler'}`,
      `Current Streak: ${state.identity.streak || 0} days`,
    ];
    if (state.identity.mbti) {
      profileParts.push(`Calibration Archetype / MBTI: ${state.identity.mbti}`);
    }

    items.push({
      id: 'profile_identity',
      text: `[Traveler Profile] ${profileParts.join(' · ')}`,
      sourceDate: today,
      sourceType: 'profile',
      timestamp: `${today}T12:00:00.000Z`,
      tags: ['profile', 'identity'],
    });
  }

  return items;
}

/**
 * Converts harvested items into legacy Thought format for Chamber/Sigma compatibility
 */
export function harvestToThoughts(state: CitadelStateModel): Thought[] {
  const harvested = harvestCitadelContent(state);
  return harvested.map((item, idx) => ({
    id: idx + 1,
    text: item.text,
    timestamp: item.timestamp,
    sourceDate: item.sourceDate,
    chamberId: 0,
    tags: item.tags,
  }));
}
