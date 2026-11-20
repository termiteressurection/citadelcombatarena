import React, { useMemo } from 'react';
import * as THREE from 'three';
import { AestheticBamboo } from '../assets/AestheticConstructs';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';

interface Props {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export function VillageBambooGroves({ playerPos }: Props) {
  const bambooDensity = useVillageTunerStore((state) => state.bambooDensity);

  const stalkPlacements = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; scale: number; seed: number }> = [];

    // 4 Corner Perimeter Bamboo Groves (NE, NW, SW, SE)
    const groveCenters: [number, number][] = [
      [38, -38],   // Northeast Grove
      [-38, -38],  // Northwest Grove
      [-38, 38],   // Southwest Grove
      [38, 38],    // Southeast Grove
    ];

    let seedCounter = 100;
    groveCenters.forEach(([gx, gz], gIdx) => {
      const baseStalks = Math.round(10 * Math.max(0.4, bambooDensity));
      for (let i = 0; i < baseStalks; i++) {
        const angle = (i / baseStalks) * Math.PI * 2 + (gIdx * 0.7);
        const r = 2.5 + ((i * 1.7) % 5.5);
        const x = gx + Math.cos(angle) * r;
        const z = gz + Math.sin(angle) * r;
        const scale = 0.85 + ((i * 7) % 4) * 0.12;
        list.push({
          pos: [x, 0, z],
          scale,
          seed: seedCounter++,
        });
      }
    });

    // Pathway Accent Stalks framing village roads
    const pathAccents: [number, number][] = [
      [-12, -28], [12, -28],
      [-12, 28], [12, 28],
      [-28, -12], [-28, 12],
      [28, -12], [28, 12],
      [-24, -20], [24, -20],
      [-24, 20], [24, 20],
    ];

    pathAccents.forEach(([px, pz], pIdx) => {
      list.push({
        pos: [px, 0, pz],
        scale: 0.95 + (pIdx % 3) * 0.1,
        seed: seedCounter++,
      });
    });

    return list;
  }, [bambooDensity]);

  return (
    <group>
      {stalkPlacements.map((s, idx) => (
        <AestheticBamboo
          key={`village-bamboo-${idx}`}
          position={s.pos}
          scale={s.scale}
          seed={s.seed}
          playerPos={playerPos}
        />
      ))}
    </group>
  );
}
