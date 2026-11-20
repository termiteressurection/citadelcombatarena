import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes a static subtree into one mesh per material, so ~50 columns cost a handful of draw calls.
 * Waits a few frames so any position-setting useFrame hooks have run, then swaps the originals out.
 * If the geometry can't be merged, the originals stay visible.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null!);
  const frames = useRef(0);
  const done = useRef(false);
  const baked = useRef<{ parent: THREE.Object3D; meshes: THREE.Mesh[] } | null>(null);

  useEffect(() => () => {
    const b = baked.current;
    if (b) b.meshes.forEach((m) => { b.parent.remove(m); m.geometry.dispose(); });
    baked.current = null;
  }, []);

  useFrame(() => {
    if (done.current || ++frames.current < 4) return;
    done.current = true;
    const src = root.current;
    src.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const mat = m.material as THREE.MeshBasicMaterial & { flatShading?: boolean; map?: THREE.Texture | null };
      const key = `${mat.type}|${mat.color?.getHexString()}|${Boolean(mat.wireframe)}|${Boolean(mat.transparent)}|${mat.opacity}|${mat.side}|${mat.blending}|${Boolean(mat.flatShading)}|${mat.map?.uuid ?? ''}`;
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: mat, geos: [] }));
      b.geos.push(g);
    });
    const merged: THREE.Mesh[] = [];
    for (const { material, geos } of buckets.values()) {
      const allHaveUv = geos.every((g) => Boolean(g.getAttribute('uv')));
      const norm = geos.map((g) => {
        const ng = g.index ? g.toNonIndexed() : g;
        if (!allHaveUv && ng.getAttribute('uv')) ng.deleteAttribute('uv');
        if (!ng.getAttribute('normal')) ng.computeVertexNormals();
        return ng;
      });
      const geo = mergeGeometries(norm, false);
      if (!geo) { merged.forEach((m) => m.geometry.dispose()); return; }
      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = 1;
      merged.push(mesh);
    }
    for (const m of merged) src.parent!.add(m);
    baked.current = { parent: src.parent!, meshes: merged };
    src.visible = false;
  });

  return <group ref={root}>{children}</group>;
}
