import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { sphereDrop } from '../RebuiltWorldShared';

export function LodgeEtchings({ identity, playerPos }: { identity: any; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const plumbGlow = (identity?.integrity || 0) >= 100;
  const levelGlow = (identity?.mentalLoad || 0) <= 10;
  const squareGlow = (identity?.streak || 0) >= 7;

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    groupRef.current.position.y = -sphereDrop(-pp.x, -pp.z);
  });

  return (
    <group ref={groupRef} position={[0, 0, -4.5]}>
      {/* Plumb */}
      <group position={[-1.2, 0.6, 0]}>
        <SpriteText fontSize={0.25} color={plumbGlow ? "#4ade80" : "#ffffff"} opacity={plumbGlow ? 0.8 : 0.15}>
          {"|"}
        </SpriteText>
      </group>
      {/* Level */}
      <group position={[0, 0.6, 0]}>
        <SpriteText fontSize={0.25} color={levelGlow ? "#60a5fa" : "#ffffff"} opacity={levelGlow ? 0.8 : 0.15}>
          {"—"}
        </SpriteText>
      </group>
      {/* Square */}
      <group position={[1.2, 0.6, 0]}>
        <SpriteText fontSize={0.25} color={squareGlow ? "#facc15" : "#ffffff"} opacity={squareGlow ? 0.8 : 0.15}>
          {"∟"}
        </SpriteText>
      </group>
    </group>
  );
}
