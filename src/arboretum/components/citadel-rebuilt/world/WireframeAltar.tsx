/**
 * WireframeAltar — nested mathematical wireframe at the chamber origin.
 *
 * Kill switch: `citadel.visuals.next === '1'` AND `citadel.visuals.altar !== '0'`.
 *
 * Renders on top of the existing Altar mesh at (0,0,0). The existing mesh
 * retains its collider / raycast bounding box; this component adds NO new
 * colliders and does not displace or hide the original.
 *
 * Per-tier config from QualityProfile.visuals:
 *   brick  → 1 layer
 *   hearth → 2 layers
 *   forge  → 3 layers
 *
 * Each layer is a MeshBasicMaterial wireframe icosahedron with:
 *   - AdditiveBlending (overlaps glow brighter; fakes a bloom pass)
 *   - toneMapped=false so the additive math stays true instead of being
 *     compressed back into LDR. The sky and ground stay tone-mapped; only
 *     the altar opts out.
 *   - depthWrite=false so additive passes stack correctly.
 *
 * Hysteresis: the outermost layer fades out when the player camera is within
 * 4 units and fades back in when >5 units. Prevents a popping layer if the
 * player hovers at the boundary, and cuts fragment cost when close.
 *
 *   distance < 4 → target count = max(1, tierCount - 1)
 *   distance > 5 → target count = tierCount
 *   4 <= d <= 5  → hold whatever the target was (hysteresis band)
 *
 * Fade is a 200ms opacity transition on the drop/restore transition.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getQualityProfile } from '../qualityTier';
import { visualFlags } from '../visualFlags';

const LAYER_SIZES = [2.2, 3.0, 3.8]; // radius per layer, outer → outer²
const LAYER_COLORS = ['#a855f7', '#ec4899', '#22d3ee'];
const ROT_SPEEDS = [0.05, -0.07, 0.11]; // rad/sec; relatively prime

const FADE_DURATION_MS = 200;
const DROP_DISTANCE = 4.0;
const RESTORE_DISTANCE = 5.0;

interface LayerState {
  material: THREE.MeshBasicMaterial;
  opacityTarget: number;
  opacityVelocity: number;
}

export function WireframeAltar() {
  const flags = visualFlags();
  const enabled = flags.master && flags.altar;
  const qp = getQualityProfile();
  const tierLayers = qp.visuals.altarLayers;

  const layers = useMemo<LayerState[]>(() => {
    if (!enabled) return [];
    const out: LayerState[] = [];
    for (let i = 0; i < tierLayers; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: LAYER_COLORS[i] ?? LAYER_COLORS[0],
        wireframe: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false, // altar-only opt-out
        opacity: 1,
      });
      out.push({ material: mat, opacityTarget: 1, opacityVelocity: 0 });
    }
    return out;
  }, [enabled, tierLayers]);

  useEffect(() => {
    return () => {
      for (const l of layers) l.material.dispose();
    };
  }, [layers]);

  const groupRef = useRef<THREE.Group>(null);
  const outerDroppedRef = useRef(false);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    if (layers.length === 0 || !groupRef.current) return;

    const group = groupRef.current;

    const t = state.clock.elapsedTime;
    
    // 1. Proximity Awakening Math (The 8th Order influence)
    const camPos = state.camera.getWorldPosition(tmpVec);
    const dist = camPos.length(); // altar is at origin
    const awakenFactor = THREE.MathUtils.smoothstep(dist, 10.0, 2.0); // 1.0 when close, 0.0 when far
    
    // 2. Biological Breathing & Heartbeat
    const breathe = 1 + Math.sin(t * 1.5) * (0.02 + awakenFactor * 0.05);
    const heartbeat = Math.pow(Math.sin(t * 1.8), 12) * (0.1 + awakenFactor * 0.4);
    group.scale.setScalar(breathe);

    // 3. Layer Management & Biological Twitch
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i] as THREE.Mesh;
      const speed = (ROT_SPEEDS[i] ?? ROT_SPEEDS[0]) * (1 + awakenFactor * 2);
      const twitch = Math.sin(t * 15 + i) * 0.005 * awakenFactor;
      child.rotation.x += (speed + twitch) * dt;
      child.rotation.y += (speed * 0.7 + twitch) * dt;
      
      // Heartbeat affects glow opacity
      const layer = layers[i];
      layer.material.opacity = (layer.opacityTarget * 0.8) + heartbeat;
    }

    // 4. Hysteresis band on the outermost layer
    if (layers.length > 1) {
      if (!outerDroppedRef.current && dist < DROP_DISTANCE) {
        outerDroppedRef.current = true;
        layers[layers.length - 1].opacityTarget = 0;
      } else if (outerDroppedRef.current && dist > RESTORE_DISTANCE) {
        outerDroppedRef.current = false;
        layers[layers.length - 1].opacityTarget = 1;
      }
    }
  });

  if (!enabled || layers.length === 0) return null;

  return (
    <group ref={groupRef} position={[0, 1.2, 0]}>
      {/* LIVING ALTAR: Opaque Obsidian Core */}
      <mesh>
        <icosahedronGeometry args={[2, 0]} />
        <meshBasicMaterial color={0x0a0514} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[2.02, 0]} />
        <meshBasicMaterial color={0x7c3aed} wireframe />
      </mesh>

      {layers.map((layer, i) => (
        <mesh key={i} material={layer.material}>
          <icosahedronGeometry args={[LAYER_SIZES[i] ?? LAYER_SIZES[0], 0]} />
        </mesh>
      ))}
    </group>
  );
}
