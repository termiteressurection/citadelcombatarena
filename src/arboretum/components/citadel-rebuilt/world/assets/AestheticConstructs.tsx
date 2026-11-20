/* ─────────────────────────────────────────────────────────────────
   AESTHETIC CONSTRUCTS
   Extracted from CityAssets.tsx.
   High-poly 3D structural meshes: Torii gates, columns, pyramids,
   and bamboo clusters. All use sphereDrop for terrain following.
   ───────────────────────────────────────────────────────────────── */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applyGlobeCurvature } from '../../RebuiltWorldShared';

type V3Ref = React.MutableRefObject<THREE.Vector3>;

export function AestheticTorii({ position, scale = 1, playerPos, yaw = 0, seed = 0 }: {
  position: [number, number, number];
  scale?: number;
  playerPos: V3Ref;
  yaw?: number;
  seed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const params = useMemo(() => {
    const r = (n: number) => { const x = Math.sin(seed * 23.45 + n * 7.89) * 1000; return x - Math.floor(x); };
    return { height: 5.5 + r(1) * 1.5, width: 3.6 + r(2) * 1.2, thickness: 0.28 + r(3) * 0.08 };
  }, [seed]);
  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp, yaw);
  });
  const { height: h, width: w, thickness: t } = params;
  return (
    <group ref={groupRef} position={position} rotation={[0, yaw, 0]} scale={[scale, scale, scale]}>
      <mesh position={[-w / 2, 0.2, 0]}><boxGeometry args={[t * 1.5, 0.4, t * 1.5]} /><meshBasicMaterial color={0x0a0514} transparent opacity={0.6} /></mesh>
      <mesh position={[w / 2, 0.2, 0]}><boxGeometry args={[t * 1.5, 0.4, t * 1.5]} /><meshBasicMaterial color={0x0a0514} transparent opacity={0.6} /></mesh>
      <mesh position={[-w / 2, h / 2, 0]}><cylinderGeometry args={[t * 0.8, t, h, 6]} /><meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.65} /></mesh>
      <mesh position={[w / 2, h / 2, 0]}><cylinderGeometry args={[t * 0.8, t, h, 6]} /><meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.65} /></mesh>
      <group position={[0, h - 0.1, 0]}>
        <mesh><boxGeometry args={[w * 1.48, t * 1.1, t * 1.2]} /><meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} /></mesh>
        <mesh position={[-(w * 0.74 + 0.1), t * 0.15, 0]} rotation={[0, 0, 0.25]}><boxGeometry args={[0.4, t * 1.1, t * 1.2]} /><meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} /></mesh>
        <mesh position={[w * 0.74 + 0.1, t * 0.15, 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.4, t * 1.1, t * 1.2]} /><meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.8} /></mesh>
      </group>
      <mesh position={[0, h * 0.76, 0]}><boxGeometry args={[w * 1.25, t * 0.7, t * 0.8]} /><meshBasicMaterial color={0x22d3ee} wireframe transparent opacity={0.6} /></mesh>
    </group>
  );
}

export function AestheticColumn({ position, scale = 1, playerPos }: {
  position: [number, number, number];
  scale?: number;
  playerPos: V3Ref;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp);
  });
  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, 5.0, 0]}><boxGeometry args={[0.9, 0.3, 0.9]} /><meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.65} /></mesh>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.26, 0.32, 5.0, 6]} /><meshBasicMaterial color={0x22d3ee} wireframe transparent opacity={0.5} /></mesh>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.0, 0.3, 1.0]} /><meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.6} /></mesh>
    </group>
  );
}

export function AestheticPyramid({ position, scale = 1, playerPos, yaw }: {
  position: [number, number, number];
  scale?: number;
  playerPos: V3Ref;
  yaw: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp, yaw);
  });
  return (
    <group ref={groupRef} position={position} rotation={[0, yaw, 0]} scale={scale}>
      <mesh position={[0, 1.25, 0]}><coneGeometry args={[1.3, 2.5, 4]} /><meshBasicMaterial color={0x0a0514} transparent opacity={0.5} /></mesh>
      <mesh position={[0, 1.25, 0]} scale={1.02}><coneGeometry args={[1.3, 2.5, 4]} /><meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.7} /></mesh>
      <mesh position={[0, 2.5, 0]}><octahedronGeometry args={[0.16, 0]} /><meshBasicMaterial color={0xec4899} transparent opacity={0.9} /></mesh>
    </group>
  );
}

export function AestheticBamboo({ position, scale = 1, playerPos, seed = 0 }: {
  position: [number, number, number];
  scale?: number;
  playerPos: V3Ref;
  seed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const params = useMemo(() => {
    const r = (n: number) => { const x = Math.sin(seed * 43.21 + n * 9.87) * 1000; return x - Math.floor(x); };
    return {
      baseH: 3.2 + r(1) * 1.6, midH: 2.5 + r(2) * 1.2, topH: 1.8 + r(3) * 1.0,
      baseW: 0.08 + r(4) * 0.05, midW: (0.08 + r(4) * 0.05) * 0.8, topW: (0.08 + r(4) * 0.05) * 0.8 * 0.75,
      bendX1: (r(5) - 0.5) * 0.12, bendZ1: (r(6) - 0.5) * 0.12,
      bendX2: (r(7) - 0.5) * 0.16, bendZ2: (r(8) - 0.5) * 0.16,
      leafCount: Math.floor(2 + r(9) * 3), leafScale: 0.7 + r(10) * 0.4,
    };
  }, [seed]);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    const sway = Math.sin(clock.elapsedTime * 0.75 + seed) * 0.05 * scale;
    applyGlobeCurvature(groupRef.current, position[0] + sway, position[1], position[2], pp, 0);
    groupRef.current.rotation.z += sway * 0.1;
  });
  const p = params;
  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      <group position={[0, p.baseH / 2, 0]}>
        <mesh><cylinderGeometry args={[p.midW, p.baseW, p.baseH, 6, 2]} /><meshBasicMaterial color={0x34d399} wireframe transparent opacity={0.6} /></mesh>
      </group>
      <group position={[0, p.baseH, 0]} rotation={[p.bendX1, 0, p.bendZ1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[p.baseW * 1.15, 0.04, 4, 8]} /><meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} /></mesh>
        <group position={[0, p.midH / 2, 0]}>
          <mesh><cylinderGeometry args={[p.topW, p.midW, p.midH, 6, 2]} /><meshBasicMaterial color={0x10b981} wireframe transparent opacity={0.65} /></mesh>
        </group>
        <group position={[0, p.midH, 0]} rotation={[p.bendX2, 0, p.bendZ2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[p.midW * 1.15, 0.03, 4, 8]} /><meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} /></mesh>
          <group position={[0, p.topH / 2, 0]}>
            <mesh><cylinderGeometry args={[p.topW * 0.7, p.topW, p.topH, 6, 1]} /><meshBasicMaterial color={0x059669} wireframe transparent opacity={0.7} /></mesh>
          </group>
          <group position={[0, p.topH, 0]}>
            {[...Array(p.leafCount)].map((_, i) => {
              const angle = (i * Math.PI * 2) / p.leafCount;
              return (
                <mesh key={i} position={[Math.cos(angle) * 0.25, -0.1, Math.sin(angle) * 0.25]} rotation={[0.3, angle, 0.6]} scale={[p.leafScale, p.leafScale, p.leafScale]}>
                  <coneGeometry args={[0.18, 0.7, 4]} />
                  <meshBasicMaterial color={0x34d399} wireframe transparent opacity={0.75} />
                </mesh>
              );
            })}
          </group>
        </group>
      </group>
    </group>
  );
}

export function DiamondStreetLamp({
  position,
  scale = 1.0,
  playerPos,
  color = 0x22d3ee,
}: {
  position: [number, number, number];
  scale?: number;
  playerPos: V3Ref;
  color?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {/* Base collar */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.4, 6]} />
        <meshBasicMaterial color={0x1e1b4b} wireframe transparent opacity={0.65} />
      </mesh>
      {/* Tall slender pole */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 5.0, 6]} />
        <meshBasicMaterial color={0x6366f1} wireframe transparent opacity={0.6} />
      </mesh>
      {/* Top lamp bracket / arm */}
      <mesh position={[0, 5.1, 0]}>
        <boxGeometry args={[0.3, 0.15, 0.3]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
      </mesh>
      {/* Glowing Diamond Octahedron Head */}
      <mesh position={[0, 5.5, 0]} rotation={[0.4, 0.7, 0.2]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 5.5, 0]} rotation={[0.4, 0.7, 0.2]} scale={1.08}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.7} />
      </mesh>
      <pointLight position={[0, 5.5, 0]} color={color} intensity={0.3} distance={8} />
    </group>
  );
}
