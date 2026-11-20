import { useRef, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from './art/SpriteText';
import { STATIONS, type Station } from './world/layout';

const Wire = ({ color, op = 0.9 }: { color: string; op?: number }) => (
  <meshBasicMaterial color={color} wireframe transparent opacity={op} />
);
const Dark = () => <meshBasicMaterial color="#0b051b" />;

function Gate({ s }: { s: Station }) {
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { ring.current.rotation.z = clock.elapsedTime * 0.8; });
  return (
    <group>
      {[-2.4, 2.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 3.2, 0]}><boxGeometry args={[1.2, 6.4, 1.2]} /><Dark /></mesh>
          <mesh position={[0, 3.2, 0]}><boxGeometry args={[1.28, 6.48, 1.28]} /><Wire color={s.color} /></mesh>
        </group>
      ))}
      <mesh position={[0, 6.8, 0]}><boxGeometry args={[6.6, 0.9, 1.3]} /><Dark /></mesh>
      <mesh position={[0, 6.8, 0]}><boxGeometry args={[6.7, 0.96, 1.36]} /><Wire color="#ffc95c" /></mesh>
      <mesh ref={ring} position={[0, 3.2, 0]}><torusGeometry args={[2.0, 0.06, 8, 48]} /><meshBasicMaterial color={s.color} /></mesh>
      <mesh position={[0, 3.2, 0]}>
        <circleGeometry args={[2.0, 40]} />
        <meshBasicMaterial color={s.color} transparent opacity={0.16} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Armory({ s }: { s: Station }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[3, 1, 1.2]} /><Dark /></mesh>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[3.06, 1.06, 1.26]} /><Wire color={s.color} /></mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 0.9, 2.1, 0]} rotation={[0, 0, i * 0.25]}>
          <boxGeometry args={[0.12, 2.2, 0.12]} /><Wire color="#e9e6ff" />
        </mesh>
      ))}
      <mesh position={[0, 2.0, -0.2]}><cylinderGeometry args={[0.7, 0.7, 0.08, 14]} /><Wire color={s.color} /></mesh>
    </group>
  );
}

function Shrine({ s }: { s: Station }) {
  const gem = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    gem.current.rotation.y = clock.elapsedTime * 0.9;
    gem.current.position.y = 2.7 + Math.sin(clock.elapsedTime * 1.4) * 0.2;
  });
  return (
    <group>
      {[1.7, 1.2, 0.7].map((r, i) => (
        <group key={r}>
          <mesh position={[0, 0.2 + i * 0.4, 0]}><cylinderGeometry args={[r, r + 0.15, 0.4, 8]} /><Dark /></mesh>
          <mesh position={[0, 0.2 + i * 0.4, 0]}><cylinderGeometry args={[r + 0.02, r + 0.17, 0.42, 8]} /><Wire color="#ffc95c" op={0.7} /></mesh>
        </group>
      ))}
      <mesh ref={gem} position={[0, 2.7, 0]}><octahedronGeometry args={[0.8, 0]} /><Wire color={s.color} /></mesh>
    </group>
  );
}

function Yard({ s }: { s: Station }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.6, 4.8, 48]} /><meshBasicMaterial color={s.color} transparent opacity={0.6} /></mesh>
      {[-2.5, 2.5].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.1, 0]}><boxGeometry args={[0.2, 2.2, 0.2]} /><Wire color="#ffc95c" /></mesh>
          <mesh position={[0, 1.7, 0]}><boxGeometry args={[1.3, 0.18, 0.18]} /><Wire color="#ffc95c" /></mesh>
          <mesh position={[0, 2.35, 0]}><icosahedronGeometry args={[0.32, 1]} /><Wire color={s.color} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Wall({ s }: { s: Station }) {
  return (
    <group>
      <mesh position={[0, 1.8, 0]}><boxGeometry args={[6, 3.6, 0.4]} /><Dark /></mesh>
      <mesh position={[0, 1.8, 0]}><boxGeometry args={[6.06, 3.66, 0.46]} /><Wire color={s.color} op={0.8} /></mesh>
      <mesh position={[0, 3.8, 0]} rotation={[0, 0, 0]}><coneGeometry args={[0.5, 0.8, 4]} /><Wire color="#ffc95c" /></mesh>
    </group>
  );
}

const BODY: Record<Station['id'], (p: { s: Station }) => JSX.Element> = { gate: Gate, armory: Armory, shrine: Shrine, yard: Yard, wall: Wall };

export function Stations() {
  return (
    <group>
      {STATIONS.map((s) => {
        const Body = BODY[s.id];
        return (
          <group key={s.id} position={[s.pos[0], 0, s.pos[1]]}>
            <Body s={s} />
            <SpriteText position={[0, s.id === 'gate' ? 8.6 : 5, 0]} fontSize={0.55} color={s.color} letterSpacing={0.1}>{s.label}</SpriteText>
          </group>
        );
      })}
    </group>
  );
}
