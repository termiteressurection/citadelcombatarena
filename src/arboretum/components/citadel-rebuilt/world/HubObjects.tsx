/**
 * HubObjects — The Town Square
 *
 * A cozy village with masonic geometry encoded into the layout.
 * Akira × Roman Vaporwave × Stardew Valley × Japanese shopfront.
 *
 * Quality control rules (from reference images):
 * 1. Every building has a roof — pyramid or flat eave overhang
 * 2. Buildings face the road — glowing window on front face
 * 3. Height variation — no two adjacent buildings the same height
 * 4. Street lamps on every road — thin post + sphere top
 * 5. Japanese eave detail — flat box extending past walls at roof level
 * 6. Chimneys — thin cylinder on top of each building
 * 7. Central altar = town well — the place everyone walks past
 *
 * Masonic layout (subverted):
 * - Altar at center (cubic stone)
 * - Sigma Pyramid at north (all-seeing eye / worshipful master)
 * - Twin columns flanking north road (Jachin & Boaz)
 * - Torii gates at cardinal road entrances (the veil / threshold)
 * - Four buildings at quadrants (four cardinal officers)
 * - Roads form a compass rose from the altar
 *
 * N64 budget: 10-17 polys per asset. All sphereDrop-correct.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { applyGlobeCurvature } from '../RebuiltWorldShared';
import { EasternVillageArchitecture } from './village/EasternVillageArchitecture';

interface WithPlayer {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

// ─── Street Lamp ──────────────────────────────────────────────────────────────
// Thin 4-sided post + sphere top. 12 polys. Reads instantly as a lamp post.

function StreetLamp({ position, color = 0xfbbf24, playerPos }: {
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
      {/* Post — 4-sided cylinder */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 6, 4]} />
        <meshBasicMaterial color={0x4c1d95} wireframe transparent opacity={0.6} />
      </mesh>
      {/* Arm extending forward */}
      <mesh position={[0.5, 6.2, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[1.2, 0.12, 0.12]} />
        <meshBasicMaterial color={0x4c1d95} wireframe transparent opacity={0.5} />
      </mesh>
      {/* Lamp globe */}
      <mesh position={[1.0, 6.0, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

// ─── Roman Column ─────────────────────────────────────────────────────────────

function RomanColumn({ position, color = 0xc084fc, height = 12, playerPos }: {
  position: [number, number, number];
  color?: number;
  height?: number;
} & WithPlayer) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.4, 0.6, 1.4]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, height / 2 + 0.6, 0]}>
        <cylinderGeometry args={[0.4, 0.5, height, 6, 1, true]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, height + 0.9, 0]}>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ─── Torii Gate ───────────────────────────────────────────────────────────────

function ToriiGate({ position, rotation = 0, color = 0xec4899, playerPos }: {
  position: [number, number, number];
  rotation?: number;
  color?: number;
} & WithPlayer) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], pp, rotation);
  });

  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]}>
      <mesh position={[-3.5, 5.5, 0]}>
        <boxGeometry args={[0.5, 11, 0.5]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
      </mesh>
      <mesh position={[3.5, 5.5, 0]}>
        <boxGeometry args={[0.5, 11, 0.5]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 11.2, 0]}>
        <boxGeometry args={[9, 0.55, 0.55]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 9.5, 0]}>
        <boxGeometry args={[7.5, 0.35, 0.35]} />
        <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type HubObjectsProps = {
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
  playerPos?: React.MutableRefObject<THREE.Vector3>;
  dormant?: boolean;
  /** Minimal world look: drop gates & lamps, keep only the interactable buildings. */
  minimal?: boolean;
};

const _fallbackPos = { current: new THREE.Vector3() };

export function HubObjects({
  nearNoticeBoard = false,
  nearMapTable = false,
  nearLibrary = false,
  nearMoodStone = false,
  nearBottlePost = false,
  playerPos = _fallbackPos,
  dormant = false,
  minimal = false,
}: HubObjectsProps) {
  return (
    <group>
      {!dormant && !minimal && <>

      {/* ── Solomon's Temple Inner Court Gates (Porch Threshold & Three Forecourt Gates) ── */}
      <ToriiGate position={[0, 0, -18]}  rotation={0}            color={0x6366f1} playerPos={playerPos} />
      <ToriiGate position={[0, 0, 28]}   rotation={Math.PI}      color={0xfbbf24} playerPos={playerPos} />
      <ToriiGate position={[-28, 0, 0]}  rotation={Math.PI / 2}  color={0xec4899} playerPos={playerPos} />
      <ToriiGate position={[28, 0, 0]}   rotation={-Math.PI / 2} color={0x22d3ee} playerPos={playerPos} />

      {/* ── Street lamps along the Inner Court approaches ── */}
      {/* Temple / Rear Building approach */}
      <StreetLamp position={[-6, 0, -12]} color={0xc084fc} playerPos={playerPos} />
      <StreetLamp position={[6, 0, -12]}  color={0xc084fc} playerPos={playerPos} />
      <StreetLamp position={[-6, 0, -54]} color={0xc084fc} playerPos={playerPos} />
      <StreetLamp position={[6, 0, -54]}  color={0xc084fc} playerPos={playerPos} />
      {/* South Forecourt Gate approach */}
      <StreetLamp position={[-5, 0, 18]}  color={0xfbbf24} playerPos={playerPos} />
      <StreetLamp position={[5, 0, 18]}   color={0xfbbf24} playerPos={playerPos} />
      <StreetLamp position={[-5, 0, 34]}  color={0xfbbf24} playerPos={playerPos} />
      <StreetLamp position={[5, 0, 34]}   color={0xfbbf24} playerPos={playerPos} />
      {/* West Forecourt Gate approach */}
      <StreetLamp position={[-20, 0, -5]} color={0xec4899} playerPos={playerPos} />
      <StreetLamp position={[-20, 0, 5]}  color={0xec4899} playerPos={playerPos} />
      <StreetLamp position={[-34, 0, -5]} color={0xec4899} playerPos={playerPos} />
      <StreetLamp position={[-34, 0, 5]}  color={0xec4899} playerPos={playerPos} />
      {/* East Forecourt Gate approach */}
      <StreetLamp position={[20, 0, -5]}  color={0x22d3ee} playerPos={playerPos} />
      <StreetLamp position={[20, 0, 5]}   color={0x22d3ee} playerPos={playerPos} />
      <StreetLamp position={[34, 0, -5]}  color={0x22d3ee} playerPos={playerPos} />
      <StreetLamp position={[34, 0, 5]}   color={0x22d3ee} playerPos={playerPos} />

      </>}

      {/* Eastern Village Architecture: Replaces wireframe TownBuildings with solid-walled,
          upturned-eave pagoda cottages, stone lanterns, and translucent ASCII hedges.
          Preserves the exact trigger zones at [-52, 0, -38], [52, 0, 38], [52, 0, -38], [-52, 0, 38]. */}
      <EasternVillageArchitecture
        nearNoticeBoard={nearNoticeBoard}
        nearMapTable={nearMapTable}
        nearLibrary={nearLibrary}
        nearMoodStone={nearMoodStone}
        nearBottlePost={nearBottlePost}
        playerPos={playerPos}
        dormant={dormant}
        minimal={minimal}
      />

    </group>
  );
}
