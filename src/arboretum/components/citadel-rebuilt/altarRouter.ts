/**
 * Context-aware destination routing for the Citadel Altar.
 *
 * Rules:
 * - If inside a Mind Map Node chamber (or explicitly provided node context):
 *   Routes to that specific Mind Map Node. Inscribed thoughts append as bullets
 *   into that node's NOTES & INQUIRY section.
 * - If inside a Calendar chamber (Year, Season, Month, Day):
 *   Routes to the respective Journal level and period subject to the fractal timelock.
 * - No silent fallback: if invoked with mindmap context but no resolvable node ID,
 *   it refuses visibly with an error rather than dumping notes into the Day chamber.
 */

import type { Chamber } from './types';
import type { JournalLevel } from './writablePath';
import { parseCalendarChamberId, SEASONS } from './fractalCalendarModel';
import { parseLocalDateFromChamber } from './calendarChamberUtils';
import { resolveWritablePeriod } from './writablePath';
import { useMindmap, type Node } from '@/features/world/mindmap3d/store';
import { getNumericId } from '@/features/world/mindmap3d/ids';

export type AltarDestination =
  | {
      kind: 'node';
      nodeId: string;
      chamberId: number;
      node: Node;
      title: string;
    }
  | {
      kind: 'journal';
      level: JournalLevel;
      period: string;
      chamberId: number;
    }
  | {
      kind: 'error';
      message: string;
    };

export interface AltarOverrideContext {
  kind?: 'node' | 'journal';
  nodeId?: string;
  level?: JournalLevel;
  period?: string;
  day?: string;
}

/**
 * Check whether a 3D chamber corresponds to a Mind Map Node.
 */
export function isMindmapNodeChamber(chamber: Chamber | null | undefined): boolean {
  if (!chamber) return false;
  if (chamber.template === 'mindmap-node') return true;
  const nodes = useMindmap.getState().nodes || {};
  return Object.values(nodes).some((n) => getNumericId(n.id) === chamber.id);
}

/**
 * Look up the Mind Map Node corresponding to a chamber ID or chamber object.
 */
export function findMindmapNodeForChamber(
  chamberOrId: Chamber | number | null | undefined
): Node | null {
  if (chamberOrId === null || chamberOrId === undefined) return null;
  const chamberId = typeof chamberOrId === 'number' ? chamberOrId : chamberOrId.id;
  const nodes = useMindmap.getState().nodes || {};

  // If chamber has explicit nodeId property
  if (typeof chamberOrId === 'object' && (chamberOrId as any)?.nodeId) {
    const explicitId = (chamberOrId as any).nodeId;
    if (nodes[explicitId]) return nodes[explicitId];
  }

  for (const n of Object.values(nodes)) {
    if (getNumericId(n.id) === chamberId) {
      return n;
    }
  }
  return null;
}

/**
 * Primary destination resolver for the Citadel Altar.
 */
export function resolveAltarDestination(
  chamber: Chamber | null | undefined,
  overrideContext?: AltarOverrideContext
): AltarDestination {
  const mmStore = useMindmap.getState();
  const nodes = mmStore.nodes || {};

  // 1. Explicit override context provided (e.g. feature props)
  if (overrideContext?.kind === 'node' || overrideContext?.nodeId) {
    const nodeId = overrideContext.nodeId;
    if (!nodeId || !nodes[nodeId]) {
      return {
        kind: 'error',
        message: 'Unresolvable mindmap node context. Inscription halted to prevent Day journal contamination.',
      };
    }
    const node = nodes[nodeId];
    return {
      kind: 'node',
      nodeId,
      chamberId: chamber?.id ?? getNumericId(nodeId),
      node,
      title: node.title,
    };
  }

  if (overrideContext?.kind === 'journal') {
    const level: JournalLevel = overrideContext.level || 'day';
    const period = overrideContext.period || overrideContext.day || resolveWritablePeriod(level);
    return {
      kind: 'journal',
      level,
      period,
      chamberId: chamber?.id ?? 0,
    };
  }

  // 2. Chamber-based contextual resolution
  if (!chamber) {
    return {
      kind: 'journal',
      level: 'day',
      period: resolveWritablePeriod('day'),
      chamberId: 0,
    };
  }

  // A. Check if chamber is explicitly marked as a mindmap node chamber
  if (chamber.template === 'mindmap-node' || (chamber as any).nodeId) {
    const nodeId = (chamber as any).nodeId;
    if (nodeId && nodes[nodeId]) {
      const node = nodes[nodeId];
      return {
        kind: 'node',
        nodeId,
        chamberId: chamber.id,
        node,
        title: node.title,
      };
    }
    // Search by numeric ID match
    for (const n of Object.values(nodes)) {
      if (getNumericId(n.id) === chamber.id) {
        return {
          kind: 'node',
          nodeId: n.id,
          chamberId: chamber.id,
          node: n,
          title: n.title,
        };
      }
    }
    // If marked as mindmap-node but node was deleted/unresolvable:
    // DO NOT silently fallback to Day!
    return {
      kind: 'error',
      message: 'Unresolvable mindmap node context. Inscription halted to prevent Day journal contamination.',
    };
  }

  // B. Check if chamber ID matches any mindmap node's numeric ID
  for (const n of Object.values(nodes)) {
    if (getNumericId(n.id) === chamber.id) {
      return {
        kind: 'node',
        nodeId: n.id,
        chamberId: chamber.id,
        node: n,
        title: n.title,
      };
    }
  }

  // C. Fractal Calendar Chambers
  const parsed = parseCalendarChamberId(chamber.id);
  if (parsed.type === 'year' && parsed.year) {
    return {
      kind: 'journal',
      level: 'year',
      period: String(parsed.year),
      chamberId: chamber.id,
    };
  }
  if (parsed.type === 'season' && parsed.year && parsed.seasonIndex !== undefined) {
    return {
      kind: 'journal',
      level: 'season',
      period: `${parsed.year}-${SEASONS[parsed.seasonIndex].name}`,
      chamberId: chamber.id,
    };
  }
  if (parsed.type === 'month' && parsed.year && parsed.month) {
    return {
      kind: 'journal',
      level: 'month',
      period: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
      chamberId: chamber.id,
    };
  }
  if (chamber.template === 'day') {
    const localDay = parseLocalDateFromChamber(chamber) ?? resolveWritablePeriod('day');
    return {
      kind: 'journal',
      level: 'day',
      period: localDay,
      chamberId: chamber.id,
    };
  }

  // D. Hub / Root Chamber (id 0) or standard custom chamber -> defaults to Journal Day
  return {
    kind: 'journal',
    level: 'day',
    period: resolveWritablePeriod('day'),
    chamberId: chamber.id,
  };
}
