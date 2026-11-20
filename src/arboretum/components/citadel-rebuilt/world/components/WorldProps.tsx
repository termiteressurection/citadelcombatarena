import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../../RebuiltWorldShared';
import SpriteText from '../../../three/SpriteText';
import { Chamber, FurnitureItem, NamePlate } from '../../types';
import { DigitalAlarmHaloRing } from '../PortalSystems';

export function ChamberDecor({ thoughtCount, playerPos, chamber }: {
  thoughtCount: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  chamber: Chamber;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const msPerDay = 86400000;
  const daysSinceVisit = chamber.lastVisited
    ? Math.max(0, Math.floor((Date.now() - chamber.lastVisited) / msPerDay))
    : 0;
  const neglectFactor = Math.min(1, daysSinceVisit / 14);
  const floraScale = 1 - neglectFactor * 0.35;
  const decorEmissive = 1 - neglectFactor * 0.65;
  const dustCount = Math.floor(neglectFactor * 36);
  // Place decorations procedurally based on thought count
  const decorations = useMemo(() => {
    const items: { type: 'bamboo' | 'lantern' | 'rock'; x: number; z: number; scale: number; seed: number }[] = [];
    const rng = (i: number) => {
      let s = i * 2654435761;
      s = ((s >>> 16) ^ s) * 0x45d9f3b;
      s = ((s >>> 16) ^ s) * 0x45d9f3b;
      return ((s >>> 16) ^ s) / 0xffffffff + 0.5;
    };
    // Bamboo at 3+ thoughts (sanctuary clearance around altar)
    const bambooCount = Math.min(8, Math.floor(thoughtCount / 3));
    for (let i = 0; i < bambooCount; i++) {
      const x = rng(i * 3) * 50 - 25;
      const z = rng(i * 3 + 1) * 50 - 25;
      if (Math.hypot(x, z) < 14) continue;
      items.push({ type: 'bamboo', x, z, scale: 0.6 + rng(i * 3 + 2) * 0.6, seed: i });
    }
    // Stone lanterns at 8+ thoughts
    const lanternCount = Math.min(4, Math.floor((thoughtCount - 5) / 4));
    for (let i = 0; i < lanternCount; i++) {
      const x = rng(i * 5 + 100) * 40 - 20;
      const z = rng(i * 5 + 101) * 40 - 20;
      if (Math.hypot(x, z) < 14) continue;
      items.push({ type: 'lantern', x, z, scale: 0.8 + rng(i * 5 + 102) * 0.4, seed: i + 100 });
    }
    // Rocks at 5+ thoughts
    const rockCount = Math.min(6, Math.floor(thoughtCount / 5));
    for (let i = 0; i < rockCount; i++) {
      const x = rng(i * 7 + 200) * 46 - 23;
      const z = rng(i * 7 + 201) * 46 - 23;
      if (Math.hypot(x, z) < 14) continue;
      items.push({ type: 'rock', x, z, scale: 0.5 + rng(i * 7 + 202) * 0.8, seed: i + 200 });
    }
    return items;
  }, [thoughtCount]);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    groupRef.current.children.forEach(child => {
      const wx = child.userData.wx as number;
      const wz = child.userData.wz as number;
      if (wx !== undefined) {
        child.position.y = (child.userData.baseY as number || 0) - sphereDrop(wx - pp.x, wz - pp.z);
      }
    });
  });

  if (decorations.length === 0) return null;

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.3 * (1 - neglectFactor * 0.45)} />
      {decorations.map((d, i) => {
        if (d.type === 'bamboo') {
          const segments = 3 + Math.floor(d.scale * 3);
          const h = d.scale * 4;
          return (
            <group key={`decor-${i}`} position={[d.x, 0, d.z]} userData={{ wx: d.x, wz: d.z, baseY: 0 }}>
              {Array.from({ length: segments }, (_, j) => (
                <mesh key={j} position={[0, j * (h / segments) + h / segments / 2, 0]} scale={[floraScale, floraScale, floraScale]}>
                  <cylinderGeometry args={[0.06 * d.scale, 0.08 * d.scale, (h / segments) * floraScale, 6]} />
                  <meshBasicMaterial color={0x34d399} wireframe transparent opacity={0.65} />
                </mesh>
              ))}
              {/* Leaves at top */}
              <mesh position={[0.15, h * floraScale, 0]} rotation={[0, 0, 0.8]} scale={[floraScale, floraScale, floraScale]}>
                <coneGeometry args={[0.15 * d.scale * floraScale, 0.5 * d.scale * floraScale, 4]} />
                <meshBasicMaterial color={0x22c55e} wireframe transparent opacity={0.55} />
              </mesh>
            </group>
          );
        }
        if (d.type === 'lantern') {
          return (
            <group key={`decor-${i}`} position={[d.x, 0, d.z]} userData={{ wx: d.x, wz: d.z, baseY: 0 }}>
              {/* Base */}
              <mesh position={[0, 0.3 * d.scale, 0]}>
                <boxGeometry args={[0.4 * d.scale, 0.6 * d.scale, 0.4 * d.scale]} />
                <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.5} />
              </mesh>
              {/* Pillar */}
              <mesh position={[0, 1.0 * d.scale, 0]}>
                <cylinderGeometry args={[0.08 * d.scale, 0.12 * d.scale, 1.0 * d.scale, 6]} />
                <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.45} />
              </mesh>
              {/* Lamp housing */}
              <mesh position={[0, 1.6 * d.scale, 0]}>
                <boxGeometry args={[0.35 * d.scale, 0.3 * d.scale, 0.35 * d.scale]} />
                <meshBasicMaterial color={0xfbbf24} transparent opacity={0.7} />
              </mesh>
              {/* Roof */}
              <mesh position={[0, 1.85 * d.scale, 0]}>
                <coneGeometry args={[0.3 * d.scale, 0.2 * d.scale, 4]} />
                <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.55} />
              </mesh>
              <pointLight position={[0, 1.6 * d.scale, 0]} color={0xfbbf24} intensity={0.3 * decorEmissive} distance={5} />
            </group>
          );
        }
        // Rock
        return (
          <group key={`decor-${i}`} position={[d.x, 0, d.z]} userData={{ wx: d.x, wz: d.z, baseY: 0 }}>
            <mesh position={[0, 0.2 * d.scale, 0]} rotation={[d.seed * 0.3, d.seed * 0.7, d.seed * 0.2]}>
              <dodecahedronGeometry args={[0.4 * d.scale, 0]} />
              <meshBasicMaterial color={0x6366f1} wireframe transparent opacity={0.5} />
            </mesh>
            {d.scale > 1 && (
              <mesh position={[0.3 * d.scale, 0.1 * d.scale, 0.2 * d.scale]} rotation={[d.seed, d.seed + 1, 0]}>
                <dodecahedronGeometry args={[0.2 * d.scale, 0]} />
                <meshBasicMaterial color={0x8b5cf6} wireframe transparent opacity={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
      {dustCount > 0 && (
        <group>
          {Array.from({ length: dustCount }, (_, i) => {
            const angle = (i / dustCount) * Math.PI * 2;
            const radius = 6 + (i % 7) * 2.6;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = 0.35 + (i % 5) * 0.25;
            return (
              <mesh key={`dust-${i}`} position={[x, y, z]}>
                <boxGeometry args={[0.04, 0.04, 0.04]} />
                <meshBasicMaterial color={0xb6a78f} transparent opacity={0.18 + neglectFactor * 0.22} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

export function ChamberEvolution({ thoughtCount, playerPos }: {
  thoughtCount: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleCount = thoughtCount >= 30 ? 60 : thoughtCount >= 15 ? 40 : thoughtCount >= 5 ? 20 : 0;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    x: (Math.random() - 0.5) * 50,
    z: (Math.random() - 0.5) * 50,
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.4,
    y: thoughtCount >= 15 ? 0.5 + Math.random() * 2 : 0.1 + Math.random() * 0.3,
  })), [thoughtCount]);

  // Determine environment stage color
  const color = thoughtCount >= 30 ? 0x34d399 : thoughtCount >= 15 ? 0x22d3ee : 0x4ade80;

  useFrame(({ clock }) => {
    if (!meshRef.current || particleCount === 0) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    for (let i = 0; i < particleCount; i++) {
      const s = seeds[i];
      const y = s.y + Math.sin(t * s.speed + s.phase) * 0.3;
      dummy.position.set(s.x, y - sphereDrop(s.x - pp.x, s.z - pp.z), s.z);
      dummy.scale.setScalar(thoughtCount >= 15 ? 0.12 : 0.06);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (particleCount === 0) return null;

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
        <tetrahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </instancedMesh>
      {/* Canopy for 30+ thoughts */}
      {thoughtCount >= 30 && (
        <mesh position={[0, 16, 0]}>
          <tetrahedronGeometry args={[35, 0]} />
          <meshBasicMaterial color={0x065f46} wireframe transparent opacity={0.12} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

export function AchievementMonuments({ achievements, playerPos }: {
  achievements: string[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const MONUMENT_RING_R = 28;

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    groupRef.current.children.forEach((child, i) => {
      const angle = (i / Math.max(achievements.length, 1)) * Math.PI * 2;
      const x = Math.cos(angle) * MONUMENT_RING_R;
      const z = Math.sin(angle) * MONUMENT_RING_R;
      child.position.set(x, 0.5 - sphereDrop(x - pp.x, z - pp.z), z);
    });
  });

  if (achievements.length === 0) return null;

  const COLORS: Record<string, number> = {
    thoughts: 0xa855f7, chambers: 0x22d3ee, streak: 0xfbbf24, first: 0xec4899,
  };
  const getColor = (id: string) => {
    if (id.startsWith('thoughts')) return COLORS.thoughts;
    if (id.startsWith('chambers')) return COLORS.chambers;
    if (id.startsWith('streak')) return COLORS.streak;
    return COLORS.first;
  };

  return (
    <group ref={groupRef}>
      {achievements.map((achId, i) => (
        <group key={achId}>
          {/* Pedestal */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.3, 6]} />
            <meshBasicMaterial color={0x1e1b4b} wireframe transparent opacity={0.5} />
          </mesh>
          {/* Trophy */}
          <mesh position={[0, 0.6, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshBasicMaterial color={getColor(achId)} wireframe transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export const ISLAND_DEFS = [
  { pos: [30, 22, -30] as [number, number, number], size: 5, color: 0x7c3aed },
  { pos: [-25, 28, 20] as [number, number, number], size: 4, color: 0xa855f7 },
  { pos: [15, 35, 35] as [number, number, number], size: 3.5, color: 0xec4899 },
  { pos: [-35, 25, -15] as [number, number, number], size: 4.5, color: 0x34d399 },
];

export function FloatingIslands({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      child.position.y = ISLAND_DEFS[i % ISLAND_DEFS.length].pos[1] + Math.sin(t * 0.2 + i * 1.5) * 1.5;
    });
  });
  return (
    <group ref={ref}>
      {ISLAND_DEFS.map((island, i) => {
        const drop = sphereDrop(island.pos[0] - playerPos.current.x, island.pos[2] - playerPos.current.z);
        return (
          <group key={`island-${i}`} position={[island.pos[0], island.pos[1] - drop * 0.3, island.pos[2]]}>
            {/* Island body */}
            <mesh>
              <cylinderGeometry args={[island.size, island.size * 1.3, 1.5, 8]} />
              <meshBasicMaterial color={island.color} transparent opacity={0.12} />
            </mesh>
            {/* Top surface glow */}
            <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[island.size * 0.9, 6]} />
              <meshBasicMaterial color={island.color} transparent opacity={0.06} />
            </mesh>
            {/* Crystal on top */}
            <mesh position={[0, 2, 0]}>
              <octahedronGeometry args={[0.6, 0]} />
              <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.25} />
            </mesh>
            {/* Light bridge pillar */}
            {i < ISLAND_DEFS.length - 1 && (
              <mesh position={[
                (ISLAND_DEFS[i + 1].pos[0] - island.pos[0]) * 0.5,
                (ISLAND_DEFS[i + 1].pos[1] - island.pos[1]) * 0.5,
                (ISLAND_DEFS[i + 1].pos[2] - island.pos[2]) * 0.5
              ]}>
                <cylinderGeometry args={[0.03, 0.03, Math.hypot(
                  ISLAND_DEFS[i + 1].pos[0] - island.pos[0],
                  ISLAND_DEFS[i + 1].pos[1] - island.pos[1],
                  ISLAND_DEFS[i + 1].pos[2] - island.pos[2]
                ), 2]} />
                <meshBasicMaterial color={0xc084fc} transparent opacity={0.08} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export const POOL_POSITIONS: [number, number, number][] = [
  [18, -0.5, 12], [-15, -0.5, 20], [25, -0.5, -22], [-20, -0.5, -10], [8, -0.5, -28],
];

export function TidePools({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // Slow tide cycle — 120s period
    const tide = Math.sin(t * 0.052) * 0.5 + 0.5;
    ref.current.children.forEach((pool, i) => {
      const pp = playerPos.current;
      const px = POOL_POSITIONS[i][0], pz = POOL_POSITIONS[i][2];
      const drop = sphereDrop(px - pp.x, pz - pp.z);
      pool.position.y = -0.3 + tide * 0.6 - drop;
      pool.scale.setScalar(0.7 + tide * 0.4);
      const mat = (pool.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + tide * 0.08;
    });
  });
  return (
    <group ref={ref}>
      {POOL_POSITIONS.map((pos, i) => (
        <group key={`pool-${i}`} position={pos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.5 + i * 0.5, 6]} />
            <meshBasicMaterial color={0x22d3ee} transparent opacity={0.1} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[2 + i * 0.5, 2.5 + i * 0.5, 6]} />
            <meshBasicMaterial color={0x06b6d4} transparent opacity={0.08} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WorldRuins({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.children.forEach(child => {
      const wx = child.userData.wx as number, wz = child.userData.wz as number;
      const drop = sphereDrop(wx - pp.x, wz - pp.z);
      child.position.y = (child.userData.baseY as number) - drop;
    });
  });
  return (
    <group ref={ref}>
      {/* Stonehenge circle */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.cos(angle) * 32 + 5;
        const z = Math.sin(angle) * 32;
        return (
          <group key={`henge-${i}`} position={[x, 0, z]} userData={{ wx: x, wz: z, baseY: 0 }}>
            {/* Vertical pillar */}
            <mesh position={[0, 2.5, 0]}>
              <boxGeometry args={[0.8, 5, 0.6]} />
              <meshStandardMaterial color={0x4c2882} transparent opacity={0.4} />
            </mesh>
            {/* Lintel connecting to next */}
            {i % 2 === 0 && (
              <mesh position={[Math.cos((i + 1) / 8 * Math.PI * 2) * 1.5, 5, Math.sin((i + 1) / 8 * Math.PI * 2) * 1.5]} rotation={[0, angle + Math.PI / 8, 0]}>
                <boxGeometry args={[4, 0.5, 0.5]} />
                <meshStandardMaterial color={0x5b34a0} transparent opacity={0.35} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* Leaning obelisk */}
      <group position={[-28, 0, 28]} rotation={[0.12, 0, 0.08]} userData={{ wx: -28, wz: 28, baseY: 0 }}>
        <mesh position={[0, 4, 0]}>
          <boxGeometry args={[0.6, 8, 0.6]} />
          <meshStandardMaterial color={0x6d3fc0} transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 8.2, 0]}>
          <coneGeometry args={[0.5, 1.2, 4]} />
          <meshStandardMaterial color={0xfbbf24} transparent opacity={0.5} />
        </mesh>
      </group>
      {/* Broken arch */}
      <group position={[30, 0, 25]} userData={{ wx: 30, wz: 25, baseY: 0 }}>
        <mesh position={[-2, 2, 0]}>
          <boxGeometry args={[0.6, 4, 0.5]} />
          <meshStandardMaterial color={0x4c2882} transparent opacity={0.35} />
        </mesh>
        <mesh position={[2, 1.5, 0]}>
          <boxGeometry args={[0.6, 3, 0.5]} />
          <meshStandardMaterial color={0x4c2882} transparent opacity={0.35} />
        </mesh>
        <mesh position={[0, 4.2, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[5, 0.4, 0.4]} />
          <meshStandardMaterial color={0x5b34a0} transparent opacity={0.3} />
        </mesh>
      </group>
      {/* Pyramid ruin */}
      <group position={[-30, 0, -25]} userData={{ wx: -30, wz: -25, baseY: 0 }}>
        <mesh position={[0, 2, 0]}>
          <coneGeometry args={[4, 4, 4]} />
          <meshBasicMaterial color={0x6d3fc0} wireframe transparent opacity={0.25} />
        </mesh>
        <mesh position={[0, 2, 0]}>
          <coneGeometry args={[3.8, 3.8, 4]} />
          <meshBasicMaterial color={0x5b34a0} transparent opacity={0.15} />
        </mesh>
      </group>
      {/* Standing stones trio */}
      <group position={[20, 0, 30]} userData={{ wx: 20, wz: 30, baseY: 0 }}>
        {[[-1, 0], [1, 0], [0, 1.2]].map(([dx, dz], j) => (
          <mesh key={`stone-${j}`} position={[dx * 2, 1.5 + j * 0.3, dz * 2]}>
            <boxGeometry args={[0.5, 3 + j * 0.6, 0.4]} />
            <meshStandardMaterial color={0x5b34a0} emissive={0x2d1660} emissiveIntensity={0.2} transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export const FURNITURE_GEOS: Record<string, { geo: string; args: number[]; hy: number }> = {
  lantern: { geo: 'octahedron', args: [0.4], hy: 1.5 },
  rug: { geo: 'circle', args: [2, 8], hy: 0.02 },
  sculpture: { geo: 'dodecahedron', args: [0.8], hy: 1.2 },
  crystal: { geo: 'octahedron', args: [0.6], hy: 1 },
  pillar: { geo: 'cylinder', args: [0.3, 0.3, 4, 6], hy: 2 },
  altar: { geo: 'box', args: [1.5, 0.8, 1], hy: 0.4 },
  fountain: { geo: 'torus', args: [1, 0.15, 3, 4], hy: 0.3 },
  banner: { geo: 'plane', args: [0.8, 3], hy: 2.5 },
};

export function FurnitureRenderer({ items, playerPos }: { items: FurnitureItem[]; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const t = clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      if (!items[i]) return;
      const item = items[i];
      const drop = sphereDrop(item.x - pp.x, item.z - pp.z);
      const def = FURNITURE_GEOS[item.kind];
      child.position.set(item.x, (def?.hy || 1) - drop, item.z);
      if (item.kind === 'lantern') child.rotation.y = t * 0.5;
      if (item.kind === 'fountain') child.rotation.x = Math.PI / 2;
    });
  });
  return (
    <group ref={ref}>
      {items.map((item, i) => {
        const def = FURNITURE_GEOS[item.kind] || FURNITURE_GEOS.crystal;
        const color = item.color || 0xa855f7;
        return (
          <mesh key={item.id} position={[item.x, def.hy, item.z]}>
            {def.geo === 'octahedron' && <octahedronGeometry args={[def.args[0], 0]} />}
            {def.geo === 'circle' && <circleGeometry args={[def.args[0], def.args[1]]} />}
            {def.geo === 'dodecahedron' && <dodecahedronGeometry args={[def.args[0], 0]} />}
            {def.geo === 'cylinder' && <cylinderGeometry args={[def.args[0], def.args[1], def.args[2], def.args[3]]} />}
            {def.geo === 'box' && <boxGeometry args={[def.args[0], def.args[1], def.args[2]]} />}
            {def.geo === 'torus' && <torusGeometry args={[def.args[0], def.args[1], def.args[2], def.args[3]]} />}
            {def.geo === 'plane' && <planeGeometry args={[def.args[0], def.args[1]]} />}
            <meshBasicMaterial color={color} wireframe={item.kind !== 'rug'} transparent opacity={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}

export function NamePlateRenderer({ plates, playerPos }: { plates: NamePlate[]; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.children.forEach((child, i) => {
      if (!plates[i]) return;
      const p = plates[i];
      const drop = sphereDrop(p.x - pp.x, p.z - pp.z);
      child.position.set(p.x, 3.2 - drop, p.z);
    });
  });
  return (
    <group ref={ref}>
      {plates.map((plate) => (
        <group key={plate.id} position={[plate.x, 3.2, plate.z]}>
          <DigitalAlarmHaloRing text={plate.text} radius={1.6} colorScheme="cyan" />
        </group>
      ))}
    </group>
  );
}

