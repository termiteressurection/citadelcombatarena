import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, applyGlobeCurvature } from '../../RebuiltWorldShared';

export function ColumnSet({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const shaft = useMemo(() => new THREE.CylinderGeometry(0.55, 0.62, 8.5, 6, 1, true), []);
  const cap = useMemo(() => new THREE.CylinderGeometry(1.0, 0.8, 0.5, 6), []);
  const base = useMemo(() => new THREE.CylinderGeometry(0.9, 1.1, 0.45, 6), []);
  const placements: [number, number, number][] = [
    [-18, 0, -18],
    [18, 0, -18],
    [-18, 0, 18],
    [18, 0, 18],
    [-18, 0, 0],
    [18, 0, 0],
  ];
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const pp = playerPos.current;
    placements.forEach(([x, _y, z], i) => {
      const g = groupRefs.current[i];
      if (!g) return;
      g.position.y = -sphereDrop(x - pp.x, z - pp.z);
    });
  });

  return (
    <group>
      {placements.map(([x, y, z], index) => (
        <group key={index} ref={(el) => { groupRefs.current[index] = el; }} position={[x, y, z]}>
          {/* Phase 5 static pilot (meshes 3/4/5): local transforms inside
              each column group never change — only the parent group moves
              with sphereDrop. Opting out of per-frame matrix updates on
              these children cuts three Matrix4.compose() calls per column
              per frame × 5 columns = 15 calls/frame. */}
          <mesh
            geometry={base}
            position={[0, 0.22, 0]}
            matrixAutoUpdate={false}
            onUpdate={(self) => self.updateMatrix()}
          >
            <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.45} />
          </mesh>
          <mesh
            geometry={shaft}
            position={[0, 4.5, 0]}
            matrixAutoUpdate={false}
            onUpdate={(self) => self.updateMatrix()}
          >
            <meshBasicMaterial color={0x34d399} wireframe transparent opacity={0.38} />
          </mesh>
          <mesh
            geometry={cap}
            position={[0, 8.7, 0]}
            matrixAutoUpdate={false}
            onUpdate={(self) => self.updateMatrix()}
          >
            <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WireframeTorii({ position, rotation = [0, 0, 0] as [number, number, number], scale = 1, playerPos }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(
      groupRef.current,
      position[0],
      0, // Flush on curved planetary floor!
      position[2],
      pp,
      rotation[1],
    );
  });

  return (
    <group ref={groupRef} scale={scale}>
      <mesh position={[-1.55, 2.9, 0]}>
        <boxGeometry args={[0.34, 5.8, 0.34]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh position={[1.55, 2.9, 0]}>
        <boxGeometry args={[0.34, 5.8, 0.34]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 5.55, 0]}>
        <boxGeometry args={[4.8, 0.34, 0.38]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 5.05, 0]}>
        <boxGeometry args={[4.1, 0.2, 0.28]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.42} />
      </mesh>
    </group>
  );
}

export function LanternField({ count = 6, playerPos }: { count?: number; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lanterns = useMemo(() => Array.from({ length: count }, (_, index) => ({
    angle: (index / count) * Math.PI * 2,
    radius: 26 + (index % 3) * 5.5,
    height: 4 + (index % 4) * 0.8,
  })), [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    lanterns.forEach((lantern, index) => {
      const angle = lantern.angle + t * 0.03;
      const wx = Math.cos(angle) * lantern.radius;
      const wz = Math.sin(angle) * lantern.radius;
      const drop = sphereDrop(wx - pp.x, wz - pp.z);
      dummy.position.set(
        wx,
        lantern.height + Math.sin(t * 1.1 + index) * 0.2 - drop,
        wz,
      );
      dummy.scale.setScalar(0.3 + Math.sin(t * 1.7 + index) * 0.04);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <tetrahedronGeometry args={[0.6, 0]} />
      <meshBasicMaterial color={0xc084fc} transparent opacity={0.85} />
    </instancedMesh>
  );
}

export function Altar({ active, playerPos }: { active: boolean; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const crystalRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.28;
      crystalRef.current.position.y = 1.45 + Math.sin(t * 1.5) * 0.08;
    }
    if (groupRef.current) {
      const pp = playerPos.current;
      groupRef.current.position.y = -sphereDrop(-pp.x, -pp.z);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. Stepped Obsidian Dais Base */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[2.0, 2.3, 0.24, 8]} />
        <meshBasicMaterial color={0x0b0716} transparent opacity={0.85} />
      </mesh>
      {/* Dais Edge Sigil */}
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.8, 1.86, 8]} />
        <meshBasicMaterial color={active ? 0xfbbf24 : 0x7c3aed} transparent opacity={0.6} />
      </mesh>

      {/* 2. Consecrated Basin Column */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.95, 0.75, 0.75, 8]} />
        <meshBasicMaterial color={0x150b28} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.96, 0.76, 0.76, 8]} />
        <meshBasicMaterial color={active ? 0xfbbf24 : 0xa855f7} wireframe transparent opacity={0.4} />
      </mesh>

      {/* 3. Floating Living Crucible Focus */}
      <group ref={crystalRef} position={[0, 1.45, 0]}>
        {/* Outer Sacred Prism */}
        <mesh>
          <octahedronGeometry args={[0.42, 0]} />
          <meshBasicMaterial color={active ? 0xfbbf24 : 0xc084fc} wireframe transparent opacity={0.9} />
        </mesh>
        {/* Inner Solid Core */}
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshBasicMaterial color={active ? 0xfffbeb : 0xe9d5ff} transparent opacity={0.75} />
        </mesh>
        {/* Gentle Ambient Radiance */}
        <pointLight
          color={active ? 0xfbbf24 : 0xa855f7}
          intensity={active ? 0.9 : 0.4}
          distance={5}
        />
      </group>
    </group>
  );
}

export function BreathingPulse({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    // Breathe at ~4 second cycle (like calm breathing)
    const breath = Math.sin(t * 1.57) * 0.5 + 0.5; // 0→1→0
    ref.current.scale.setScalar(1 + breath * 0.15);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + breath * 0.06;
    ref.current.position.set(pp.x, 0.05, pp.z);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[28, 32, 6]} />
      <meshBasicMaterial color={0xa855f7} transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function GrowthRings({ thoughtCount, playerPos }: { thoughtCount: number; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ringCount = Math.min(Math.floor(thoughtCount / 3), 5); // one ring per 3 thoughts, max 5
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    groupRef.current.position.set(pp.x, 0.02, pp.z);
  });

  if (ringCount === 0) return null;

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      {Array.from({ length: ringCount }, (_, i) => (
        <mesh key={i}>
          <ringGeometry args={[8 + i * 6, 8.3 + i * 6, 6]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? 0xa855f7 : 0x34d399}
            transparent
            opacity={0.06 - i * 0.008}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export function UpgradeAura({ upgrades, playerPos }: {
  upgrades: Record<string, number>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const totalLevel = Object.values(upgrades).reduce((s, v) => s + v, 0);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    ref.current.position.set(0, 0.5 - sphereDrop(-pp.x, -pp.z), 0);
    ref.current.rotation.y = t * 0.1;
    ref.current.scale.setScalar(1 + Math.sin(t * 0.3) * 0.05);
  });

  if (totalLevel === 0) return null;

  const color = totalLevel >= 9 ? 0xfbbf24 : totalLevel >= 5 ? 0xc084fc : 0x7c3aed;
  const radius = 2 + totalLevel * 0.3;

  return (
    <mesh ref={ref} position={[0, 0.5, 0]}>
      <torusGeometry args={[radius, 0.03, 3, 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.15 + totalLevel * 0.02} />
    </mesh>
  );
}

