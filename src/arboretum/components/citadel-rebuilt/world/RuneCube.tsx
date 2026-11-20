import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { applyGlobeCurvature } from '../RebuiltWorldShared';

const CUBIE_SIZE = 0.45;
const GAP = 0.05;
const RUNES = ["#", "!", "$", "%", "^", "&", "*", "@", "◉", "◈", "◇", "◆"];

export function RuneCube({ position, scale = 1, playerPos }: {
  position: [number, number, number];
  scale?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cubiesRef = useRef<THREE.Group[]>([]);

  // Generate 27 cubies for a 3x3x3 grid
  const cubieData = useMemo(() => {
    const data = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          data.push({
            pos: [x * (CUBIE_SIZE + GAP), y * (CUBIE_SIZE + GAP), z * (CUBIE_SIZE + GAP)] as [number, number, number],
            grid: [x, y, z] as [number, number, number],
            runes: [
              RUNES[Math.floor(Math.random() * RUNES.length)], // +X
              RUNES[Math.floor(Math.random() * RUNES.length)], // -X
              RUNES[Math.floor(Math.random() * RUNES.length)], // +Y
              RUNES[Math.floor(Math.random() * RUNES.length)], // -Y
              RUNES[Math.floor(Math.random() * RUNES.length)], // +Z
              RUNES[Math.floor(Math.random() * RUNES.length)], // -Z
            ]
          });
        }
      }
    }
    return data;
  }, []);

  const moveState = useRef({
    axis: 'x',
    layer: 0,
    progress: 0,
    active: false,
    timer: 0,
  });

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;

    // 1. Ground Curvature & Tangent Alignment
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp, 0, Math.sin(t * 0.5) * 0.1);
    groupRef.current.rotateY(delta * 0.2);

    // 2. Solving Algorithm Simulation
    const ms = moveState.current;
    if (!ms.active) {
      ms.timer += delta;
      if (ms.timer > 1.5) {
        ms.active = true;
        ms.progress = 0;
        ms.axis = ['x', 'y', 'z'][Math.floor(Math.random() * 3)];
        ms.layer = Math.floor(Math.random() * 3) - 1;
        ms.timer = 0;
      }
    } else {
      ms.progress += delta * 4; // Rotation speed
      if (ms.progress >= Math.PI / 2) {
        ms.progress = Math.PI / 2;
        // Finalize move: update cubie positions (visual only for this ambient loop)
        ms.active = false;
        ms.progress = 0;
      }
    }

    // Apply rotation to the active layer
    cubiesRef.current.forEach((cubie, i) => {
      if (!cubie) return;
      const data = cubieData[i];
      const isMatch = ms.axis === 'x' ? data.grid[0] === ms.layer :
                      ms.axis === 'y' ? data.grid[1] === ms.layer :
                      data.grid[2] === ms.layer;

      if (ms.active && isMatch) {
        if (ms.axis === 'x') cubie.rotation.x = ms.progress;
        if (ms.axis === 'y') cubie.rotation.y = ms.progress;
        if (ms.axis === 'z') cubie.rotation.z = ms.progress;
      } else if (!ms.active) {
        cubie.rotation.set(0, 0, 0);
      }
    });
  });

  return (
    <group ref={groupRef} scale={scale}>
      {cubieData.map((data, i) => (
        <group 
          key={i} 
          ref={el => { if (el) cubiesRef.current[i] = el; }}
          position={data.pos}
        >
          {/* Cubie Base */}
          <mesh>
            <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
            <meshBasicMaterial color={0x0a0520} wireframe transparent opacity={0.3} />
          </mesh>
          {/* Runes on faces */}
          {data.runes.map((rune, ri) => {
            const rPos: [number, number, number] = [
              ri === 0 ? 0.23 : ri === 1 ? -0.23 : 0,
              ri === 2 ? 0.23 : ri === 3 ? -0.23 : 0,
              ri === 4 ? 0.23 : ri === 5 ? -0.23 : 0,
            ];
            const rRot: [number, number, number] = [
              ri >= 2 && ri <= 3 ? Math.PI / 2 : 0,
              ri <= 1 ? Math.PI / 2 : 0,
              0
            ];
            return (
              <group key={ri} position={rPos} rotation={rRot}>
                <SpriteText
                  fontSize={0.12}
                  color={ri % 2 === 0 ? "#22d3ee" : "#ec4899"}
                  opacity={0.8}
                >
                  {rune}
                </SpriteText>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}
