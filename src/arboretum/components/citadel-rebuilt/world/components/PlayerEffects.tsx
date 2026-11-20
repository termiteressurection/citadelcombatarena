import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../../RebuiltWorldShared';
import { Html } from '@react-three/drei';
import { BottleMessage, FutureLetter } from '../../types';

export function PlayerNavHalo({
  playerPos,
  playerYaw,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  playerYaw?: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const sweepRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !playerPos.current) return;
    const pp = playerPos.current;
    // Follow the player's world position directly under avatar
    groupRef.current.position.set(pp.x, pp.y - 1.35, pp.z);

    const t = clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.25;
    }
    if (sweepRef.current) {
      sweepRef.current.rotation.z = -t * 1.8;
    }
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer Tactical Ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[1.7, 1.76, 32]} />
        <meshBasicMaterial color={0xa855f7} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Compass Tick Ring */}
      <mesh>
        <ringGeometry args={[1.0, 1.05, 8]} />
        <meshBasicMaterial color={0x22d3ee} transparent opacity={0.25} wireframe side={THREE.DoubleSide} />
      </mesh>
      {/* Sweeping Tactical Sonar Slice */}
      <mesh ref={sweepRef}>
        <ringGeometry args={[0.2, 1.7, 16, 1, 0, Math.PI / 3]} />
        <meshBasicMaterial color={0x22d3ee} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function RadarHUD({
  playerPos,
  cameraRef,
  playerYaw,
  targets = [],
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  cameraRef?: React.MutableRefObject<THREE.Camera | null>;
  playerYaw?: React.MutableRefObject<number>;
  targets?: { pos: THREE.Vector3; label: string }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 160;
    const H = 160;
    const cx = 80;
    const cy = 80;
    const R = 72;
    const camDir = new THREE.Vector3();

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);

      ctx.clearRect(0, 0, W, H);

      // 1. Radar Glass Background
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 4, 18, 0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Concentric Distance Rings
      [24, 48, 72].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 3. Camera / Player Heading
      let fx = 0;
      let fz = -1; // Default facing North (-Z)
      if (cameraRef?.current) {
        cameraRef.current.getWorldDirection(camDir);
        fx = camDir.x;
        fz = camDir.z;
      } else if (playerYaw) {
        fx = -Math.sin(playerYaw.current);
        fz = -Math.cos(playerYaw.current);
      }
      const headingAngle = Math.atan2(fx, -fz);

      // Crosshair axes (tactical reticle: Forward/Aft & Port/Starboard)
      ctx.beginPath();
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cardinal Markers (N, S, E, W) - Rotates around player heading (Halo style)
      const cardinals = [
        { text: 'N', angle: 0, color: '#22d3ee' },
        { text: 'E', angle: Math.PI / 2, color: 'rgba(192, 132, 252, 0.7)' },
        { text: 'S', angle: Math.PI, color: 'rgba(192, 132, 252, 0.7)' },
        { text: 'W', angle: -Math.PI / 2, color: 'rgba(192, 132, 252, 0.7)' },
      ];
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      cardinals.forEach(({ text, angle, color }) => {
        const relAngle = angle - headingAngle;
        const nx = cx + Math.sin(relAngle) * (R - 10);
        const ny = cy - Math.cos(relAngle) * (R - 10);
        ctx.fillStyle = color;
        ctx.fillText(text, nx, ny);
      });

      // 4. Sonar Sweep
      const t = timestamp * 0.001;
      const sweep = (t * 2.2) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R - 2, sweep, sweep + 0.4);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.2)');
      grad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 5. Target Blips (Rotated relative to player heading: ahead is ALWAYS UP)
      const pp = playerPos.current || { x: 0, y: 0, z: 0 };
      const MAX_RADAR_DIST = 90;

      targets.forEach((tg) => {
        const dx = tg.pos.x - pp.x;
        const dy = (tg.pos.y || 0) - (pp.y || 0);
        const dz = tg.pos.z - pp.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MAX_RADAR_DIST * 1.5) return;

        const targetWorldAngle = Math.atan2(dx, -dz);
        const relAngle = targetWorldAngle - headingAngle;
        const isOutOfRange = dist > MAX_RADAR_DIST;
        const rDist = Math.min(dist / MAX_RADAR_DIST, 1.0) * (R - 12);

        const bx = cx + Math.sin(relAngle) * rDist;
        const by = cy - Math.cos(relAngle) * rDist;

        const isAltar = tg.label.toUpperCase().includes('ALTAR');
        const isPortal = tg.label.toUpperCase().includes('PORTAL') || tg.label.toUpperCase().includes('GATE');
        const color = isAltar ? '#ec4899' : isPortal ? '#22d3ee' : '#a855f7';

        // Blip glow
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isOutOfRange ? 3 : 7;

        // Halo-style altitude indicators
        if (!isOutOfRange && dy > 2.5) {
          // Target Above: Upward triangle
          ctx.beginPath();
          ctx.moveTo(bx, by - 4.5);
          ctx.lineTo(bx + 3.5, by + 2.5);
          ctx.lineTo(bx - 3.5, by + 2.5);
          ctx.closePath();
          ctx.fill();
        } else if (!isOutOfRange && dy < -2.5) {
          // Target Below: Downward triangle
          ctx.beginPath();
          ctx.moveTo(bx, by + 4.5);
          ctx.lineTo(bx + 3.5, by - 2.5);
          ctx.lineTo(bx - 3.5, by - 2.5);
          ctx.closePath();
          ctx.fill();
        } else {
          // Level / Edge Pip
          ctx.beginPath();
          ctx.arc(bx, by, isOutOfRange ? 2.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      // 6. Halo-style Forward Player Reticle (Fixed UP dead-ahead)
      // Forward Vision Cone (illuminates field of view directly ahead)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R - 4, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35);
      ctx.closePath();
      const fovGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R - 4);
      fovGrad.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
      fovGrad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
      ctx.fillStyle = fovGrad;
      ctx.fill();

      // Center Yellow Reticle Arrow (Points permanently UP at 12 o'clock)
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.lineTo(cx, cy + 2.5);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.closePath();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [playerPos, cameraRef, playerYaw, targets]);

  return (
    <div
      className="fixed z-[80] pointer-events-none select-none flex flex-col items-end gap-1.5 font-mono"
      style={{
        top: '106px',
        right: '16px',
      }}
    >
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-purple-500/30 backdrop-blur-md shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[8px] uppercase tracking-[0.2em] text-purple-200/80">Vector Radar</span>
      </div>
      <div
        className="relative rounded-full"
        style={{
          width: '150px',
          height: '150px',
          filter: 'drop-shadow(0 0 16px rgba(124, 58, 237, 0.45))',
        }}
      >
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            backdropFilter: 'blur(8px)',
          }}
        />
      </div>
    </div>
  );
}

export function PlayerTrail({ playerPos, style }: { playerPos: React.MutableRefObject<THREE.Vector3>; style: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX_TRAIL = 60;
  const trail = useRef<{ x: number; y: number; z: number; t: number }[]>([]);
  const lastPos = useRef(new THREE.Vector3());

  const TRAIL_COLORS: Record<string, number> = {
    footprints: 0x8b5cf6, particles: 0xec4899, ink: 0x1e0d3a, fire: 0xf97316, stars: 0xfbbf24, glitch: 0x22d3ee,
  };

  useFrame(({ clock }) => {
    if (!meshRef.current || style === 'none') return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    const dist = pp.distanceTo(lastPos.current);
    if (dist > 0.8) {
      trail.current.push({ x: pp.x, y: pp.y - 1.4, z: pp.z, t });
      if (trail.current.length > MAX_TRAIL) trail.current.shift();
      lastPos.current.copy(pp);
    }
    trail.current.forEach((pt, i) => {
      const age = t - pt.t;
      const fade = Math.max(0, 1 - age / 8);
      const drop = sphereDrop(pt.x - pp.x, pt.z - pp.z);
      dummy.position.set(pt.x, pt.y - drop, pt.z);
      if (style === 'footprints') {
        dummy.scale.set(0.15, 0.02, 0.25);
      } else if (style === 'fire') {
        dummy.position.y += Math.sin(t * 3 + i) * 0.3;
        dummy.scale.setScalar(0.1 * fade);
      } else if (style === 'stars') {
        dummy.position.y += 0.5 + Math.sin(t + i * 0.5) * 0.3;
        dummy.scale.setScalar(0.08 * fade);
      } else {
        dummy.scale.setScalar(0.12 * fade);
      }
      dummy.rotation.set(style === 'glitch' ? t * 5 + i : 0, 0, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    for (let i = trail.current.length; i < MAX_TRAIL; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (style === 'none') return null;
  const geo = style === 'footprints' ? <boxGeometry args={[1, 1, 1]} /> :
              style === 'stars' ? <octahedronGeometry args={[1, 0]} /> :
              <octahedronGeometry args={[1, 0]} />;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TRAIL]}>
      {geo}
      <meshBasicMaterial color={TRAIL_COLORS[style] || 0x8b5cf6} transparent opacity={0.3} />
    </instancedMesh>
  );
}

export function BottleMessages({ bottles, playerPos }: { bottles: BottleMessage[]; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    ref.current.children.forEach((child, i) => {
      const angle = (i / Math.max(bottles.length, 1)) * Math.PI * 2 + t * 0.05;
      const r = 15 + i * 3;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const drop = sphereDrop(x - pp.x, z - pp.z);
      child.position.set(x, 1.5 + Math.sin(t * 0.5 + i) * 0.5 - drop, z);
      child.rotation.set(0, t * 0.3 + i, Math.sin(t + i) * 0.2);
    });
  });
  return (
    <group ref={ref}>
      {bottles.map((bottle) => (
        <group key={bottle.id}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.15, 0.5, 6]} />
            <meshBasicMaterial color={0x22d3ee} transparent opacity={0.3} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <octahedronGeometry args={[0.08, 0]} />
            <meshBasicMaterial color={0xfbbf24} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function FutureLetterMonoliths({ letters, playerPos }: { letters: FutureLetter[]; playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    ref.current.children.forEach((child, i) => {
      if (!letters[i]) return;
      const angle = (i / Math.max(letters.length, 1)) * Math.PI * 2;
      const x = Math.cos(angle) * 22;
      const z = Math.sin(angle) * 22;
      const drop = sphereDrop(x - pp.x, z - pp.z);
      child.position.set(x, 2 - drop, z);
      if (letters[i].revealed) {
        child.rotation.y = t * 0.2;
        child.scale.setScalar(1 + Math.sin(t * 2) * 0.1);
      }
    });
  });
  return (
    <group ref={ref}>
      {letters.map((letter) => (
        <group key={letter.id}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 3.5, 0.15]} />
            <meshBasicMaterial color={letter.revealed ? 0xfbbf24 : 0x2d1660} transparent opacity={letter.revealed ? 0.3 : 0.12} />
          </mesh>
          {letter.revealed && (
            <pointLight color={0xfbbf24} intensity={0.5} distance={5} />
          )}
        </group>
      ))}
    </group>
  );
}

export function GhostTrails({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const GHOST_COUNT = 30;
  const ghostPath = useRef<{ x: number; z: number; t: number }[]>([]);
  const sampleTimer = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    // Sample position every 2 seconds
    if (t - sampleTimer.current > 2) {
      sampleTimer.current = t;
      ghostPath.current.push({ x: pp.x, z: pp.z, t });
      if (ghostPath.current.length > GHOST_COUNT) ghostPath.current.shift();
    }
    ghostPath.current.forEach((g, i) => {
      const age = t - g.t;
      const fade = Math.max(0, 1 - age / 60);
      const drop = sphereDrop(g.x - pp.x, g.z - pp.z);
      dummy.position.set(g.x, 0.9 - drop, g.z);
      dummy.scale.set(0.15, 0.4 * fade, 0.15);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    for (let i = ghostPath.current.length; i < GHOST_COUNT; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, GHOST_COUNT]}>
      <octahedronGeometry args={[0.6, 0]} />
      <meshBasicMaterial color={0xc084fc} wireframe transparent opacity={0.12} />
    </instancedMesh>
  );
}

export function FireworksBurst({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3>; }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COUNT = 60;
  const startTime = useRef(performance.now() / 1000);
  const [alive, setAlive] = useState(true);
  const particles = useMemo(() => Array.from({ length: COUNT }, () => {
    const phi = Math.acos(1 - 2 * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    return {
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed * 0.8 + 4,
      vz: Math.cos(phi) * speed,
      color: [0xfbbf24, 0xec4899, 0xa855f7, 0x34d399, 0x22d3ee, 0xf97316][Math.floor(Math.random() * 6)],
    };
  }), []);

  useFrame(() => {
    if (!meshRef.current || !alive) return;
    const elapsed = performance.now() / 1000 - startTime.current;
    if (elapsed > 4) { setAlive(false); return; }
    const pp = playerPos.current;
    particles.forEach((p, i) => {
      const t = elapsed;
      const x = p.vx * t;
      const y = 10 + p.vy * t - 4.9 * t * t;
      const z = p.vz * t;
      const fade = Math.max(0, 1 - elapsed / 4);
      dummy.position.set(pp.x + x, y, pp.z + z);
      dummy.scale.setScalar(0.15 * fade);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!alive) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <octahedronGeometry args={[0.2, 0]} />
      <meshBasicMaterial color={0xfbbf24} transparent opacity={0.6} />
    </instancedMesh>
  );
}

