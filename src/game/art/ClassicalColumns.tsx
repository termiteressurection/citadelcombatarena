import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applyGlobeCurvature } from './flat';
import { cloneTex, getPs1Texture, makePs1Material } from './ps1Textures';

export interface ColumnMeshProps {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  showLabel?: boolean;
}

let sharedMats: {
  stone: THREE.MeshLambertMaterial;
  stoneAccent: THREE.MeshLambertMaterial;
  bronze: THREE.MeshLambertMaterial;
} | null = null;

function getColumnMats() {
  if (!sharedMats) {
    const stoneTex = cloneTex(getPs1Texture('conduit'), 2, 4);
    const bronzeTex = cloneTex(getPs1Texture('circuit'), 2, 1);
    sharedMats = {
      stone: makePs1Material({ color: '#272c4a', map: stoneTex, emissive: '#0c1d33', emissiveIntensity: 0.3 }),
      stoneAccent: makePs1Material({ color: '#1b1f38', map: stoneTex }),
      bronze: makePs1Material({ color: '#4de8ff', map: bronzeTex, emissive: '#3ff0ff', emissiveIntensity: 0.45 }),
    };
  }
  return sharedMats;
}

/** Doric Order: chunky 10-sided faceted PS1 stone shaft, cushion echinus, and antique-bronze square abacus. */
export function DoricColumn({ position, scale = 1.0, rotationY = 0, playerPos }: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  const mats = useMemo(getColumnMats, []);
  useFrame(() => {
    if (!ref.current) return;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], playerPos.current, rotationY);
  });

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.16, 0]} material={mats.stoneAccent}>
        <boxGeometry args={[1.5, 0.32, 1.5]} />
      </mesh>
      <mesh position={[0, 4.1, 0]} material={mats.stone}>
        <cylinderGeometry args={[0.50, 0.64, 7.6, 10]} />
      </mesh>
      <mesh position={[0, 7.9, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.56, 0.50, 0.18, 10]} />
      </mesh>
      <mesh position={[0, 8.15, 0]} material={mats.stoneAccent}>
        <cylinderGeometry args={[0.82, 0.56, 0.36, 10]} />
      </mesh>
      <mesh position={[0, 8.46, 0]} material={mats.bronze}>
        <boxGeometry args={[1.55, 0.26, 1.55]} />
      </mesh>
    </group>
  );
}

/** Ionic Order: stepped base, faceted shaft, and angular low-poly bronze scroll volutes. */
export function IonicColumn({ position, scale = 1.0, rotationY = 0, playerPos }: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  const mats = useMemo(getColumnMats, []);
  useFrame(() => {
    if (!ref.current) return;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], playerPos.current, rotationY);
  });

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.16, 0]} material={mats.stoneAccent}>
        <boxGeometry args={[1.55, 0.32, 1.55]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.66, 0.78, 0.24, 10]} />
      </mesh>
      <mesh position={[0, 4.4, 0]} material={mats.stone}>
        <cylinderGeometry args={[0.44, 0.55, 7.7, 10]} />
      </mesh>
      <mesh position={[0, 8.28, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.64, 0.46, 0.28, 10]} />
      </mesh>
      <group position={[0, 8.46, 0]}>
        <mesh position={[0, 0, -0.66]} material={mats.bronze}>
          <cylinderGeometry args={[0.32, 0.32, 0.34, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.66]} material={mats.bronze}>
          <cylinderGeometry args={[0.32, 0.32, 0.34, 8]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={mats.stoneAccent}>
          <boxGeometry args={[1.05, 0.24, 1.4]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={mats.bronze}>
          <boxGeometry args={[1.28, 0.16, 1.66]} />
        </mesh>
      </group>
    </group>
  );
}

/** Corinthian Order: slender 10-sided stone shaft topped with faceted bronze kalathos & triangular leaf petals. */
export function CorinthianColumn({ position, scale = 1.0, rotationY = 0, playerPos }: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  const mats = useMemo(getColumnMats, []);
  useFrame(() => {
    if (!ref.current) return;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], playerPos.current, rotationY);
  });

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.18, 0]} material={mats.stoneAccent}>
        <boxGeometry args={[1.5, 0.36, 1.5]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.62, 0.74, 0.24, 10]} />
      </mesh>
      <mesh position={[0, 4.55, 0]} material={mats.stone}>
        <cylinderGeometry args={[0.42, 0.52, 7.9, 10]} />
      </mesh>
      <mesh position={[0, 8.78, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.74, 0.44, 0.88, 8]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * Math.PI * 2) / 6;
        return (
          <group
            key={i}
            position={[Math.cos(angle) * 0.56, 8.78, Math.sin(angle) * 0.56]}
            rotation={[0.3 * Math.sin(angle), -angle, 0.3 * Math.cos(angle)]}
          >
            <mesh material={mats.bronze}>
              <coneGeometry args={[0.17, 0.58, 3]} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 9.32, 0]} material={mats.stoneAccent}>
        <boxGeometry args={[1.56, 0.22, 1.56]} />
      </mesh>
      <mesh position={[0, 9.56, 0]} material={mats.bronze}>
        <coneGeometry args={[0.2, 0.32, 4]} />
      </mesh>
    </group>
  );
}

export const DoricColumnMesh = DoricColumn;
export const IonicColumnMesh = IonicColumn;
export const CorinthianColumnMesh = CorinthianColumn;
