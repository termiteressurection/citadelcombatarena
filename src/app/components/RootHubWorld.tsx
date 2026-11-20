import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';

function Altar() {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.2;
    }
  });

  return (
    <group ref={meshRef} position={[0, 0, 0]}>
      {/* Central Prism */}
      <mesh>
        <tetrahedronGeometry args={[1.5, 0]} />
        <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.4} />
      </mesh>
      {/* Outer Rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <torusGeometry args={[3.2, 0.01, 16, 100]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

function CurvedGrid() {
  const count = 40;
  const size = 100;
  
  return (
    <group position={[0, -5, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={`h-${i}`} position={[0, 0, (i - count / 2) * (size / count)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, 0.05]} />
          <meshBasicMaterial color="#4c1d95" transparent opacity={0.15} />
        </mesh>
      ))}
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={`v-${i}`} position={[(i - count / 2) * (size / count), 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, size]} />
          <meshBasicMaterial color="#4c1d95" transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function AetherParticles() {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.05;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#d8b4fe" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export function RootHubWorld() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: '#06020e' }}>
      <Canvas camera={{ position: [0, 2, 10], fov: 60 }}>
        <fog attach="fog" args={['#06020e', 5, 25]} />
        <ambientLight intensity={0.5} />
        <Altar />
        <CurvedGrid />
        <AetherParticles />
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <Sphere args={[0.8, 32, 32]} position={[4, 1, -5]}>
            <MeshDistortMaterial color="#22d3ee" speed={2} distort={0.4} transparent opacity={0.6} />
          </Sphere>
        </Float>
      </Canvas>
    </div>
  );
}
