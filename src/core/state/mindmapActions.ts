import type { CitadelStateModel, MindEdge, MindNode } from '../model/types';

export type MindPoint = { x: number; y: number };
export type MindMapState = CitadelStateModel['globalMindMap'];

const DEFAULT_NODE_LABEL = 'idea';

export function createGlobalNode(
  state: CitadelStateModel,
  id: string,
  label: string,
  at?: MindPoint,
): CitadelStateModel {
  const node: MindNode = {
    id,
    label: label.trim() || DEFAULT_NODE_LABEL,
    x: at?.x ?? 400 + (Math.random() - 0.5) * 200,
    y: at?.y ?? 300 + (Math.random() - 0.5) * 200,
    bullets: [],
    starred: false,
    boundChamberId: null,
  };

  return {
    ...state,
    globalMindMap: {
      ...state.globalMindMap,
      nodes: [...state.globalMindMap.nodes, node],
    },
  };
}

export function updateGlobalNode(
  state: CitadelStateModel,
  id: string,
  patch: Partial<MindNode>,
): CitadelStateModel {
  return {
    ...state,
    globalMindMap: {
      ...state.globalMindMap,
      nodes: state.globalMindMap.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node,
      ),
    },
  };
}

export function removeGlobalNode(state: CitadelStateModel, id: string): CitadelStateModel {
  return {
    ...state,
    globalMindMap: {
      nodes: state.globalMindMap.nodes.filter((node) => node.id !== id),
      edges: state.globalMindMap.edges.filter((edge) => edge.from !== id && edge.to !== id),
    },
  };
}

export function toggleGlobalNodeStar(state: CitadelStateModel, id: string): CitadelStateModel {
  const starred = state.globalMindMap.nodes.find((node) => node.id === id)?.starred ?? false;
  return updateGlobalNode(
    state,
    id,
    { starred: !starred },
  );
}

export function bindGlobalNodeToChamber(
  state: CitadelStateModel,
  id: string,
  chamberId: string | null,
): CitadelStateModel {
  return updateGlobalNode(state, id, { boundChamberId: chamberId });
}

export function createGlobalEdge(
  state: CitadelStateModel,
  id: string,
  fromId: string,
  toId: string,
): CitadelStateModel {
  if (fromId === toId) return state;
  const exists = state.globalMindMap.edges.some(
    (edge) =>
      (edge.from === fromId && edge.to === toId) ||
      (edge.from === toId && edge.to === fromId),
  );
  if (exists) return state;

  const edge: MindEdge = { id, from: fromId, to: toId };
  return {
    ...state,
    globalMindMap: {
      ...state.globalMindMap,
      edges: [...state.globalMindMap.edges, edge],
    },
  };
}

export function removeGlobalEdge(state: CitadelStateModel, edgeId: string): CitadelStateModel {
  return {
    ...state,
    globalMindMap: {
      ...state.globalMindMap,
      edges: state.globalMindMap.edges.filter((edge) => edge.id !== edgeId),
    },
  };
}

export function setGlobalMindMap(
  state: CitadelStateModel,
  globalMindMap: MindMapState,
): CitadelStateModel {
  return { ...state, globalMindMap };
}
