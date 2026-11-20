import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { Chamber } from '../types';

export function TesseractPortal({ position, targetChamber, onEnter }: { position: [number, number, number]; targetChamber: Chamber; onEnter: () => void; }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (groupRef.current) groupRef.current.position.y = position[1] + Math.sin(t * 0.5 + position[0]) * 0.2;
    if (innerRef.current) { innerRef.current.rotation.x = t * 0.4; innerRef.current.rotation.y = t * 0.6; }
    if (outerRef.current) { outerRef.current.rotation.x = -t * 0.2; outerRef.current.rotation.y = -t * 0.35; }
    if (discRef.current) discRef.current.rotation.z = t * 0.8;
    if (coreRef.current) coreRef.current.scale.setScalar(0.9 + Math.sin(t * 1.5 + position[0]) * 0.1);
  });

  return (
    <group ref={groupRef} position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} onClick={onEnter}>
      {/* Void core — dark sphere at center */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.7, 8, 8]} />
        <meshBasicMaterial color={0x050005} transparent opacity={0.98} />
      </mesh>
      {/* Inner tesseract — bright wireframe */}
      <mesh ref={innerRef}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshBasicMaterial color={0xc084fc} wireframe transparent opacity={hovered ? 1 : 0.85} />
      </mesh>
      {/* Outer tesseract — visible wireframe boundary */}
      <mesh ref={outerRef}>
        <boxGeometry args={[3, 3, 3]} />
        <meshBasicMaterial color={0x7c3aed} wireframe transparent opacity={hovered ? 0.8 : 0.55} />
      </mesh>
      {/* Accretion disc — bright tilted ring */}
      <mesh ref={discRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[2.2, 0.08, 4, 16]} />
        <meshStandardMaterial color={0xec4899} emissive={0xec4899} emissiveIntensity={3} transparent opacity={0.85} />
      </mesh>
      {/* Second accretion ring — counter-angled */}
      <mesh rotation={[Math.PI / 2.5, Math.PI / 2, 0]}>
        <torusGeometry args={[2.5, 0.06, 4, 16]} />
        <meshStandardMaterial color={0xa855f7} emissive={0x7c3aed} emissiveIntensity={2.5} transparent opacity={0.7} />
      </mesh>
      {/* Event horizon glow — ground ring */}
      <mesh position={[0, -2.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.8, 3, 12]} />
        <meshBasicMaterial color={0x4c1d95} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <SpriteText position={[0, 3.2, 0]} fontSize={0.5} color="#d8b4fe" outlineWidth={0.04} outlineColor="#0a0414" renderOrder={10} depthTest={false}>
        {targetChamber.name.toUpperCase()}
      </SpriteText>
      <SpriteText position={[0, 2.5, 0]} fontSize={0.28} color="#c084fc" renderOrder={10} depthTest={false}>
        {`${targetChamber.thoughts.length} thoughts`}
      </SpriteText>
    </group>
  );
}
