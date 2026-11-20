import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface GladiatorHandle { group: THREE.Group; setMoving: (speed01: number) => void }

/** Wireframe-over-obsidian gladiator, in the Citadel's neon language. Ragdoll replaces this in Phase 3. */
export const Gladiator = forwardRef<GladiatorHandle, { color: string; accent?: string; scale?: number }>(
  function Gladiator({ color, accent = '#ffc95c', scale = 1 }, ref) {
    const group = useRef<THREE.Group>(null!);
    const body = useRef<THREE.Group>(null!);
    const speed = useRef(0);
    useImperativeHandle(ref, () => ({ group: group.current, setMoving: (s) => { speed.current = s; } }), []);
    useFrame(({ clock }) => {
      const t = clock.elapsedTime * 9;
      const s = speed.current;
      body.current.position.y = Math.abs(Math.sin(t)) * 0.12 * s;
      body.current.rotation.z = Math.sin(t) * 0.06 * s;
    });
    return (
      <group ref={group} scale={scale}>
        <group ref={body}>
          <mesh position={[0, 1.0, 0]}>
            <capsuleGeometry args={[0.36, 0.9, 4, 10]} />
            <meshBasicMaterial color="#0b051b" />
          </mesh>
          <mesh position={[0, 1.0, 0]} scale={1.04}>
            <capsuleGeometry args={[0.36, 0.9, 4, 10]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <icosahedronGeometry args={[0.28, 1]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          <mesh position={[0, 2.28, 0]} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.16, 0.34, 4]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          {/* shield, left */}
          <mesh position={[-0.55, 1.1, 0.15]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.07, 14]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          {/* sword, right */}
          <mesh position={[0.55, 1.2, 0.35]}>
            <boxGeometry args={[0.07, 0.07, 1.1]} />
            <meshBasicMaterial color="#e9e6ff" />
          </mesh>
        </group>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      </group>
    );
  },
);
