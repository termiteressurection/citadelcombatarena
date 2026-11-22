import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCurvedBasicMaterial } from './curvature';
import { getPs1Texture, makePs1Material } from './ps1Textures';

export type SkyMood = 'ludus' | 'arena' | 'town_morning' | 'town_dusk' | 'city_cycle' | 'city_purge';

/** Quantized low-poly PS1 TRON megacity sky dome with digital processor disc & distant skyline spires. */
export function Ps1Sky({ mood = 'city_cycle' }: { mood?: SkyMood }) {
  const skyGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(320, 20, 10);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const isMorning = mood === 'town_morning';
    const isPurge = mood === 'city_purge';
    const isCity = mood === 'city_cycle' || isPurge;

    const zenith = new THREE.Color(isMorning ? '#1b254a' : isCity ? '#04030d' : '#080614');
    const mid = new THREE.Color(
      isMorning ? '#49588a' : isPurge ? '#240b38' : isCity ? '#0c163a' : mood === 'arena' ? '#211132' : '#181332',
    );
    const horizon = new THREE.Color(
      isMorning ? '#c2845e' : isPurge ? '#8c184c' : isCity ? '#145a78' : mood === 'arena' ? '#5a2b2c' : '#2f204e',
    );
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp(y / 320, 0, 1);
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

  const isMorning = mood === 'town_morning';
  const isPurge = mood === 'city_purge';
  const isCity = mood === 'city_cycle' || isPurge;

  const silColor = isPurge ? '#140822' : isCity ? '#091026' : mood === 'arena' ? '#170c1c' : '#110c24';
  const rimColor = isPurge ? '#ff4fd8' : isCity ? '#3ff0ff' : '#a78bfa';
  const coreColor = isMorning ? '#ffe9a6' : isPurge ? '#ff6b8b' : isCity ? '#8cf6ff' : '#f4ecd2';
  const haloColor = isPurge ? '#ff4fd8' : isCity ? '#3ff0ff' : '#ffc95c';

  const towers = useMemo(() => {
    const items: { x: number; z: number; ry: number; h: number; w: number; spire: boolean }[] = [];
    const N = 32;
    const R = 185;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      items.push({
        x: Math.cos(a) * R,
        z: Math.sin(a) * R,
        ry: -a + Math.PI / 2,
        h: 22 + ((i * 19) % 44),
        w: 14 + ((i * 7) % 10),
        spire: i % 3 === 0,
      });
    }
    return items;
  }, []);

  return (
    <group>
      <mesh geometry={skyGeo}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
      </mesh>

      {/* Pixelated Digital Processor Sun / System Core */}
      <group position={isPurge ? [-62, 86, -210] : [58, 92, -210]}>
        <mesh>
          <octahedronGeometry args={[14, 0]} />
          <meshBasicMaterial color={coreColor} fog={false} />
        </mesh>
        <mesh rotation={[0.25, 0.25, 0]}>
          <ringGeometry args={[18, 22, 8]} />
          <meshBasicMaterial color={haloColor} transparent opacity={0.34} side={THREE.DoubleSide} fog={false} />
        </mesh>
        <mesh rotation={[-0.2, 0.6, 0]}>
          <ringGeometry args={[25, 27, 12]} />
          <meshBasicMaterial color={rimColor} transparent opacity={0.22} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      {/* Distant Night City Megatower Skyline Ring */}
      <group>
        {towers.map((s, i) => (
          <group key={i} position={[s.x, -26, s.z]} rotation={[0, s.ry, 0]}>
            <mesh position={[0, s.h / 2, 0]}>
              <boxGeometry args={[s.w, s.h, 6]} />
              <meshBasicMaterial color={silColor} fog={false} />
            </mesh>
            <mesh position={[0, s.h - 2, 3.05]}>
              <boxGeometry args={[s.w * 0.72, 0.9, 0.3]} />
              <meshBasicMaterial color={i % 2 === 0 ? rimColor : '#ffc95c'} fog={false} />
            </mesh>
            {s.spire && (
              <mesh position={[0, s.h + 8, 0]}>
                <cylinderGeometry args={[0.15, 0.6, 16, 4]} />
                <meshBasicMaterial color={rimColor} fog={false} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Glowing PS1 Neon Plasma Pylon replacing ancient braziers, automatically conforming to horizon curvature. */
export function Brazier({
  position,
  scale = 1,
  light = false,
  color = '#3ff0ff',
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
    stone: makePs1Material({ color: '#1b1d36', map: getPs1Texture('conduit') }),
    bronze: makePs1Material({ color: '#4d5d88', map: getPs1Texture('circuit') }),
    coal: makePs1Material({ color: '#16384d', emissive: color, emissiveIntensity: 0.95 }),
    flameOuter: makeCurvedBasicMaterial({ color }),
    flameMid: makeCurvedBasicMaterial({ color: color === '#3ff0ff' ? '#ff4fd8' : '#ffc95c' }),
    flameCore: makeCurvedBasicMaterial({ color: '#ffffff' }),
  }), [color]);

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
      <mesh position={[0, 0.42, 0]} material={mats.stone}>
        <cylinderGeometry args={[0.38, 0.56, 0.84, 4]} />
      </mesh>
      <mesh position={[0, 0.94, 0]} material={mats.bronze}>
        <cylinderGeometry args={[0.62, 0.34, 0.36, 4]} />
      </mesh>
      <mesh position={[0, 1.12, 0]} material={mats.coal}>
        <cylinderGeometry args={[0.46, 0.44, 0.1, 4]} />
      </mesh>
      <mesh ref={f1} position={[0, 1.56, 0]} material={mats.flameOuter}>
        <octahedronGeometry args={[0.38, 0]} />
      </mesh>
      <mesh ref={f2} position={[0.04, 1.5, -0.04]} material={mats.flameMid}>
        <octahedronGeometry args={[0.24, 0]} />
      </mesh>
      <mesh ref={f3} position={[-0.03, 1.42, 0.04]} material={mats.flameCore}>
        <octahedronGeometry args={[0.14, 0]} />
      </mesh>
      {light && <pointLight ref={pt} position={[0, 2.2, 0]} color={color} intensity={18} distance={28} decay={1.4} />}
    </group>
  );
}
