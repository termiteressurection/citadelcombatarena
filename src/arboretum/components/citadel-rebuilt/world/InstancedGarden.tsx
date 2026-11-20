/**
 * InstancedGarden — replaces the per-thought `<group>` tree in ThoughtGarden
 * with 2 InstancedMesh draw calls (foliage + trunks). Preserves the
 * age-tiered "sprout → bush → sapling → tree" silhouette by modulating
 * per-instance scale. Colour hue is still derived from the thought's first
 * tag, preserving the existing aesthetic contract.
 *
 * Contract (Phase 2 acceptance gate, see PERF_BASELINE.md):
 * - Garden draws at 50 thoughts ≤ 2 (down from 1-3 per plant).
 * - Visual diff vs baseline: plants still differentiate by age at the same
 *   thresholds (1 / 7 / 30 days).
 * - Sphere-drop remains CPU-side until Phase 4.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Thought } from '../types';
import { sphereDrop, applyGlobeCurvatureMatrix } from '../RebuiltWorldShared';
import { getThoughtCategory } from '../RebuiltWorldThoughts';
import { perfEnabled, perfTick } from '../devPerf';

// Base geometries are module-level — one allocation, reused across every
// chamber mount. We reuse icospheres of cheap detail (6 tris × 4 subdiv ≈ 64
// tris) because we're rendering them at 0.25–0.55 world units.
const FOLIAGE_GEOM = new THREE.IcosahedronGeometry(1, 0); // unit radius, scaled per-instance
const TRUNK_GEOM = new THREE.CylinderGeometry(0.06, 0.09, 1, 5); // unit height, scaled per-instance

// `instanceColor` is multiplied against `color` by MeshBasicMaterial, so we
// leave base color white and set per-instance tint via `setColorAt` below.
const FOLIAGE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.42,
});
const TRUNK_MAT = new THREE.MeshBasicMaterial({
  color: 0x4a2800,
  wireframe: true,
  transparent: true,
  opacity: 0.48,
});

type Plant = {
  id: number;
  x: number;
  z: number;
  tier: 'sprout' | 'bush' | 'sapling' | 'tree';
  foliageScale: number;
  foliageBaseY: number;
  trunkScale: number; // 0 = no trunk
  trunkBaseY: number;
  color: THREE.Color;
};

function buildPlants(thoughts: Thought[], positions: [number, number, number][]): Plant[] {
  const out: Plant[] = [];
  for (let i = 0; i < thoughts.length; i++) {
    const t = thoughts[i];
    if (!positions[i]) continue;
    if (getThoughtCategory(t) !== 'seed') continue;

    const age = (Date.now() - new Date(t.timestamp).getTime()) / 86400000;
    const [x, , z] = positions[i];

    const hue = t.tags?.length ? (t.tags[0].charCodeAt(0) * 37 % 360) / 360 : 0.33;
    const color = new THREE.Color().setHSL(hue, 0.6, 0.45);

    if (age < 1) {
      // Sprout — small bud, no trunk.
      out.push({
        id: t.id,
        x,
        z,
        tier: 'sprout',
        foliageScale: 0.14,
        foliageBaseY: 0.22,
        trunkScale: 0,
        trunkBaseY: 0,
        color,
      });
    } else if (age < 7) {
      // Bush — sphere + short trunk.
      out.push({
        id: t.id,
        x,
        z,
        tier: 'bush',
        foliageScale: 0.28,
        foliageBaseY: 0.42,
        trunkScale: 0.22, // cylinder height
        trunkBaseY: 0.15,
        color,
      });
    } else if (age < 30) {
      out.push({
        id: t.id,
        x,
        z,
        tier: 'sapling',
        foliageScale: 0.42,
        foliageBaseY: 0.95,
        trunkScale: 1.0,
        trunkBaseY: 0.35,
        color,
      });
    } else {
      const growth = Math.min(1 + (age - 30) / 60, 2.0);
      out.push({
        id: t.id,
        x,
        z,
        tier: 'tree',
        foliageScale: 0.58 * growth,
        foliageBaseY: 0.75 * growth + 0.3,
        trunkScale: 1.4 * growth,
        trunkBaseY: 0.5 * growth,
        color,
      });
    }
  }
  return out;
}

export function InstancedGarden({
  thoughts,
  positions,
  playerPos,
}: {
  thoughts: Thought[];
  positions: [number, number, number][];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const plants = useMemo(() => buildPlants(thoughts, positions), [thoughts, positions]);
  if (perfEnabled) perfTick('thoughts', thoughts.length);
  if (perfEnabled) perfTick('plants', plants.length);

  const foliageRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Instance capacity — must be >= max plants we ever expect to show.
  // chamber.thoughts is user-generated; 256 is a comfortable ceiling that
  // still fits in Uint16 attribute space with room to spare.
  const capacity = 256;

  // Push per-instance colours whenever the plant set changes. Transform
  // matrices are written per-frame (below) because sphereDrop is player-
  // relative.
  useEffect(() => {
    const foliage = foliageRef.current;
    const trunk = trunkRef.current;
    if (!foliage || !trunk) return;
    for (let i = 0; i < plants.length; i++) {
      foliage.setColorAt(i, plants[i].color);
    }
    foliage.count = plants.length;
    trunk.count = plants.length;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  }, [plants]);

  useFrame(() => {
    const foliage = foliageRef.current;
    const trunk = trunkRef.current;
    if (!foliage || !trunk) return;
    const pp = playerPos.current;
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];

      // Foliage instance with planetary surface-normal alignment
      applyGlobeCurvatureMatrix(dummy.matrix, p.x, p.foliageBaseY, p.z, pp, p.foliageScale);
      foliage.setMatrixAt(i, dummy.matrix);

      // Trunk instance — zero-scale collapse when this tier has no trunk.
      if (p.trunkScale > 0) {
        applyGlobeCurvatureMatrix(dummy.matrix, p.x, p.trunkBaseY, p.z, pp, [1, p.trunkScale, 1]);
        trunk.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
      }
    }
    foliage.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
  });

  if (plants.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={foliageRef}
        args={[FOLIAGE_GEOM, FOLIAGE_MAT, capacity]}
        count={plants.length}
        frustumCulled={false}
      />
      <instancedMesh
        ref={trunkRef}
        args={[TRUNK_GEOM, TRUNK_MAT, capacity]}
        count={plants.length}
        frustumCulled={false}
      />
    </group>
  );
}
