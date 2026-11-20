import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Void colour — pure black so distance fog dissolves everything into infinite nothingness. */
export const MINIMAL_VOID_HEX = 0x000000;
export const MINIMAL_FOG = { near: 24, far: 110 } as const;

const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = smoothstep(0.35, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.35;
    float ring = smoothstep(0.018, 0.0, abs(d - 0.65)) * 0.65;
    float breath = 0.92 + 0.08 * sin(uTime * 1.2);
    float a = (core * 0.95 + halo + ring) * breath;
    gl_FragColor = vec4(vec3(1.0) * a, a);
  }
`;

/**
 * MinimalPlayerLight — the user's personal aura: a soft luminous white pool on
 * the void floor that tracks the player, with a concentric breathing ring.
 * This is the ONLY light on the ground in the Minimal world.
 */
export function MinimalPlayerLight({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    const m = ref.current;
    if (m) m.position.set(playerPos.current.x, 0.03, playerPos.current.z);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-10} frustumCulled={false} userData={{ minimalOwn: true }}>
      <planeGeometry args={[8, 8]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
