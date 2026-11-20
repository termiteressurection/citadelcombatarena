import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../three/SpriteText';
import type { Thought } from './types';
import { sphereDrop } from './RebuiltWorldShared';

export type ThoughtCategory = 'seed' | 'reply' | 'mood' | 'monolith' | 'gem';

export function getThoughtCategory(t: Thought): ThoughtCategory {
  if (t.type === 'orb' || t.isRefined) return 'mood'; // Refined Orbs use MoodOrb component
  if (t.type === 'monolith' || (t.pinned && t.text.length > 500)) return 'monolith';
  if (t.type === 'gem' || t.text.length > 200) return 'gem';
  if (t.type === 'seed') return 'seed';
  if (t.type === 'scroll' || t.replyTo) return 'reply';
  if (t.mood) return 'mood';
  return 'gem';
}

export function ThoughtGem({
  thought,
  position,
  playerPos,
}: {
  thought: Thought;
  position: [number, number, number];
  playerPos: MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const ageDays = useMemo(() => {
    const ms = Date.now() - new Date(thought.timestamp).getTime();
    return Math.floor(ms / 86400000);
  }, [thought.timestamp]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const drop = sphereDrop(position[0] - pp.x, position[2] - pp.z);
    ref.current.position.y = position[1] + Math.sin(t * 0.7 + position[0] + position[2]) * 0.2 - drop;
    ref.current.children[0].rotation.y = t * 0.5 + position[0];
    ref.current.children[0].rotation.x = t * 0.3;
  });

  const preview = thought.text.length > 28 ? thought.text.slice(0, 28) + '...' : thought.text;
  const gemColor = hovered ? 0xfbbf24 : ageDays > 30 ? 0xfbbf24 : ageDays > 7 ? 0xec4899 : 0xa855f7;
  const gemOpacity = hovered ? 0.95 : Math.max(0.4, 0.7 - ageDays * 0.003);

  return (
    <group ref={ref} position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh>
        <octahedronGeometry args={[0.45, 0]} />
        <meshBasicMaterial color={gemColor} wireframe={!hovered} transparent opacity={gemOpacity} />
      </mesh>
      <mesh>
        <tetrahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={hovered ? 0.45 : 0.15} />
      </mesh>
      {hovered && (
        <SpriteText position={[0, 1.2, 0]} fontSize={0.28} color="#d8b4fe" outlineWidth={0.025} outlineColor="#0a0414" maxWidth={5}>
          {preview}
        </SpriteText>
      )}
    </group>
  );
}

export function ThoughtScroll({
  thought,
  position,
  playerPos,
}: {
  thought: Thought;
  position: [number, number, number];
  playerPos: MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const drop = sphereDrop(position[0] - pp.x, position[2] - pp.z);
    ref.current.position.y = position[1] + Math.sin(t * 0.5 + position[0]) * 0.1 - drop;
    ref.current.children[0].rotation.y = t * 0.3;
  });

  const preview = thought.text.length > 28 ? thought.text.slice(0, 28) + '...' : thought.text;

  return (
    <group ref={ref} position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh>
        <cylinderGeometry args={[0.18, 0.18, 0.7, 8]} />
        <meshBasicMaterial color={0xc4b5fd} wireframe={!hovered} transparent opacity={hovered ? 0.85 : 0.55} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 6]} />
        <meshBasicMaterial color={0x8b5cf6} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 6]} />
        <meshBasicMaterial color={0x8b5cf6} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.5, 3]} />
        <meshBasicMaterial color={0xc084fc} transparent opacity={0.25} />
      </mesh>
      {hovered && (
        <>
          <SpriteText position={[0, 1.2, 0]} fontSize={0.28} color="#c4b5fd" outlineWidth={0.025} outlineColor="#0a0414" maxWidth={5}>
            {preview}
          </SpriteText>
          <SpriteText position={[0, 0.85, 0]} fontSize={0.16} color="#a78bfa" outlineWidth={0.015} outlineColor="#0a0414" maxWidth={5}>
            ↩ reply
          </SpriteText>
        </>
      )}
    </group>
  );
}

export function MoodOrb({
  thought,
  position,
  playerPos,
}: {
  thought: Thought;
  position: [number, number, number];
  playerPos: MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const orbColor = useMemo(() => {
    const m = (thought.mood ?? '').toLowerCase();
    if (m.includes('😊') || m.includes('happy') || m.includes('joy')) return 0xfbbf24;
    if (m.includes('😢') || m.includes('sad')) return 0x6366f1;
    if (m.includes('😠') || m.includes('angry') || m.includes('mad')) return 0xef4444;
    if (m.includes('😴') || m.includes('calm') || m.includes('peace')) return 0x22d3ee;
    if (m.includes('😰') || m.includes('anxious') || m.includes('worry')) return 0xf97316;
    if (m.includes('❤') || m.includes('love')) return 0xf472b6;
    return 0xc084fc;
  }, [thought.mood]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const drop = sphereDrop(position[0] - pp.x, position[2] - pp.z);
    ref.current.position.y = position[1] + Math.sin(t * 0.8 + position[2]) * 0.25 - drop;
    const pulse = 1.0 + Math.sin(t * 1.5) * 0.08;
    ref.current.scale.setScalar(pulse);
  });

  const preview = thought.text.length > 28 ? thought.text.slice(0, 28) + '...' : thought.text;

  return (
    <group ref={ref} position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh>
        <dodecahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={orbColor} transparent opacity={hovered ? 0.9 : 0.65} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={orbColor} wireframe transparent opacity={0.18} />
      </mesh>
      <pointLight color={orbColor} intensity={0.6} distance={4} />
      <SpriteText position={[0, 0.7, 0]} fontSize={0.35} color="#ffffff" maxWidth={1}>
        {thought.mood ?? ''}
      </SpriteText>
      {hovered && (
        <SpriteText position={[0, 1.3, 0]} fontSize={0.28} color="#e9d5ff" outlineWidth={0.025} outlineColor="#0a0414" maxWidth={5}>
          {preview}
        </SpriteText>
      )}
    </group>
  );
}
import { applyTermiteseGlitch } from '@/features/sigma/termiteseGlitch';

export function ThoughtMonolith({
  thought,
  position,
  playerPos,
}: {
  thought: Thought;
  position: [number, number, number];
  playerPos: MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Compute a stable Termitesse representation of the thought on mount
  const termiteseText = useMemo(() => {
    return applyTermiteseGlitch(thought.text, 0); // 0 = maximum glitch (pure Termitesse)
  }, [thought.text]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    
    // Apply local wave/drop physics
    const drop = sphereDrop(position[0] - pp.x, position[2] - pp.z);
    ref.current.position.y = position[1] - 0.3 - drop + Math.sin(t * 1.8 + position[0]) * 0.08;

    // Billboard rotation: Face the camera/player on the Y-axis
    const targetPos = new THREE.Vector3(pp.x, ref.current.position.y, pp.z);
    ref.current.lookAt(targetPos);
  });

  const preview = thought.text.length > 80 ? thought.text.slice(0, 80) + '...' : thought.text;
  const glitchedPreview = termiteseText.length > 80 ? termiteseText.slice(0, 80) + '...' : termiteseText;

  return (
    <group
      ref={ref}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 2.5D Holographic Screen Background */}
      <mesh>
        <planeGeometry args={[2.8, 0.9]} />
        <meshBasicMaterial
          color={hovered ? 0x2e1065 : 0x0f051d}
          transparent
          opacity={hovered ? 0.9 : 0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Holographic glowing wireframe border */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[2.82, 0.92]} />
        <meshBasicMaterial
          color={hovered ? 0xd8b4fe : 0x4c1d95}
          wireframe
          transparent
          opacity={hovered ? 0.95 : 0.4}
        />
      </mesh>

      {/* Grid pattern aesthetic inside screen */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[2.75, 0.85]} />
        <meshBasicMaterial
          color={hovered ? 0x7c3aed : 0x3b0764}
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>

      <pointLight
        color={hovered ? 0xd8b4fe : 0x7c3aed}
        intensity={hovered ? 0.85 : 0.35}
        distance={4}
        position={[0, 0.2, 0.2]}
      />

      {/* Plain English Player Inscription Text */}
      <SpriteText
        position={[0, 0, 0.01]}
        fontSize={0.16}
        color={hovered ? "#fbbf24" : "#f5f3ff"}
        maxWidth={2.6}
      >
        {preview}
      </SpriteText>
    </group>
  );
}
