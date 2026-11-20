import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Node, MindmapEdge, EdgeStyle } from "./store";
import { useMindmap } from "./store";
import { kindOf, visibleOrder, type MindGraph, type NodeKind, type Visibility } from "./graph";
import { ForceLayout, type Spring, type Vec3 } from "./layout";
import { SHAPES, reticleGeometry, sunGeometry } from "./polyhedra";
import { ACCENTS, INTENSITY, VOID, resolveNodeColor } from "./palette";
import {
  commitPositions,
  focusNode,
  focusEdge,
  runtime,
  toggleFold,
  createChild,
  createCrosslinkWithUndo,
  commitMoveWithUndo,
  updateEdgeStyleWithUndo,
} from "./runtime";
import { labelSlots, edgeLabelSlots } from "./LabelLayer";
import type { SemanticPairScore } from "@/core/semantic/semanticClient";
import { CitadelSkyDome } from "@/arboretum/components/citadel-rebuilt/world/sky/CitadelSkyDome";

const MINDMAP_CHAMBER = {
  id: -1000,
  name: "Mind Map",
  template: "mindmap",
  depth: 0,
  doors: [] as number[],
  description: "",
  thoughts: [] as any[],
};

const STATE_W = 1024;
const EDGE_SEGMENTS = 20;
const PANEL_W = 380;
const IDLE_FPS = 20;
const BASE_SCALE: Record<NodeKind | "root", number> = { root: 1.35, branch: 1.0, entry: 0.82, tag: 0.62 };

const STATE_GLSL = /* glsl */ `
uniform highp sampler2D uState;
uniform float uStateHeight;
vec4 st(int t) {
  float ft = float(t);
  float x = mod(ft, float(${STATE_W}));
  float y = floor(ft / float(${STATE_W}));
  return texture2D(uState, vec2((x + 0.5) / float(${STATE_W}), (y + 0.5) / max(uStateHeight, 1.0)));
}
`;

const nodeVert = /* glsl */ `
${STATE_GLSL}
attribute float aNode;
uniform float uTime;
varying vec3 vColor;
varying float vAlpha;
varying vec3 vMv;
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
void main() {
  int i = int(aNode + 0.5);
  vec4 s0 = st(i * 2);
  vec4 s1 = st(i * 2 + 1);
  float ph = fract(sin(aNode * 12.9898 + 1.7) * 43758.5453) * 6.2831853;
  vec3 o = rotY(uTime * 0.06 + ph) * rotX(0.55 + ph * 0.2) * position;
  vColor = s1.rgb;
  vec4 mv = modelViewMatrix * vec4(s0.xyz + o * s1.w, 1.0);
  vMv = mv.xyz;
  float camDist = length(mv.xyz);
  float fog = max(0.70, exp(-camDist * camDist * 0.000002));
  vAlpha = max(s0.w * 0.85, 0.60) * step(0.0001, s1.w) * fog;
  gl_Position = projectionMatrix * mv;
}`;

const flatFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(vColor, vAlpha); }`;

const haloVert = /* glsl */ `
${STATE_GLSL}
attribute float aNode;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  int i = int(aNode + 0.5);
  vec4 s0 = st(i * 2);
  vec4 s1 = st(i * 2 + 1);
  vec4 mv = modelViewMatrix * vec4(s0.xyz, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = s0.w;
  float camDist = length(mv.xyz);
  float fog = max(0.70, exp(-camDist * camDist * 0.000002));
  gl_PointSize = min(s1.w * (3.2 + 2.8 * g) * 2.0 * uPx / max(-mv.z, 0.1), 480.0);
  vColor = s1.rgb;
  float haloFloor = max(g * 0.65, 0.45);
  vAlpha = haloFloor * step(0.0001, s1.w) * fog;
}`;

const haloFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, pow(1.0 - d, 2.6) * vAlpha);
}`;

const edgeVert = /* glsl */ `
${STATE_GLSL}
attribute float aA;
attribute float aB;
attribute float aT;
attribute float aCurvature;
attribute vec3 aColor;
attribute float aDashed;
attribute float aKind;
attribute float aSelected;
uniform float uTime;
uniform float uFocus;
uniform float uMotion;
varying vec3 vColor;
varying float vAlpha;
varying float vT;
varying float vDashed;
varying float vPulse;
varying vec3 vMv;
void main() {
  int ia = int(aA + 0.5);
  int ib = int(aB + 0.5);
  vec4 a0 = st(ia * 2); vec4 a1 = st(ia * 2 + 1);
  vec4 b0 = st(ib * 2); vec4 b1 = st(ib * 2 + 1);
  vec3 A = a0.xyz; vec3 B = b0.xyz; vec3 d = B - A;
  float L = length(d);
  
  // Robust 3D perpendicular vector calculation
  vec3 normD = L > 1e-4 ? d / L : vec3(0.0, 1.0, 0.0);
  vec3 up = abs(dot(normD, vec3(0.0, 1.0, 0.0))) > 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 perp = normalize(cross(normD, up));
  
  vec3 C = (A + B) * 0.5 + perp * (L * aCurvature);
  float t = aT;
  vec3 p = mix(mix(A, C, t), mix(C, B, t), t);
  
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vMv = mv.xyz;
  gl_Position = projectionMatrix * mv;
  
  vColor = aColor;
  float vis = step(0.0001, a1.w) * step(0.0001, b1.w);
  float camDist = length(mv.xyz);
  float fog = max(0.70, exp(-camDist * camDist * 0.000002));
  
  float baseAlpha = mix(0.70, 0.85, aKind);
  if (aSelected > 0.5) baseAlpha = 1.0;
  vAlpha = max(min(a0.w, b0.w), 0.60) * vis * baseAlpha * fog;
  
  bool fa = abs(aA - uFocus) < 0.5;
  bool fb = abs(aB - uFocus) < 0.5;
  float along = fa ? t : 1.0 - t;
  float head = fract(uTime * 0.32);
  vPulse = (fa || fb) ? uMotion * smoothstep(0.09, 0.0, abs(along - head)) : (aSelected > 0.5 ? 0.4 : 0.0);
  vT = t;
  vDashed = aDashed;
}`;

const edgeFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vT;
varying float vDashed;
varying float vPulse;
void main() {
  if (vDashed > 0.5 && fract(vT * 26.0) > 0.5) discard;
  gl_FragColor = vec4(vColor + vPulse * 0.4, vAlpha * (1.0 + vPulse * 1.8));
}`;

const gridVert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const gridFrag = /* glsl */ `
uniform vec3 uCenter;
uniform float uQuiet;
uniform float uRadius;
uniform vec3 uC1;
uniform vec3 uC2;
varying vec3 vW;
void main() {
  vec2 g = vW.xz / 6.0;
  vec2 gw = fwidth(g);
  vec2 gl = abs(fract(g - 0.5) - 0.5) / max(gw, vec2(1e-4));
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  float dist = length(vW.xz - uCenter.xz);
  float fade = exp(-(dist * dist) / (uRadius * uRadius));
  float lod = 1.0 - smoothstep(0.2, 0.8, max(gw.x, gw.y));
  vec3 col = mix(uC1, uC2, smoothstep(0.0, uRadius * 1.1, dist));
  gl_FragColor = vec4(col, line * fade * lod * uQuiet);
}`;

const starVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uDpr;
varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uDpr;
}`;

const starFrag = /* glsl */ `
uniform float uQuiet;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, (1.0 - d) * uQuiet);
}`;

function additive<T extends THREE.Material>(material: T): T {
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.blending = THREE.AdditiveBlending;
  return material;
}

const CYAN = new THREE.Color(...ACCENTS.cyan.rgb);
const MAGENTA = new THREE.Color(...ACCENTS.magenta.rgb);
const GOLD = new THREE.Color(...ACCENTS.gold.rgb);

const familyColor = (n: Node, isRoot: boolean) =>
  isRoot || n.starred ? ACCENTS.gold.rgb : resolveNodeColor(n).rgb;

export interface SceneProps {
  graph: MindGraph;
  vis: Visibility;
  nodes: Record<string, Node>;
  selectedId: string | null;
  reducedMotion: boolean;
  semanticPairs: SemanticPairScore[] | null;
  panelOpen: boolean;
}

export const Scene = React.memo(function Scene(props: SceneProps) {
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
  return (
    <Canvas
      frameloop="demand"
      dpr={dpr}
      camera={{ fov: 45, near: 0.1, far: 3000, position: [0, 12, 65] }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(VOID), 1)}
    >
      <World {...props} />
    </Canvas>
  );
});

interface SimState {
  sim: ForceLayout;
  ids: string[];
  index: Map<string, number>;
}

function World({ graph, vis, nodes, selectedId, reducedMotion, semanticPairs, panelOpen }: SceneProps) {
  const { camera, size, invalidate, gl, viewport } = useThree();
  const controlsRef = useRef<any>(null);
  const selectedEdgeId = useMindmap((s) => s.selectedEdgeId);
  const linkingSourceId = useMindmap((s) => s.linkingSourceId);
  const cancelLinking = useMindmap((s) => s.cancelLinking);
  const finishLinking = useMindmap((s) => s.finishLinking);
  const startLinking = useMindmap((s) => s.startLinking);

  const propsRef = useRef({ selectedId, selectedEdgeId, linkingSourceId, reducedMotion, panelOpen, vis, nodes });
  propsRef.current = { selectedId, selectedEdgeId, linkingSourceId, reducedMotion, panelOpen, vis, nodes };

  // ── Per-node buffers (rebuilt on topology change) ─────────────────────
  const prevRender = useRef(new Map<string, Vec3>());
  const buffers = useMemo(() => {
    const ids = graph.ids;
    const n = ids.length;
    const index = new Map(ids.map((id, i) => [id, i]));
    const renderPos = new Float32Array(n * 3);
    ids.forEach((id, i) => {
      const prev = prevRender.current.get(id);
      renderPos.set(prev ?? nodes[id]?.position ?? [0, 0, 0], i * 3);
    });
    const height = Math.max(1, Math.ceil((n * 2) / STATE_W));
    const data = new Float32Array(STATE_W * height * 4);
    const tex = new THREE.DataTexture(data, STATE_W, height, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return {
      n,
      ids,
      index,
      height,
      renderPos,
      inten: new Float32Array(n),
      scale: new Float32Array(n),
      color: new Float32Array(n * 3).fill(0.3),
      screen: new Float32Array(n * 4),
      data,
      tex,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
  useEffect(() => () => buffers.tex.dispose(), [buffers]);

  // Appearance fingerprint: only changes when node hues, stars, or links change (never on title/notes)
  const nodeAppearanceKey = useMemo(() => {
    let key = "";
    for (const id of buffers.ids) {
      const n = nodes[id];
      if (n) key += `${id}:${n.hue}:${n.color ?? ""}:${n.starred ? 1 : 0}:${(n.links || []).length}|`;
    }
    return key;
  }, [buffers.ids, nodes]);

  // Static per-node attributes
  const kinds = useMemo(
    () => buffers.ids.map((id) => (nodes[id] ? kindOf(graph, nodes[id]) : "tag")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buffers, graph, nodeAppearanceKey]
  );
  const kindsKey = kinds.join(",");
  const attrs = useMemo(() => {
    const family = new Float32Array(buffers.n * 3);
    const base = new Float32Array(buffers.n);
    const landmark = new Uint8Array(buffers.n);
    buffers.ids.forEach((id, i) => {
      const node = nodes[id];
      const isRoot = id === graph.rootId;
      if (node) family.set(familyColor(node, isRoot), i * 3);
      base[i] = isRoot ? BASE_SCALE.root : BASE_SCALE[kinds[i]];
      landmark[i] = isRoot ? 2 : node?.starred ? 1 : 0;
    });
    return { family, base, landmark };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffers, graph, kinds, nodeAppearanceKey]);

  // Visibility-derived arrays
  const visArrays = useMemo(() => {
    const visible = new Uint8Array(buffers.n);
    const anchor = new Int32Array(buffers.n);
    buffers.ids.forEach((id, i) => {
      visible[i] = vis.visible.has(id) ? 1 : 0;
      let cur: string | null | undefined = id;
      while (cur && !vis.visible.has(cur)) cur = graph.parent.get(cur);
      anchor[i] = cur ? buffers.index.get(cur)! : i;
    });
    return { visible, anchor };
  }, [buffers, vis, graph]);

  // ── Geometries ────────────────────────────────────────────────────────
  const nodeGeo = useMemo(() => {
    let total = 0;
    for (const k of kinds) total += SHAPES[k as NodeKind].length / 3;
    const pos = new Float32Array(total * 3);
    const idx = new Float32Array(total);
    let v = 0;
    kinds.forEach((k, i) => {
      const shape = SHAPES[k as NodeKind];
      pos.set(shape, v * 3);
      idx.fill(i, v, v + shape.length / 3);
      v += shape.length / 3;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aNode", new THREE.BufferAttribute(idx, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffers, kindsKey]);

  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffers.n * 3), 3));
    g.setAttribute("aNode", new THREE.BufferAttribute(Float32Array.from(buffers.ids, (_, i) => i), 1));
    return g;
  }, [buffers]);

  // Batched Edges Geometry with custom curvatures, styles and colors
  const edgeGeo = useMemo(() => {
    const m = graph.edges.length * EDGE_SEGMENTS * 2;
    const a = new Float32Array(m);
    const b = new Float32Array(m);
    const t = new Float32Array(m);
    const curvature = new Float32Array(m);
    const color = new Float32Array(m * 3);
    const dashed = new Float32Array(m);
    const kind = new Float32Array(m);
    const selected = new Float32Array(m);
    let v = 0;

    for (const e of graph.edges) {
      const ia = buffers.index.get(e.a);
      const ib = buffers.index.get(e.b);
      if (ia === undefined || ib === undefined) continue;

      const curv = e.style?.curvature ?? (e.tree ? 0.12 : 0.18);
      const isDash = e.style?.dashed ?? (e.kind === "crosslink");
      const isSel = selectedEdgeId === e.id ? 1 : 0;

      // Color resolution
      let colRgb: readonly [number, number, number] | [number, number, number] =
        e.kind === "crosslink" ? ACCENTS.magenta.rgb : ACCENTS.cyan.rgb;
      if (e.style?.color) {
        const c = new THREE.Color(e.style.color);
        colRgb = [c.r, c.g, c.b];
      }

      for (let s = 0; s < EDGE_SEGMENTS; s++) {
        for (const tt of [s / EDGE_SEGMENTS, (s + 1) / EDGE_SEGMENTS]) {
          a[v] = ia;
          b[v] = ib;
          t[v] = tt;
          curvature[v] = curv;
          dashed[v] = isDash ? 1 : 0;
          kind[v] = e.kind === "crosslink" ? 1 : 0;
          selected[v] = isSel;
          color[v * 3] = colRgb[0];
          color[v * 3 + 1] = colRgb[1];
          color[v * 3 + 2] = colRgb[2];
          v++;
        }
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    g.setAttribute("aA", new THREE.BufferAttribute(a, 1));
    g.setAttribute("aB", new THREE.BufferAttribute(b, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aCurvature", new THREE.BufferAttribute(curvature, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aDashed", new THREE.BufferAttribute(dashed, 1));
    g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    g.setAttribute("aSelected", new THREE.BufferAttribute(selected, 1));
    return g;
  }, [graph, buffers, selectedEdgeId]);

  useEffect(() => () => nodeGeo.dispose(), [nodeGeo]);
  useEffect(() => () => haloGeo.dispose(), [haloGeo]);
  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);

  // ── Materials ─────────────────────────────────────────────────────────
  const uniforms = useMemo(
    () => ({
      uState: { value: buffers.tex as THREE.Texture },
      uStateHeight: { value: buffers.height },
      uTime: { value: 0 },
      uPx: { value: 1 },
      uFocus: { value: -1 },
      uMotion: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  uniforms.uState.value = buffers.tex;
  uniforms.uStateHeight.value = buffers.height;

  const materials = useMemo(() => {
    const node = additive(new THREE.ShaderMaterial({ uniforms, vertexShader: nodeVert, fragmentShader: flatFrag }));
    const halo = additive(new THREE.ShaderMaterial({ uniforms, vertexShader: haloVert, fragmentShader: haloFrag }));
    const edge = additive(new THREE.ShaderMaterial({ uniforms, vertexShader: edgeVert, fragmentShader: edgeFrag }));
    // Share the live uniforms reference directly instead of keeping ShaderMaterial's cloned copy
    node.uniforms = uniforms;
    halo.uniforms = uniforms;
    edge.uniforms = uniforms;
    return { node, halo, edge };
  }, [uniforms]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  // ── True 3D Force layout ──────────────────────────────────────────────
  const simRef = useRef<SimState | null>(null);
  const simIdx = useRef<Int32Array>(new Int32Array(0));
  const firstSleep = useRef(true);
  const userMoved = useRef(false);

  // Interaction refs
  const dragRef = useRef<null | {
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    initialPos: Vec3;
    moved: boolean;
    depthOffset: number;
    plane: THREE.Plane;
  }>(null);

  const edgeBendDragRef = useRef<null | {
    edgeId: string;
    pointerId: number;
    initialCurvature: number;
    sourcePos: Vec3;
    targetPos: Vec3;
  }>(null);

  const activeLinkPos = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const prev = simRef.current;
    const prevPos = new Map<string, Vec3>();
    if (prev) prev.ids.forEach((id, i) => prevPos.set(id, prev.sim.get(i)));

    const ids = visibleOrder(graph, vis.visible);
    const index = new Map(ids.map((id, i) => [id, i]));
    const initial: Vec3[] = [];
    ids.forEach((id) => {
      const known = prevPos.get(id);
      if (known) return initial.push(known);
      const p = graph.parent.get(id);
      const stored = nodes[id]?.position ?? [0, 0, 0];
      if (prev && p && index.has(p)) {
        const pp = initial[index.get(p)!];
        // 3D spherical radiating offset for new children
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 5.0;
        const dx = r * Math.sin(phi) * Math.cos(theta);
        const dy = r * Math.sin(phi) * Math.sin(theta);
        const dz = r * Math.cos(phi);
        return initial.push([pp[0] + dx, pp[1] + dy, pp[2] + dz]);
      }
      initial.push([...stored] as Vec3);
    });

    const springs: Spring[] = [];
    for (const id of ids) {
      const p = graph.parent.get(id);
      if (!p || !index.has(p)) continue;
      const d = graph.depth.get(id) ?? 1;
      springs.push({
        a: index.get(p)!,
        b: index.get(id)!,
        rest: graph.virtual.has(id) ? 12 : d === 1 ? 8.5 : 5.2,
        k: graph.virtual.has(id) ? 0.03 : 0.22,
      });
    }
    for (const e of graph.edges) {
      if (e.tree || !index.has(e.a) || !index.has(e.b)) continue;
      springs.push({ a: index.get(e.a)!, b: index.get(e.b)!, rest: 8.5, k: 0.04 });
    }
    for (const pair of semanticPairs ?? []) {
      if (pair.similarity <= 0.28 || !index.has(pair.leftId) || !index.has(pair.rightId)) continue;
      const s = Math.min(0.95, pair.similarity);
      springs.push({ a: index.get(pair.leftId)!, b: index.get(pair.rightId)!, rest: 2.8 + (1 - s) * 5, k: 0.03 * s });
    }

    const rootIndex = graph.rootId && index.has(graph.rootId) ? index.get(graph.rootId)! : null;
    const sim = new ForceLayout(initial, springs, rootIndex);
    if (prev) sim.alpha = 0.45;
    else sim.alpha = 0.75;
    if (propsRef.current.reducedMotion) sim.settle(1200);
    else sim.settle(15);

    simRef.current = { sim, ids, index };
    const map = new Int32Array(buffers.n).fill(-1);
    buffers.ids.forEach((id, i) => {
      if (index.has(id)) map[i] = index.get(id)!;
    });
    simIdx.current = map;
    if (!prev) frameAll(false);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, vis, semanticPairs, buffers]);

  const commitIfMoved = () => {
    const s = simRef.current;
    if (!s) return;
    const entries: Array<[string, Vec3]> = [];
    s.ids.forEach((id, i) => {
      const stored = propsRef.current.nodes[id]?.position;
      const p = s.sim.get(i).map((x) => Number(x.toFixed(2))) as Vec3;
      if (!stored || Math.hypot(p[0] - stored[0], p[1] - stored[1], p[2] - stored[2]) > 0.05) entries.push([id, p]);
    });
    commitPositions(entries);
  };
  useEffect(() => () => commitIfMoved(), []);

  // ── Camera: fly-to, framing, orbit pivot ──────────────────────────────
  const fly = useRef<null | { fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; t0: number; dur: number }>(null);
  const pendingFly = useRef<null | { id: string; until: number }>(null);
  const viewOffset = useRef(0);

  const fovFit = (radius: number) => {
    const cam = camera as THREE.PerspectiveCamera;
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const aspect = size.width / Math.max(size.height, 1);
    const fit = radius / Math.tan(half) / Math.min(1, aspect);
    return THREE.MathUtils.clamp(fit * 1.05, 18, 400);
  };

  const startFly = (target: THREE.Vector3, dist: number, animate = true) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-6) offset.set(0, 0.2, 1);
    offset.setLength(dist);
    const toP = target.clone().add(offset);
    if (!animate || propsRef.current.reducedMotion) {
      controls.target.copy(target);
      camera.position.copy(toP);
      controls.update();
      fly.current = null;
    } else {
      fly.current = { fromT: controls.target.clone(), toT: target, fromP: camera.position.clone(), toP, t0: performance.now(), dur: 750 };
    }
    invalidate();
  };

  function frameAll(animate = true) {
    const s = simRef.current;
    let r = 8;
    if (s) for (let i = 0; i < s.ids.length; i++) r = Math.max(r, Math.hypot(...s.sim.get(i)) + 5);
    const rootP = runtime.graph?.rootId ? runtime.getPos(runtime.graph.rootId) : null;
    startFly(new THREE.Vector3(...(rootP ?? [0, 0, 0])), fovFit(r), animate);
  }

  useEffect(() => {
    runtime.invalidate = invalidate;
    runtime.getPos = (id) => {
      const i = buffers.index.get(id);
      if (i === undefined) return null;
      const s = simRef.current;
      const si = s?.index.get(id);
      if (s && si !== undefined) return s.sim.get(si);
      return [buffers.renderPos[i * 3], buffers.renderPos[i * 3 + 1], buffers.renderPos[i * 3 + 2]];
    };
    runtime.flyTo = (id) => {
      if (!id) {
        frameAll(true);
        return;
      }
      pendingFly.current = { id, until: performance.now() + 1500 };
      invalidate();
    };
    runtime.frameAll = () => frameAll(true);
  });

  // ── Helper to calculate 3D Quadratic Curve Points ─────────────────────
  const getCurvePoint = (pA: Vec3, pB: Vec3, curvature: number, t: number, out = new THREE.Vector3()) => {
    const A = new THREE.Vector3(...pA);
    const B = new THREE.Vector3(...pB);
    const d = new THREE.Vector3().subVectors(B, A);
    const L = d.length();
    const normD = L > 1e-4 ? d.clone().divideScalar(L) : new THREE.Vector3(0, 1, 0);
    const up = Math.abs(normD.dot(new THREE.Vector3(0, 1, 0))) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(normD, up).normalize();
    const C = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5).addScaledVector(perp, L * curvature);

    const oneMinusT = 1 - t;
    out.copy(A)
      .multiplyScalar(oneMinusT * oneMinusT)
      .addScaledVector(C, 2 * oneMinusT * t)
      .addScaledVector(B, t * t);
    return out;
  };

  // ── Pointer: 3D raycasting, orbital navigation, dragging in 3D ────────
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const rectOf = () => gl.domElement.getBoundingClientRect();

    const pickNode = (clientX: number, clientY: number): string | null => {
      const rect = rectOf();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best: string | null = null;
      let bestD = Infinity;
      const { screen, ids } = buffers;
      for (let i = 0; i < ids.length; i++) {
        if (!screen[i * 4 + 3]) continue;
        const d = Math.hypot(screen[i * 4] - x, screen[i * 4 + 1] - y);
        if (d < Math.max(screen[i * 4 + 2] * 1.35, 14) && d < bestD) {
          bestD = d;
          best = ids[i];
        }
      }
      return best;
    };

    const pickEdge = (clientX: number, clientY: number): string | null => {
      const rect = rectOf();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let bestEdge: string | null = null;
      let bestD = Infinity;
      const p = new THREE.Vector3();

      for (const e of graph.edges) {
        const pa = runtime.getPos(e.a);
        const pb = runtime.getPos(e.b);
        if (!pa || !pb) continue;
        const curv = e.style?.curvature ?? (e.tree ? 0.12 : 0.18);

        // Sample 8 points along curve
        for (let s = 1; s <= 7; s++) {
          const t = s / 8;
          getCurvePoint(pa, pb, curv, t, p);
          p.project(camera);
          const sx = ((p.x + 1) / 2) * rect.width;
          const sy = ((1 - p.y) / 2) * rect.height;
          const d = Math.hypot(sx - x, sy - y);
          if (d < 12 && d < bestD) {
            bestD = d;
            bestEdge = e.id;
          }
        }
      }
      return bestEdge;
    };

    let emptyDown: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      userMoved.current = true;
      if (e.button !== 0) return; // Right drag pans naturally via OrbitControls

      // If linking active, clicking any node finishes linking
      if (propsRef.current.linkingSourceId) {
        const hitNode = pickNode(e.clientX, e.clientY);
        if (hitNode && hitNode !== propsRef.current.linkingSourceId) {
          finishLinking(hitNode);
        } else {
          cancelLinking();
        }
        return;
      }

      // Check if clicked the selected edge's midpoint handle
      if (propsRef.current.selectedEdgeId) {
        const selEdge = graph.edges.find((x) => x.id === propsRef.current.selectedEdgeId);
        if (selEdge) {
          const pa = runtime.getPos(selEdge.a);
          const pb = runtime.getPos(selEdge.b);
          if (pa && pb) {
            const curv = selEdge.style?.curvature ?? (selEdge.tree ? 0.12 : 0.18);
            const mid = getCurvePoint(pa, pb, curv, 0.5);
            mid.project(camera);
            const rect = rectOf();
            const sx = ((mid.x + 1) / 2) * rect.width;
            const sy = ((1 - mid.y) / 2) * rect.height;
            if (Math.hypot(sx - (e.clientX - rect.left), sy - (e.clientY - rect.top)) < 16) {
              const controls = controlsRef.current;
              if (controls) controls.enabled = false;
              edgeBendDragRef.current = {
                edgeId: selEdge.id,
                pointerId: e.pointerId,
                initialCurvature: curv,
                sourcePos: pa,
                targetPos: pb,
              };
              host.setPointerCapture?.(e.pointerId);
              return;
            }
          }
        }
      }

      const hit = pickNode(e.clientX, e.clientY);
      if (hit) {
        const controls = controlsRef.current;
        if (controls) controls.enabled = false;
        const p = runtime.getPos(hit) ?? [0, 0, 0];
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.negate(), new THREE.Vector3(...p));
        dragRef.current = {
          id: hit,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          initialPos: [...p],
          moved: false,
          depthOffset: 0,
          plane,
        };
        host.setPointerCapture?.(e.pointerId);
      } else {
        const hitEdge = pickEdge(e.clientX, e.clientY);
        if (hitEdge) {
          focusEdge(hitEdge);
        } else {
          emptyDown = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      // 1. Edge bend handle dragging
      const bendDrag = edgeBendDragRef.current;
      if (bendDrag && bendDrag.pointerId === e.pointerId) {
        const rect = rectOf();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);

        const A = new THREE.Vector3(...bendDrag.sourcePos);
        const B = new THREE.Vector3(...bendDrag.targetPos);
        const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
        const d = new THREE.Vector3().subVectors(B, A);
        const L = d.length();
        const normD = L > 1e-4 ? d.clone().divideScalar(L) : new THREE.Vector3(0, 1, 0);
        const up = Math.abs(normD.dot(new THREE.Vector3(0, 1, 0))) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        const perp = new THREE.Vector3().crossVectors(normD, up).normalize();

        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), mid);
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, hit)) {
          const delta = hit.sub(mid);
          const proj = delta.dot(perp);
          const newCurv = THREE.MathUtils.clamp(proj / (L * 0.5), -0.85, 0.85);
          updateEdgeStyleWithUndo(bendDrag.edgeId, { curvature: Number(newCurv.toFixed(3)) });
          invalidate();
        }
        return;
      }

      // 2. Node dragging on camera plane with depth
      const drag = dragRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
        drag.moved = true;
        host.style.cursor = "grabbing";
        const s = simRef.current;
        const si = s?.index.get(drag.id);
        if (!s || si === undefined) return;

        const rect = rectOf();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);

        // Support Shift-drag or Alt-drag for vertical depth control
        if (e.shiftKey || e.altKey) {
          const dy = e.clientY - drag.startY;
          drag.depthOffset = -dy * 0.2;
        }

        const camDir = camera.getWorldDirection(new THREE.Vector3());
        const adjustedPlane = drag.plane.clone().translate(camDir.clone().multiplyScalar(drag.depthOffset));

        const hitPoint = new THREE.Vector3();
        if (ray.ray.intersectPlane(adjustedPlane, hitPoint)) {
          s.sim.set(si, [hitPoint.x, hitPoint.y, hitPoint.z]);
          s.sim.pinned[si] = 1;
          s.sim.reheat(0.22);
          invalidate();
        }
        return;
      }

      // 3. Hover highlights
      const hit = pickNode(e.clientX, e.clientY);
      if (hit !== runtime.hoveredId) {
        runtime.hoveredId = hit;
        host.style.cursor = hit ? "pointer" : "";
        invalidate();
      }
    };

    const onUp = (e: PointerEvent) => {
      // Release edge bend handle
      if (edgeBendDragRef.current && edgeBendDragRef.current.pointerId === e.pointerId) {
        edgeBendDragRef.current = null;
        const controls = controlsRef.current;
        if (controls) controls.enabled = true;
        host.releasePointerCapture?.(e.pointerId);
        invalidate();
        return;
      }

      // Release node drag
      const drag = dragRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        dragRef.current = null;
        const controls = controlsRef.current;
        if (controls) controls.enabled = true;
        host.releasePointerCapture?.(e.pointerId);
        host.style.cursor = "pointer";

        if (drag.moved) {
          const s = simRef.current;
          const si = s?.index.get(drag.id);
          const finalPos = s?.sim.get(si!) ?? drag.initialPos;
          if (s && si !== undefined && drag.id !== runtime.graph?.rootId) s.sim.pinned[si] = 0;
          commitMoveWithUndo(drag.id, drag.initialPos, finalPos);
          s?.sim.reheat(0.2);
        } else {
          focusNode(drag.id, false);
        }
        invalidate();
        return;
      }

      // Click on empty space
      if (emptyDown && Math.hypot(e.clientX - emptyDown.x, e.clientY - emptyDown.y) < 4) {
        if (buffers.n === 0) createChild(null);
        else {
          useMindmap.getState().select(null);
          useMindmap.getState().selectEdge(null);
        }
      }
      emptyDown = null;
    };

    // Double click: node -> focus & make orbit pivot; empty -> recenter on root
    const onDbl = (e: MouseEvent) => {
      const hit = pickNode(e.clientX, e.clientY);
      if (hit) {
        focusNode(hit, true);
        const p = runtime.getPos(hit);
        if (p && controlsRef.current) {
          controlsRef.current.target.set(p[0], p[1], p[2]);
          controlsRef.current.update();
        }
      } else {
        runtime.flyTo(null);
      }
    };

    // Scroll wheel: when dragging node, adjust its depth!
    const onWheel = (e: WheelEvent) => {
      userMoved.current = true;
      const drag = dragRef.current;
      if (drag) {
        e.preventDefault();
        drag.depthOffset += -e.deltaY * 0.05;
        invalidate();
      }
    };

    const onLeave = () => {
      if (runtime.hoveredId) {
        runtime.hoveredId = null;
        invalidate();
      }
    };

    host.addEventListener("pointerdown", onDown, true);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("dblclick", onDbl);
    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointerdown", onDown, true);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("dblclick", onDbl);
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, buffers, graph, invalidate, finishLinking, cancelLinking]);

  // ── Idle cadence: capped drift ticks; nothing when hidden or reduced ──
  useEffect(() => {
    if (reducedMotion) return;
    let timer: number | null = null;
    const start = () => {
      if (timer === null && document.visibilityState === "visible") timer = window.setInterval(invalidate, 1000 / IDLE_FPS);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const onVis = () => (document.visibilityState === "visible" ? (start(), invalidate()) : stop());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reducedMotion, invalidate]);

  // ── Overlays: root sun, selection reticle, midpoint bend handle ───────
  const sunRef = useRef<THREE.LineSegments>(null);
  const reticleRef = useRef<THREE.LineSegments>(null);
  const midpointRef = useRef<THREE.LineSegments>(null);

  const sunGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(sunGeometry(), 3));
    return g;
  }, []);
  const reticleGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(reticleGeometry(), 3));
    return g;
  }, []);
  const midpointGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Diamond reticle for edge midpoint handle
    const v = [
      0, 0.7, 0,  0.7, 0, 0,
      0.7, 0, 0,  0, -0.7, 0,
      0, -0.7, 0, -0.7, 0, 0,
      -0.7, 0, 0, 0, 0.7, 0,
    ];
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
    return g;
  }, []);

  const sunMat = useMemo(() => additive(new THREE.LineBasicMaterial({ color: new THREE.Color(...ACCENTS.gold.rgb), opacity: 0 })), []);
  const reticleMat = useMemo(() => additive(new THREE.LineBasicMaterial({ color: new THREE.Color(...ACCENTS.magenta.rgb), opacity: 0 })), []);
  const midpointMat = useMemo(() => additive(new THREE.LineBasicMaterial({ color: new THREE.Color(...ACCENTS.magenta.rgb), opacity: 0.9 })), []);

  // ── Backdrop ─────────────────────────────────────────────────────────
  const gridRef = useRef<THREE.Mesh>(null);
  const gridMat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          uniforms: {
            uCenter: { value: new THREE.Vector3() },
            uQuiet: { value: 0.05 },
            uRadius: { value: 150 },
            uC1: { value: new THREE.Color(...ACCENTS.cyan.rgb) },
            uC2: { value: new THREE.Color(...ACCENTS.magenta.rgb) },
          },
          vertexShader: gridVert,
          fragmentShader: gridFrag,
        }),
      ),
    [],
  );

  const stars = useMemo(() => {
    const count = 280;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const r = 700 + rnd() * 600;
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(rnd() * 2 - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
      const tint = rnd();
      col.set(tint > 0.92 ? ACCENTS.gold.rgb : tint > 0.84 ? ACCENTS.cyan.rgb : [0.8, 0.78, 0.95], i * 3);
      sz[i] = 1.2 + rnd() * 1.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
    const m = additive(
      new THREE.ShaderMaterial({
        uniforms: { uQuiet: { value: 0.20 }, uDpr: { value: 1 } },
        vertexShader: starVert,
        fragmentShader: starFrag,
      }),
    );
    return { g, m };
  }, []);

  // ── Seed (empty state) ───────────────────────────────────────────────
  const seedRef = useRef<THREE.Group>(null);
  const seedGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(SHAPES.entry, 3));
    return g;
  }, []);
  const seedMat = useMemo(() => additive(new THREE.LineBasicMaterial({ color: new THREE.Color(...ACCENTS.cyan.rgb), opacity: 0.85 })), []);

  // ── Frame ────────────────────────────────────────────────────────────
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const nbr = useRef<{ key: string | null; flags: Uint8Array }>({ key: null, flags: new Uint8Array(0) });
  const wasAwake = useRef(false);

  useFrame((state, rawDelta) => {
    const { selectedId: sel, selectedEdgeId: selEdge, reducedMotion: rm, panelOpen: po, nodes: liveNodes } = propsRef.current;
    const dt = Math.min(rawDelta, 0.05);
    const k = rm ? 1 : 1 - Math.exp(-dt * 9);
    let animating = false;
    runtime.frames = (runtime.frames ?? 0) + 1;

    const time = rm ? 0 : state.clock.elapsedTime;
    uniforms.uTime.value = time;
    uniforms.uMotion.value = rm ? 0 : 1;

    // Simulation
    const s = simRef.current;
    if (s && !s.sim.asleep) {
      const steps = s.ids.length < 300 ? 2 : 1;
      for (let i = 0; i < steps; i++) s.sim.tick();
      wasAwake.current = true;
      animating = true;
    } else if (s && wasAwake.current && !dragRef.current) {
      wasAwake.current = false;
      commitIfMoved();
      if (firstSleep.current && !userMoved.current) frameAll(true);
      firstSleep.current = false;
    }

    // Focus model & Node State Packing
    const { n, ids, renderPos, inten, scale, color, data, screen } = buffers;
    const selIdx = sel ? buffers.index.get(sel) ?? -1 : -1;
    const hovIdx = runtime.hoveredId ? buffers.index.get(runtime.hoveredId) ?? -1 : -1;
    if (nbr.current.key !== sel || nbr.current.flags.length !== n) {
      const flags = new Uint8Array(n);
      if (sel) for (const nb of graph.neighbors.get(sel) ?? []) {
        const j = buffers.index.get(nb);
        if (j !== undefined) flags[j] = 1;
      }
      nbr.current = { key: sel, flags };
    }
    const flags = nbr.current.flags;
    const { visible, anchor } = visArrays;
    const { family, base, landmark } = attrs;
    const map = simIdx.current;

    for (let i = 0; i < n; i++) {
      const o = i * 3;
      // position
      const si = map[i] ?? -1;
      if (visible[i] && s && si >= 0) {
        renderPos[o] = s.sim.pos[si * 3];
        renderPos[o + 1] = s.sim.pos[si * 3 + 1];
        renderPos[o + 2] = s.sim.pos[si * 3 + 2];
      } else {
        const a = anchor[i] * 3;
        for (let c = 0; c < 3; c++) {
          const d = renderPos[a + c] - renderPos[o + c];
          renderPos[o + c] += d * k;
          if (Math.abs(d) > 0.01) animating = true;
        }
      }
      // intensity / scale / colour targets
      let ti: number;
      if (!visible[i]) ti = 0;
      else if (i === selIdx) ti = INTENSITY.selected;
      else if (i === hovIdx) ti = INTENSITY.hover;
      else if (selIdx >= 0) ti = flags[i] ? INTENSITY.neighbor : INTENSITY.dimmed;
      else ti = landmark[i] === 2 ? INTENSITY.root : landmark[i] === 1 ? INTENSITY.starred : INTENSITY.rest;
      const ts = visible[i] ? base[i] * (i === selIdx ? 1.3 : i === hovIdx ? 1.15 : 1) : 0;
      const focused = i === selIdx || i === hovIdx || flags[i] === 1 || landmark[i] > 0;
      const di = ti - inten[i];
      const ds = ts - scale[i];
      inten[i] += di * k;
      scale[i] += ds * k;
      if (Math.abs(di) > 0.004 || Math.abs(ds) > 0.004) animating = true;
      for (let c = 0; c < 3; c++) {
        const target = focused ? family[o + c] : family[o + c] * 0.45 + CYAN.toArray()[c] * 0.55;
        color[o + c] += (target - color[o + c]) * k;
      }
      // pack state texture
      const t0 = i * 8;
      data[t0] = renderPos[o];
      data[t0 + 1] = renderPos[o + 1];
      data[t0 + 2] = renderPos[o + 2];
      data[t0 + 3] = inten[i];
      data[t0 + 4] = color[o];
      data[t0 + 5] = color[o + 1];
      data[t0 + 6] = color[o + 2];
      data[t0 + 7] = scale[i];
    }
    buffers.tex.needsUpdate = true;
    uniforms.uState.value = buffers.tex;
    uniforms.uStateHeight.value = buffers.height;
    uniforms.uFocus.value = selIdx;
    for (const mat of [materials.node, materials.halo, materials.edge]) {
      mat.uniforms.uState.value = buffers.tex;
      mat.uniforms.uStateHeight.value = buffers.height;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uMotion.value = rm ? 0 : 1;
      mat.uniforms.uFocus.value = selIdx;
    }

    // Camera fly / pending fly
    const controls = controlsRef.current;
    if (pendingFly.current) {
      const pf = pendingFly.current;
      const i = buffers.index.get(pf.id);
      if (i !== undefined && (map[i] ?? -1) >= 0) {
        pendingFly.current = null;
        const p = runtime.getPos(pf.id)!;
        const dist = Math.min(camera.position.distanceTo(controls?.target ?? tmp), 32);
        startFly(new THREE.Vector3(...p), Math.max(dist, 18));
      } else if (performance.now() > pf.until) pendingFly.current = null;
      else animating = true;
    }
    if (fly.current && controls) {
      const f = fly.current;
      const u = Math.min(1, (performance.now() - f.t0) / f.dur);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      controls.target.lerpVectors(f.fromT, f.toT, e);
      camera.position.lerpVectors(f.fromP, f.toP, e);
      controls.update();
      if (u >= 1) fly.current = null;
      animating = true;
    }

    // Panel-aware view offset keeps the focused node centred in the open area
    const cam = camera as THREE.PerspectiveCamera;
    const wantOffset = po && size.width > 900 ? PANEL_W / 2 : 0;
    const dOff = wantOffset - viewOffset.current;
    if (Math.abs(dOff) > 0.3) {
      viewOffset.current += dOff * k;
      animating = true;
    } else viewOffset.current = wantOffset;
    if (viewOffset.current > 0.3) cam.setViewOffset(size.width, size.height, viewOffset.current, 0, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
    cam.updateMatrixWorld();

    // Overlays: Sun, Reticle, Midpoint Handle
    const rootIdx = graph.rootId ? buffers.index.get(graph.rootId) ?? -1 : -1;
    if (sunRef.current) {
      const sun = sunRef.current;
      if (rootIdx >= 0) {
        sun.position.set(renderPos[rootIdx * 3], renderPos[rootIdx * 3 + 1], renderPos[rootIdx * 3 + 2]);
        sun.quaternion.copy(camera.quaternion);
        sun.rotateZ(time * 0.02);
        sun.scale.setScalar(scale[rootIdx] * 2.1);
        sunMat.opacity = inten[rootIdx] * 0.55;
        sun.visible = true;
      } else sun.visible = false;
    }
    if (reticleRef.current) {
      const ret = reticleRef.current;
      const want = selIdx >= 0 ? 0.85 : 0;
      reticleMat.opacity += (want - reticleMat.opacity) * k;
      if (Math.abs(want - reticleMat.opacity) > 0.01) animating = true;
      if (selIdx >= 0) {
        ret.position.set(renderPos[selIdx * 3], renderPos[selIdx * 3 + 1], renderPos[selIdx * 3 + 2]);
        const fam = family.subarray(selIdx * 3, selIdx * 3 + 3);
        const isMagenta = fam[0] > 0.9 && fam[2] > 0.7;
        const targetRgb = isMagenta ? ACCENTS.cyan.rgb : ACCENTS.magenta.rgb;
        reticleMat.color.setRGB(targetRgb[0], targetRgb[1], targetRgb[2]);
      }
      ret.quaternion.copy(camera.quaternion);
      ret.rotateZ(time * 0.15);
      ret.scale.setScalar((selIdx >= 0 ? scale[selIdx] : 1) * 1.9);
      ret.visible = reticleMat.opacity > 0.01;
    }

    // Midpoint Bend Handle
    if (midpointRef.current) {
      const handle = midpointRef.current;
      if (selEdge) {
        const edgeObj = graph.edges.find((x) => x.id === selEdge);
        if (edgeObj) {
          const pa = runtime.getPos(edgeObj.a);
          const pb = runtime.getPos(edgeObj.b);
          if (pa && pb) {
            const curv = edgeObj.style?.curvature ?? (edgeObj.tree ? 0.12 : 0.18);
            const mid = getCurvePoint(pa, pb, curv, 0.5);
            handle.position.copy(mid);
            handle.quaternion.copy(camera.quaternion);
            handle.scale.setScalar(1.4);
            handle.visible = true;
          } else handle.visible = false;
        } else handle.visible = false;
      } else {
        handle.visible = false;
      }
    }

    if (gridRef.current && controls) {
      const target = controls.target as THREE.Vector3;
      gridRef.current.position.set(target.x, target.y - 26, target.z);
      const density = THREE.MathUtils.clamp(1 - vis.visible.size / 260, 0.3, 1);
      const quiet = 0.05 * density * (selIdx >= 0 ? 0.55 : 1);
      const u = gridMat.uniforms;
      u.uCenter.value.copy(target);
      u.uQuiet.value += (quiet - u.uQuiet.value) * k;
      stars.m.uniforms.uQuiet.value = 0.20 * density * (selIdx >= 0 ? 0.6 : 1);
      stars.m.uniforms.uDpr.value = viewport.dpr;
    }
    if (seedRef.current) {
      seedRef.current.rotation.y = time * 0.25;
      seedRef.current.rotation.x = 0.5 + Math.sin(time * 0.4) * 0.1;
      seedRef.current.scale.setScalar(2.4 * (1 + (rm ? 0 : Math.sin(time * 1.2) * 0.04)));
    }

    // Screen projection (picking + labels)
    const H = size.height;
    const W = size.width;
    const pxPerUnit = H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    uniforms.uPx.value = pxPerUnit * viewport.dpr;
    materials.halo.uniforms.uPx.value = pxPerUnit * viewport.dpr;
    for (let i = 0; i < n; i++) {
      tmp.set(renderPos[i * 3], renderPos[i * 3 + 1], renderPos[i * 3 + 2]).applyMatrix4(cam.matrixWorldInverse);
      const depth = -tmp.z;
      tmp.applyMatrix4(cam.projectionMatrix);
      const sx = ((tmp.x + 1) / 2) * W;
      const sy = ((1 - tmp.y) / 2) * H;
      screen[i * 4] = sx;
      screen[i * 4 + 1] = sy;
      screen[i * 4 + 2] = depth > 0 ? (scale[i] * pxPerUnit) / depth : 0;
      screen[i * 4 + 3] = visible[i] && depth > 0.5 && sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40 ? 1 : 0;
    }
    layoutLabels(buffers, visible, flags, selIdx, hovIdx, rootIdx, landmark, liveNodes, vis.folded, W, H);
    layoutEdgeLabels(graph, cam, W, H);

    if (animating || dragRef.current || edgeBendDragRef.current) invalidate();
  });

  const hasNodes = buffers.n > 0;
  return (
    <>
      <CitadelSkyDome chamber={MINDMAP_CHAMBER} />
      <points geometry={stars.g} material={stars.m} frustumCulled={false} renderOrder={-3} />
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} material={gridMat} renderOrder={-2} frustumCulled={false}>
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      {hasNodes && (
        <>
          <lineSegments geometry={edgeGeo} material={materials.edge} frustumCulled={false} renderOrder={0} />
          <points geometry={haloGeo} material={materials.halo} frustumCulled={false} renderOrder={1} />
          <lineSegments geometry={nodeGeo} material={materials.node} frustumCulled={false} renderOrder={2} />
          <lineSegments ref={sunRef} geometry={sunGeo} material={sunMat} frustumCulled={false} renderOrder={3} />
          <lineSegments ref={reticleRef} geometry={reticleGeo} material={reticleMat} frustumCulled={false} renderOrder={3} />
          <lineSegments ref={midpointRef} geometry={midpointGeo} material={midpointMat} frustumCulled={false} renderOrder={4} />
        </>
      )}
      {!hasNodes && (
        <group ref={seedRef}>
          <lineSegments geometry={seedGeo} material={seedMat} />
        </group>
      )}
      {/* Orbital Camera Controls: Unrestricted 360 Azimuth Orbit, Damped Inertia, Sensible Polar Clamps */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning
        zoomToCursor
        zoomSpeed={0.9}
        rotateSpeed={0.45}
        minDistance={4}
        maxDistance={480}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI - 0.05}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

// ── Node Labels ─────────────────────────────────────────────────────────
function layoutLabels(
  b: { n: number; ids: string[]; screen: Float32Array },
  visible: Uint8Array,
  nbrFlags: Uint8Array,
  selIdx: number,
  hovIdx: number,
  rootIdx: number,
  landmark: Uint8Array,
  nodes: Record<string, Node>,
  folded: Map<string, number>,
  W: number,
  H: number,
) {
  if (labelSlots.length === 0) return;
  const cands: Array<{ i: number; pri: number; alpha: number; tier: string }> = [];
  for (let i = 0; i < b.n; i++) {
    if (!visible[i] || !b.screen[i * 4 + 3]) continue;
    const r = b.screen[i * 4 + 2];
    let pri: number;
    let tier = "rest";
    if (i === selIdx) (pri = 1000), (tier = "selected");
    else if (i === hovIdx) (pri = 950), (tier = "hover");
    else if (i === rootIdx) (pri = 800), (tier = selIdx >= 0 ? "dim" : "root");
    else if (selIdx >= 0 && nbrFlags[i]) (pri = 600), (tier = "neighbor");
    else if (landmark[i] === 1) pri = 500;
    else pri = 300 - Math.min(r < 1 ? 0 : 0, 0) + r;
    let alpha = 1.0;
    if (pri < 500) {
      // High readability floor at rest zoom (never drops below 0.85 at rest or 0.78 when another node is selected)
      alpha = Math.min(1.0, Math.max(0.85, (r - 2) / 4.0));
      if (selIdx >= 0) {
        alpha = Math.min(0.92, Math.max(0.78, (r - 2) / 4.0));
        tier = "dim";
      }
    }
    if (selIdx >= 0 && i === rootIdx) alpha = 0.88;
    cands.push({ i, pri, alpha, tier });
  }
  cands.sort((a, c) => c.pri - a.pri);

  const placed: Array<[number, number, number, number]> = [];
  let used = 0;
  for (const c of cands) {
    if (used >= labelSlots.length) break;
    const id = b.ids[c.i];
    const node = nodes[id];
    if (!node) continue;
    const raw = node.title || "Untitled";
    const text = raw.length > 30 ? raw.slice(0, 29) + "…" : raw;
    const hidden = folded.get(id);
    const chip = hidden ? `+${hidden}` : "";
    const fs = c.tier === "selected" ? 11 : 9.2;
    const w = (text.length + (chip ? chip.length + 1.5 : 0)) * fs + 14;
    const h = c.tier === "selected" ? 26 : 22;
    const sx = b.screen[c.i * 4];
    const sy = b.screen[c.i * 4 + 1];
    const r = Math.max(b.screen[c.i * 4 + 2], 6);
    let x = sx - w / 2;
    let y = sy - r - 8 - h;
    const hits = (ax: number, ay: number) =>
      placed.some(([px, py, pw, ph]) => ax < px + pw + 4 && ax + w + 4 > px && ay < py + ph + 2 && ay + h + 2 > py);
    if (hits(x, y)) {
      y = sy + r + 8;
      if (hits(x, y)) {
        if (c.pri < 900) continue;
      }
    }
    x = Math.max(4, Math.min(W - w - 4, x));
    y = Math.max(4, Math.min(H - h - 4, y));
    placed.push([x, y, w, h]);
    const slot = labelSlots[used++];
    slot.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    slot.el.style.opacity = c.alpha.toFixed(2);
    if (slot.tier !== c.tier) {
      slot.el.dataset.tier = c.tier;
      slot.tier = c.tier;
    }
    if (slot.text !== text) {
      slot.title.textContent = text;
      slot.text = text;
    }
    if (slot.chipText !== chip) {
      slot.chip.textContent = chip;
      slot.chip.style.display = chip ? "inline-block" : "none";
      slot.chipText = chip;
    }
    slot.el.dataset.id = id;
  }
  for (let i = used; i < labelSlots.length; i++) {
    const slot = labelSlots[i];
    if (slot.el.style.opacity !== "0") {
      slot.el.style.opacity = "0";
      slot.el.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
    slot.el.dataset.id = "";
  }
}

// ── Edge Labels ─────────────────────────────────────────────────────────
function layoutEdgeLabels(g: MindGraph, cam: THREE.Camera, W: number, H: number) {
  if (edgeLabelSlots.length === 0) return;
  let used = 0;
  const p = new THREE.Vector3();

  for (const edge of g.edges) {
    if (!edge.style?.label || used >= edgeLabelSlots.length) continue;
    const pa = runtime.getPos(edge.a);
    const pb = runtime.getPos(edge.b);
    if (!pa || !pb) continue;

    const curv = edge.style.curvature ?? (edge.tree ? 0.12 : 0.18);
    // Midpoint of curve
    const A = new THREE.Vector3(...pa);
    const B = new THREE.Vector3(...pb);
    const d = new THREE.Vector3().subVectors(B, A);
    const L = d.length();
    const normD = L > 1e-4 ? d.clone().divideScalar(L) : new THREE.Vector3(0, 1, 0);
    const up = Math.abs(normD.dot(new THREE.Vector3(0, 1, 0))) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(normD, up).normalize();
    p.addVectors(A, B).multiplyScalar(0.5).addScaledVector(perp, L * curv);

    p.project(cam);
    if (p.z > 1.0) continue; // Behind camera

    const sx = ((p.x + 1) / 2) * W;
    const sy = ((1 - p.y) / 2) * H;
    if (sx < 10 || sx > W - 10 || sy < 10 || sy > H - 10) continue;

    const slot = edgeLabelSlots[used++];
    slot.el.style.transform = `translate3d(${(sx - 40).toFixed(1)}px, ${(sy - 10).toFixed(1)}px, 0)`;
    slot.el.style.opacity = "0.9";
    slot.el.dataset.edgeId = edge.id;
    if (slot.text !== edge.style.label) {
      slot.title.textContent = edge.style.label;
      slot.text = edge.style.label;
    }
  }

  for (let i = used; i < edgeLabelSlots.length; i++) {
    const slot = edgeLabelSlots[i];
    if (slot.el.style.opacity !== "0") {
      slot.el.style.opacity = "0";
      slot.el.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
    slot.el.dataset.edgeId = "";
  }
}
