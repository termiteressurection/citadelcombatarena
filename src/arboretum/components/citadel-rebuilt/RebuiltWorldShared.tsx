import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../three/SpriteText';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';

/**
 * Restored Original Planetary Curvature Radius:
 * R = 120.0 units is the canonical sanctuary planetoid dome curvature
 * verified directly in git commit 4f453c4 (Thu Oct 22 12:44:35 2026).
 */
export const ORIGINAL_CURVATURE_RADIUS = 120.0;
export const WORLD_CURVATURE_RADIUS = 120.0;

/**
 * Shared live reference to the player's world position, updated every frame
 * so custom Look ground shaders and scenery stay 100% locked to the same
 * curvature origin as overworld assets (rather than drifting with camera orbit).
 */
export const livePlayerWorldPos = new THREE.Vector3(0, 2, 12);

export function getActiveCurvatureRadius(): number {
  try {
    const r = useVillageTunerStore.getState().curvatureRadius;
    return typeof r === 'number' ? r : ORIGINAL_CURVATURE_RADIUS;
  } catch {
    return ORIGINAL_CURVATURE_RADIUS;
  }
}

/** Get hour-based time-of-day factor (0=midnight, 0.5=noon, 1=midnight) */
export function getTimeOfDay(): number {
  const d = new Date();
  return (d.getHours() + d.getMinutes() / 60) / 24;
}

/** Map time-of-day to color temperature / mood (0=midnight, 0.5=noon) */
export function getTimePalette(t: number) {
  // Midnight / Deep Night (0.0 - 0.2)
  if (t < 0.2) return { bg: '#030108', fog: '#030108', intensity: 0.25, accent: '#6d28d9' };
  // Pre-dawn / Indigo (0.2 - 0.3)
  if (t < 0.3) return { bg: '#0a0520', fog: '#0a0520', intensity: 0.4, accent: '#7c3aed' };
  // Sunrise / Vapor-Glow (0.3 - 0.4)
  if (t < 0.4) return { bg: '#2d063a', fog: '#1e0520', intensity: 0.7, accent: '#f43f5e' };
  // Morning / Solar-Punk (0.4 - 0.55)
  if (t < 0.55) return { bg: '#0f061e', fog: '#0f061e', intensity: 1.0, accent: '#3b82f6' };
  // Afternoon / High-Citadel (0.55 - 0.7)
  if (t < 0.7) return { bg: '#0b0416', fog: '#0b0416', intensity: 0.85, accent: '#8b5cf6' };
  // Sunset / Ember-Void (0.7 - 0.85)
  if (t < 0.85) return { bg: '#1a0505', fog: '#0f0202', intensity: 0.6, accent: '#f97316' };
  // Twilight / Glitch-Noir (0.85 - 0.95)
  if (t < 0.95) return { bg: '#08020e', fog: '#08020e', intensity: 0.4, accent: '#a855f7' };
  // Deep Night (0.95 - 1.0)
  return { bg: '#030108', fog: '#030108', intensity: 0.25, accent: '#6d28d9' };
}

/**
 * Shared Planetary Curvature Drop (Continuous Parabolic Sagitta):
 * sagitta = d^2 / (2 * R)
 * Matches the spherical dome near the origin while remaining C-infinity smooth
 * at all distances (even when d > R on tight R = 60 planetoids), eliminating
 * horizon cliff clamping and ground-mesh secant gaps that caused assets to float.
 */
export function sphereDrop(dx: number, dz: number, customR?: number): number {
  const R = customR ?? getActiveCurvatureRadius();
  if (R <= 0 || R >= 50000) return 0.0;
  const d2 = dx * dx + dz * dz;
  return d2 / (2.0 * R);
}

const _UP = new THREE.Vector3(0, 1, 0);
const _NORMAL = new THREE.Vector3();
const _QUAT = new THREE.Quaternion();
const _DUMMY_OBJ = new THREE.Object3D();

/**
 * Align any 3D Object to world coordinates on the unified curved terrain.
 * - Displaces position.y to match the shared continuous curvature drop.
 * - Tilts the object along the surface normal of the curved world.
 * - Displaces non-zero height offsets along the surface normal so multi-part
 *   instanced trunks and foliage stay connected and grounded.
 */
export function applyGlobeCurvature(
  object: THREE.Object3D,
  worldX: number,
  baseY: number,
  worldZ: number,
  playerPos: THREE.Vector3,
  baseRotationY: number = 0,
  extraOffsetY: number = 0,
  customR?: number
) {
  livePlayerWorldPos.copy(playerPos);
  const R = customR ?? getActiveCurvatureRadius();
  const totalY = baseY + extraOffsetY;
  if (R <= 0 || R >= 50000) {
    object.position.set(worldX, totalY, worldZ);
    object.quaternion.set(0, 0, 0, 1);
    if (baseRotationY !== 0) object.rotateY(baseRotationY);
    return;
  }

  const dx = worldX - playerPos.x;
  const dz = worldZ - playerPos.z;
  const d2 = dx * dx + dz * dz;
  const sagitta = d2 / (2.0 * R);

  // Surface normal of y = -d^2 / (2R) is normalize(dx/R, 1, dz/R).
  // Gently cap maximum tilt slope so wide buildings don't tip sideways on R=60.
  const maxSlope = 0.75;
  let sx = dx / R;
  let sz = dz / R;
  const slopeMag = Math.hypot(sx, sz);
  if (slopeMag > maxSlope) {
    const scale = maxSlope / slopeMag;
    sx *= scale;
    sz *= scale;
  }
  _NORMAL.set(sx, 1.0, sz).normalize();

  // Subtle curvature-proportional foundation sink so wide building bases stay embedded in the dome
  const foundationSink =
    totalY === 0 ? Math.min(0.42, (14.0 / R) * (1.0 + Math.min(d2, 3600) / 3600)) : 0;

  object.position.set(
    worldX + totalY * _NORMAL.x,
    -sagitta - foundationSink + totalY * _NORMAL.y,
    worldZ + totalY * _NORMAL.z
  );

  // Orient object along surface normal
  _QUAT.setFromUnitVectors(_UP, _NORMAL);
  object.quaternion.copy(_QUAT);

  // Apply inherent rotation around tilted Y axis
  if (baseRotationY !== 0) {
    object.rotateY(baseRotationY);
  }
}

/**
 * Align a Matrix4 directly to world coordinates on the unified terrain plane.
 */
export function applyGlobeCurvatureMatrix(
  matrix: THREE.Matrix4,
  worldX: number,
  baseY: number,
  worldZ: number,
  playerPos: THREE.Vector3,
  scale: number | [number, number, number] = 1,
  baseRotationY: number = 0,
  extraOffsetY: number = 0,
  customR?: number
): THREE.Matrix4 {
  applyGlobeCurvature(_DUMMY_OBJ, worldX, baseY, worldZ, playerPos, baseRotationY, extraOffsetY, customR);
  if (typeof scale === 'number') {
    _DUMMY_OBJ.scale.set(scale, scale, scale);
  } else {
    _DUMMY_OBJ.scale.set(scale[0], scale[1], scale[2]);
  }
  _DUMMY_OBJ.updateMatrix();
  matrix.copy(_DUMMY_OBJ.matrix);
  return matrix;
}

export function ProximityGlyph({
  glyph,
  position,
  active,
  playerPos,
  color = '#c084fc',
}: {
  glyph: string;
  position: [number, number, number];
  active: boolean;
  playerPos: MutableRefObject<THREE.Vector3>;
  color?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const drop = sphereDrop(position[0] - pp.x, position[2] - pp.z);
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.15 - drop;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.2;
  });
  return (
    <group ref={ref} position={position}>
      <SpriteText
        fontSize={active ? 0.6 : 0.3}
        color={color}
        opacity={active ? 0.9 : 0.3}
        outlineWidth={0.04}
        outlineColor="#0a0414"
      >
        {glyph}
      </SpriteText>
    </group>
  );
}

export function VaultBackdrop({ playerPos }: { playerPos: MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.x = playerPos.current.x;
    groupRef.current.position.z = playerPos.current.z;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.04) * 0.02;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 70, 0]}>
        <octahedronGeometry args={[180, 1]} />
        <meshBasicMaterial color={0x0d0520} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 26, -116]}>
        <circleGeometry args={[24, 6]} />
        <meshBasicMaterial color={0x7c3aed} transparent opacity={0.08} />
      </mesh>
      <mesh position={[0, 24, -115]}>
        <circleGeometry args={[18, 5]} />
        <meshBasicMaterial color={0xd946ef} transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 22, -114.5]}>
        <circleGeometry args={[10, 3]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.42} />
      </mesh>
      <mesh position={[-50, 10, -130]}>
        <coneGeometry args={[30, 20, 4]} />
        <meshBasicMaterial color={0x0e0822} wireframe transparent opacity={0.12} />
      </mesh>
      <mesh position={[40, 8, -128]}>
        <coneGeometry args={[25, 16, 4]} />
        <meshBasicMaterial color={0x0e0822} wireframe transparent opacity={0.1} />
      </mesh>
      <mesh position={[-15, 12, -132]}>
        <coneGeometry args={[35, 24, 4]} />
        <meshBasicMaterial color={0x100a28} wireframe transparent opacity={0.08} />
      </mesh>
      <mesh position={[65, 6, -125]}>
        <coneGeometry args={[20, 12, 4]} />
        <meshBasicMaterial color={0x0e0822} wireframe transparent opacity={0.1} />
      </mesh>
      <mesh position={[0, 16, -112]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[180, 42]} />
        <meshBasicMaterial color={0x140828} transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 12, -108]}>
        <planeGeometry args={[260, 18]} />
        <meshBasicMaterial color={0x1e0d3a} transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 8.5, -98]}>
        <planeGeometry args={[240, 10]} />
        <meshBasicMaterial color={0x2d1660} transparent opacity={0.14} />
      </mesh>
      <mesh position={[0, 5, -90]}>
        <planeGeometry args={[220, 8]} />
        <meshBasicMaterial color={0x3b1d7a} transparent opacity={0.06} />
      </mesh>
      <mesh position={[-60, 40, -110]}>
        <octahedronGeometry args={[15, 0]} />
        <meshBasicMaterial color={0x7c3aed} transparent opacity={0.04} />
      </mesh>
      <mesh position={[50, 50, -105]}>
        <octahedronGeometry args={[12, 0]} />
        <meshBasicMaterial color={0xec4899} transparent opacity={0.03} />
      </mesh>
      {[...Array(20)].map((_, i) => {
        const a = (i / 20) * Math.PI * 2 + 0.3;
        const h = 30 + (i % 5) * 12;
        const r = 100 + (i % 3) * 20;
        return (
          <mesh key={`star-${i}`} position={[Math.cos(a) * r, h, Math.sin(a) * r - 60]}>
            <octahedronGeometry args={[0.3 + (i % 3) * 0.15, 0]} />
            <meshBasicMaterial color={i % 4 === 0 ? 0xfbbf24 : i % 3 === 0 ? 0xec4899 : 0xd8b4fe} transparent opacity={0.15 + (i % 3) * 0.05} />
          </mesh>
        );
      })}
    </group>
  );
}
