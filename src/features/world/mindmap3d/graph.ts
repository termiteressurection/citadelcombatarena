// Pure graph derivation for the mindmap. The stored schema is a flat set of
// nodes with first-class edges and backward-compatible `links`; here we derive
// a readable tree (root, parents, depth, kind) without changing what is persisted.

import type { Node, MindmapEdge, EdgeKind, EdgeStyle } from "./store";
import { edgeKey } from "./store";

export type NodeKind = "branch" | "entry" | "tag";

export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  tree: boolean;
  kind: EdgeKind;
  style?: EdgeStyle;
}

export interface MindGraph {
  ids: string[];
  rootId: string | null;
  parent: Map<string, string | null>;
  children: Map<string, string[]>;
  depth: Map<string, number>;
  /** Undirected adjacency from stored links (plus virtual root ties for orphans). */
  neighbors: Map<string, string[]>;
  /** Drawable edges: real stored edges with full kind, style, and tree status. */
  edges: GraphEdge[];
  /** Orphan components hang off the root without a stored link. */
  virtual: Set<string>;
  descendants: Map<string, number>;
}

/** Topology fingerprint — changes only when ids, order, links or edges change. */
export function topologyKey(
  nodes: Record<string, Node>,
  order: string[],
  edges?: Record<string, MindmapEdge>
): string {
  let key = "";
  for (const id of order) {
    const n = nodes[id];
    if (!n) continue;
    key += id + ":" + (n.links || []).join(",") + "|";
  }
  if (edges) {
    for (const [eId, e] of Object.entries(edges)) {
      key += `${eId}:${e.source}->${e.target}:${e.kind}:${e.style?.curvature ?? 0}:${e.style?.color ?? ""}|`;
    }
  }
  return key;
}

export function buildGraph(
  nodes: Record<string, Node>,
  order: string[],
  storedEdges?: Record<string, MindmapEdge>
): MindGraph {
  const ids = order.filter((id) => nodes[id]);
  for (const id of Object.keys(nodes)) if (!ids.includes(id)) ids.push(id);
  const rank = new Map(ids.map((id, i) => [id, i]));

  // General adjacency (all connected neighbors, tree or crosslink)
  const adj = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  // Tree-only adjacency for strict hierarchy derivation
  const treeAdj = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));

  // Map to index stored edges by node pair
  const edgeByPair = new Map<string, MindmapEdge>();
  if (storedEdges) {
    for (const edge of Object.values(storedEdges)) {
      if (!nodes[edge.source] || !nodes[edge.target] || edge.source === edge.target) continue;
      const k = edgeKey(edge.source, edge.target);
      edgeByPair.set(k, edge);
    }
  }

  for (const id of ids) {
    for (const other of nodes[id].links || []) {
      if (other === id || !adj.has(other)) continue;
      adj.get(id)!.add(other);
      adj.get(other)!.add(id);

      const k = edgeKey(id, other);
      const edge = edgeByPair.get(k);
      // If edges are stored, only tree edges define the parent-child hierarchy.
      // If storedEdges is omitted (legacy/test callers), all links define tree.
      if (!storedEdges || !edge || edge.kind === "tree") {
        treeAdj.get(id)!.add(other);
        treeAdj.get(other)!.add(id);
      }
    }
  }

  // Also include any stored edges where links might not have synced yet
  if (storedEdges) {
    for (const edge of Object.values(storedEdges)) {
      const { source, target, kind } = edge;
      if (source === target || !adj.has(source) || !adj.has(target)) continue;
      adj.get(source)!.add(target);
      adj.get(target)!.add(source);
      if (kind === "tree") {
        treeAdj.get(source)!.add(target);
        treeAdj.get(target)!.add(source);
      }
    }
  }

  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const depth = new Map<string, number>();
  const virtual = new Set<string>();
  const rootId = ids[0] ?? null;

  // BFS across TREE edges only: crosslinks do not mutate parent-child hierarchy
  const bfs = (start: string, startParent: string | null, startDepth: number) => {
    parent.set(start, startParent);
    depth.set(start, startDepth);
    if (startParent) children.get(startParent)!.push(start);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const next = [...treeAdj.get(cur)!].filter((n) => !depth.has(n)).sort((a, b) => rank.get(a)! - rank.get(b)!);
      for (const n of next) {
        parent.set(n, cur);
        depth.set(n, depth.get(cur)! + 1);
        children.get(cur)!.push(n);
        queue.push(n);
      }
    }
  };

  if (rootId) {
    bfs(rootId, null, 0);
    // Attach orphans (unconnected in tree hierarchy) virtually to root
    for (const id of ids) {
      if (depth.has(id)) continue;
      virtual.add(id);
      bfs(id, rootId, 1);
    }
  }

  const neighbors = new Map<string, string[]>();
  for (const id of ids) {
    const set = new Set(adj.get(id));
    const p = parent.get(id);
    if (p) set.add(p);
    for (const c of children.get(id)!) set.add(c);
    neighbors.set(id, [...set]);
  }

  // Build drawable edges list
  const edges: GraphEdge[] = [];
  const seenPairs = new Set<string>();

  // First add all stored edges
  if (storedEdges) {
    for (const edge of Object.values(storedEdges)) {
      if (!nodes[edge.source] || !nodes[edge.target] || edge.source === edge.target) continue;
      const k = edgeKey(edge.source, edge.target);
      if (seenPairs.has(k)) continue;
      seenPairs.add(k);
      const isTree = edge.kind === "tree" && (parent.get(edge.target) === edge.source || parent.get(edge.source) === edge.target);
      edges.push({
        id: edge.id,
        a: edge.source,
        b: edge.target,
        tree: isTree,
        kind: edge.kind,
        style: edge.style,
      });
    }
  }

  // Add any legacy/unstored links
  for (const id of ids) {
    for (const other of adj.get(id)!) {
      const k = edgeKey(id, other);
      if (seenPairs.has(k)) continue;
      seenPairs.add(k);
      const isTree = parent.get(other) === id || parent.get(id) === other;
      edges.push({
        id: `${id}_${other}`,
        a: id,
        b: other,
        tree: isTree,
        kind: isTree ? "tree" : "crosslink",
        style: { curvature: 0.15, thickness: 1.5 },
      });
    }
  }

  const descendants = new Map<string, number>();
  const count = (id: string): number => {
    let total = 0;
    for (const c of children.get(id)!) total += 1 + count(c);
    descendants.set(id, total);
    return total;
  };
  if (rootId) count(rootId);

  return { ids, rootId, parent, children, depth, neighbors, edges, virtual, descendants };
}

export function kindOf(g: MindGraph, node: Node): NodeKind {
  if (node.id === g.rootId || (g.children.get(node.id)?.length ?? 0) > 0) return "branch";
  if (node.body?.trim() || (node.bullets?.length ?? 0) > 0) return "entry";
  return "tag";
}

export interface Visibility {
  visible: Set<string>;
  autoDepth: number;
  isOpen: (id: string) => boolean;
  /** Hidden descendant counts for visible nodes whose branch is folded. */
  folded: Map<string, number>;
}

/** Auto-declutter: show levels until the budget is reached; explicit user folds win. */
export function computeVisibility(
  g: MindGraph,
  expanded: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
  budget: number
): Visibility {
  const perDepth: number[] = [];
  for (const d of g.depth.values()) perDepth[d] = (perDepth[d] ?? 0) + 1;
  let autoDepth = 0;
  let running = perDepth[0] ?? 0;
  for (let d = 0; d < perDepth.length - 1; d++) {
    const nextCount = perDepth[d + 1] ?? 0;
    if (running + nextCount > budget) break;
    running += nextCount;
    autoDepth = d + 1;
  }
  const isOpen = (id: string) =>
    !collapsed.has(id) && (expanded.has(id) || (g.depth.get(id) ?? 0) < autoDepth);

  const visible = new Set<string>();
  const folded = new Map<string, number>();
  if (g.rootId) {
    const stack = [g.rootId];
    while (stack.length) {
      const id = stack.pop()!;
      visible.add(id);
      const kids = g.children.get(id) ?? [];
      if (kids.length === 0) continue;
      if (isOpen(id)) stack.push(...kids);
      else folded.set(id, g.descendants.get(id) ?? kids.length);
    }
  }
  return { visible, autoDepth, isOpen, folded };
}

export function pathToRoot(g: MindGraph, id: string): string[] {
  const path: string[] = [];
  let cur: string | null | undefined = id;
  while (cur) {
    path.unshift(cur);
    cur = g.parent.get(cur);
  }
  return path;
}

/** Depth-first order of visible nodes — the Tab order. */
export function visibleOrder(g: MindGraph, visible: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (!g.rootId) return out;
  const walk = (id: string) => {
    out.push(id);
    for (const c of g.children.get(id) ?? []) if (visible.has(c)) walk(c);
  };
  walk(g.rootId);
  return out;
}

/** Subsequence fuzzy score. Higher is better; null = no match. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const t = text.toLowerCase();
  if (t === q) return 1000;
  const direct = t.indexOf(q);
  if (direct >= 0) return 500 - direct + (direct === 0 || /\W/.test(t[direct - 1]) ? 100 : 0);
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    streak = found === ti ? streak + 1 : 0;
    score += 4 + streak * 3 + (found === 0 || /\W/.test(t[found - 1]) ? 6 : 0) - Math.min(found - ti, 6);
    ti = found + 1;
  }
  return score;
}

export function searchNodes(
  nodes: Record<string, Node>,
  ids: string[],
  query: string,
  limit = 8
): Array<{ id: string; score: number }> {
  const out: Array<{ id: string; score: number }> = [];
  for (const id of ids) {
    const n = nodes[id];
    if (!n) continue;
    const title = fuzzyScore(query, n.title || "");
    const body = fuzzyScore(query, n.body || "");
    const best = Math.max(title ?? -Infinity, body !== null ? body * 0.4 : -Infinity);
    if (best > -Infinity) out.push({ id, score: best });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
