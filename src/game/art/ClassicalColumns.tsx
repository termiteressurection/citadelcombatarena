import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applyGlobeCurvature } from './flat';

interface Props {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export interface ColumnMeshProps {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  showLabel?: boolean;
}

/**
 * The Three Classical Orders: Doric, Ionic, Corinthian.
 * Represents the three Masonic pillars (Wisdom, Strength, Beauty).
 * High-fidelity fluted shafts, ornate capitals, and authentic profiles.
 */

export function DoricColumn({
  position,
  scale = 1.0,
  rotationY = 0,
  playerPos,
  showLabel = false,
}: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp, rotationY);
  });

  // Doric Order: NO base (rests directly on stylobate), sturdy fluted shaft, plain cushion echinus + square abacus
  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {/* Fluted shaft: 16 facets, sturdy taper */}
      <mesh position={[0, 4.0, 0]}>
        <cylinderGeometry args={[0.52, 0.65, 8.0, 16, 1, true]} />
        <meshBasicMaterial color={0x22d3ee} wireframe transparent opacity={0.55} />
      </mesh>
      {/* Inner shaft solid body */}
      <mesh position={[0, 4.0, 0]}>
        <cylinderGeometry args={[0.48, 0.60, 7.9, 16]} />
        <meshBasicMaterial color={0x0b051b} transparent opacity={0.7} />
      </mesh>
      {/* Capital Necking groove */}
      <mesh position={[0, 7.9, 0]}>
        <cylinderGeometry args={[0.54, 0.52, 0.15, 16]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.7} />
      </mesh>
      {/* Capital: Circular cushion echinus */}
      <mesh position={[0, 8.15, 0]}>
        <cylinderGeometry args={[0.82, 0.56, 0.35, 16]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} />
      </mesh>
      {/* Capital: Square flat abacus slab */}
      <mesh position={[0, 8.45, 0]}>
        <boxGeometry args={[1.5, 0.25, 1.5]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, 6, 0]} color={0x22d3ee} intensity={0.35} distance={9} />
    </group>
  );
}

export function IonicColumn({
  position,
  scale = 1.0,
  rotationY = 0,
  playerPos,
  showLabel = false,
}: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp, rotationY);
  });

  // Ionic Order: Attic base with torus ring, slender fluted shaft, iconic scrolled paired volutes
  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {/* Attic Base: Square plinth + Torus ring + Scotia */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.5, 0.3, 1.5]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.75, 0.85, 0.22, 16]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <torusGeometry args={[0.62, 0.08, 6, 16]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
      </mesh>
      {/* Slender fluted shaft */}
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.44, 0.54, 7.8, 16, 1, true]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.40, 0.50, 7.7, 16]} />
        <meshBasicMaterial color={0x0b051b} transparent opacity={0.7} />
      </mesh>
      {/* Capital: Central echinus with egg-and-dart band */}
      <mesh position={[0, 8.25, 0]}>
        <cylinderGeometry args={[0.62, 0.46, 0.25, 16]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} />
      </mesh>
      {/* Capital Volutes: Paired horizontal scrolled spiral volutes on left & right */}
      <group position={[0, 8.4, 0]}>
        {/* Left spiral scroll */}
        <mesh position={[0, 0, -0.68]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.12, 6, 16]} />
          <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0, -0.68]}>
          <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
          <meshBasicMaterial color={0xa855f7} transparent opacity={0.75} />
        </mesh>
        {/* Right spiral scroll */}
        <mesh position={[0, 0, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.12, 6, 16]} />
          <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.68]}>
          <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
          <meshBasicMaterial color={0xa855f7} transparent opacity={0.75} />
        </mesh>
        {/* Volute horizontal connecting bolster cushion */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.0, 0.22, 1.4]} />
          <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} />
        </mesh>
        {/* Thin molded abacus */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.2, 0.12, 1.6]} />
          <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.9} />
        </mesh>
      </group>
      <pointLight position={[0, 6, 0]} color={0xa855f7} intensity={0.4} distance={9} />
    </group>
  );
}

export function CorinthianColumn({
  position,
  scale = 1.0,
  rotationY = 0,
  playerPos,
  showLabel = false,
}: ColumnMeshProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp, rotationY);
  });

  // Corinthian Order: Tiered base, tall fluted shaft, ornate bell-shaped kalathos with carved acanthus leaf petals
  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {/* Tiered Attic Base */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.4, 0.3, 1.4]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.68, 0.78, 0.25, 16]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <torusGeometry args={[0.56, 0.07, 6, 16]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
      </mesh>
      {/* Tall slender fluted shaft */}
      <mesh position={[0, 4.6, 0]}>
        <cylinderGeometry args={[0.40, 0.50, 8.0, 16, 1, true]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 4.6, 0]}>
        <cylinderGeometry args={[0.36, 0.46, 7.9, 16]} />
        <meshBasicMaterial color={0x0b051b} transparent opacity={0.7} />
      </mesh>
      {/* Ornate Corinthian Capital: Bell-shaped Kalathos core */}
      <mesh position={[0, 8.8, 0]}>
        <cylinderGeometry args={[0.75, 0.42, 0.9, 16]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.75} />
      </mesh>
      {/* Tier 1: 8 Acanthus leaf fronds outward curling at base of kalathos */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI * 2) / 8;
        return (
          <group key={`leaf1-${i}`} position={[Math.cos(angle) * 0.48, 8.55, Math.sin(angle) * 0.48]} rotation={[0.25 * Math.sin(angle), -angle, 0.25 * Math.cos(angle)]}>
            <mesh>
              <coneGeometry args={[0.14, 0.5, 4]} />
              <meshBasicMaterial color={0x34d399} wireframe transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })}
      {/* Tier 2: 8 Acanthus leaves flaring higher between lower tier */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = ((i + 0.5) * Math.PI * 2) / 8;
        return (
          <group key={`leaf2-${i}`} position={[Math.cos(angle) * 0.62, 8.95, Math.sin(angle) * 0.62]} rotation={[0.38 * Math.sin(angle), -angle, 0.38 * Math.cos(angle)]}>
            <mesh>
              <coneGeometry args={[0.16, 0.6, 4]} />
              <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.9} />
            </mesh>
          </group>
        );
      })}
      {/* Molded abacus with concave faceted sides */}
      <mesh position={[0, 9.35, 0]}>
        <boxGeometry args={[1.5, 0.18, 1.5]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.9} />
      </mesh>
      {/* Central flower finial on abacus edge */}
      <mesh position={[0, 9.46, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color={0xec4899} transparent opacity={0.95} />
      </mesh>
      <pointLight position={[0, 6, 0]} color={0xec4899} intensity={0.45} distance={10} />
    </group>
  );
}

// Backward-compatible aliases
export const DoricColumnMesh = DoricColumn;
export const IonicColumnMesh = IonicColumn;
export const CorinthianColumnMesh = CorinthianColumn;

