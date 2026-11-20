import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── ARES: One plane. One draw call. Infinite precision. ───
// The old grid spawned 25,600+ instanced tiles across 4 meshes.
// Bloated. Wasteful. Every redundant draw call is a vulnerability.
// A single shader plane achieves the same result — zero per-frame cost.

const gridVertexShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  void main() {
    vec3 localPos = position;
    vLocalXZ = localPos.xz;
    float sphereRadius = 520.0;
    float radial = length(localPos.xz);
    float sagitta = sphereRadius - sqrt(max(sphereRadius * sphereRadius - radial * radial, 0.0));
    localPos.y -= sagitta;
    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const gridFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;
  uniform float uMentalLoad;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    float tileSize = 6.0;

    // TRIANGULATED WIREFRAME LOGIC
    vec2 st = vWorldXZ / tileSize;
    vec2 f = fract(st);
    float tri = abs(f.x - f.y); // Creates a diagonal split for triangulation
    
    vec2 worldGrid = vWorldXZ / tileSize;
    vec2 grid = abs(fract(worldGrid - 0.5) - 0.5);
    vec2 lineWidth = max(fwidth(worldGrid) * 2.5, vec2(0.015));
    vec2 lineStrength = smoothstep(lineWidth, vec2(0.0), grid);
    float lineMask = max(lineStrength.x, lineStrength.y);
    
    // Add the diagonal triangle line
    float triLine = smoothstep(0.03, 0.0, abs(tri - 0.01));
    lineMask = max(lineMask, triLine);

    float dist = length(vLocalXZ);
    float fade = 1.0 - smoothstep(120.0, 1120.0, dist);
    fade = pow(fade, 1.35);

    vec3 indigo = vec3(0.05, 0.02, 0.15);
    vec3 ultraviolet = vec3(0.48, 0.22, 0.93);
    vec3 obsidian = vec3(0.02, 0.01, 0.05);

    vec3 finalColor = mix(obsidian, ultraviolet, lineMask * fade);
    float alpha = fade;

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/** Curved wireframe grid — single draw call, GPU-computed.
 *  The plane is bent into a shallow spherical segment to support the rolling horizon illusion. */
export function SurrealGrid({ playerPosRef, mentalLoad = 0 }: { playerPosRef?: React.MutableRefObject<THREE.Vector3>; mentalLoad?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMentalLoad: { value: mentalLoad },
  }), [mentalLoad]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: gridVertexShader,
    fragmentShader: gridFragmentShader,
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  }), [uniforms]);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame(({ clock }) => {
    (material as any).uniforms.uTime.value = clock.elapsedTime;
    (material as any).uniforms.uMentalLoad.value = mentalLoad;
    if (!meshRef.current || !playerPosRef?.current) return;
    meshRef.current.position.x = playerPosRef.current.x;
    meshRef.current.position.z = playerPosRef.current.z;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, 0.18, 0]} renderOrder={24} />;
}
