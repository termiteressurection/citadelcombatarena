import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';

interface LighthouseBeaconsProps {
  chambers: Record<number, any>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export function LighthouseBeacons({ chambers, playerPos }: LighthouseBeaconsProps) {
  const lighthouses = useMemo(() => {
    return Object.values(chambers).filter(c => c.isLighthouse && c.depth > 0);
  }, [chambers]);

  const groupRef = useRef<THREE.Group>(null);

  const starPositions = useMemo(() => {
    return lighthouses.map((c, i) => {
      const angle = (i / lighthouses.length) * Math.PI * 2;
      const radius = 60 + (i % 3) * 20;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 30 + (i % 5) * 5;
      return { pos: [x, y, z] as [number, number, number], name: c.name };
    });
  }, [lighthouses]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Distant stars move slightly with player or time
    groupRef.current.rotation.y = clock.elapsedTime * 0.01;
  });

  if (lighthouses.length === 0) return null;

  return (
    <group ref={groupRef}>
      {starPositions.map((star, i) => (
        <group key={i} position={star.pos}>
          <mesh>
            <sphereGeometry args={[0.8, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          <pointLight color="#ffffff" intensity={5} distance={20} />
          <group position={[0, 2, 0]}>
            <SpriteText fontSize={1.5} color="#ffffff" opacity={0.4}>
              {star.name.toUpperCase()}
            </SpriteText>
          </group>
        </group>
      ))}
    </group>
  );
}
