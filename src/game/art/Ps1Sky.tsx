import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPs1Texture, makePs1Material } from './ps1Textures';

/** Quantized low-poly PS1 sky dome with vertex-colored twilight bands, faceted moon, and distant horizon ruins. */
export function Ps1Sky({ mood = 'ludus' }: { mood?: 'ludus' | 'arena' }) {
  const skyGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(280, 18, 10);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const zenith = new THREE.Color('#080614');
    const mid = new THREE.Color(mood === 'arena' ? '#211132' : '#181332');
    const horizon = new THREE.Color(mood === 'arena' ? '#5a2b2c' : '#2f204e');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp(y / 280, 0, 1);
      // Quantize into 7 crisp PS1 sky bands
      const q = Math.floor(t * 7) / 7;
      if (q < 0.35) tmp.copy(horizon).lerp(mid, q / 0.35);
      else tmp.copy(mid).lerp(zenith, (q - 0.35) / 0.65);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [mood]);

  const aqueducts = useMemo(() => {
    const items: { x: number; z: number; ry: number; h: number; temple: boolean }[] = [];
    const N = 24;
    const R = 155;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      items.push({
        x: Math.cos(a) * R,
        z: Math.sin(a) * R,
        ry: -a + Math.PI / 2,
        h: i % 3 === 0 ? 18 : 13,
        temple: i % 4 === 0,
      });
    }
    return items;
  }, []);

  return (
    <group>
      <mesh geometry={skyGeo}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
      </mesh>

      {/* Low-poly PS1 Moon */}
      <group position={[-45, 92, -175]}>
        <mesh>
          <dodecahedronGeometry args={[11, 0]} />
          <meshBasicMaterial color={mood === 'arena' ? '#ffe0b8' : '#f4ecd2'} fog={false} />
        </mesh>
        <mesh rotation={[0.2, 0.3, 0]}>
          <ringGeometry args={[13.5, 16.5, 10]} />
          <meshBasicMaterial color={mood === 'arena' ? '#ffc95c' : '#a78bfa'} transparent opacity={0.18} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      {/* Distant low-poly Colosseum / Aqueduct horizon silhouettes */}
      <group>
        {aqueducts.map((s, i) => (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.ry, 0]}>
            <mesh position={[0, s.h / 2, 0]}>
              <boxGeometry args={[22, s.h, 5]} />
              <meshBasicMaterial color={mood === 'arena' ? '#170c1c' : '#110c24'} />
            </mesh>
            {s.temple && (
              <mesh position={[0, s.h + 4, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[14, 8, 4]} />
                <meshBasicMaterial color={mood === 'arena' ? '#1f1022' : '#171030'} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Chunky faceted PS1 bronze & stone fire brazier with animated low-poly flame cones. */
export function Brazier({
  position,
  scale = 1,
  light = false,
  color = '#ff8a2b',
}: {
  position: [number, number, number];
  scale?: number;
  light?: boolean;
  color?: string;
}) {
  const f1 = useRef<THREE.Mesh>(null!);
  const f2 = useRef<THREE.Mesh>(null!);
  const f3 = useRef<THREE.Mesh>(null!);
  const pt = useRef<THREE.PointLight>(null!);

  const mats = useMemo(() => ({
    stone: makePs1Material({ color: '#d0c6de', map: getPs1Texture('stone') }),
    bronze: makePs1Material({ color: '#ffdd99', map: getPs1Texture('bronze') }),
    coal: makePs1Material({ color: '#5a1b0f', emissive: '#ff5114', emissiveIntensity: 0.75 }),
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + position[0] * 0.37 + position[2] * 0.21;
    const flick = 0.88 + Math.sin(t * 14) * 0.1 + Math.cos(t * 23) * 0.08;
    if (f1.current) { f1.current.scale.set(1, flick, 1); f1.current.rotation.y = t * 1.4; }
    if (f2.current) { f2.current.scale.set(1, 0.92 + Math.cos(t * 19) * 0.14, 1); f2.current.rotation.y = -t * 1.9; }
    if (f3.current) { f3.current.scale.set(1, 0.9 + Math.sin(t * 27) * 0.16, 1); }
    if (pt.current) pt.current.intensity = 18 * flick;
  });

  return (
    <group position={position} scale={scale}>
      {/* Stone pedestal */}
      <mesh position={[0, 0.35, 0]} material={mats.stone}>
        <cylinderGeometry args={[0.42, 0.56, 0.7, 6]} />
      </mesh>
      {/* Bronze fire bowl */}
      <mesh position={[0, 0.88, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.68, 0.34, 0.42, 6]} />
      </mesh>
      {/* Glowing coal bed */}
      <mesh position={[0, 1.06, 0]} material={mats.coal}>
        <cylinderGeometry args={[0.52, 0.48, 0.1, 6]} />
      </mesh>
      {/* Faceted low-poly flames */}
      <mesh ref={f1} position={[0, 1.48, 0]}>
        <coneGeometry args={[0.42, 0.92, 5]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={f2} position={[0.05, 1.42, -0.04]}>
        <coneGeometry args={[0.26, 0.74, 4]} />
        <meshBasicMaterial color="#ffc95c" />
      </mesh>
      <mesh ref={f3} position={[-0.04, 1.32, 0.05]}>
        <coneGeometry args={[0.15, 0.52, 4]} />
        <meshBasicMaterial color="#fff6c7" />
      </mesh>
      {light && <pointLight ref={pt} position={[0, 2.2, 0]} color="#ff9d42" intensity={18} distance={26} decay={1.4} />}
    </group>
  );
}
