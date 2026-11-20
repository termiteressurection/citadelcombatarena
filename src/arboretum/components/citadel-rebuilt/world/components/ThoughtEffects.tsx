import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../../RebuiltWorldShared';
import SpriteText from '../../../three/SpriteText';
import { Thought, Chamber } from '../../types';
import { summarizeThoughtText } from '../../calendarChamberUtils';
import { applyTermiteseGlitch } from '@/features/sigma/termiteseGlitch';

export function formatThoughtDisplay(thought?: Thought | null, text?: string): string {
  const content = text ?? thought?.text ?? '';
  if (!thought) return content;
  const tags = thought.tags || [];
  if (tags.includes('sigma-chat') || tags.includes('non-inscription') || tags.includes('ai-response') || tags.includes('system') || tags.includes('derived-mindmap')) {
    return applyTermiteseGlitch(content, 0);
  }
  return content;
}

export type WorldVFXEvent = {
  id: number;
  type: 'write' | 'pin' | 'tag' | 'reply' | 'mood' | 'wormhole' | 'seal' | 'upgrade' | 'bookmark' | 'delete' | 'mindmap' | 'merge' | 'template' | 'teleport';
  time: number;
};

export function EchoThoughts({ thoughts, playerPos }: { thoughts: Thought[]; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  // Pick up to 3 oldest thoughts as echoes
  const echoes = useMemo(() => {
    if (thoughts.length < 4) return [];
    return [...thoughts]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, 3)
      .map((t, i) => ({
        text: formatThoughtDisplay(t, t.text.slice(0, 30) + (t.text.length > 30 ? '...' : '')),
        angle: (i / 3) * Math.PI * 2 + Math.PI / 6,
        radius: 22 + i * 4,
        y: 8 + i * 2,
      }));
  }, [thoughts]);

  if (echoes.length === 0) return null;

  return (
    <group>
      {echoes.map((echo, i) => (
        <EchoText key={i} echo={echo} playerPos={playerPos} index={i} />
      ))}
    </group>
  );
}

function EchoText({ echo, playerPos, index }: {
  echo: { text: string; angle: number; radius: number; y: number };
  playerPos: React.MutableRefObject<THREE.Vector3>;
  index: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const angle = echo.angle + t * 0.02;
    const x = Math.cos(angle) * echo.radius;
    const z = Math.sin(angle) * echo.radius;
    const pp = playerPos.current;
    const drop = sphereDrop(x - pp.x, z - pp.z);
    ref.current.position.set(x, echo.y + Math.sin(t * 0.3 + index) * 0.5 - drop, z);
  });

  return (
    <group ref={ref}>
      <SpriteText position={[0, 0, 0]} fontSize={0.22} color="rgba(168, 133, 247, 0.15)" outlineWidth={0} maxWidth={6}>
        {echo.text}
      </SpriteText>
    </group>
  );
}

export function MilestoneEffect({ thoughtCount, playerPos }: { thoughtCount: number; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const milestones = [10, 25, 50, 100, 250, 500];
  const currentMilestone = milestones.filter(m => thoughtCount >= m).pop();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current || !currentMilestone) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    ref.current.position.set(0, 12 + Math.sin(t * 0.5) * 1 - sphereDrop(-pp.x, -pp.z), 0);
    ref.current.rotation.y = t * 0.2;
    ref.current.rotation.x = t * 0.1;
    const scale = 0.8 + Math.log2(currentMilestone / 10 + 1) * 0.3;
    ref.current.scale.setScalar(scale);
  });

  if (!currentMilestone) return null;

  return (
    <mesh ref={ref} position={[0, 12, 0]}>
      <tetrahedronGeometry args={[1.8, 0]} />
      <meshBasicMaterial color={0xfbbf24} wireframe transparent opacity={0.25} />
    </mesh>
  );
}

export function TownSquareThoughts({ entries, playerPos }: {
  entries: Array<{ chamber: Chamber; thought: Thought }>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const walkers = useMemo(() => entries.slice(-32).map((entry, index) => ({
    id: entry.thought.id,
    chamberName: entry.chamber.name,
    label: formatThoughtDisplay(entry.thought, summarizeThoughtText(entry.thought.text, 30)),
    radius: 12 + (index % 4) * 6,
    speed: 0.08 + (index % 5) * 0.01,
    phase: (index / Math.max(entries.length, 1)) * Math.PI * 2,
    height: 1.4 + (index % 3) * 0.18,
    color:
      (entry.thought.stressScore ?? 0) >= 60 ? 0xfb7185
        : (entry.thought.stressScore ?? 0) >= 40 ? 0xfbbf24
        : 0x67e8f9,
  })), [entries]);
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    walkers.forEach((walker, index) => {
      const ref = refs.current[index];
      if (!ref) return;
      const angle = walker.phase + t * walker.speed;
      const x = Math.cos(angle) * walker.radius;
      const z = Math.sin(angle) * walker.radius;
      const stride = Math.sin(t * 4 + index) * 0.08;
      ref.position.set(x, walker.height - sphereDrop(x - pp.x, z - pp.z), z);
      ref.rotation.y = angle + Math.PI * 0.5;
      ref.position.y += stride;
    });
  });

  if (walkers.length === 0) return null;

  return (
    <group>
      {walkers.map((walker, index) => (
        <group
          key={walker.id}
          ref={(node) => { refs.current[index] = node; }}
        >
          <mesh position={[0, 0.55, 0]}>
            <octahedronGeometry args={[0.24, 0]} />
            <meshBasicMaterial color={walker.color} wireframe transparent opacity={0.65} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <torusGeometry args={[0.32, 0.012, 4, 18]} />
            <meshBasicMaterial color={walker.color} wireframe transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshBasicMaterial color={walker.color} transparent opacity={0.88} />
          </mesh>
          <SpriteText position={[0, 2.0, 0]} fontSize={0.18} color="#f8fafc" outlineWidth={0.02} outlineColor="#0a0414" maxWidth={4}>
            {walker.label}
          </SpriteText>
          <SpriteText position={[0, 1.6, 0]} fontSize={0.12} color="#67e8f9" outlineWidth={0.02} outlineColor="#0a0414">
            {walker.chamberName}
          </SpriteText>
        </group>
      ))}
    </group>
  );
}

export function ConstellationStories({ chambers, playerPos }: {
  chambers: Record<number, Chamber>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  // Map chamber IDs to sky positions on the dome
  const { stars, lines } = useMemo(() => {
    const chamberList = Object.values(chambers);
    const posMap: Record<number, THREE.Vector3> = {};
    const domeR = 160;
    chamberList.forEach((ch, i) => {
      const phi = (ch.id * 137.5 % 360) * (Math.PI / 180); // golden angle spread
      const theta = 0.2 + (ch.depth * 0.15); // higher depth = lower on dome
      const x = domeR * Math.sin(theta) * Math.cos(phi);
      const y = domeR * Math.cos(theta);
      const z = domeR * Math.sin(theta) * Math.sin(phi);
      posMap[ch.id] = new THREE.Vector3(x, y, z);
    });
    // Collect wormhole edges
    const edgeSet = new Set<string>();
    const linesList: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
    for (const ch of chamberList) {
      for (const whId of (ch.wormholes || [])) {
        const key = [Math.min(ch.id, whId), Math.max(ch.id, whId)].join('-');
        if (!edgeSet.has(key) && posMap[whId]) {
          edgeSet.add(key);
          linesList.push({ from: posMap[ch.id], to: posMap[whId] });
        }
      }
    }
    return { stars: Object.entries(posMap).map(([id, pos]) => ({ id: Number(id), pos })), lines: linesList };
  }, [chambers]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(playerPos.current.x, 0, playerPos.current.z);
  });

  if (stars.length <= 1) return null;

  return (
    <group ref={groupRef}>
      {/* Stars */}
      {stars.map(({ id, pos }) => (
        <mesh key={`star-${id}`} position={pos}>
          <octahedronGeometry args={[0.6, 0]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.15} />
        </mesh>
      ))}
      {/* Constellation lines */}
      {lines.map((line, i) => {
        const points = [line.from, line.to];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <lineSegments key={`cline-${i}`} geometry={geometry}>
            <lineBasicMaterial color={0xfbbf24} transparent opacity={0.12} />
          </lineSegments>
        );
      })}
    </group>
  );
}

export const VFX_PROFILES: Record<string, { color: number; count: number; speed: number; shape: 'sphere' | 'ring' | 'column' | 'spiral' | 'shatter'; life: number }> = {
  write:    { color: 0xa855f7, count: 24,  speed: 4,   shape: 'sphere',  life: 2.0 },
  pin:      { color: 0xfbbf24, count: 16,  speed: 6,   shape: 'column',  life: 1.8 },
  tag:      { color: 0x34d399, count: 20,  speed: 3,   shape: 'spiral',  life: 2.2 },
  reply:    { color: 0xc4b5fd, count: 18,  speed: 3.5, shape: 'ring',    life: 2.0 },
  mood:     { color: 0xf472b6, count: 30,  speed: 2.5, shape: 'sphere',  life: 2.5 },
  wormhole: { color: 0x22d3ee, count: 40,  speed: 8,   shape: 'spiral',  life: 3.0 },
  seal:     { color: 0x06b6d4, count: 20,  speed: 5,   shape: 'ring',    life: 2.0 },
  upgrade:  { color: 0xf59e0b, count: 50,  speed: 6,   shape: 'column',  life: 3.0 },
  bookmark: { color: 0xfbbf24, count: 12,  speed: 3,   shape: 'ring',    life: 1.5 },
  delete:   { color: 0xef4444, count: 28,  speed: 7,   shape: 'shatter', life: 2.0 },
  mindmap:  { color: 0x8b5cf6, count: 45,  speed: 5,   shape: 'spiral',  life: 3.0 },
  merge:    { color: 0xec4899, count: 35,  speed: 6,   shape: 'sphere',  life: 2.5 },
  template: { color: 0x7c3aed, count: 36,  speed: 4,   shape: 'column',  life: 2.5 },
};

export function CommandVFX({ event, playerPos }: { event: WorldVFXEvent; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const profile = VFX_PROFILES[event.type] ?? VFX_PROFILES.write;
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(-1);
  const [alive, setAlive] = useState(true);

  const particles = useMemo(() => {
    const arr: { pos: THREE.Vector3; vel: THREE.Vector3; size: number }[] = [];
    for (let i = 0; i < profile.count; i++) {
      const t = i / profile.count;
      let vx = 0, vy = 0, vz = 0;
      switch (profile.shape) {
        case 'sphere': {
          const phi = Math.acos(1 - 2 * Math.random());
          const theta = Math.random() * Math.PI * 2;
          vx = Math.sin(phi) * Math.cos(theta) * profile.speed;
          vy = Math.sin(phi) * Math.sin(theta) * profile.speed * 0.6 + 2;
          vz = Math.cos(phi) * profile.speed;
          break;
        }
        case 'ring': {
          const angle = t * Math.PI * 2;
          vx = Math.cos(angle) * profile.speed;
          vy = 1.5 + Math.random() * 1.5;
          vz = Math.sin(angle) * profile.speed;
          break;
        }
        case 'column': {
          const r = 0.3 + Math.random() * 0.8;
          const a = Math.random() * Math.PI * 2;
          vx = Math.cos(a) * r;
          vy = profile.speed * (0.5 + Math.random());
          vz = Math.sin(a) * r;
          break;
        }
        case 'spiral': {
          const sa = t * Math.PI * 6;
          const sr = 1 + t * 3;
          vx = Math.cos(sa) * sr * 0.8;
          vy = 2 + t * profile.speed;
          vz = Math.sin(sa) * sr * 0.8;
          break;
        }
        case 'shatter': {
          vx = (Math.random() - 0.5) * profile.speed * 2;
          vy = Math.random() * profile.speed;
          vz = (Math.random() - 0.5) * profile.speed * 2;
          break;
        }
      }
      arr.push({
        pos: new THREE.Vector3(0, 0.5, 0),
        vel: new THREE.Vector3(vx, vy, vz),
        size: 0.06 + Math.random() * 0.08,
      });
    }
    return arr;
  }, [profile]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !alive) return;
    if (startTime.current < 0) startTime.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startTime.current;
    if (elapsed > profile.life) { setAlive(false); return; }
    const progress = elapsed / profile.life;
    const fade = 1 - progress * progress; // quadratic fadeout
    const dt = 0.016;
    groupRef.current.children.forEach((mesh, i) => {
      const p = particles[i];
      if (!p) return;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
      p.vel.y -= 3 * dt; // gravity
      mesh.position.copy(p.pos);
      const s = p.size * fade;
      mesh.scale.setScalar(Math.max(s, 0.001));
      ((mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = fade * 0.8;
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.pos.x, p.pos.y, p.pos.z]}>
          {profile.shape === 'ring' || profile.shape === 'spiral' ? (
            <octahedronGeometry args={[p.size, 0]} />
          ) : profile.shape === 'shatter' ? (
            <tetrahedronGeometry args={[p.size * 1.5, 0]} />
          ) : (
            <octahedronGeometry args={[p.size, 0]} />
          )}
          <meshBasicMaterial color={profile.color} transparent opacity={0.8} />
        </mesh>
      ))}
      <pointLight color={profile.color} intensity={2} distance={12} position={[0, 1.5, 0]} />
    </group>
  );
}
