import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarfieldProps {
  count?: number;
  radius?: number;
  depth?: number;
  speed?: number;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export default function Starfield({
  count = 1200,
  radius = 200,
  depth = 80,
  speed = 0.2,
  playerPosRef,
}: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const buffer = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = radius - Math.random() * depth;
      buffer[index * 3] = Math.sin(phi) * Math.cos(theta) * distance;
      buffer[index * 3 + 1] = Math.cos(phi) * distance * 0.9;
      buffer[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * distance;
    }
    return buffer;
  }, [count, depth, radius]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    if (playerPosRef) {
      pointsRef.current.position.set(playerPosRef.current.x, 0, playerPosRef.current.z);
    }
    pointsRef.current.rotation.y += delta * speed * 0.05;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial color="#e7f3ff" size={1.2} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}
