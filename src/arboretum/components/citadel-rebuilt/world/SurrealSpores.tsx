import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CHAMBER_SIZE } from '../types';

export function SurrealSpores({ count = 60 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    pos: new THREE.Vector3((Math.random() - 0.5) * CHAMBER_SIZE * 1.5, Math.random() * 20 + 1, (Math.random() - 0.5) * CHAMBER_SIZE * 1.5),
    speed: Math.random() * 0.01 + 0.005, drift: (Math.random() - 0.5) * 0.02, phase: Math.random() * Math.PI * 2, scale: Math.random() * 0.15 + 0.05,
  })), [count]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      p.pos.y += p.speed; p.pos.x += Math.sin(t * 0.5 + p.phase) * p.drift;
      if (p.pos.y > 25) p.pos.y = 0.5;
      dummy.position.copy(p.pos); dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 2 + p.phase) * 0.3));
      dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (<instancedMesh ref={mesh} args={[undefined, undefined, count]}><sphereGeometry args={[1, 4, 4]} /><meshStandardMaterial color={0xc084fc} emissive={0xa855f7} emissiveIntensity={0.8} transparent opacity={0.5} /></instancedMesh>);
}
