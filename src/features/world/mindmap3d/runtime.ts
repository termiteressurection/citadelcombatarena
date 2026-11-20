// Shared runtime bridge + view state + user actions for the mindmap chamber.
// View state (folds, toasts) is session-only; nothing here changes the schema.

import { create } from "zustand";
import { useMindmap, type Node, type MindmapEdge, type EdgeStyle } from "./store";
import { buildGraph, type MindGraph, type Visibility } from "./graph";
import type { Vec3 } from "./layout";
import { ACCENTS } from "./palette";

export interface Runtime {
  graph: MindGraph | null;
  vis: Visibility | null;
  nodes: Record<string, Node>;
  /** Dev-only synthetic graph — never persisted, edits disabled. */
  stress: boolean;
  hoveredId: string | null;
  hoveredEdgeId: string | null;
  reducedMotion: boolean;
  frames?: number;
  invalidate: () => void;
  getPos: (id: string) => Vec3 | null;
  flyTo: (id: string | null) => void;
  frameAll: () => void;
}

export const runtime: Runtime = {
  graph: null,
  vis: null,
  nodes: {},
  stress: false,
  hoveredId: null,
  hoveredEdgeId: null,
  reducedMotion: false,
  invalidate: () => {},
  getPos: () => null,
  flyTo: () => {},
  frameAll: () => {},
};

export interface UndoToast {
  message: string;
  restore: () => void;
  at: number;
}

interface ViewState {
  expanded: Set<string>;
  collapsed: Set<string>;
  undo: UndoToast | null;
  editNonce: number;
  showKeys: boolean;
  showPerf: boolean;
  setFold: (id: string, open: boolean) => void;
  expandMany: (ids: string[]) => void;
  setUndo: (u: UndoToast | null) => void;
  requestEdit: () => void;
  toggleKeys: () => void;
  togglePerf: () => void;
}

export const useMindmapView = create<ViewState>()((set) => ({
  expanded: new Set(),
  collapsed: new Set(),
  undo: null,
  editNonce: 0,
  showKeys: false,
  showPerf: false,
  setFold: (id, open) =>
    set((s) => {
      const expanded = new Set(s.expanded);
      const collapsed = new Set(s.collapsed);
      if (open) {
        expanded.add(id);
        collapsed.delete(id);
      } else {
        collapsed.add(id);
        expanded.delete(id);
      }
      return { expanded, collapsed };
    }),
  expandMany: (ids) =>
    set((s) => {
      const expanded = new Set(s.expanded);
      const collapsed = new Set(s.collapsed);
      for (const id of ids) {
        expanded.add(id);
        collapsed.delete(id);
      }
      return { expanded, collapsed };
    }),
  setUndo: (undo) => set({ undo }),
  requestEdit: () => set((s) => ({ editNonce: s.editNonce + 1 })),
  toggleKeys: () => set((s) => ({ showKeys: !s.showKeys })),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
}));

// ── Actions ────────────────────────────────────────────────────────────────

/** Session view state (folds, undo) refers to node ids of one map, so drop it when the active map changes. */
export function resetViewForMapChange() {
  useMindmapView.setState({ expanded: new Set(), collapsed: new Set(), undo: null });
  setTimeout(() => runtime.frameAll(), 50);
}

export function switchToMap(id: string): boolean {
  const ok = useMindmap.getState().switchMap(id);
  if (ok) resetViewForMapChange();
  return ok;
}

export function createMapAndSwitch(name?: string): string {
  const id = useMindmap.getState().createMap(name);
  resetViewForMapChange();
  return id;
}

export function deleteMapAndReset(id: string): boolean {
  const wasActive = useMindmap.getState().activeMapId === id;
  const ok = useMindmap.getState().deleteMap(id);
  if (ok && wasActive) resetViewForMapChange();
  return ok;
}

/** Select a node, unfold its ancestors so it is visible, and fly the camera to it. */
export function focusNode(id: string | null, fly = true) {
  const g = runtime.graph;
  if (id && g) {
    const ancestors: string[] = [];
    let cur = g.parent.get(id);
    while (cur) {
      if (!runtime.vis?.isOpen(cur)) ancestors.push(cur);
      cur = g.parent.get(cur);
    }
    if (ancestors.length) useMindmapView.getState().expandMany(ancestors);
  }
  useMindmap.getState().select(id);
  if (fly && id) runtime.flyTo(id);
  runtime.invalidate();
}

export function focusEdge(edgeId: string | null) {
  useMindmap.getState().selectEdge(edgeId);
  runtime.invalidate();
}

export function toggleFold(id: string) {
  const open = runtime.vis?.isOpen(id) ?? true;
  useMindmapView.getState().setFold(id, !open);
  runtime.invalidate();
}

function ensureLinked(a: string, b: string, kind: "tree" | "crosslink" = "tree") {
  const store = useMindmap.getState();
  const existing = Object.values(store.edges || {}).find(
    (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
  );
  if (!existing) {
    store.createEdge({ source: a, target: b, kind });
  }
}

/** N — create a child of the given node (or the root, or plant the first seed) in true 3D. */
export function createChild(parentId?: string | null): string | null {
  if (runtime.stress) return null;
  const store = useMindmap.getState();
  const g = runtime.graph;
  const parent = parentId ?? g?.rootId ?? null;

  if (!parent || !store.nodes[parent]) {
    const id = store.createNode({ title: "First thought", hue: ACCENTS.gold.hue, position: [0, 0, 0] });
    useMindmapView.getState().requestEdit();
    runtime.flyTo(id);
    return id;
  }

  const pNode = store.nodes[parent];
  const base = runtime.getPos(parent) ?? pNode.position;

  // True 3D spherical radiating distribution for child placement
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 5.2 + Math.random() * 2.5;
  const position: Vec3 = [
    Number((base[0] + r * Math.sin(phi) * Math.cos(theta)).toFixed(2)),
    Number((base[1] + r * Math.sin(phi) * Math.sin(theta)).toFixed(2)),
    Number((base[2] + r * Math.cos(phi)).toFixed(2)),
  ];

  const siblings = g?.children.get(parent)?.length ?? 0;
  const hue =
    parent === g?.rootId
      ? siblings % 2 === 0
        ? ACCENTS.cyan.hue
        : ACCENTS.magenta.hue
      : pNode.hue;

  const id = store.createNode({
    title: "New thought",
    position,
    hue,
    color: parent === g?.rootId ? undefined : pNode.color,
  });
  const edgeId = store.createEdge({
    source: parent,
    target: id,
    kind: "tree",
    style: { curvature: 0.12, thickness: 1.5 },
  });

  useMindmapView.getState().setFold(parent, true);
  useMindmapView.getState().requestEdit();
  runtime.flyTo(id);

  // Undo support for child creation
  useMindmapView.getState().setUndo({
    message: `Created thought`,
    at: Date.now(),
    restore: () => {
      store.deleteNode(id);
      if (edgeId) store.deleteEdge(edgeId);
      useMindmapView.getState().setUndo(null);
      runtime.flyTo(parent);
    },
  });

  return id;
}

/** Create a crosslink between two existing nodes with undo support. */
export function createCrosslinkWithUndo(source: string, target: string, style?: EdgeStyle): string | null {
  if (runtime.stress || source === target) return null;
  const store = useMindmap.getState();
  const edgeId = store.createEdge({
    source,
    target,
    kind: "crosslink",
    style,
  });
  if (!edgeId) return null;

  useMindmapView.getState().setUndo({
    message: `Connected thoughts`,
    at: Date.now(),
    restore: () => {
      store.deleteEdge(edgeId);
      useMindmapView.getState().setUndo(null);
      runtime.invalidate();
    },
  });
  runtime.invalidate();
  return edgeId;
}

/** Delete an edge only (both nodes stay completely unharmed), with undo support. */
export function deleteEdgeWithUndo(edgeId: string) {
  if (runtime.stress) return;
  const store = useMindmap.getState();
  const edge = store.edges[edgeId];
  if (!edge) return;

  const snapshot = { ...edge };
  store.deleteEdge(edgeId);

  useMindmapView.getState().setUndo({
    message: `Severed connection`,
    at: Date.now(),
    restore: () => {
      store.createEdge({
        id: snapshot.id,
        source: snapshot.source,
        target: snapshot.target,
        kind: snapshot.kind,
        style: snapshot.style,
      });
      useMindmapView.getState().setUndo(null);
      runtime.invalidate();
    },
  });
  runtime.invalidate();
}

/** Restyle an edge (color, thickness, dashed, arrow, curvature, label) with undo support. */
export function updateEdgeStyleWithUndo(edgeId: string, patch: Partial<EdgeStyle>) {
  if (runtime.stress) return;
  const store = useMindmap.getState();
  const edge = store.edges[edgeId];
  if (!edge) return;

  const prevStyle = { ...(edge.style || {}) };
  store.updateEdge(edgeId, { style: { ...prevStyle, ...patch } });

  useMindmapView.getState().setUndo({
    message: `Restyled connection`,
    at: Date.now(),
    restore: () => {
      store.updateEdge(edgeId, { style: prevStyle });
      useMindmapView.getState().setUndo(null);
      runtime.invalidate();
    },
  });
  runtime.invalidate();
}

/** Record a deliberate node move with undo. */
export function commitMoveWithUndo(id: string, oldPos: Vec3, newPos: Vec3) {
  if (runtime.stress) return;
  const store = useMindmap.getState();
  store.updateNode(id, { position: newPos });

  useMindmapView.getState().setUndo({
    message: `Moved thought`,
    at: Date.now(),
    restore: () => {
      store.updateNode(id, { position: oldPos });
      useMindmapView.getState().setUndo(null);
      runtime.invalidate();
    },
  });
}

/** Delete — remove a node, reattach its children to its parent, offer undo. */
export function deleteWithUndo(id: string) {
  if (runtime.stress) return;
  const store = useMindmap.getState();
  const g = runtime.graph ?? buildGraph(store.nodes, store.order, store.edges);
  const node = store.nodes[id];
  if (!node || !g) return;

  const kids = (g.children.get(id) ?? []).filter((k) => !g.virtual.has(k));
  let newParent = g.parent.get(id) ?? null;
  let promoted: string | null = null;
  if (!newParent && kids.length) {
    promoted = kids[0];
    newParent = promoted;
  }

  const affectedNodes = new Set<string>([id, ...(node.links || []), ...kids]);
  if (newParent) affectedNodes.add(newParent);
  const nodeSnapshot: Record<string, Node> = {};
  for (const a of affectedNodes) if (store.nodes[a]) nodeSnapshot[a] = store.nodes[a];

  // Capture attached edges snapshot
  const edgeSnapshot: Record<string, MindmapEdge> = {};
  for (const [eId, edge] of Object.entries(store.edges || {})) {
    if (edge.source === id || edge.target === id) {
      edgeSnapshot[eId] = edge;
    }
  }

  const snapOrder = [...store.order];

  store.deleteNode(id);
  if (newParent) {
    for (const k of kids) {
      if (k !== newParent) ensureLinked(newParent, k, "tree");
    }
  }
  if (promoted) {
    useMindmap.setState((s) => ({ order: [promoted!, ...s.order.filter((x) => x !== promoted)] }));
  }
  useMindmap.getState().select(newParent);

  useMindmapView.getState().setUndo({
    message: `Removed “${node.title || "Untitled"}”`,
    at: Date.now(),
    restore: () => {
      useMindmap.setState((s) => {
        const nodes = { ...s.nodes, ...nodeSnapshot };
        const edges = { ...(s.edges || {}), ...edgeSnapshot };
        const order = snapOrder.filter((x) => nodes[x]);
        for (const x of s.order) if (!order.includes(x)) order.push(x);
        return { nodes, edges, order, selectedId: id };
      });
      useMindmapView.getState().setUndo(null);
      runtime.flyTo(id);
    },
  });
  runtime.invalidate();
}

export function setAsRoot(id: string) {
  if (runtime.stress) return;
  useMindmap.setState((s) => ({ order: [id, ...s.order.filter((x) => x !== id)] }));
  runtime.flyTo(id);
}

export function linkNodes(a: string, b: string) {
  if (runtime.stress) return;
  ensureLinked(a, b, "crosslink");
}

/** Batch-write settled positions in a single store update. */
export function commitPositions(entries: Array<[string, Vec3]>) {
  if (runtime.stress || entries.length === 0) return;
  useMindmap.setState((s) => {
    const nodes = { ...s.nodes };
    for (const [id, p] of entries) {
      if (nodes[id]) nodes[id] = { ...nodes[id], position: p };
    }
    return { nodes };
  });
}
