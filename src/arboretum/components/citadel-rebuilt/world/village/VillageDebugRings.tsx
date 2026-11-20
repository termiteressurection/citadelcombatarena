import React, { useMemo } from 'react';
import * as THREE from 'three';
import SpriteText from '../../../three/SpriteText';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import { computeVillageColliders, KEEP_CLEAR_ZONES } from './villageColliders';

export function VillageDebugRings() {
  const collidersVisible = useVillageTunerStore((state) => state.collidersVisible);
  const keepClearZonesVisible = useVillageTunerStore((state) => state.keepClearZonesVisible);
  const colliders = useMemo(() => computeVillageColliders(), []);

  if (!collidersVisible && !keepClearZonesVisible) return null;

  return (
    <group>
      {/* 1. Visible Collider Outlines */}
      {collidersVisible &&
        colliders.map((c) => {
          const radius = Math.max(c.scale[0], c.scale[2]) * 0.7;
          return (
            <group key={`debug-col-${c.id}`} position={c.pos}>
              {/* Ground wireframe footprint ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
                <ringGeometry args={[radius * 0.9, radius, 24]} />
                <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} />
              </mesh>
              {/* Height wireframe cylinder */}
              <mesh position={[0, c.scale[1] / 2, 0]}>
                <cylinderGeometry args={[radius, radius, c.scale[1], 16, 1, true]} />
                <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.35} />
              </mesh>
              <SpriteText
                position={[0, c.scale[1] + 0.6, 0]}
                fontSize={0.28}
                color="#4ade80"
                outlineWidth={0.02}
                outlineColor="#052e16"
              >
                {c.name}
              </SpriteText>
            </group>
          );
        })}

      {/* 2. Keep-Clear Zones Ground Outlines */}
      {keepClearZonesVisible &&
        KEEP_CLEAR_ZONES.map((zone) => (
          <group key={`debug-zone-${zone.id}`} position={[zone.center[0], 0.06, zone.center[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[zone.radius * 0.95, zone.radius, 32]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} side={THREE.DoubleSide} />
            </mesh>
            <SpriteText
              position={[0, 0.3, 0]}
              fontSize={0.35}
              color="#67e8f9"
              outlineWidth={0.03}
              outlineColor="#083344"
            >
              {`KEEP-CLEAR: ${zone.name}`}
            </SpriteText>
          </group>
        ))}
    </group>
  );
}
