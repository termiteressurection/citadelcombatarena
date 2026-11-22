import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { patchCurvedMaterial } from '../art/curvature';
import { biomeAt, type BiomeId } from '../world/universe';

const PARTICLE_COUNT = 200;

interface WeatherPreset {
  color: string;
  speedY: number;
  driftX: number;
  tiltZ: number;
  scaleX: number;
  scaleY: number;
}

const WEATHER_PRESETS: Record<BiomeId, WeatherPreset> = {
  metropolis: { color: '#3ff0ff', speedY: 0.9, driftX: 0.6, tiltZ: 0.1, scaleX: 0.08, scaleY: 0.12 },
  bazaar: { color: '#ffc95c', speedY: 2.6, driftX: 0.9, tiltZ: -0.15, scaleX: 0.09, scaleY: 0.14 },
  vault: { color: '#e9e6ff', speedY: -2.2, driftX: 0.85, tiltZ: 0.08, scaleX: 0.11, scaleY: 0.11 },
  frontier: { color: '#ff3b5c', speedY: -18.5, driftX: 4.5, tiltZ: 0.22, scaleX: 0.04, scaleY: 0.68 },
  kernel: { color: '#ffd866', speedY: 1.8, driftX: 0.4, tiltZ: 0, scaleX: 0.12, scaleY: 0.18 },
};

/** Dynamic 5-biome atmospheric particles (data-rain, crystal snow, golden embers, aurora ribbon & lightning). */
export function BiomeWeather({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const auroraRef = useRef<THREE.Mesh>(null!);
  const flashLight = useRef<THREE.PointLight>(null!);

  const offsets = useMemo(() => {
    const out: { x: number; y: number; z: number; phase: number; spd: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      out.push({
        x: ((i * 73) % 84) - 42,
        y: ((i * 37) % 24),
        z: ((i * 109) % 84) - 42,
        phase: (i * 0.41) % (Math.PI * 2),
        spd: 0.75 + ((i * 17) % 10) * 0.05,
      });
    }
    return out;
  }, []);

  const mat = useMemo(() => patchCurvedMaterial(
    new THREE.MeshBasicMaterial({ color: '#3ff0ff', transparent: true, opacity: 0.68, fog: false }),
  ), []);
  const auroraMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffd866',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    depthWrite: false,
  }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const targetColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const biome = biomeAt(px, pz);
    const preset = WEATHER_PRESETS[biome];
    targetColor.set(preset.color);
    mat.color.lerp(targetColor, Math.min(1, dt * 4));

    const t = clock.elapsedTime;
    const inst = meshRef.current;
    if (inst) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = offsets[i];
        p.y += preset.speedY * p.spd * dt;
        p.x += (preset.driftX + Math.sin(t * 1.4 + p.phase) * 0.6) * dt;
        if (p.y < 0.2) p.y = 24;
        if (p.y > 24.5) p.y = 0.4;
        if (p.x > 42) p.x = -42;
        if (p.x < -42) p.x = 42;
        dummy.position.set(px + p.x, p.y, pz + p.z);
        dummy.rotation.set(0, t * 0.8 + p.phase, preset.tiltZ);
        dummy.scale.set(preset.scaleX, preset.scaleY, preset.scaleX);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    if (auroraRef.current) {
      auroraRef.current.visible = biome === 'kernel' || biome === 'vault';
      auroraRef.current.position.set(px, 34 + Math.sin(t * 0.7) * 2.5, pz - 32);
      auroraRef.current.rotation.z = Math.sin(t * 0.35) * 0.08;
      auroraMat.color.set(biome === 'kernel' ? '#ffd866' : '#a78bfa');
    }

    if (flashLight.current) {
      const strike = biome === 'frontier' && Math.sin(t * 3.7) > 0.96 && Math.cos(t * 11.3) > 0.6;
      flashLight.current.position.set(px + 8, 22, pz - 12);
      flashLight.current.intensity = strike ? 18 : 0;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} material={mat} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <mesh ref={auroraRef} visible={false} material={auroraMat} frustumCulled={false}>
        <torusGeometry args={[48, 2.6, 4, 24, Math.PI]} />
      </mesh>
      <pointLight ref={flashLight} color="#ff4f6d" intensity={0} distance={140} decay={1.2} />
    </group>
  );
}
