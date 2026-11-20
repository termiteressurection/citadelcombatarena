import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../../RebuiltWorldShared';
import SpriteText from '../../../three/SpriteText';
import { Thought, Chamber } from '../../types';
import { POOL_POSITIONS } from './WorldProps';
import { resolveBitLoreProfile } from '../bitLore';

export function AmbientCreatures({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const count = 4;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const creatures = useMemo(() => Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2,
    radius: 35 + i * 8,
    yBase: 6 + i * 2,
    speed: 0.08 + Math.random() * 0.05,
    wobble: Math.random() * Math.PI * 2,
  })), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    creatures.forEach((c, i) => {
      const angle = c.angle + t * c.speed;
      const x = Math.cos(angle) * c.radius;
      const z = Math.sin(angle) * c.radius;
      const y = c.yBase + Math.sin(t * 0.8 + c.wobble) * 2;
      const drop = sphereDrop(x - pp.x, z - pp.z);
      dummy.position.set(x, y - drop, z);
      dummy.rotation.set(t * 0.3 + i, t * 0.2, t * 0.1 + i);
      dummy.scale.setScalar(0.4 + Math.sin(t + i * 2) * 0.1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={0xf0abfc} wireframe transparent opacity={0.55} />
    </instancedMesh>
  );
}

export function ThoughtCreatures({ entries, playerPos }: {
  entries: Array<{ chamber: Chamber; thought: Thought }>;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const creatured = entries.filter(({ thought }) => {
    const age = (Date.now() - new Date(thought.timestamp).getTime()) / 86400000;
    return age > 3 && (thought.mood || thought.pinned || (thought.tags && thought.tags.length > 0));
  });
  const groupRef = useRef<THREE.Group>(null);
  const seeds = useMemo(() => creatured.map(({ chamber, thought }) => {
    const profile = resolveBitLoreProfile(thought, chamber);
    return {
      profile,
      radius: profile.orbitRadius,
      height: profile.orbitHeight,
      speed: 0.18 + (thought.id % 10) * 0.045,
      phase: (thought.id % 100) * 0.1,
      mood: thought.mood || '',
    };
  }), [creatured]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    groupRef.current.children.forEach((child, i) => {
      if (i >= seeds.length) return;
      const s = seeds[i];
      const angle = t * s.speed + s.phase;
      const x = Math.cos(angle) * s.radius;
      const z = Math.sin(angle) * s.radius;
      const y = s.height + Math.sin(t * 1.5 + s.phase) * 0.8;
      child.position.set(x, y - sphereDrop(x - pp.x, z - pp.z), z);
      child.rotation.y = t * 0.5;
    });
  });

  const getMoodTint = (mood: string): number | null => {
    if (mood.includes('😊') || mood.includes('happy') || mood.includes('😄')) return 0xfbbf24;
    if (mood.includes('😢') || mood.includes('sad')) return 0x6366f1;
    if (mood.includes('😠') || mood.includes('angry')) return 0xef4444;
    if (mood.includes('😴') || mood.includes('calm')) return 0x22d3ee;
    return null;
  };

  if (creatured.length === 0) return null;

  return (
    <group ref={groupRef}>
      {creatured.slice(0, 12).map(({ chamber, thought }, i) => {
        const profile = seeds[i]?.profile ?? resolveBitLoreProfile(thought, chamber);
        const moodTint = getMoodTint(thought.mood || '');
        const color = moodTint ?? profile.color;
        const isElite = profile.caste === 'elite';
        return (
          <group key={`creature-${thought.id}`} scale={profile.scale} userData={{ bitCaste: profile.caste, bitTitle: profile.title }}>
            <mesh>
              {profile.geometry === 'icosahedron'
                ? <icosahedronGeometry args={[0.2, 0]} />
                : profile.geometry === 'octahedron'
                  ? <octahedronGeometry args={[0.18, 0]} />
                  : <tetrahedronGeometry args={[0.2, 0]} />
              }
              <meshBasicMaterial color={color} wireframe={!isElite} transparent opacity={isElite ? 0.68 : 0.46} />
            </mesh>
            {isElite && <pointLight color={color} intensity={0.28} distance={4.5} />}
          </group>
        );
      })}
    </group>
  );
}

export function BitCasteMesh({
  caste = 'artisan',
  color = 0xa855f7,
  scale = 1,
}: {
  caste?: 'elite' | 'artisan' | 'laborer' | 'wanderer';
  color?: number;
  scale?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.x = clock.elapsedTime * 0.8;
      ringRef.current.rotation.y = clock.elapsedTime * 0.5;
    }
  });

  return (
    <group scale={scale}>
      {/* 1. Core geometric body based on caste */}
      {caste === 'elite' && (
        <mesh>
          <icosahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
        </mesh>
      )}
      {caste === 'artisan' && (
        <mesh>
          <octahedronGeometry args={[0.32, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
        </mesh>
      )}
      {caste === 'laborer' && (
        <mesh>
          <tetrahedronGeometry args={[0.3, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.75} />
        </mesh>
      )}
      {caste === 'wanderer' && (
        <mesh>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
        </mesh>
      )}

      {/* 2. Gyroscopic outer ring (The Bit citizen signature) */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.48, 0.015, 4, 24]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.65} />
      </mesh>

      {/* 3. Inner glowing nucleus */}
      <mesh scale={0.35}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export function EchoSelves({ thoughts, positions, playerPos }: {
  thoughts: Thought[];
  positions: [number, number, number][];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  // Show echoes for thoughts from >7 days ago
  const echoes = useMemo(() => {
    const now = Date.now();
    return thoughts
      .map((t, i) => ({ thought: t, pos: positions[i] }))
      .filter(({ thought, pos }) => pos && (now - new Date(thought.timestamp).getTime()) > 7 * 86400000)
      .slice(0, 5);
  }, [thoughts, positions]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    groupRef.current.children.forEach((child, i) => {
      if (i >= echoes.length) return;
      const e = echoes[i];
      const [x, , z] = e.pos;
      child.position.set(x + 2, 1.2 + Math.sin(t * 0.5 + i) * 0.2, z + 2);
      child.position.y -= sphereDrop(x + 2 - pp.x, z + 2 - pp.z);
    });
  });

  if (echoes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {echoes.map(({ thought }) => (
        <group key={`echo-${thought.id}`}>
          <BitCasteMesh caste="artisan" color={0xd8b4fe} scale={0.8} />
        </group>
      ))}
    </group>
  );
}

export function WanderingThoughts({ chambers, currentChamberId, playerPos }: {
  chambers: Record<number, Chamber>;
  currentChamberId: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const wanderer = useRef<{ text: string; chamberName: string; x: number; z: number; startTime: number; dx: number; dz: number } | null>(null);
  const textRef = useRef<THREE.Group>(null);
  const lastSpawn = useRef(0);

  const otherThoughts = useMemo(() => {
    const result: { text: string; chamberName: string }[] = [];
    for (const ch of Object.values(chambers)) {
      if (ch.id === currentChamberId) continue;
      for (const t of ch.thoughts) {
        result.push({ text: t.text.slice(0, 60), chamberName: ch.name });
      }
    }
    return result;
  }, [chambers, currentChamberId]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = playerPos.current;

    // Spawn a new wanderer every 45-90 seconds
    if (!wanderer.current && t - lastSpawn.current > 45 && otherThoughts.length > 0) {
      const pick = otherThoughts[Math.floor(Math.random() * otherThoughts.length)];
      const angle = Math.random() * Math.PI * 2;
      wanderer.current = {
        ...pick,
        x: pp.x + Math.cos(angle) * 20,
        z: pp.z + Math.sin(angle) * 20,
        startTime: t,
        dx: (Math.random() - 0.5) * 2,
        dz: (Math.random() - 0.5) * 2,
      };
      lastSpawn.current = t;
    }

    if (wanderer.current && textRef.current) {
      const w = wanderer.current;
      const elapsed = t - w.startTime;
      if (elapsed > 15) {
        wanderer.current = null;
        textRef.current.visible = false;
        return;
      }
      const fade = elapsed < 2 ? elapsed / 2 : elapsed > 13 ? (15 - elapsed) / 2 : 1;
      w.x += w.dx * 0.01;
      w.z += w.dz * 0.01;
      textRef.current.position.set(w.x, 4 - sphereDrop(w.x - pp.x, w.z - pp.z), w.z);
      textRef.current.visible = true;
      textRef.current.children.forEach(c => {
        if ((c as THREE.Mesh).material) {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = fade * 0.15;
        }
      });
    } else if (textRef.current) {
      textRef.current.visible = false;
    }
  });

  if (otherThoughts.length === 0) return null;

  return (
    <group ref={textRef} visible={false}>
      <SpriteText position={[0, 0, 0]} fontSize={0.3} color="#c084fc" outlineWidth={0} letterSpacing={0.02}>
        {wanderer.current?.text || ''}
      </SpriteText>
      <SpriteText position={[0, -0.5, 0]} fontSize={0.18} color="#7c3aed" outlineWidth={0} letterSpacing={0.02}>
        {wanderer.current ? `— ${wanderer.current.chamberName}` : ''}
      </SpriteText>
    </group>
  );
}

export function EnhancedWildlife({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const fireflies = useRef<THREE.InstancedMesh>(null);
  const birds = useRef<THREE.InstancedMesh>(null);
  const fish = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const FF_COUNT = 20;
  const BIRD_COUNT = 6;
  const FISH_COUNT = 8;

  const ffData = useMemo(() => Array.from({ length: FF_COUNT }, () => ({
    x: (Math.random() - 0.5) * 60, z: (Math.random() - 0.5) * 60,
    y: 2 + Math.random() * 5, phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.4,
  })), []);
  const birdData = useMemo(() => Array.from({ length: BIRD_COUNT }, (_, i) => ({
    angle: (i / BIRD_COUNT) * Math.PI * 2, radius: 40 + Math.random() * 20,
    y: 15 + Math.random() * 10, speed: 0.03 + Math.random() * 0.02,
  })), []);
  const fishData = useMemo(() => Array.from({ length: FISH_COUNT }, (_, i) => ({
    poolIdx: i % POOL_POSITIONS.length, angle: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.3, radius: 1 + Math.random(),
  })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour < 6;
    const isDusk = hour >= 17 && hour < 20;

    // Fireflies — visible at night
    if (fireflies.current) {
      ffData.forEach((ff, i) => {
        const alpha = isNight ? 0.6 : isDusk ? 0.2 : 0;
        const blink = Math.sin(t * ff.speed * 3 + ff.phase) > 0.3 ? 1 : 0.1;
        const x = ff.x + Math.sin(t * 0.1 + ff.phase) * 3;
        const z = ff.z + Math.cos(t * 0.08 + ff.phase) * 3;
        const drop = sphereDrop(x - pp.x, z - pp.z);
        dummy.position.set(x, ff.y + Math.sin(t * ff.speed + ff.phase) * 1.5 - drop, z);
        dummy.scale.setScalar(alpha * blink * 0.15);
        dummy.updateMatrix();
        fireflies.current!.setMatrixAt(i, dummy.matrix);
      });
      fireflies.current.instanceMatrix.needsUpdate = true;
    }
    // Birds — visible at dusk
    if (birds.current) {
      birdData.forEach((b, i) => {
        const alpha = isDusk ? 0.3 : isNight ? 0.15 : 0.05;
        const a = b.angle + t * b.speed;
        const x = Math.cos(a) * b.radius;
        const z = Math.sin(a) * b.radius;
        dummy.position.set(x, b.y + Math.sin(t * 0.5 + i) * 2, z);
        dummy.rotation.set(0, a + Math.PI / 2, Math.sin(t * 2 + i) * 0.3);
        dummy.scale.set(1.5, alpha > 0 ? 0.15 : 0, 1);
        dummy.updateMatrix();
        birds.current!.setMatrixAt(i, dummy.matrix);
      });
      birds.current.instanceMatrix.needsUpdate = true;
    }
    // Geometric fish — in tide pools
    if (fish.current) {
      const tide = Math.sin(t * 0.052) * 0.5 + 0.5;
      fishData.forEach((f, i) => {
        const pool = POOL_POSITIONS[f.poolIdx];
        const a = f.angle + t * f.speed;
        const x = pool[0] + Math.cos(a) * f.radius;
        const z = pool[2] + Math.sin(a) * f.radius;
        const drop = sphereDrop(x - pp.x, z - pp.z);
        dummy.position.set(x, -0.2 + tide * 0.5 - drop, z);
        dummy.rotation.set(0, a, 0);
        dummy.scale.setScalar(tide > 0.3 ? 0.2 : 0);
        dummy.updateMatrix();
        fish.current!.setMatrixAt(i, dummy.matrix);
      });
      fish.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={fireflies} args={[undefined, undefined, FF_COUNT]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
      </instancedMesh>
      <instancedMesh ref={birds} args={[undefined, undefined, BIRD_COUNT]}>
        <coneGeometry args={[1, 3, 3]} />
        <meshBasicMaterial color={0x7c3aed} transparent opacity={0.35} />
      </instancedMesh>
      <instancedMesh ref={fish} args={[undefined, undefined, FISH_COUNT]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={0x22d3ee} transparent opacity={0.4} />
      </instancedMesh>
    </>
  );
}

export const NPC_DEFS = [
  { name: 'The Archivist', color: 0xc084fc, caste: 'artisan' as const, pattern: 'circle' },
  { name: 'The Wanderer',  color: 0x34d399, caste: 'wanderer' as const, pattern: 'figure8' },
  { name: 'The Herald',    color: 0xfbbf24, caste: 'elite' as const,    pattern: 'linear' },
];

export function NPCWanderers({ playerPos, depth }: { playerPos: React.MutableRefObject<THREE.Vector3>; depth: number }) {
  const ref = useRef<THREE.Group>(null);
  // NPCs appear everywhere — root hub is a town square
  const visible = depth >= 0;
  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    NPC_DEFS.forEach((npc, i) => {
      const child = ref.current!.children[i];
      if (!child) return;
      let x = 0, z = 0;
      if (npc.pattern === 'circle') {
        const a = t * 0.08 + i * 2;
        x = Math.cos(a) * 20; z = Math.sin(a) * 20;
      } else if (npc.pattern === 'figure8') {
        const a = t * 0.06;
        x = Math.sin(a) * 18; z = Math.sin(a * 2) * 12;
      } else {
        x = Math.sin(t * 0.04) * 25; z = 15;
      }
      const drop = sphereDrop(x - pp.x, z - pp.z);
      child.position.set(x, 1.2 - drop, z);
      child.rotation.y = t * 0.3 + i;
    });
  });
  if (!visible) return null;
  return (
    <group ref={ref}>
      {NPC_DEFS.map((npc, i) => (
        <group key={`npc-${i}`}>
          <BitCasteMesh caste={npc.caste} color={npc.color} scale={0.9} />
          <SpriteText text={npc.name} position={[0, 0.9, 0]} fontSize={0.16} color="#c084fc" />
        </group>
      ))}
    </group>
  );
}

export const LORE_POSITIONS: [number, number, number][] = [
  [-25, 0, 15], [28, 0, -20], [10, 0, 30], [-18, 0, -28], [32, 0, 8],
];

export function LoreTerminals({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    ref.current.children.forEach((child, i) => {
      const pos = LORE_POSITIONS[i];
      if (!pos) return;
      const drop = sphereDrop(pos[0] - pp.x, pos[2] - pp.z);
      child.position.set(pos[0], 1 - drop, pos[2]);
      // Subtle glow pulse
      const mesh = child.children[0] as THREE.Mesh;
      if (mesh?.material) {
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t + i * 1.5) * 0.04;
      }
    });
  });
  return (
    <group ref={ref}>
      {LORE_POSITIONS.map((pos, i) => (
        <group key={`lore-${i}`} position={pos}>
          {/* Terminal pedestal */}
          <mesh>
            <boxGeometry args={[0.6, 1.2, 0.4]} />
            <meshBasicMaterial color={0x7c3aed} wireframe transparent opacity={0.15} />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0.4, 0.21]}>
            <planeGeometry args={[0.4, 0.3]} />
            <meshBasicMaterial color={0x34d399} transparent opacity={0.2} />
          </mesh>
          {/* Eye symbol on top */}
          <mesh position={[0, 0.8, 0]}>
            <torusGeometry args={[0.12, 0.03, 3, 4]} />
            <meshBasicMaterial color={0xfbbf24} transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
