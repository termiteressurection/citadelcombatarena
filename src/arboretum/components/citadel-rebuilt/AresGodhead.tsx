import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../three/SpriteText';
import { Hexadecachoron16Cell } from './world/components/Hexadecachoron16Cell';
import { applyGlobeCurvature } from './RebuiltWorldShared';

export function SigmaSkull({
  position,
  playerPos,
  nearSigma,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  nearSigma: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={groupRef} position={position}>
      {/* === PEDESTAL — tiered angular platform (masonic style) === */}
      <mesh position={[0, -5.2, 0]}>
        <cylinderGeometry args={[6, 7, 0.6, 4]} />
        <meshBasicMaterial color={0x0a0418} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -4.7, 0]}>
        <cylinderGeometry args={[5, 6, 0.4, 4]} />
        <meshBasicMaterial color={0x0d0520} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, -4.3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[4.5, 0.35, 4.5]} />
        <meshBasicMaterial color={0x140828} wireframe transparent opacity={0.4} />
      </mesh>

      {/* The God in the Machine: The Plash 24D Extradimensional 16-Cell */}
      <group position={[0, -0.6, 0]}>
        <Hexadecachoron16Cell scale={2.8} speed={2.6} showDust={true} dustCount={140} />
      </group>

      {/* === PROXIMITY PROMPT === */}
      {nearSigma && (
        <SpriteText position={[0, -5.8, 3]} fontSize={0.4} color="#d4a04a" outlineWidth={0.03} outlineColor="#0a0800" maxWidth={8}>
          ✕  COMMUNE WITH THE SIGMA
        </SpriteText>
      )}
    </group>
  );
}
