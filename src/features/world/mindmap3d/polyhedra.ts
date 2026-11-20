// Wireframe polyhedra as unit-radius edge lists (flat [x,y,z, x,y,z, ...] per segment).
import type { NodeKind } from "./graph";

const PHI = (1 + Math.sqrt(5)) / 2;

function edgesFromVertices(verts: number[][]): Float32Array {
  const norm = verts.map((v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  let min = Infinity;
  for (let i = 0; i < norm.length; i++)
    for (let j = i + 1; j < norm.length; j++) {
      const d = Math.hypot(norm[i][0] - norm[j][0], norm[i][1] - norm[j][1], norm[i][2] - norm[j][2]);
      if (d < min) min = d;
    }
  const out: number[] = [];
  for (let i = 0; i < norm.length; i++)
    for (let j = i + 1; j < norm.length; j++) {
      const d = Math.hypot(norm[i][0] - norm[j][0], norm[i][1] - norm[j][1], norm[i][2] - norm[j][2]);
      if (d < min * 1.01) out.push(...norm[i], ...norm[j]);
    }
  return new Float32Array(out);
}

const ICOSA: number[][] = [];
for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ICOSA.push([0, a, b], [a, b, 0], [b, 0, a]);

const CUBE: number[][] = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CUBE.push([x, y, z]);

const OCTA: number[][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export const SHAPES: Record<NodeKind, Float32Array> = {
  entry: edgesFromVertices(ICOSA),
  branch: edgesFromVertices(CUBE),
  tag: edgesFromVertices(OCTA),
};

/** Root "sun": a ring plus fine alternating rays, in the XY plane (billboarded at runtime). */
export function sunGeometry(rays = 40): Float32Array {
  const out: number[] = [];
  const seg = 72;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    out.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
  }
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const outer = i % 2 === 0 ? 1.62 : 1.34;
    out.push(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 0, Math.cos(a) * outer, Math.sin(a) * outer, 0);
  }
  return new Float32Array(out);
}

/** Selection reticle: four arcs with gaps and small inward ticks. */
export function reticleGeometry(): Float32Array {
  const out: number[] = [];
  for (let q = 0; q < 4; q++) {
    const start = q * (Math.PI / 2) + 0.18;
    const end = (q + 1) * (Math.PI / 2) - 0.18;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const a0 = start + ((end - start) * i) / steps;
      const a1 = start + ((end - start) * (i + 1)) / steps;
      out.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
    }
    const mid = q * (Math.PI / 2) + Math.PI / 4;
    out.push(Math.cos(mid) * 1.0, Math.sin(mid) * 1.0, 0, Math.cos(mid) * 0.86, Math.sin(mid) * 0.86, 0);
  }
  return new Float32Array(out);
}
