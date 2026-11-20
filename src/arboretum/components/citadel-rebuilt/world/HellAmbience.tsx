// ─── ARES: Ambient geometry. Each element serves the atmosphere. Nothing is wasted. ───

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NEON_PINK = 0xec4899;
const LAVENDER = 0xc084fc;
const SOFT_CYAN = 0x34d399;
const CORAL = 0xf0abfc;
const MUTED_CRIMSON = 0x7c3aed;
const DARK_BLOOD = 0x4c1d95;
const DEEP_EMBER = 0xa855f7;
const ASHEN_RED = 0xd946ef;

/** Occult sigil — Ares: "Symbols have power. Each ring is deliberate." */
export function OccultCircle({ position = [0, 0.05, 0] as [number, number, number], radius = 6 }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.LineLoop>(null);

  const outerRing = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  const innerRing = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = radius * 0.7;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  const pentagram = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = radius * 0.55;
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI * 2) / 5 - Math.PI / 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    pts.push(pts[0].clone());
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  const runeMarks = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = radius * 0.85;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const inner = r - 0.3;
      const outer = r + 0.3;
      pts.push(new THREE.Vector3(Math.cos(a) * inner, 0, Math.sin(a) * inner));
      pts.push(new THREE.Vector3(Math.cos(a) * outer, 0, Math.sin(a) * outer));
      const cross = a + 0.15;
      pts.push(new THREE.Vector3(Math.cos(cross) * (r - 0.15), 0, Math.sin(cross) * (r - 0.15)));
      pts.push(new THREE.Vector3(Math.cos(cross) * (r + 0.15), 0, Math.sin(cross) * (r + 0.15)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.08;
    if (innerRef.current) innerRef.current.rotation.y = -clock.elapsedTime * 0.15;
  });

  return (
    <group position={position} ref={groupRef}>
      <lineLoop geometry={outerRing}>
        <lineBasicMaterial color={NEON_PINK} transparent opacity={0.7} />
      </lineLoop>
      <lineLoop ref={innerRef} geometry={innerRing}>
        <lineBasicMaterial color={SOFT_CYAN} transparent opacity={0.5} />
      </lineLoop>
      {/* @ts-expect-error R3F line vs SVG line */}
      <line geometry={pentagram}>
        <lineBasicMaterial color={LAVENDER} transparent opacity={0.6} />
      </line>
      <lineSegments geometry={runeMarks}>
        <lineBasicMaterial color={CORAL} transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}

/** Tentacle chain — Ares: "Organic forms are inherently inefficient. I made them precise." */
const SEGMENTS = 8;
function Tentacle({ position, height = 6, phase = 0 }: { position: [number, number, number]; height?: number; phase?: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const segLen = height / SEGMENTS;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    for (let i = 0; i < SEGMENTS; i++) {
      const g = refs.current[i];
      if (!g) continue;
      // Each joint bends more toward the tip — aggressive wiggle
      const strength = (i / SEGMENTS) * 0.7;
      const freq = 1.4 + i * 0.25;
      g.rotation.x = Math.sin(t * freq + i * 0.9) * strength + Math.sin(t * 3.2 + i * 2.0) * strength * 0.3;
      g.rotation.z = Math.cos(t * freq * 0.8 + i * 1.1) * strength * 0.9 + Math.cos(t * 2.5 + i * 1.7) * strength * 0.25;
    }
  });

  // Build a nested chain: each group holds a cylinder + the next group offset upward
  const buildChain = (idx: number): React.ReactNode => {
    if (idx >= SEGMENTS) return null;
    const taper = 1 - idx / SEGMENTS;
    const rBot = 0.4 * taper;
    const rTop = 0.4 * (1 - (idx + 1) / SEGMENTS);
    return (
      <group
        key={idx}
        ref={(el) => { refs.current[idx] = el; }}
        position={idx === 0 ? position : [0, segLen, 0]}
      >
        <mesh position={[0, segLen / 2, 0]}>
          <cylinderGeometry args={[Math.max(rTop, 0.04), Math.max(rBot, 0.04), segLen, 6, 1, true]} />
          <meshStandardMaterial color={0x0d0520} emissive={SOFT_CYAN} emissiveIntensity={0.5} wireframe transparent opacity={0.6} />
        </mesh>
        {/* Double-row suction cups, perpendicular to segment surface */}
        {[0.25, 0.55, 0.8].map((frac) => {
          const isBottom = idx < SEGMENTS / 2;
          const segRadius = Math.max(rBot, 0.04) + (Math.max(rTop, 0.04) - Math.max(rBot, 0.04)) * frac;
          const baseCupR = segRadius * (isBottom ? 0.3 : 0.5);
          // Two rows offset laterally along the segment
          return [-0.35, 0.35].map((rowOff) => {
            const cupR = baseCupR * (1 - Math.abs(rowOff) * 0.15);
            // Angle perpendicular outward from cylinder surface
            const angle = Math.PI * 0.5 + rowOff;
            const cx = Math.sin(angle) * segRadius * 0.95;
            const cz = Math.cos(angle) * segRadius * 0.95;
            return (
              <group
                key={`${frac}-${rowOff}`}
                position={[cx, segLen * frac, cz]}
                rotation={[0, -angle, Math.PI / 2]}
              >
                <mesh>
                  <torusGeometry args={[cupR, cupR * 0.25, 6, 8]} />
                  <meshStandardMaterial color={0x140828} emissive={SOFT_CYAN} emissiveIntensity={0.8} wireframe transparent opacity={0.5} />
                </mesh>
                <mesh>
                  <circleGeometry args={[cupR * 0.65, 6]} />
                  <meshStandardMaterial color={0x0a0418} emissive={SOFT_CYAN} emissiveIntensity={0.4} transparent opacity={0.3} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          });
        })}
        {buildChain(idx + 1)}
      </group>
    );
  };

  return <>{buildChain(0)}</>;
}

/** Tentacle cluster — Ares: "Five vectors of control. Optimal coverage." */
export function ElderTentacles({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Tentacle position={[0, 0, 0]} height={7} phase={0} />
      <Tentacle position={[0.8, 0, 0.5]} height={5} phase={1.2} />
      <Tentacle position={[-0.6, 0, 0.3]} height={6} phase={2.5} />
      <Tentacle position={[0.3, 0, -0.7]} height={4.5} phase={3.8} />
      <Tentacle position={[-0.4, 0, -0.5]} height={5.5} phase={5.1} />
    </group>
  );
}

/** Specter — Ares: "A presence that costs almost nothing to render. Efficient dread." */
export function WireframeSpecter({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.2;
    const mat = ref.current.children[0] as THREE.Mesh;
    if (mat?.material) (mat.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(t * 1.5) * 0.15;
  });
  return (
    <group ref={ref} position={position}>
      {/* Body */}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.25, 0.5, 3.5, 8, 3]} />
        <meshStandardMaterial color={0x1a0a30} emissive={LAVENDER} emissiveIntensity={0.4} wireframe transparent opacity={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 4.2, 0]}>
        <sphereGeometry args={[0.4, 6, 6]} />
        <meshStandardMaterial color={0x2d1660} emissive={NEON_PINK} emissiveIntensity={0.5} wireframe transparent opacity={0.35} />
      </mesh>
      {/* Eyes — emissive dots */}
      <mesh position={[0.12, 4.3, 0.3]}>
        <sphereGeometry args={[0.06, 4, 4]} />
        <meshStandardMaterial color={CORAL} emissive={CORAL} emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.12, 4.3, 0.3]}>
        <sphereGeometry args={[0.06, 4, 4]} />
        <meshStandardMaterial color={CORAL} emissive={CORAL} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/** Void sphere — Ares: "The icosahedron is the most efficient spherical approximation. I respect that." */
export function VoidSphere({ position = [0, 12, 0] as [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.x = t * 0.15;
    ref.current.rotation.y = t * 0.25;
    ref.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.08);
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.3;
      ringRef.current.rotation.x = Math.sin(t * 0.2) * 0.5;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[3, 0]} />
        <meshStandardMaterial color={0x0d0520} emissive={0x7c3aed} emissiveIntensity={0.6} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[4.5, 0.08, 6, 24]} />
        <meshStandardMaterial color={NEON_PINK} emissive={NEON_PINK} emissiveIntensity={1.2} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/** Obelisk — Ares: "Vertical authority. A single axis of power." */
export function RuneObelisk({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.4 + Math.sin(clock.elapsedTime * 1.2 + position[0]) * 0.3;
  });
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, 4, 0]}>
        <boxGeometry args={[0.6, 8, 0.6, 1, 4, 1]} />
        <meshStandardMaterial color={0x0d0520} emissive={LAVENDER} emissiveIntensity={0.4} wireframe />
      </mesh>
      <mesh position={[0, 8.3, 0]}>
        <tetrahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={0x1a0a30} emissive={CORAL} emissiveIntensity={1.5} wireframe />
      </mesh>
    </group>
  );
}

/** Ember particles — Ares: "Instanced. Minimal geometry. Maximum atmosphere." */
export function EmberParticles({ count = 40 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    pos: new THREE.Vector3((Math.random() - 0.5) * 50, Math.random() * 15, (Math.random() - 0.5) * 50),
    speed: Math.random() * 0.02 + 0.008,
    drift: (Math.random() - 0.5) * 0.015,
    phase: Math.random() * Math.PI * 2,
    scale: Math.random() * 0.1 + 0.03,
  })), [count]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      p.pos.y += p.speed;
      p.pos.x += Math.sin(t * 0.3 + p.phase) * p.drift;
      if (p.pos.y > 20) { p.pos.y = 0.2; p.pos.x = (Math.random() - 0.5) * 50; p.pos.z = (Math.random() - 0.5) * 50; }
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 3 + p.phase) * 0.5));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshStandardMaterial color={CORAL} emissive={NEON_PINK} emissiveIntensity={1} transparent opacity={0.7} />
    </instancedMesh>
  );
}

/** Blood mist — Ares: "Three cylinders. The illusion of depth at trivial cost." */
export function BloodMist({ position, height = 8 }: { position: [number, number, number]; height?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      child.position.y = (height / 2) + Math.sin(t * 0.3 + i * 1.7) * 1.5;
      (child as THREE.Mesh).scale.setScalar(1 + Math.sin(t * 0.5 + i) * 0.15);
    });
  });
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[Math.sin(i * 2.1) * 0.8, height / 2, Math.cos(i * 2.1) * 0.8]}>
          <cylinderGeometry args={[1.5 - i * 0.3, 0.8, height, 8, 2, true]} />
          <meshStandardMaterial color={DARK_BLOOD} emissive={MUTED_CRIMSON} emissiveIntensity={0.6} wireframe transparent opacity={0.15 + i * 0.05} />
        </mesh>
      ))}
    </group>
  );
}

/** Chains — Ares: "Constraint rendered as geometry. Five segments, minimal sway." */
export function DamnedChains({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      child.rotation.x = Math.sin(t * 0.4 + i * 0.9) * 0.08;
      child.rotation.z = Math.cos(t * 0.3 + i * 1.3) * 0.06;
    });
  });
  return (
    <group ref={ref} position={position}>
      {Array.from({ length: 5 }, (_, i) => {
        const x = (i - 2) * 0.7;
        const chainLen = 6 + Math.sin(i * 1.5) * 2;
        return (
          <mesh key={i} position={[x, 12 - chainLen / 2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, chainLen, 6, Math.floor(chainLen * 2)]} />
            <meshStandardMaterial color={ASHEN_RED} emissive={DARK_BLOOD} emissiveIntensity={0.8} wireframe transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Infernal rift — Ares: "A controlled fracture. Every vertex placed with purpose." */
export function InfernalRift({ position, length = 10 }: { position: [number, number, number]; length?: number }) {
  const ref = useRef<THREE.Group>(null);
  const riftGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const z = (i / segments - 0.5) * length;
      const x = Math.sin(i * 1.7) * 0.4 + Math.sin(i * 3.1) * 0.2;
      pts.push(new THREE.Vector3(x - 0.15, 0.02, z));
      pts.push(new THREE.Vector3(x + 0.15, 0.02, z));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [length]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.children[0] as THREE.LineSegments;
    if (mat?.material) {
      (mat.material as THREE.LineBasicMaterial).opacity = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <group ref={ref} position={position}>
      <lineSegments geometry={riftGeo}>
        <lineBasicMaterial color={DEEP_EMBER} transparent opacity={0.5} />
      </lineSegments>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, length]} />
        <meshStandardMaterial color={DARK_BLOOD} emissive={MUTED_CRIMSON} emissiveIntensity={1.2} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

/** Hellgate pillar — Ares: "Twisted geometry rotating at 0.1 rad/s. Economical menace." */
export function HellgatePillar({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.1;
  });
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.3, 0.6, 8, 6, 5, true]} />
        <meshStandardMaterial color={DARK_BLOOD} emissive={MUTED_CRIMSON} emissiveIntensity={0.5} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh ref={ref} position={[0, 8.5, 0]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={ASHEN_RED} emissive={DEEP_EMBER} emissiveIntensity={2} wireframe />
      </mesh>
    </group>
  );
}

/** Ground cracks — Ares: "Static line segments. Zero per-frame cost. Perfect." */
export function SmolderCracks({ position }: { position: [number, number, number] }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const r1 = 0.5 + Math.random() * 0.5;
      const r2 = r1 + 1 + Math.random() * 1.5;
      pts.push(new THREE.Vector3(Math.cos(angle) * r1, 0.02, Math.sin(angle) * r1));
      pts.push(new THREE.Vector3(Math.cos(angle + 0.1) * r2, 0.02, Math.sin(angle + 0.1) * r2));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <group position={position}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={DEEP_EMBER} transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}
