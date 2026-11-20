/**
 * SuccessionFlora — Urban-Nature Melting Pot visual layer
 *
 * Renders all flora types (bamboo, fern, reed, bloom, palm) as instanced
 * meshes. One draw call per geometry type regardless of element count.
 * All assets are PS1 low-poly (≤22 polys), optimistic synthwave palette.
 *
 * Art Director Law compliance:
 * - No smooth curves — 6-sided cylinders, faceted cones, icosahedrons
 * - Optimistic palette: lavender, teal, gold, indigo, emerald
 * - Assets wobble/pulse like toys
 * - City (white/cyan) and nature (purple/pink) always coexist
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Chamber } from '../types';
import { sphereDrop } from '../RebuiltWorldShared';
import {
  generateFloraElements,
  getBlendedPalette,
  getPillarOpacity,
  type FloraElement,
} from './UrbanSuccession';
import { isCitadelMicro } from '../citadelBuildMode';

// ─── Shared geometries (module-level, one allocation) ────────────────────────

// Bamboo stalk geometry: 3 stacked cylinders of decreasing width.
// Pure tubes — no cone. Reads instantly as bamboo.
const BAMBOO_STALK_GEO = new THREE.CylinderGeometry(0.08, 0.11, 4, 6, 3);
// Mid segment — slightly narrower
const BAMBOO_MID_GEO = new THREE.CylinderGeometry(0.06, 0.08, 3, 6, 2);
// Top segment — thinnest
const BAMBOO_TOP_GEO = new THREE.CylinderGeometry(0.04, 0.06, 2, 6, 1);
const BAMBOO_LEAF_GEO = new THREE.ConeGeometry(0.22, 0.7, 4, 1);
// Fern leaf: flat triangle fan — 3 planes = 6 polys total
const FERN_GEO = new THREE.ConeGeometry(0.4, 0.6, 3, 1);
// Reed: thin 6-sided cylinder + tiny cone tip — 8 polys
const REED_GEO = new THREE.CylinderGeometry(0.04, 0.06, 2.5, 6, 1);
const REED_TIP_GEO = new THREE.ConeGeometry(0.06, 0.2, 4);
// Bloom: tetrahedron — 4 polys, clustered into "weird bunches"
const BLOOM_GEO = new THREE.TetrahedronGeometry(0.18, 0);
// Palm trunk: tapered 6-sided cylinder — 12 polys
const PALM_TRUNK_GEO = new THREE.CylinderGeometry(0.3, 0.5, 6, 6, 2);
// Palm frond: triangle — 2 polys × 6 fronds = 12 polys
const PALM_FROND_GEO = new THREE.ConeGeometry(0.6, 1.8, 3, 1);

// ─── Shared materials ─────────────────────────────────────────────────────────

const BAMBOO_STALK_MAT = new THREE.MeshBasicMaterial({
  color: 0x34d399,
  wireframe: true,
  transparent: true,
  opacity: 0.7,
});
const BAMBOO_LEAF_MAT = new THREE.MeshBasicMaterial({
  color: 0x22c55e,
  wireframe: true,
  transparent: true,
  opacity: 0.6,
});
const FERN_MAT = new THREE.MeshBasicMaterial({
  color: 0x34d399,
  wireframe: false,
  transparent: true,
  opacity: 0.8,
});
const REED_MAT = new THREE.MeshBasicMaterial({
  color: 0x22d3ee,
  transparent: true,
  opacity: 0.7,
});
const REED_TIP_MAT = new THREE.MeshBasicMaterial({
  color: 0xfbbf24,
  transparent: true,
  opacity: 0.9,
});
const BLOOM_MAT = new THREE.MeshBasicMaterial({
  color: 0xc084fc,
  wireframe: false,
  transparent: true,
  opacity: 0.9,
});
const PALM_TRUNK_MAT = new THREE.MeshBasicMaterial({
  color: 0x10b981,
  wireframe: true,
  transparent: true,
  opacity: 0.65,
});
const PALM_FROND_MAT = new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.8,
});

// ─── Component ────────────────────────────────────────────────────────────────

interface SuccessionFloraProps {
  chamber: Chamber;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export function SuccessionFlora({ chamber, playerPos }: SuccessionFloraProps) {
  if (isCitadelMicro()) return null;

  const elements = useMemo(
    () => generateFloraElements(chamber),
    // Regenerate when thought count or depth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chamber.id, chamber.thoughts.length, chamber.depth],
  );

  const palette = useMemo(() => getBlendedPalette(chamber.depth), [chamber.depth]);
  const pillarOpacity = getPillarOpacity(chamber.depth);

  if (elements.length === 0) return null;

  const bambooElements = elements.filter(e => e.type === 'bamboo');
  const fernElements = elements.filter(e => e.type === 'fern');
  const reedElements = elements.filter(e => e.type === 'reed');
  const bloomElements = elements.filter(e => e.type === 'bloom');
  const palmElements = elements.filter(e => e.type === 'palm');

  return (
    <group>
      {bambooElements.length > 0 && (
        <BambooLayer elements={bambooElements} playerPos={playerPos} palette={palette} />
      )}
      {fernElements.length > 0 && (
        <FernLayer elements={fernElements} playerPos={playerPos} palette={palette} />
      )}
      {reedElements.length > 0 && (
        <ReedLayer elements={reedElements} playerPos={playerPos} />
      )}
      {bloomElements.length > 0 && (
        <BloomLayer elements={bloomElements} playerPos={playerPos} />
      )}
      {palmElements.length > 0 && (
        <PalmLayer elements={palmElements} playerPos={playerPos} />
      )}
      {/* Pillar succession overlay — cracks and vines at depth 2+ */}
      {chamber.depth >= 2 && (
        <PillarSuccession depth={chamber.depth} opacity={pillarOpacity} palette={palette} playerPos={playerPos} />
      )}
    </group>
  );
}

// ─── Bamboo Layer ─────────────────────────────────────────────────────────────

function BambooLayer({ elements, playerPos, palette }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  palette: ReturnType<typeof getBlendedPalette>;
}) {
  const stalkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Update bamboo stalk color to match depth palette
  useMemo(() => {
    BAMBOO_STALK_MAT.color.setHex(palette.naturePrimary);
    BAMBOO_LEAF_MAT.color.setHex(palette.natureAccent);
  }, [palette]);

  useFrame(({ clock }) => {
    if (!stalkRef.current || !leafRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;

    elements.forEach((el, i) => {
      const drop = sphereDrop(el.x - pp.x, el.z - pp.z);
      const height = 4 * el.scale;
      const sway = Math.sin(t * 0.6 + el.seed * 0.3) * 0.04 * el.scale;

      // Stalk — base sits on curved ground
      dummy.position.set(el.x + sway, height / 2 - drop, el.z);
      dummy.scale.set(el.scale, el.scale, el.scale);
      dummy.rotation.set(sway * 0.1, el.rotation, 0);
      dummy.updateMatrix();
      stalkRef.current!.setMatrixAt(i, dummy.matrix);

      // Leaf at top of stalk
      dummy.position.set(el.x + sway * 1.5, height - drop, el.z);
      dummy.scale.setScalar(el.scale * 0.9);
      dummy.rotation.set(sway * 0.2, el.rotation + t * 0.05, sway * 0.3);
      dummy.updateMatrix();
      leafRef.current!.setMatrixAt(i, dummy.matrix);
    });

    stalkRef.current.instanceMatrix.needsUpdate = true;
    leafRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={stalkRef} args={[BAMBOO_STALK_GEO, BAMBOO_STALK_MAT, elements.length]} />
      <instancedMesh ref={leafRef} args={[BAMBOO_LEAF_GEO, BAMBOO_LEAF_MAT, elements.length]} />
    </group>
  );
}

// ─── Fern Layer ───────────────────────────────────────────────────────────────

function FernLayer({ elements, playerPos, palette }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  palette: ReturnType<typeof getBlendedPalette>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    FERN_MAT.color.setHex(palette.naturePrimary);
  }, [palette]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;

    elements.forEach((el, i) => {
      const drop = sphereDrop(el.x - pp.x, el.z - pp.z);
      const pulse = 1 + Math.sin(t * 0.8 + el.seed * 0.5) * 0.05;

      dummy.position.set(el.x, 0.3 * el.scale - drop, el.z);
      dummy.scale.setScalar(el.scale * pulse);
      dummy.rotation.set(-Math.PI / 2 + 0.2, el.rotation, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[FERN_GEO, FERN_MAT, elements.length]} />
  );
}

// ─── Reed Layer ───────────────────────────────────────────────────────────────

function ReedLayer({ elements, playerPos }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const stalkRef = useRef<THREE.InstancedMesh>(null);
  const tipRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!stalkRef.current || !tipRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;

    elements.forEach((el, i) => {
      const drop = sphereDrop(el.x - pp.x, el.z - pp.z);
      const wave = Math.sin(t * 1.2 + el.seed * 0.7) * 0.06;

      // Stalk
      dummy.position.set(el.x + wave, 1.25 * el.scale - drop, el.z);
      dummy.scale.set(el.scale, el.scale, el.scale);
      dummy.rotation.set(wave * 0.15, el.rotation, 0);
      dummy.updateMatrix();
      stalkRef.current!.setMatrixAt(i, dummy.matrix);

      // Gold tip
      dummy.position.set(el.x + wave * 1.5, 2.5 * el.scale - drop, el.z);
      dummy.scale.setScalar(el.scale * 0.8);
      dummy.rotation.set(wave * 0.2, el.rotation, 0);
      dummy.updateMatrix();
      tipRef.current!.setMatrixAt(i, dummy.matrix);
    });

    stalkRef.current.instanceMatrix.needsUpdate = true;
    tipRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={stalkRef} args={[REED_GEO, REED_MAT, elements.length]} />
      <instancedMesh ref={tipRef} args={[REED_TIP_GEO, REED_TIP_MAT, elements.length]} />
    </group>
  );
}

// ─── Bloom Layer ──────────────────────────────────────────────────────────────

// Bloom cycles through palette colors — clustered into bunches of 3
const BLOOM_COLORS = [0xc084fc, 0xec4899, 0x22d3ee, 0xfbbf24, 0xa855f7];

function BloomLayer({ elements, playerPos }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const BUNCH_SIZE = 3;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;

    elements.forEach((el, i) => {
      const drop = sphereDrop(el.x - pp.x, el.z - pp.z);
      const pulse = 1 + Math.sin(t * 1.5 + el.seed) * 0.15;
      
      // Render a "bunch" of 3 flowers for each element
      for (let j = 0; j < BUNCH_SIZE; j++) {
        const idx = i * BUNCH_SIZE + j;
        const offsetAngle = (j / BUNCH_SIZE) * Math.PI * 2 + el.seed;
        const offsetR = 0.15 * el.scale;
        const ox = Math.cos(offsetAngle) * offsetR;
        const oz = Math.sin(offsetAngle) * offsetR;
        const oy = Math.sin(t * 2 + j) * 0.05;

        dummy.position.set(el.x + ox, el.y + 0.5 - drop + oy, el.z + oz);
        dummy.scale.setScalar(el.scale * pulse * (0.8 + Math.sin(j) * 0.2));
        dummy.rotation.set(t * 0.3 + el.seed + j, t * 0.5 + j, t * 0.2);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(idx, dummy.matrix);

        // Cycle through palette colors over time
        const colorIdx = Math.floor((t * 0.3 + el.seed * 0.7 + j)) % BLOOM_COLORS.length;
        colorObj.setHex(BLOOM_COLORS[colorIdx]);
        meshRef.current!.setColorAt(idx, colorObj);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[BLOOM_GEO, BLOOM_MAT, elements.length * BUNCH_SIZE]} />
  );
}

// ─── Palm Layer ───────────────────────────────────────────────────────────────

function PalmLayer({ elements, playerPos }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!trunkRef.current || !frondRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;

    elements.forEach((el, i) => {
      const drop = sphereDrop(el.x - pp.x, el.z - pp.z);

      // Trunk — static, matrixAutoUpdate would be false but we need sphereDrop
      dummy.position.set(el.x, 3 - drop, el.z);
      dummy.scale.setScalar(el.scale);
      dummy.rotation.set(0, el.rotation, 0);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Fronds — 6 fronds per palm, packed into one instance per palm
      // (simplified: one cone representing the frond cluster)
      const frondSway = Math.sin(t * 0.4 + el.seed) * 0.08;
      dummy.position.set(el.x + frondSway, 6.5 - drop, el.z);
      dummy.scale.setScalar(el.scale * 1.2);
      dummy.rotation.set(frondSway * 0.3, el.rotation + t * 0.05, 0);
      dummy.updateMatrix();
      frondRef.current!.setMatrixAt(i, dummy.matrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    frondRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[PALM_TRUNK_GEO, PALM_TRUNK_MAT, elements.length]} />
      <instancedMesh ref={frondRef} args={[PALM_FROND_GEO, PALM_FROND_MAT, elements.length]} />
    </group>
  );
}

// ─── Pillar Succession Overlay ────────────────────────────────────────────────
// Cracks grow wider, longer, and more branched with depth.
// Depth 2: hairline cracks, 3 per pillar
// Depth 3: wider cracks, 5 per pillar, slight branches
// Depth 4: thick fractures, 8 per pillar, branching sub-cracks
// Depth 5+: shattered, 12 per pillar, full fracture network

const PILLAR_POSITIONS: [number, number, number][] = [
  [-18, 0, -18], [18, 0, -18], [-18, 0, 18],
  [18, 0, 18], [-18, 0, 0], [18, 0, 0],
];

// Crack widths by depth
function getCrackWidth(depth: number): number {
  if (depth <= 2) return 0.05;
  if (depth === 3) return 0.10;
  if (depth === 4) return 0.18;
  return 0.28; // depth 5+
}

// Crack count per pillar by depth
function getCracksPerPillar(depth: number): number {
  if (depth <= 2) return 3;
  if (depth === 3) return 5;
  if (depth === 4) return 8;
  return 12; // depth 5+
}

// Crack length by depth
function getCrackLength(depth: number): number {
  if (depth <= 2) return 1.8;
  if (depth === 3) return 2.8;
  if (depth === 4) return 3.8;
  return 5.0; // depth 5+, spans most of pillar height
}

function PillarSuccession({ depth, opacity, palette, playerPos }: {
  depth: number;
  opacity: number;
  palette: ReturnType<typeof getBlendedPalette>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const cracksPerPillar = getCracksPerPillar(depth);
  const crackCount = PILLAR_POSITIONS.length * cracksPerPillar;
  const crackWidth = getCrackWidth(depth);
  const crackLength = getCrackLength(depth);

  // Rebuild geometry when depth changes
  const crackGeo = useMemo(
    () => new THREE.BoxGeometry(crackWidth, crackLength, crackWidth),
    [crackWidth, crackLength],
  );

  const crackMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: palette.cityAccent,
    transparent: true,
    opacity: Math.min(0.85, 0.4 + depth * 0.1),
  }), [palette.cityAccent, depth]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const crackRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    if (!crackRef.current) return;
    const t = clock.elapsedTime;
    let idx = 0;

    PILLAR_POSITIONS.forEach(([px, , pz], pi) => {
      // Get ground drop at this pillar's position
      const pp = playerPos.current;
      const groundDrop = sphereDrop(px - pp.x, pz - pp.z);

      for (let c = 0; c < cracksPerPillar; c++) {
        const angle = (pi * 1.618 + c * (Math.PI * 2 / cracksPerPillar)) % (Math.PI * 2);
        const reach = 0.35 + (depth - 2) * 0.12;
        const offsetX = Math.cos(angle) * reach;
        const offsetZ = Math.sin(angle) * reach;
        // Crack Y follows ground curve
        const crackY = 1.5 + (c / cracksPerPillar) * (depth * 1.2) - groundDrop;
        const branchTilt = depth >= 4 && c % 2 === 0
          ? 0.6 + (depth - 4) * 0.3
          : 0.2 + c * 0.15;
        const breathe = depth >= 5
          ? 1 + Math.sin(t * 0.8 + pi * 0.5 + c) * 0.12
          : 1 + Math.sin(t * 0.4 + pi + c) * 0.04;

        dummy.position.set(px + offsetX, crackY, pz + offsetZ);
        dummy.scale.set(breathe, 1, breathe);
        dummy.rotation.set(
          branchTilt,
          angle + (depth >= 3 ? Math.sin(pi * 2.3 + c) * 0.4 : 0),
          0.15 + c * 0.2 + (depth >= 4 ? Math.cos(c * 1.7) * 0.5 : 0),
        );
        dummy.updateMatrix();
        crackRef.current!.setMatrixAt(idx++, dummy.matrix);
      }
    });

    crackRef.current.instanceMatrix.needsUpdate = true;
  });

  if (depth < 2) return null;

  return (
    <instancedMesh ref={crackRef} args={[crackGeo, crackMat, crackCount]} />
  );
}
