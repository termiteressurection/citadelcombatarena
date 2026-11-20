import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, applyGlobeCurvature } from '../RebuiltWorldShared';
import { DigitalAlarmHaloRing } from './PortalSystems';
import { applyTermiteseGlitch } from '@/features/sigma/termiteseGlitch';

const TEXT_NEAR_RADIUS_SQ = 18 * 18;

// ─────────────────────────────────────────────────────────────────────────────
// MODULAR PYRAMID SUBCOMPONENTS (Breaking down the monolithic mesh)
// ─────────────────────────────────────────────────────────────────────────────

export function PyramidOuterGlass({ active = false }: { active?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.12;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 2.8, 0]} rotation={[0, Math.PI / 4, 0]}>
      <cylinderGeometry args={[0, 4.2, 5.6, 4, 1, false]} />
      <meshStandardMaterial
        color="#38bdf8"
        roughness={0.08}
        metalness={0.9}
        transparent
        opacity={0.52}
        emissive="#0284c7"
        emissiveIntensity={active ? 0.65 : 0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function PyramidFacetWireframe({ active = false }: { active?: boolean }) {
  return (
    <mesh position={[0, 2.8, 0]} rotation={[0, Math.PI / 4, 0]}>
      <cylinderGeometry args={[0, 4.22, 5.62, 4, 1, false]} />
      <meshBasicMaterial
        color={active ? '#67e8f9' : '#7dd3fc'}
        wireframe
        transparent
        opacity={active ? 0.95 : 0.55}
      />
    </mesh>
  );
}

export function PyramidChronosCore() {
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.35;
      coreRef.current.rotation.z = Math.sin(t * 0.8) * 0.2;
    }
  });

  return (
    <mesh ref={coreRef} position={[0, 2.6, 0]}>
      <octahedronGeometry args={[1.2, 0]} />
      <meshBasicMaterial color="#facc15" wireframe transparent opacity={0.8} />
    </mesh>
  );
}

export function PyramidSeasonalOrbits() {
  const orbitGroupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = clock.elapsedTime * 0.45;
    }
  });

  return (
    <group ref={orbitGroupRef} position={[0, 3.0, 0]}>
      {/* Winter (s=0): Frost Crystal Octahedron */}
      <mesh position={[5.2, 0, 0]}>
        <octahedronGeometry args={[0.38, 0]} />
        <meshBasicMaterial color="#38bdf8" wireframe />
      </mesh>
      {/* Spring (s=1): Emerald Spire Tetrahedron */}
      <mesh position={[0, 0, 5.2]}>
        <tetrahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color="#34d399" wireframe />
      </mesh>
      {/* Summer (s=2): Solar Sun Dodecahedron */}
      <mesh position={[-5.2, 0, 0]}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color="#facc15" wireframe />
      </mesh>
      {/* Autumn (s=3): Obsidian Amber Icosahedron */}
      <mesh position={[0, 0, -5.2]}>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color="#c084fc" wireframe />
      </mesh>
    </group>
  );
}

export function PyramidFoundationRing({
  displayText,
  active = false,
  highlightColor,
}: {
  displayText: string;
  active?: boolean;
  highlightColor: string;
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[3.2, 4.6, 16]} />
        <meshBasicMaterial
          color={highlightColor}
          wireframe
          transparent
          opacity={active ? 0.85 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group position={[0, 0.6, 0]}>
        <DigitalAlarmHaloRing
          text={displayText}
          radius={3.8}
          active={active}
          colorScheme={active ? 'cyan' : 'amber'}
        />
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE PYRAMIDS
// ─────────────────────────────────────────────────────────────────────────────

interface OpenYearGlassPyramidProps {
  year: number;
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  active?: boolean;
  onEnter?: () => void;
}

export function OpenYearGlassPyramid({
  year,
  position,
  playerPos,
  active = false,
  onEnter,
}: OpenYearGlassPyramidProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isNear, setIsNear] = useState(false);

  const label = `YEAR ${year}`;
  const glitchLabel = useMemo(() => applyTermiteseGlitch(label, 0), [label]);

  useFrame(() => {
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;
    const distSq = dx * dx + dz * dz;

    const near = distSq < TEXT_NEAR_RADIUS_SQ;
    if (near !== isNear) setIsNear(near);

    if (groupRef.current) {
      applyGlobeCurvature(groupRef.current, position[0], 0, position[2], pp);
    }
  });

  const displayText = isNear ? label : glitchLabel;
  const highlightColor = active ? '#67e8f9' : '#fbbf24';

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={onEnter}
      onPointerDown={(e) => {
        e.stopPropagation();
        onEnter?.();
      }}
    >
      <PyramidOuterGlass active={active} />
      <PyramidFacetWireframe active={active} />
      <PyramidChronosCore />
      <PyramidSeasonalOrbits />
      <PyramidFoundationRing
        displayText={displayText}
        active={active}
        highlightColor={highlightColor}
      />
    </group>
  );
}

interface SealedYearArchivePyramidProps {
  year: number;
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  active?: boolean;
  onEnter?: () => void;
}

export function SealedYearArchivePyramid({
  year,
  position,
  playerPos,
  active = false,
  onEnter,
}: SealedYearArchivePyramidProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pyramidRef = useRef<THREE.Mesh>(null);
  const [isNear, setIsNear] = useState(false);

  const label = `ARCHIVE ${year} · SEALED`;
  const glitchLabel = useMemo(() => applyTermiteseGlitch(label, 0), [label]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;
    const distSq = dx * dx + dz * dz;

    const near = distSq < TEXT_NEAR_RADIUS_SQ;
    if (near !== isNear) setIsNear(near);

    if (groupRef.current) {
      applyGlobeCurvature(groupRef.current, position[0], 0, position[2], pp);
    }
    if (pyramidRef.current) {
      pyramidRef.current.rotation.y = t * 0.06;
    }
  });

  const displayText = isNear ? label : glitchLabel;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={onEnter}
      onPointerDown={(e) => {
        e.stopPropagation();
        onEnter?.();
      }}
    >
      {/* Solid Faceted Starlight Crystal Structure */}
      <mesh ref={pyramidRef} position={[0, 2.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0, 3.6, 4.8, 4, 1, false]} />
        <meshStandardMaterial
          color="#1e1b4b"
          metalness={0.88}
          roughness={0.18}
          emissive="#6366f1"
          emissiveIntensity={active ? 0.65 : 0.28}
        />
      </mesh>
      <mesh position={[0, 2.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0, 3.62, 4.82, 4, 1, false]} />
        <meshBasicMaterial
          color="#818cf8"
          wireframe
          transparent
          opacity={active ? 0.8 : 0.35}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[2.8, 3.8, 12]} />
        <meshBasicMaterial
          color="#818cf8"
          wireframe
          transparent
          opacity={active ? 0.75 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group position={[0, 0.6, 0]}>
        <DigitalAlarmHaloRing
          text={displayText}
          radius={3.2}
          active={active}
          colorScheme={active ? 'cyan' : 'amber'}
        />
      </group>
    </group>
  );
}
