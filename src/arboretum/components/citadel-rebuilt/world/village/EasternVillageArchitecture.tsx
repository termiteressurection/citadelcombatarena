import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../../three/SpriteText';
import { applyGlobeCurvature } from '../../RebuiltWorldShared';

interface WithPlayer {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

// ─── TRANSLUCENT ASCII HEDGE & BUSH SYSTEM ───────────────────────────────────

export function ASCIIBush({
  position,
  scale = 1.0,
  color = 0x34d399,
  showGlyph = false,
  playerPos,
}: {
  position: [number, number, number];
  scale?: number;
  color?: number;
  showGlyph?: boolean;
} & WithPlayer) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      {/* 3D ASCII shrub: Semi-transparent intersecting geometric clusters */}
      <mesh position={[0, 0.45 * scale, 0]}>
        <dodecahedronGeometry args={[0.55 * scale, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.45 * scale, 0]}>
        <icosahedronGeometry args={[0.42 * scale, 0]} />
        <meshBasicMaterial color={0x064e3b} transparent opacity={0.5} />
      </mesh>
      {/* Translucent ASCII Glyph Petals (optional) */}
      {showGlyph && (
        <SpriteText
          position={[0, 0.6 * scale, 0]}
          fontSize={0.55 * scale}
          color={`#${color.toString(16).padStart(6, '0')}`}
          outlineWidth={0.02}
          outlineColor="#022c22"
        >
          {"*#%*"}
        </SpriteText>
      )}
    </group>
  );
}

export function ASCIIHedgeRow({
  start,
  end,
  density = 1.0,
  playerPos,
}: {
  start: [number, number]; // [x, z]
  end: [number, number];
  density?: number;
} & WithPlayer) {
  const bushes = useMemo(() => {
    const list: [number, number][] = [];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const step = 2.4 / Math.max(0.2, density);
    const count = Math.max(2, Math.floor(len / step));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      list.push([start[0] + dx * t, start[1] + dz * t]);
    }
    return list;
  }, [start, end, density]);

  return (
    <group>
      {bushes.map(([x, z], idx) => (
        <ASCIIBush
          key={`hedge-${idx}`}
          position={[x, 0, z]}
          scale={0.95 + (idx % 3) * 0.12}
          color={idx % 2 === 0 ? 0x10b981 : 0x34d399}
          playerPos={playerPos}
        />
      ))}
    </group>
  );
}

// ─── JAPANESE STONE LANTERN (TŌRŌ) ───────────────────────────────────────────

export function StoneLantern({
  position,
  color = 0xfbbf24,
  playerPos,
}: {
  position: [number, number, number];
  color?: number;
} & WithPlayer) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={ref} position={position}>
      {/* Base (kiso) */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.7]} />
        <meshBasicMaterial color={0x1e1b4b} wireframe transparent opacity={0.65} />
      </mesh>
      {/* Post (sao) */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.16, 0.20, 0.8, 6]} />
        <meshBasicMaterial color={0x1e1b4b} wireframe transparent opacity={0.6} />
      </mesh>
      {/* Middle platform (chūdai) */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.55, 0.35, 0.2, 6]} />
        <meshBasicMaterial color={0x1e1b4b} wireframe transparent opacity={0.7} />
      </mesh>
      {/* Light box (hibukuro) */}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* Roof (kasa) with upturned eaves */}
      <mesh position={[0, 1.8, 0]}>
        <coneGeometry args={[0.75, 0.35, 6]} />
        <meshBasicMaterial color={0xa855f7} wireframe transparent opacity={0.8} />
      </mesh>
      {/* Jewel top (hōju) */}
      <mesh position={[0, 2.05, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

// ─── FOUR DISTINCT FUNCTIONAL SERVICE COTTAGES ───────────────────────────────

interface CottageProps extends WithPlayer {
  near: boolean;
  label: string;
}

/**
 * 1. Terminal Cottage at [0, 0, -68] (Solomon's Temple Rear "West Building" behind the Temple & Rear Colonnade):
 * Multi-tiered Japanese pagoda library with amber lanterns and carved brackets.
 */
export function TerminalCottage({ playerPos, near, label }: CottageProps) {
  const ref = useRef<THREE.Group>(null);
  const position: [number, number, number] = [0, 0, -68];
  const color = 0xf59e0b;
  const roofColor = 0xfde68a;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
    if (near) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.015);
    } else {
      ref.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Raised stone foundation */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[8.4, 0.8, 8.4]} />
        <meshBasicMaterial color={0x090416} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[8.5, 0.82, 8.5]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
      </mesh>

      {/* Main Ground Floor Body: Solid dark wood walls */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[7.2, 5.4, 7.2]} />
        <meshBasicMaterial color={0x0e0624} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[7.25, 5.45, 7.25]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Shoji Grid Paper Windows — Warm Amber Glow */}
      <mesh position={[0, 3.2, 3.65]}>
        <planeGeometry args={[4.2, 2.2]} />
        <meshBasicMaterial color={roofColor} transparent opacity={near ? 0.95 : 0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-3.65, 3.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4.2, 2.2]} />
        <meshBasicMaterial color={roofColor} transparent opacity={near ? 0.95 : 0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Ground Tier Sweeping Eave Overhang */}
      <mesh position={[0, 6.3, 0]}>
        <boxGeometry args={[10.2, 0.45, 10.2]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 6.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[4.2, 5.4, 0.8, 4]} />
        <meshBasicMaterial color={0x78350f} wireframe transparent opacity={0.85} />
      </mesh>

      {/* Second Story Upper Tier Body */}
      <mesh position={[0, 9.2, 0]}>
        <boxGeometry args={[5.2, 4.4, 5.2]} />
        <meshBasicMaterial color={0x0e0624} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 9.2, 0]}>
        <boxGeometry args={[5.25, 4.45, 5.25]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Upper Tier Shoji Lanterns */}
      <mesh position={[0, 9.2, 2.65]}>
        <planeGeometry args={[2.8, 1.8]} />
        <meshBasicMaterial color={roofColor} transparent opacity={near ? 0.95 : 0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Top Pagoda Roof with Sweeping Upturned Eaves */}
      <mesh position={[0, 11.6, 0]}>
        <boxGeometry args={[7.8, 0.4, 7.8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 12.8, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.6, 2.2, 4]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.9} />
      </mesh>
      {/* Finial spire / jewel */}
      <mesh position={[0, 14.2, 0]}>
        <cylinderGeometry args={[0.08, 0.22, 1.6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 15.1, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.95} />
      </mesh>

      {/* Hanging Amber Paper Lanterns at Veranda */}
      <group position={[2.5, 5.2, 4.5]}>
        <mesh><cylinderGeometry args={[0.22, 0.22, 0.55, 6]} /><meshBasicMaterial color={0xfbbf24} transparent opacity={0.9} /></mesh>
      </group>
      <group position={[-2.5, 5.2, 4.5]}>
        <mesh><cylinderGeometry args={[0.22, 0.22, 0.55, 6]} /><meshBasicMaterial color={0xfbbf24} transparent opacity={0.9} /></mesh>
      </group>

      {/* Signboard */}
      <SpriteText
        position={[0, 16.2, 0]}
        fontSize={near ? 0.72 : 0.45}
        color={near ? '#ffffff' : '#fde68a'}
        outlineWidth={0.04}
        outlineColor="#0b0416"
      >
        {label.toUpperCase()}
      </SpriteText>
    </group>
  );
}

/**
 * 2. Courier Post Office Cottage at [36, 0, -34] (Solomon's Temple Right Side Chambers behind East Pillar Row):
 * Wide hip-and-gable courier house, cyan paper lanterns, dispatch scrolls.
 */
export function PostOfficeCottage({ playerPos, near, label }: CottageProps) {
  const ref = useRef<THREE.Group>(null);
  const position: [number, number, number] = [36, 0, -34];
  const color = 0x22d3ee;
  const roofColor = 0x0891b2;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
    if (near) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.015);
    } else {
      ref.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Foundation plinth */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[7.8, 0.7, 7.2]} />
        <meshBasicMaterial color={0x081524} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[7.85, 0.72, 7.25]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.45} />
      </mesh>

      {/* Wide solid post house body */}
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[6.6, 4.4, 6.0]} />
        <meshBasicMaterial color={0x051b2e} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[6.65, 4.45, 6.05]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Cyan Shoji Sliding Screen Windows */}
      <mesh position={[0, 2.5, 3.05]}>
        <planeGeometry args={[3.8, 2.4]} />
        <meshBasicMaterial color={0xa5f3fc} transparent opacity={near ? 0.95 : 0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Hip-and-Gable Japanese Curved Roof */}
      <mesh position={[0, 5.2, 0]}>
        <boxGeometry args={[8.8, 0.4, 8.0]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 6.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[1.2, 4.4, 2.2, 4]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.9} />
      </mesh>
      {/* Ridge Pole with Cyan ornamental crest tiles */}
      <mesh position={[0, 7.6, 0]}>
        <boxGeometry args={[6.2, 0.35, 0.4]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>

      {/* Veranda Courier Lantern */}
      <group position={[2.4, 4.0, 3.8]}>
        <mesh><octahedronGeometry args={[0.26, 0]} /><meshBasicMaterial color={0x22d3ee} transparent opacity={0.9} /></mesh>
      </group>

      {/* Signboard */}
      <SpriteText
        position={[0, 9.2, 0]}
        fontSize={near ? 0.72 : 0.45}
        color={near ? '#ffffff' : '#a5f3fc'}
        outlineWidth={0.04}
        outlineColor="#04121e"
      >
        {label.toUpperCase()}
      </SpriteText>
    </group>
  );
}

/**
 * 3. Mind Map Pagoda Pavilion at [0, 0, -34] (Solomon's Temple Central Sanctuary & Oracle):
 * Majestic octagonal pagoda pavilion, tiered roofs, star crest spire, indigo glow.
 */
export function MindMapPavilion({ playerPos, near, label }: CottageProps) {
  const ref = useRef<THREE.Group>(null);
  const position: [number, number, number] = [0, 0, -34];
  const color = 0xa855f7;
  const roofColor = 0x7c3aed;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
    if (near) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.015);
    } else {
      ref.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Foundation */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[5.2, 5.5, 1.0, 8]} />
        <meshBasicMaterial color={0x110729} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[5.25, 5.55, 1.02, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Tier 1 Body: Octagonal sanctuary */}
      <mesh position={[0, 3.8, 0]}>
        <cylinderGeometry args={[4.2, 4.4, 5.6, 8]} />
        <meshBasicMaterial color={0x160a36} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 3.8, 0]}>
        <cylinderGeometry args={[4.25, 4.45, 5.65, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} />
      </mesh>

      {/* Shoji Windows */}
      <mesh position={[0, 3.5, 4.25]}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshBasicMaterial color={0xd8b4fe} transparent opacity={near ? 0.95 : 0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Eave Tier 1 */}
      <mesh position={[0, 6.8, 0]}>
        <cylinderGeometry args={[5.6, 4.2, 0.6, 8]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.85} />
      </mesh>

      {/* Tier 2 Body */}
      <mesh position={[0, 9.8, 0]}>
        <cylinderGeometry args={[3.2, 3.4, 5.2, 8]} />
        <meshBasicMaterial color={0x160a36} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 9.8, 0]}>
        <cylinderGeometry args={[3.25, 3.45, 5.25, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} />
      </mesh>

      {/* Eave Tier 2 */}
      <mesh position={[0, 12.6, 0]}>
        <cylinderGeometry args={[4.5, 3.2, 0.6, 8]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.85} />
      </mesh>

      {/* Tier 3 Zenith Spire & Star Gem */}
      <mesh position={[0, 14.8, 0]}>
        <coneGeometry args={[3.0, 3.8, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 17.2, 0]}>
        <cylinderGeometry args={[0.08, 0.25, 2.2, 6]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 18.4, 0]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.95} />
      </mesh>

      {/* Signboard */}
      <SpriteText
        position={[0, 19.8, 0]}
        fontSize={near ? 0.72 : 0.45}
        color={near ? '#ffffff' : '#e9d5ff'}
        outlineWidth={0.04}
        outlineColor="#0b0318"
      >
        {label.toUpperCase()}
      </SpriteText>
    </group>
  );
}

/**
 * 4. Synaptic Vault Tea House at [-36, 0, -34] (Solomon's Temple Left Side Chambers behind West Pillar Row):
 * Zen tea house and sensory meditation shrine, circular ensō window, magenta lantern.
 */
export function SynapticVaultTeaHouse({ playerPos, near, label }: CottageProps) {
  const ref = useRef<THREE.Group>(null);
  const position: [number, number, number] = [-36, 0, -34];
  const color = 0xec4899;
  const roofColor = 0xbe185d;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
    if (near) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.015);
    } else {
      ref.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Foundation */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[7.6, 0.7, 7.6]} />
        <meshBasicMaterial color={0x220516} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[7.65, 0.72, 7.65]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.45} />
      </mesh>

      {/* Main Tea House Sanctuary Body */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[6.4, 5.0, 6.4]} />
        <meshBasicMaterial color={0x2b061d} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[6.45, 5.05, 6.45]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} />
      </mesh>

      {/* Ensō Circular Moon Window Glowing Magenta */}
      <mesh position={[0, 3.2, 3.25]}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial color={0xfbcfe8} transparent opacity={near ? 0.95 : 0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.2, 3.27]}>
        <ringGeometry args={[1.4, 1.55, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Gabled Japanese Roof with Curved Eaves */}
      <mesh position={[0, 5.9, 0]}>
        <boxGeometry args={[8.6, 0.4, 8.6]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 7.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[5.2, 2.4, 4]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.9} />
      </mesh>
      {/* Stone water basin (Tsukubai) on veranda */}
      <mesh position={[2.6, 0.4, 4.2]}>
        <cylinderGeometry args={[0.45, 0.4, 0.45, 12]} />
        <meshBasicMaterial color={0x500724} transparent opacity={0.9} />
      </mesh>
      <mesh position={[2.6, 0.65, 4.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 12]} />
        <meshBasicMaterial color={0xf472b6} transparent opacity={0.8} />
      </mesh>

      {/* Veranda Magenta Paper Lantern */}
      <group position={[-2.4, 4.5, 4.0]}>
        <mesh><octahedronGeometry args={[0.26, 0]} /><meshBasicMaterial color={0xec4899} transparent opacity={0.9} /></mesh>
      </group>

      {/* Signboard */}
      <SpriteText
        position={[0, 10.4, 0]}
        fontSize={near ? 0.72 : 0.45}
        color={near ? '#ffffff' : '#fbcfe8'}
        outlineWidth={0.04}
        outlineColor="#1a0210"
      >
        {label.toUpperCase()}
      </SpriteText>
    </group>
  );
}

// ─── ADDITIONAL VARIED VILLAGE HOUSES ────────────────────────────────────────

function VillageCottageMesh({
  position,
  color,
  roofColor,
  playerPos,
}: {
  position: [number, number, number];
  color: number;
  roofColor: number;
} & WithPlayer) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[5.2, 4.4, 5.2]} />
        <meshBasicMaterial color={0x0b051b} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[5.25, 4.45, 5.25]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 4.6, 0]}>
        <boxGeometry args={[6.8, 0.35, 6.8]} />
        <meshBasicMaterial color={roofColor} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 5.8, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.0, 2.1, 4]} />
        <meshBasicMaterial color={roofColor} wireframe transparent opacity={0.8} />
      </mesh>
      {/* Front glowing shoji window */}
      <mesh position={[0, 2.2, 2.65]}>
        <planeGeometry args={[2.2, 1.8]} />
        <meshBasicMaterial color={0xfde68a} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── VILLAGE ARCHITECTURE ENSEMBLE EXPORT ────────────────────────────────────

export interface EasternVillageProps extends WithPlayer {
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
  dormant?: boolean;
  /** Minimal world look: keep only the four interactable buildings, drop all ornament. */
  minimal?: boolean;
  hedgeDensity?: number;
}

export function EasternVillageArchitecture({
  nearNoticeBoard = false,
  nearMapTable = false,
  nearLibrary = false,
  nearMoodStone = false,
  nearBottlePost = false,
  dormant = false,
  minimal = false,
  hedgeDensity = 1.0,
  playerPos,
}: EasternVillageProps) {
  return (
    <group>
      {/* The 4 Functional Service Cottages replacing TownBuilding */}
      {!dormant && (
        <>
          <TerminalCottage
            playerPos={playerPos}
            near={nearLibrary || nearNoticeBoard}
            label="Terminal"
          />
          <PostOfficeCottage
            playerPos={playerPos}
            near={nearBottlePost}
            label="Post"
          />
        </>
      )}

      <MindMapPavilion
        playerPos={playerPos}
        near={nearMapTable}
        label="Mind Map"
      />

      <SynapticVaultTeaHouse
        playerPos={playerPos}
        near={nearMoodStone}
        label="Synaptic Vault"
      />

      {/* Side Chamber Wings flanking the Synaptic Vault (West Chambers) and Post Office (East Chambers) */}
      {!dormant && !minimal && (
        <>
          <VillageCottageMesh position={[-36, 0, -22]} color={0x818cf8} roofColor={0x4f46e5} playerPos={playerPos} />
          <VillageCottageMesh position={[-36, 0, -46]} color={0xf43f5e} roofColor={0xbe123c} playerPos={playerPos} />
          <VillageCottageMesh position={[36, 0, -22]} color={0x2dd4bf} roofColor={0x0f766e} playerPos={playerPos} />
          <VillageCottageMesh position={[36, 0, -46]} color={0xfbbf24} roofColor={0xb45309} playerPos={playerPos} />
        </>
      )}

      {!minimal && (<>
      {/* Stone Lanterns (Tōrō) framing the Altar Forecourt & Temple Porch approach */}
      <StoneLantern position={[-8, 0, -14]} color={0xfbbf24} playerPos={playerPos} />
      <StoneLantern position={[8, 0, -14]} color={0xfbbf24} playerPos={playerPos} />
      <StoneLantern position={[-8, 0, 14]} color={0xfbbf24} playerPos={playerPos} />
      <StoneLantern position={[8, 0, 14]} color={0xfbbf24} playerPos={playerPos} />
      <StoneLantern position={[-18, 0, -8]} color={0x22d3ee} playerPos={playerPos} />
      <StoneLantern position={[18, 0, -8]} color={0x22d3ee} playerPos={playerPos} />
      <StoneLantern position={[-18, 0, 8]} color={0xec4899} playerPos={playerPos} />
      <StoneLantern position={[18, 0, 8]} color={0xec4899} playerPos={playerPos} />

      {/* Translucent ASCII Hedge Rows enclosing the Inner Court perimeter */}
      <ASCIIHedgeRow start={[-28, 16]} end={[-10, 16]} density={hedgeDensity} playerPos={playerPos} />
      <ASCIIHedgeRow start={[10, 16]} end={[28, 16]} density={hedgeDensity} playerPos={playerPos} />
      <ASCIIHedgeRow start={[-28, 16]} end={[-28, 6]} density={hedgeDensity} playerPos={playerPos} />
      <ASCIIHedgeRow start={[28, 16]} end={[28, 6]} density={hedgeDensity} playerPos={playerPos} />
      <ASCIIHedgeRow start={[-28, -6]} end={[-28, -14]} density={hedgeDensity} playerPos={playerPos} />
      <ASCIIHedgeRow start={[28, -6]} end={[28, -14]} density={hedgeDensity} playerPos={playerPos} />

      {/* Translucent ASCII Bush Clusters around plots and garden nooks */}
      <ASCIIBush position={[-20, 0, -22]} scale={1.2} color={0x34d399} playerPos={playerPos} />
      <ASCIIBush position={[20, 0, -22]} scale={1.1} color={0x10b981} playerPos={playerPos} />
      <ASCIIBush position={[-20, 0, 22]} scale={1.2} color={0x34d399} playerPos={playerPos} />
      <ASCIIBush position={[20, 0, 22]} scale={1.1} color={0x10b981} playerPos={playerPos} />
      </>)}
    </group>
  );
}
