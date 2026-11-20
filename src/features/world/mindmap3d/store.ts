import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCitadelStore, registerCitadelHydrationCallback } from "@/core/state/citadelStore";
import type { Mindmap3dState } from "@/core/model/types";
import { parseMapFile, serializeMapFile, type MapDoc, type MapMeta } from "./library";
import {
  getCitadelSettings,
  MINDMAP_EDGE_CURVATURE,
  MINDMAP_EDGE_HEX,
} from "@/arboretum/components/citadel-rebuilt/settings/citadelSettings";

export type Node = {
  id: string;
  title: string;
  body: string;
  /** Position in space, roughly bounded to a sphere of radius ~10. */
  position: [number, number, number];
  /** Hue in degrees (0–360). */
  hue: number;
  /** Optional custom color (#rrggbb) from the color wheel; overrides the hue accent. */
  color?: string;
  /** IDs of other nodes this one is linked to. */
  links: string[];
  createdAt: number;
  starred?: boolean;
  bullets?: string[];
};

export type EdgeKind = "tree" | "crosslink";

export type EdgeStyle = {
  color?: string; // hex or preset: cyan (#3ff0ff), magenta (#ff4fd8), gold (#ffc95c)
  thickness?: number; // 1 to 5 (default: 1.5)
  dashed?: boolean; // false = solid, true = dashed
  curvature?: number; // -1 to 1 (0 = straight, default 0.15)
  arrow?: boolean; // directed (arrowhead) vs undirected
  label?: string; // optional short label
};

export type MindmapEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  style?: EdgeStyle;
};

type State = {
  nodes: Record<string, Node>;
  edges: Record<string, MindmapEdge>;
  order: string[];
  selectedId: string | null;
  selectedEdgeId: string | null;
  hoveredId: string | null;
  hoveredEdgeId: string | null;
  draggingId: string | null;
  linkingSourceId: string | null;
  /** Whether the mindmap portal overlay is open. */
  open: boolean;
  /** Library: the live nodes/edges/order above always belong to `activeMapId`. */
  activeMapId: string;
  maps: Record<string, MapMeta>;
  /** Content of every inactive map, keyed by map id. */
  stash: Record<string, MapDoc>;
};

type Actions = {
  createNode: (seed?: Partial<Node>) => string;
  updateNode: (id: string, patch: Partial<Omit<Node, "id" | "createdAt">>) => void;
  deleteNode: (id: string) => void;
  createEdge: (seed: { source: string; target: string; kind?: EdgeKind; style?: EdgeStyle; id?: string }) => string;
  updateEdge: (id: string, patch: Partial<Omit<MindmapEdge, "id">>) => void;
  deleteEdge: (id: string) => void;
  toggleLink: (a: string, b: string) => void;
  select: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  hover: (id: string | null) => void;
  hoverEdge: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  startLinking: (sourceId: string) => void;
  cancelLinking: () => void;
  finishLinking: (targetId: string) => string | null;
  openPortal: () => void;
  closePortal: () => void;
  togglePortal: () => void;
  toggleStar: (id: string) => void;
  addBullet: (id: string, text: string) => void;
  removeBullet: (id: string, index: number) => void;
  updateBullet: (id: string, index: number, text: string) => void;
  createMap: (name?: string) => string;
  switchMap: (id: string) => boolean;
  renameMap: (id: string, name: string) => void;
  duplicateMap: (id: string) => string | null;
  deleteMap: (id: string) => boolean;
  exportMap: (id: string) => { fileText: string; name: string } | null;
  importMap: (fileText: string) => { ok: true; id: string } | { ok: false; error: string };
  reset: () => void;
  loadDurableState: (persisted: Mindmap3dState) => void;
};

export const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const randomPos = (): [number, number, number] => {
  const r = 5 + Math.random() * 8;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return [
    Number((r * Math.sin(phi) * Math.cos(theta)).toFixed(2)),
    Number((r * Math.sin(phi) * Math.sin(theta)).toFixed(2)),
    Number((r * Math.cos(phi)).toFixed(2)),
  ];
};

const randomHue = () => Math.floor(Math.random() * 360);

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

const seed = (): Pick<State, "nodes" | "edges" | "order"> => {
  const rows: Array<{ title: string; body: string; hue: number }> = [
    { title: "Branch A", body: "A primary concept in your mindscape.", hue: 30 },
    { title: "Branch B", body: "Another direction worth exploring.", hue: 130 },
    { title: "Detail", body: "A specific note under one of the branches.", hue: 290 },
  ];
  const nodes: Record<string, Node> = {};
  const edges: Record<string, MindmapEdge> = {};
  const order: string[] = [];
  rows.forEach((r, i) => {
    const id = rid();
    nodes[id] = {
      id,
      title: r.title,
      body: r.body,
      hue: r.hue,
      position: randomPos(),
      links: [],
      createdAt: Date.now() + i,
      starred: false,
      bullets: [],
    };
    order.push(id);
  });
  if (order.length >= 2) {
    nodes[order[0]].links = [order[1]];
    nodes[order[1]].links = [order[0]];
    const eId = rid();
    edges[eId] = {
      id: eId,
      source: order[0],
      target: order[1],
      kind: "tree",
      style: { curvature: 0.12, thickness: 1.5 },
    };
  }
  return { nodes, edges, order };
};

const MAX_MAP_NAME = 80;
const cleanName = (name: string | undefined, fallback: string) =>
  (name ?? "").trim().slice(0, MAX_MAP_NAME) || fallback;

const makeMeta = (name: string): MapMeta => {
  const now = Date.now();
  return { id: rid(), name, createdAt: now, updatedAt: now };
};

const freshDoc = (): MapDoc => {
  const id = rid();
  return {
    nodes: {
      [id]: {
        id,
        title: "Root",
        body: "",
        hue: randomHue(),
        position: [0, 0, 0],
        links: [],
        createdAt: Date.now(),
        starred: false,
        bullets: [],
      },
    },
    edges: {},
    order: [id],
  };
};

const cloneDoc = (doc: MapDoc): MapDoc => JSON.parse(JSON.stringify(doc)) as MapDoc;

const nextMapName = (maps: Record<string, MapMeta>) => {
  const used = new Set(Object.values(maps).map((m) => m.name));
  for (let i = Object.keys(maps).length + 1; ; i++) {
    const candidate = `Mindmap ${i}`;
    if (!used.has(candidate)) return candidate;
  }
};

const uniqueName = (maps: Record<string, MapMeta>, base: string) => {
  const used = new Set(Object.values(maps).map((m) => m.name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`.slice(0, MAX_MAP_NAME + 6);
    if (!used.has(candidate)) return candidate;
  }
};

const selectionReset = {
  selectedId: null,
  selectedEdgeId: null,
  hoveredId: null,
  hoveredEdgeId: null,
  draggingId: null,
  linkingSourceId: null,
} as const;

/** Normalizes raw persisted/canonical data into a full durable snapshot, including the map library. */
export function toDurableState(data: any): Mindmap3dState {
  const nodes = data.nodes as Mindmap3dState["nodes"];
  const base: Mindmap3dState = {
    nodes,
    edges: data.edges || {},
    order: Array.isArray(data.order) ? data.order : Object.keys(nodes),
  };
  const maps = data.maps && typeof data.maps === "object" ? (data.maps as Record<string, MapMeta>) : null;
  const activeMapId = typeof data.activeMapId === "string" ? data.activeMapId : null;
  if (!maps || !activeMapId || !maps[activeMapId]) return base;
  const stash: Record<string, MapDoc> = {};
  for (const [id, doc] of Object.entries((data.stash ?? {}) as Record<string, MapDoc>)) {
    if (id !== activeMapId && maps[id] && doc && typeof doc.nodes === "object") {
      stash[id] = {
        nodes: doc.nodes,
        edges: doc.edges || {},
        order: Array.isArray(doc.order) ? doc.order : Object.keys(doc.nodes),
      };
    }
  }
  const liveMaps: Record<string, MapMeta> = {};
  for (const id of [activeMapId, ...Object.keys(stash)]) liveMaps[id] = maps[id];
  return { ...base, activeMapId, maps: liveMaps, stash };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: string | null = null;
let pendingKey: string | null = null;

export const cancelPendingMindmapSave = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingKey = null;
  pendingState = null;
};

const debouncedStorage = {
  getItem: (key: string): string | null => {
    // 1. In-flight pending state
    if (pendingKey === key && pendingState !== null) {
      return pendingState;
    }
    // 2. Durable native store from Citadel canonical state (citadel-profile.json)
    try {
      const canonicalState = useCitadelStore.getState()?.state;
      if (canonicalState?.mindmap3d && Object.keys(canonicalState.mindmap3d.nodes).length > 0) {
        return JSON.stringify({ state: canonicalState.mindmap3d, version: 3 });
      }
    } catch {
      // ignore
    }
    // 3. Fallback to localStorage / bridged vault storage
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    pendingKey = key;
    pendingState = value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      flushMindmapStorage();
    }, 400);
  },
  removeItem: (key: string): void => {
    cancelPendingMindmapSave();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

const initialLibrary = () => {
  const meta = makeMeta("Mindmap 1");
  return { activeMapId: meta.id, maps: { [meta.id]: meta }, stash: {} as Record<string, MapDoc> };
};

export const useMindmap = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...seed(),
      ...initialLibrary(),
      selectedId: null,
      selectedEdgeId: null,
      hoveredId: null,
      hoveredEdgeId: null,
      draggingId: null,
      linkingSourceId: null,
      open: false,

      createNode: (partial) => {
        const id = rid();
        const node: Node = {
          id,
          title: partial?.title ?? "New node",
          body: partial?.body ?? "",
          position: partial?.position ?? randomPos(),
          hue: partial?.hue ?? randomHue(),
          color: partial?.color,
          links: partial?.links ?? [],
          createdAt: partial?.createdAt ?? Date.now(),
          starred: partial?.starred ?? false,
          bullets: partial?.bullets ? [...partial.bullets] : [],
        };
        set((s) => ({
          nodes: { ...s.nodes, [id]: node },
          order: [...s.order, id],
          selectedId: id,
          selectedEdgeId: null,
        }));
        return id;
      },

      updateNode: (id, patch) =>
        set((s) => {
          const c = s.nodes[id];
          if (!c) return s;
          return { nodes: { ...s.nodes, [id]: { ...c, ...patch } } };
        }),

      deleteNode: (id) =>
        set((s) => {
          const { [id]: _gone, ...rest } = s.nodes;
          for (const k of Object.keys(rest)) {
            if (rest[k].links.includes(id)) {
              rest[k] = { ...rest[k], links: rest[k].links.filter((l) => l !== id) };
            }
          }
          // Also purge any edges attached to this node
          const nextEdges: Record<string, MindmapEdge> = {};
          for (const [eId, edge] of Object.entries(s.edges || {})) {
            if (edge.source !== id && edge.target !== id) {
              nextEdges[eId] = edge;
            }
          }
          return {
            nodes: rest,
            edges: nextEdges,
            order: s.order.filter((x) => x !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
            hoveredId: s.hoveredId === id ? null : s.hoveredId,
            linkingSourceId: s.linkingSourceId === id ? null : s.linkingSourceId,
          };
        }),

      createEdge: (spec) => {
        const { source, target, kind = "crosslink", style } = spec;
        if (source === target) return "";
        const id = spec.id ?? rid();
        const prefs = getCitadelSettings();
        const newEdge: MindmapEdge = {
          id,
          source,
          target,
          kind,
          style: {
            curvature: style?.curvature ?? MINDMAP_EDGE_CURVATURE[prefs.mindmapEdgeShape],
            thickness: style?.thickness ?? 1.5,
            dashed: style?.dashed ?? (kind === "crosslink"),
            arrow: style?.arrow ?? false,
            color: style?.color ?? MINDMAP_EDGE_HEX[prefs.mindmapEdgeColor],
            label: style?.label,
            ...style,
          },
        };
        set((s) => {
          const na = s.nodes[source];
          const nb = s.nodes[target];
          const updatedNodes = { ...s.nodes };
          if (na && !na.links.includes(target)) {
            updatedNodes[source] = { ...na, links: [...na.links, target] };
          }
          if (nb && !nb.links.includes(source)) {
            updatedNodes[target] = { ...nb, links: [...nb.links, source] };
          }
          return {
            edges: { ...(s.edges || {}), [id]: newEdge },
            nodes: updatedNodes,
          };
        });
        return id;
      },

      updateEdge: (id, patch) =>
        set((s) => {
          const edge = (s.edges || {})[id];
          if (!edge) return s;
          return {
            edges: {
              ...s.edges,
              [id]: {
                ...edge,
                ...patch,
                style: {
                  ...edge.style,
                  ...patch.style,
                },
              },
            },
          };
        }),

      deleteEdge: (id) =>
        set((s) => {
          const edge = (s.edges || {})[id];
          if (!edge) return s;
          const { [id]: _gone, ...nextEdges } = s.edges;
          // Check if there are any remaining edges between source and target
          const hasOtherEdge = Object.values(nextEdges).some(
            (e) => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source)
          );
          const updatedNodes = { ...s.nodes };
          if (!hasOtherEdge) {
            const na = updatedNodes[edge.source];
            const nb = updatedNodes[edge.target];
            if (na) updatedNodes[edge.source] = { ...na, links: na.links.filter((l) => l !== edge.target) };
            if (nb) updatedNodes[edge.target] = { ...nb, links: nb.links.filter((l) => l !== edge.source) };
          }
          return {
            edges: nextEdges,
            nodes: updatedNodes,
            selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
            hoveredEdgeId: s.hoveredEdgeId === id ? null : s.hoveredEdgeId,
          };
        }),

      toggleLink: (a, b) => {
        if (a === b) return;
        const state = get();
        // Check if an edge already exists
        const existing = Object.values(state.edges || {}).find(
          (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
        );
        if (existing) {
          state.deleteEdge(existing.id);
        } else {
          state.createEdge({ source: a, target: b, kind: "crosslink" });
        }
      },

      select: (id) => set({ selectedId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
      selectEdge: (id) => set({ selectedEdgeId: id, selectedId: id ? null : get().selectedId }),
      hover: (id) => set({ hoveredId: id }),
      hoverEdge: (id) => set({ hoveredEdgeId: id }),
      setDragging: (id) => set({ draggingId: id }),

      startLinking: (sourceId) => set({ linkingSourceId: sourceId }),
      cancelLinking: () => set({ linkingSourceId: null }),
      finishLinking: (targetId) => {
        const { linkingSourceId } = get();
        if (!linkingSourceId || linkingSourceId === targetId) {
          set({ linkingSourceId: null });
          return null;
        }
        const edgeId = get().createEdge({
          source: linkingSourceId,
          target: targetId,
          kind: "crosslink",
        });
        set({ linkingSourceId: null, selectedEdgeId: edgeId, selectedId: null });
        return edgeId;
      },

      openPortal: () => set({ open: true }),
      closePortal: () => set({ open: false }),
      togglePortal: () => set((s) => ({ open: !s.open })),
      toggleStar: (id) =>
        set((s) => {
          const c = s.nodes[id];
          if (!c) return s;
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...c, starred: !c.starred },
            },
          };
        }),
      addBullet: (id, text) =>
        set((s) => {
          const c = s.nodes[id];
          if (!c) return s;
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...c, bullets: [...(c.bullets || []), text] },
            },
          };
        }),
      removeBullet: (id, index) =>
        set((s) => {
          const c = s.nodes[id];
          if (!c) return s;
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...c, bullets: (c.bullets || []).filter((_, i) => i !== index) },
            },
          };
        }),
      updateBullet: (id, index, text) =>
        set((s) => {
          const c = s.nodes[id];
          if (!c) return s;
          const nextB = [...(c.bullets || [])];
          nextB[index] = text;
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...c, bullets: nextB },
            },
          };
        }),
      createMap: (name) => {
        const s = get();
        const meta = makeMeta(cleanName(name, nextMapName(s.maps)));
        set({
          stash: { ...s.stash, [s.activeMapId]: { nodes: s.nodes, edges: s.edges, order: s.order } },
          maps: { ...s.maps, [s.activeMapId]: { ...s.maps[s.activeMapId], updatedAt: Date.now() }, [meta.id]: meta },
          activeMapId: meta.id,
          ...freshDoc(),
          ...selectionReset,
        });
        return meta.id;
      },
      switchMap: (id) => {
        const s = get();
        const target = s.stash[id];
        if (id === s.activeMapId || !target || !s.maps[id]) return false;
        const { [id]: _taken, ...restStash } = s.stash;
        set({
          stash: { ...restStash, [s.activeMapId]: { nodes: s.nodes, edges: s.edges, order: s.order } },
          maps: { ...s.maps, [s.activeMapId]: { ...s.maps[s.activeMapId], updatedAt: Date.now() } },
          activeMapId: id,
          ...target,
          ...selectionReset,
        });
        return true;
      },
      renameMap: (id, name) =>
        set((s) => {
          const meta = s.maps[id];
          if (!meta) return s;
          return { maps: { ...s.maps, [id]: { ...meta, name: cleanName(name, meta.name), updatedAt: Date.now() } } };
        }),
      duplicateMap: (id) => {
        const s = get();
        const meta = s.maps[id];
        const source = id === s.activeMapId ? { nodes: s.nodes, edges: s.edges, order: s.order } : s.stash[id];
        if (!meta || !source) return null;
        const copyMeta = makeMeta(uniqueName(s.maps, `${meta.name} copy`));
        set({
          stash: { ...s.stash, [copyMeta.id]: cloneDoc(source) },
          maps: { ...s.maps, [copyMeta.id]: copyMeta },
        });
        return copyMeta.id;
      },
      deleteMap: (id) => {
        const s = get();
        if (!s.maps[id] || Object.keys(s.maps).length <= 1) return false;
        const { [id]: _meta, ...restMaps } = s.maps;
        if (id === s.activeMapId) {
          const nextId = Object.keys(s.stash)[0];
          const { [nextId]: nextDoc, ...restStash } = s.stash;
          set({ maps: restMaps, stash: restStash, activeMapId: nextId, ...nextDoc, ...selectionReset });
        } else {
          const { [id]: _doc, ...restStash } = s.stash;
          set({ maps: restMaps, stash: restStash });
        }
        return true;
      },
      exportMap: (id) => {
        const s = get();
        const meta = s.maps[id];
        const doc = id === s.activeMapId ? { nodes: s.nodes, edges: s.edges, order: s.order } : s.stash[id];
        if (!meta || !doc) return null;
        return { fileText: serializeMapFile(meta, doc), name: meta.name };
      },
      importMap: (fileText) => {
        try {
          const parsed = parseMapFile(fileText);
          const s = get();
          const meta = makeMeta(uniqueName(s.maps, parsed.name));
          set({
            stash: { ...s.stash, [meta.id]: parsed.doc },
            maps: { ...s.maps, [meta.id]: { ...meta, createdAt: parsed.createdAt } },
          });
          return { ok: true, id: meta.id };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Import failed." };
        }
      },
      reset: () => {
        set({ ...seed(), ...initialLibrary(), ...selectionReset });
      },
      loadDurableState: (persisted) => {
        const durable = toDurableState(persisted);
        set({
          nodes: durable.nodes,
          edges: durable.edges,
          order: durable.order,
          ...(durable.maps && durable.activeMapId && durable.stash
            ? { activeMapId: durable.activeMapId, maps: durable.maps, stash: durable.stash }
            : {}),
          ...selectionReset,
        });
      },
    }),
    {
      name: "mindmap-v1",
      version: 3,
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (s) => ({
        nodes: s.nodes,
        edges: s.edges,
        order: s.order,
        activeMapId: s.activeMapId,
        maps: s.maps,
        stash: s.stash,
      }),
      migrate: (persistedState: any, version: number) => {
        const state = persistedState as State;
        if (!state.edges || Object.keys(state.edges).length === 0) {
          state.edges = {};
          if (state.nodes) {
            const seen = new Set<string>();
            for (const [id, node] of Object.entries(state.nodes)) {
              for (const targetId of node.links || []) {
                if (targetId === id || !state.nodes[targetId]) continue;
                const k = edgeKey(id, targetId);
                if (seen.has(k)) continue;
                seen.add(k);
                const eId = rid();
                state.edges[eId] = {
                  id: eId,
                  source: id,
                  target: targetId,
                  kind: "tree",
                  style: { curvature: 0.12, thickness: 1.5 },
                };
              }
            }
          }
        }
        return state;
      },
    }
  )
);

export const flushMindmapStorage = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pendingKey && pendingState !== null && typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(pendingKey, pendingState);
    } catch {
      // ignore
    }
    try {
      const parsed = JSON.parse(pendingState);
      const data = parsed.state || parsed;
      if (data && data.nodes) {
        const canonical = useCitadelStore.getState();
        if (canonical && typeof canonical.setMindmap3d === "function") {
          canonical.setMindmap3d(toDurableState(data));
        }
      }
    } catch {
      // ignore
    }
    pendingKey = null;
    pendingState = null;
  } else if (!pendingKey) {
    // If no debounced write is pending, still sync current in-memory store to durable storage if available
    try {
      const s = useMindmap.getState();
      if (s?.nodes && Object.keys(s.nodes).length > 0) {
        const canonical = useCitadelStore.getState();
        if (canonical && typeof canonical.setMindmap3d === "function") {
          canonical.setMindmap3d(toDurableState(s));
        }
      }
    } catch {
      // ignore
    }
  }
};

export const flushMindmapSave = flushMindmapStorage;

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushMindmapStorage);
  window.addEventListener("blur", flushMindmapStorage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushMindmapStorage();
  });
}

export function hydrateMindmapFromStorage(persisted?: Mindmap3dState | null): void {
  // Seeding rule: seed only when there is nothing to load.
  // If persisted user data exists, load those nodes and NEVER seed starter nodes over them.
  if (persisted && persisted.nodes && Object.keys(persisted.nodes).length > 0) {
    useMindmap.getState().loadDurableState(persisted);
    return;
  }
  // Check local storage backup
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem("mindmap-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = parsed.state || parsed;
        if (data.nodes && Object.keys(data.nodes).length > 0) {
          useMindmap.getState().loadDurableState(toDurableState(data));
          flushMindmapStorage();
          return;
        }
      }
    } catch {
      // Fall through
    }
  }
  // If no persisted user nodes exist (first launch or explicit full wipe), seed starter nodes
  useMindmap.getState().reset();
}

// Automatically subscribe to canonical Citadel store hydration
registerCitadelHydrationCallback((citadelState) => {
  hydrateMindmapFromStorage(citadelState.mindmap3d ?? null);
});

