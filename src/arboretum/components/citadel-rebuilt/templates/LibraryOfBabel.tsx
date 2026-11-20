import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../RebuiltWorldShared';

interface LibraryOfBabelProps {
  thoughts: any[];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export function LibraryOfBabel({ thoughts, playerPos }: LibraryOfBabelProps) {
  const shelfGeometry = useMemo(() => new THREE.BoxGeometry(10, 0.2, 2), []);
  const bookGeometry = useMemo(() => new THREE.BoxGeometry(0.15, 0.8, 0.6), []);

  const groupRef = useRef<THREE.Group>(null);

  const shelves = useMemo(() => {
    const s: { pos: [number, number, number] }[] = [];
    for (let i = 0; i < 20; i++) {
      s.push({ pos: [-8, i * 2.5 + 0.5, 0] });
      s.push({ pos: [8, i * 2.5 + 0.5, 0] });
    }
    return s;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    groupRef.current.position.y = -sphereDrop(-pp.x, -pp.z);
  });

  return (
    <group ref={groupRef}>
      {shelves.map((s, i) => (
        <group key={i} position={s.pos}>
          <mesh geometry={shelfGeometry}>
            <meshBasicMaterial color="#4c1d95" wireframe transparent opacity={0.3} />
          </mesh>
          {/* Books representing thoughts */}
          {thoughts.slice(i * 5, (i + 1) * 5).map((t, j) => (
            <mesh key={j} geometry={bookGeometry} position={[-4 + j * 2, 0.5, 0]}>
              <meshBasicMaterial color={t.pinned ? "#facc15" : "#a855f7"} transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Infinite effect: Duplicate rows in Z */}
      {[...Array(6)].map((_, i) => (
        <group key={i} position={[0, 0, (i - 3) * 12]}>
           {/* Shelves logic repeated or just clones */}
        </group>
      ))}
    </group>
  );
}
