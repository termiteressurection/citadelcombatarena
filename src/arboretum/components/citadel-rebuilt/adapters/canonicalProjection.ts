import type { CellEntry, CitadelStateModel, MindNode } from '@/core/model/types';
import type { Chamber, Thought } from '../types';

export type CanonicalMonolith = Thought & {
  sourceEntryId: string;
};

export type CanonicalNodeProjection = {
  id: string;
  title: string;
  body: string;
  position: [number, number, number];
  hue: number;
  links: string[];
  createdAt: number;
  starred: boolean;
  bullets: string[];
  sourceNodeId: string;
};

function numericProjectionId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
}

export function projectEntryToMonolith(entry: CellEntry, chamberId: number): CanonicalMonolith {
  return {
    id: numericProjectionId(entry.id),
    sourceEntryId: entry.id,
    text: entry.text,
    timestamp: entry.updatedAt || entry.createdAt,
    chamberId,
    type: 'monolith',
    tags: [...(entry.tags ?? []), 'canonical-entry'],
  };
}

export function projectDayEntriesToChamber(
  state: CitadelStateModel,
  day: keyof CitadelStateModel['days'],
  chamberId: number,
): Chamber {
  const entries = state.days[day]?.entries ?? [];
  return {
    id: chamberId,
    name: day === state.today ? 'TODAY' : day,
    description: `Canonical entries for ${day}.`,
    depth: 1,
    parent: 0,
    template: 'day',
    doors: [0],
    thoughts: entries.map((entry) => projectEntryToMonolith(entry, chamberId)),
  };
}

export function projectMindNode(node: MindNode): CanonicalNodeProjection {
  return {
    id: node.id,
    sourceNodeId: node.id,
    title: node.label,
    body: node.bullets?.join('\n') ?? '',
    position: [node.x, 0, node.y],
    hue: 180,
    links: [],
    createdAt: 0,
    starred: Boolean(node.starred),
    bullets: [...(node.bullets ?? [])],
  };
}

export function projectMindMap(state: CitadelStateModel): CanonicalNodeProjection[] {
  const links = new Map<string, string[]>();
  for (const edge of state.globalMindMap.edges) {
    links.set(edge.from, [...(links.get(edge.from) ?? []), edge.to]);
    links.set(edge.to, [...(links.get(edge.to) ?? []), edge.from]);
  }

  return state.globalMindMap.nodes.map((node) => ({
    ...projectMindNode(node),
    links: links.get(node.id) ?? [],
  }));
}