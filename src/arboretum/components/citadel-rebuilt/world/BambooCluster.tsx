/**
 * BambooCluster — Hero flora asset for Urban-Nature Melting Pot
 * 
 * Bamboo is THE succession asset that scales with depth + thoughts.
 * Clusters densely like Ghost of Tsushima at high depths.
 * 
 * Poly Budget: 22 polys per stalk (6-sided cylinder + leaf quads)
 * Rendering: Instanced for performance (1 draw call per cluster)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloraElement } from './UrbanSuccession';
import { sphereDrop, applyGlobeCurvatureMatrix } from '../RebuiltWorldShared';

interface BambooClusterProps {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  palette: { naturePrimary: number; natureAccent: number };
}

export function BambooCluster({ elements, playerPos, palette }: BambooClusterProps) {
  const bambooElements = elements.filter(e => e.type === 'bamboo');
  
  if (bambooElements.length === 0) return null;
  
  return (
    <group>
      <BambooStalks elements={bambooElements} playerPos={playerPos} color={palette.naturePrimary} />
      <BambooLeaves elements={bambooElements} playerPos={playerPos} color={palette.natureAccent} />
    </group>
  );
}

// Bamboo stalks (instanced cylinders)
function BambooStalks({ elements, playerPos, color }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  color: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Stalk geometry: 6-sided cylinder, 3 segments
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.08, 0.1, 4, 6, 3), []);
  
  useFrame(() => {
    if (!meshRef.current) return;
    const pp = playerPos.current;
    
    elements.forEach((el, i) => {
      const height = 4 * el.scale;
      applyGlobeCurvatureMatrix(dummy.matrix, el.x, height / 2, el.z, pp, el.scale, el.rotation);
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, elements.length]}
      matrixAutoUpdate={false}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.15}
        roughness={0.8}
      />
    </instancedMesh>
  );
}

// Bamboo leaves (instanced cones at top)
function BambooLeaves({ elements, playerPos, color }: {
  elements: FloraElement[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  color: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Leaf geometry: low-poly cone
  const geometry = useMemo(() => new THREE.ConeGeometry(0.15, 0.5, 4), []);
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;
    
    elements.forEach((el, i) => {
      const height = 4 * el.scale;
      // Leaves at top with gentle sway
      const sway = Math.sin(t * 0.5 + el.seed * 0.1) * 0.1;
      applyGlobeCurvatureMatrix(dummy.matrix, el.x + sway, height, el.z, pp, el.scale, el.rotation, sway * 0.5);
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, elements.length]}
      matrixAutoUpdate={false}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.2}
        transparent
        opacity={0.7}
      />
    </instancedMesh>
  );
}
