import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, WORLD_CURVATURE_RADIUS, livePlayerWorldPos } from '../../RebuiltWorldShared';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import { lodgeVertexShader, lodgeFragmentShader } from '../lodgeShaders';
import { getTimeOfDay, getTimePalette } from '../../RebuiltWorldShared';
import { getSeason, SEASON_PALETTES } from '../../seasonalPalette';

export function FacetedAetherSky({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  const sheets = useMemo(() => {
    return [...Array(128)].map((_, i) => ({
      pos: [Math.random() * 400 - 200, 25 + (i % 4) * 4, Math.random() * 400 - 200] as [number, number, number],
      opacityBase: 0.15 + Math.random() * 0.25,
      latticeType: i % 2 === 0 ? 'A' : 'B',
      size: 20 + Math.random() * 20
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    
    groupRef.current.position.x = playerPos.current.x;
    groupRef.current.position.z = playerPos.current.z;
    
    groupRef.current.children.forEach((child, i) => {
      const sheet = sheets[i];
      const frequency = 0.12;
      const wave = Math.sin(t * 1.2 + (sheet.pos[0] + sheet.pos[2]) * frequency);
      
      if (sheet.latticeType === 'A') {
        child.rotation.x = wave * 1.4;
        child.rotation.z = Math.cos(t * 0.8 + sheet.pos[0] * 0.1) * 0.5;
      } else {
        child.rotation.x = Math.cos(t * 1.2 + (sheet.pos[0] - sheet.pos[2]) * frequency) * 1.4;
        child.rotation.z = wave * 0.5;
      }
      
      ((child as THREE.Mesh).material as any).opacity = sheet.opacityBase + Math.max(0, wave) * 0.3;
    });
  });

  return (
    <group ref={groupRef}>
      {sheets.map((sheet, i) => (
        <mesh key={i} position={sheet.pos}>
          <planeGeometry args={[sheet.size, sheet.size]} />
          <meshBasicMaterial color={sheet.latticeType === 'A' ? "#1e3a8a" : "#312e81"} transparent opacity={sheet.opacityBase} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function ThickeningClouds({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  return (
    <group position={[0, 45, 0]}>
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[0, i * 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial color="#0a0f2c" transparent opacity={0.1 + i * 0.15} />
        </mesh>
      ))}
    </group>
  );
}

export function DigitalGrass({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const count = 12000;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const strands = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      // Road Exclusion: Only grass IN the glades/roads, or everywhere? 
      // User said: "packed grass everywhere except the walking trail"
      if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;
      
      list.push({
        pos: [x, 0, z] as [number, number, number],
        scale: 0.5 + Math.random() * 0.5,
        color: Math.random() > 0.5 ? '#10b981' : '#fbbf24' // Emerald or Gold
      });
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    strands.forEach((s, i) => {
      const drop = sphereDrop(s.pos[0] - playerPos.current.x, s.pos[2] - playerPos.current.z);
      const sway = Math.sin(t * 2 + s.pos[0] * 0.5) * 0.1;
      dummy.position.set(s.pos[0], -drop, s.pos[2]);
      dummy.scale.set(s.scale, s.scale, s.scale);
      dummy.rotation.x = sway;
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, strands.length]} frustumCulled={false}>
      <coneGeometry args={[0.05, 1.2, 3]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

export function LodgeFloor({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSphereRadius: { value: WORLD_CURVATURE_RADIUS },
  }), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: lodgeVertexShader,
    fragmentShader: lodgeFragmentShader,
    uniforms,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  }), [uniforms]);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(800, 800, 240, 240);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame(({ clock }) => {
    (material as any).uniforms.uTime.value = clock.elapsedTime;
    const activeR = useVillageTunerStore.getState().curvatureRadius || WORLD_CURVATURE_RADIUS;
    (material as any).uniforms.uSphereRadius.value = activeR;
    livePlayerWorldPos.copy(playerPos.current);
    if (!meshRef.current) return;
    meshRef.current.position.x = playerPos.current.x;
    meshRef.current.position.z = playerPos.current.z;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -0.01, 0]}
      renderOrder={-1}
    />
  );
}

export function WeatherParticles({ depth, playerPos, streak }: { depth: number; playerPos: React.MutableRefObject<THREE.Vector3>; streak?: number }) {
  const count = 80;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 60,
    y: Math.random() * 25,
    z: (Math.random() - 0.5) * 60,
    speed: 0.3 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.02,
    hue: Math.random(),
  })), []);

  // Weather linked to streak: 0=rain, 1-3=gentle, 4-6=calm, 7+=aurora
  const s = streak || 0;
  const activeCount = s >= 7 ? 80 : s >= 4 ? 20 : s >= 1 ? 40 : 80;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    particles.forEach((p, i) => {
      if (i >= activeCount) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        return;
      }
      if (s >= 7) {
        // Aurora: particles rise slowly, colorful
        let y = p.y + 0.015;
        if (y > 25) y = -1;
        p.y = y;
        p.x += Math.sin(t * 0.3 + i * 0.5) * 0.01;
        dummy.position.set(p.x + pp.x, y, p.z + pp.z);
        dummy.scale.setScalar(0.08);
      } else {
        const dir = depth > 2 ? 1 : -1;
        let y = p.y + dir * p.speed * 0.02;
        if (dir < 0 && y < -1) y = 25;
        if (dir > 0 && y > 25) y = -1;
        p.y = y;
        p.x += p.drift + Math.sin(t * 0.5 + i) * 0.005;
        dummy.position.set(p.x + pp.x, y, p.z + pp.z);
        dummy.scale.setScalar(depth > 2 ? 0.06 : 0.03);
      }
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const color = s >= 7 ? 0x22d3ee : depth > 2 ? 0x34d399 : depth > 1 ? 0xc084fc : 0xa855f7;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <tetrahedronGeometry args={[0.3, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </instancedMesh>
  );
}

export function TimeOfDayController({ depth }: { depth: number }) {
  const { scene } = useThree();
  const bgColor = useRef(new THREE.Color('#0a0414'));
  const seasonColor = useRef(new THREE.Color('#0a0414'));
  const lastUpdate = useRef(0);

  useFrame(() => {
    const now = Date.now();
    // Only update every 10 seconds to avoid constant recalc
    if (now - lastUpdate.current < 10000) return;
    lastUpdate.current = now;

    const tod = getTimeOfDay();
    const palette = getTimePalette(tod);
    const season = getSeason();
    const seasonalPalette = SEASON_PALETTES[season];
    // Deeper chambers are darker regardless of time
    const depthDarken = Math.max(0.4, 1 - depth * 0.08);
    bgColor.current.set(palette.bg);
    seasonColor.current.set(seasonalPalette.bg);
    bgColor.current.lerp(seasonColor.current, 0.26);
    bgColor.current.multiplyScalar(depthDarken);
    scene.background = bgColor.current;
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(bgColor.current);
      // Deeper = closer fog for claustrophobic feel
      scene.fog.near = Math.max(15, 35 - depth * 4);
      scene.fog.far = Math.max(60, 145 - depth * 12);
    }
  });

  return null;
}

