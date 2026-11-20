import type { Node, MindmapEdge } from "./store";
import { isHexColor } from "./palette";

/** The graph content of one mindmap. */
export type MapDoc = {
  nodes: Record<string, Node>;
  edges: Record<string, MindmapEdge>;
  order: string[];
};

export type MapMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** Portable single-mindmap file, used to move maps between devices (e.g. the phone companion). */
export const MAP_FILE_KIND = "citadel-mindmap";
export const MAP_FILE_VERSION = 1;
export const MAP_FILE_EXTENSION = ".mindmap.json";

export type MapFile = {
  kind: typeof MAP_FILE_KIND;
  version: typeof MAP_FILE_VERSION;
  exportedAt: string;
  map: {
    name: string;
    createdAt: number;
    nodes: Record<string, Node>;
    edges: Record<string, MindmapEdge>;
    order: string[];
  };
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function serializeMapFile(meta: MapMeta, doc: MapDoc): string {
  const file: MapFile = {
    kind: MAP_FILE_KIND,
    version: MAP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    map: { name: meta.name, createdAt: meta.createdAt, nodes: doc.nodes, edges: doc.edges, order: doc.order },
  };
  return JSON.stringify(file, null, 2);
}

export function fileNameForMap(name: string): string {
  const slug = name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${slug || "mindmap"}${MAP_FILE_EXTENSION}`;
}

/** Validates and normalizes untrusted file text. Throws an Error with a user-facing message. */
export function parseMapFile(text: string): { name: string; createdAt: number; doc: MapDoc } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!isRecord(raw) || raw.kind !== MAP_FILE_KIND) throw new Error("Not a Citadel mindmap file.");
  if (num(raw.version, 0) < 1 || num(raw.version, 0) > MAP_FILE_VERSION) {
    throw new Error("Unsupported mindmap file version.");
  }
  const map = raw.map;
  if (!isRecord(map) || !isRecord(map.nodes)) throw new Error("Mindmap file has no nodes.");

  const nodes: Record<string, Node> = {};
  for (const [key, value] of Object.entries(map.nodes)) {
    if (!isRecord(value)) continue;
    const id = typeof value.id === "string" && value.id ? value.id : key;
    const pos = Array.isArray(value.position) ? value.position : [];
    nodes[id] = {
      id,
      title: typeof value.title === "string" ? value.title : "Untitled",
      body: typeof value.body === "string" ? value.body : "",
      position: [num(pos[0], 0), num(pos[1], 0), num(pos[2], 0)],
      hue: num(value.hue, 200),
      color: isHexColor(value.color) ? value.color : undefined,
      links: Array.isArray(value.links) ? value.links.filter((l): l is string => typeof l === "string") : [],
      createdAt: num(value.createdAt, Date.now()),
      starred: value.starred === true,
      bullets: Array.isArray(value.bullets) ? value.bullets.filter((b): b is string => typeof b === "string") : [],
    };
  }
  if (Object.keys(nodes).length === 0) throw new Error("Mindmap file contains no valid nodes.");
  for (const n of Object.values(nodes)) n.links = n.links.filter((l) => l in nodes && l !== n.id);

  const edges: Record<string, MindmapEdge> = {};
  if (isRecord(map.edges)) {
    for (const [key, value] of Object.entries(map.edges)) {
      if (!isRecord(value)) continue;
      const source = value.source;
      const target = value.target;
      if (typeof source !== "string" || typeof target !== "string" || !nodes[source] || !nodes[target]) continue;
      const id = typeof value.id === "string" && value.id ? value.id : key;
      edges[id] = {
        id,
        source,
        target,
        kind: value.kind === "tree" ? "tree" : "crosslink",
        ...(isRecord(value.style) ? { style: value.style as MindmapEdge["style"] } : {}),
      };
    }
  }

  const declared = Array.isArray(map.order) ? map.order.filter((id): id is string => typeof id === "string" && id in nodes) : [];
  const seen = new Set(declared);
  const order = [...declared, ...Object.keys(nodes).filter((id) => !seen.has(id))];

  const name = typeof map.name === "string" && map.name.trim() ? map.name.trim().slice(0, 80) : "Imported mindmap";
  return { name, createdAt: num(map.createdAt, Date.now()), doc: { nodes, edges, order } };
}
