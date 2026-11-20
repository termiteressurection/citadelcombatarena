import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface Pose {
  /** sword pitch in radians: negative = raised (windup), positive = swung through */
  swing: number;
  /** 0..1, shield raised in front */
  block: number;
  /** 0..1 enemy attack telegraph glow */
  telegraph: number;
  /** 0..1 hit flash */
  hurt: number;
}
export interface GladiatorHandle { group: THREE.Group; pose: Pose; setMoving: (speed01: number) => void }

/** Wireframe-over-obsidian gladiator, in the Citadel's neon language. */
export const Gladiator = forwardRef<GladiatorHandle, { color: string; accent?: string; scale?: number }>(
  function Gladiator({ color, accent = '#ffc95c', scale = 1 }, ref) {
    const group = useRef<THREE.Group>(null!);
    const body = useRef<THREE.Group>(null!);
    const sword = useRef<THREE.Group>(null!);
    const shield = useRef<THREE.Mesh>(null!);
    const wire = useRef<THREE.MeshBasicMaterial>(null!);
    const swordMat = useRef<THREE.MeshBasicMaterial>(null!);
    const speed = useRef(0);
    const pose = useRef<Pose>({ swing: 0, block: 0, telegraph: 0, hurt: 0 });
    const tmp = useRef({ base: new THREE.Color(color), hot: new THREE.Color('#ffffff'), warn: new THREE.Color('#ff3b3b') });
    useImperativeHandle(ref, () => ({ group: group.current, pose: pose.current, setMoving: (s) => { speed.current = s; } }), []);
    useFrame(({ clock }) => {
      const t = clock.elapsedTime * 9;
      const s = speed.current;
      const p = pose.current;
      body.current.position.y = Math.abs(Math.sin(t)) * 0.12 * s;
      body.current.rotation.z = Math.sin(t) * 0.06 * s - p.hurt * 0.25;
      sword.current.rotation.x = p.swing;
      shield.current.position.set(-0.55 + p.block * 0.55, 1.1 + p.block * 0.2, 0.15 + p.block * 0.5);
      shield.current.rotation.y = Math.PI / 2 - p.block * Math.PI / 2;
      const c = wire.current.color.copy(tmp.current.base);
      c.lerp(tmp.current.warn, p.telegraph).lerp(tmp.current.hot, p.hurt);
      swordMat.current.color.set('#e9e6ff').lerp(tmp.current.warn, p.telegraph);
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
            <meshBasicMaterial ref={wire} color={color} wireframe transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <icosahedronGeometry args={[0.28, 1]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          <mesh position={[0, 2.28, 0]}>
            <coneGeometry args={[0.16, 0.34, 4]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          <mesh ref={shield} position={[-0.55, 1.1, 0.15]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.07, 14]} />
            <meshBasicMaterial color={accent} wireframe />
          </mesh>
          {/* sword pivots at the shoulder */}
          <group ref={sword} position={[0.55, 1.35, 0]}>
            <mesh position={[0, -0.15, 0.55]}>
              <boxGeometry args={[0.07, 0.07, 1.1]} />
              <meshBasicMaterial ref={swordMat} color="#e9e6ff" />
            </mesh>
          </group>
        </group>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      </group>
    );
  },
);
