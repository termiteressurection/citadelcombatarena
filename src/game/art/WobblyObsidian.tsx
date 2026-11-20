import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float time;
  uniform vec3 color;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    // MATRIX RAIN LOGIC
    float columns = 12.0;
    vec2 st = vUv * columns;
    st.y += time * (2.0 + random(vec2(floor(st.x), 0.0)) * 3.0);
    
    float ipos = floor(st.y);
    float fpos = fract(st.y);
    
    // Simulate glitched Termitesse glyphs
    float glyph = step(0.1, random(vec2(floor(st.x), ipos)));
    float rain = step(0.9, fpos) * glyph;
    
    vec3 finalColor = color * rain * (1.0 - vUv.y);
    gl_FragColor = vec4(finalColor, rain * 0.8);
  }
`;

export function WobblyObsidian({ position, scale = [1, 1, 1], color = "#7c3aed" }: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  const p1 = useRef<THREE.Mesh>(null);
  const p2 = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    color: { value: new THREE.Color(color) }
  }), [color]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uniforms.time.value = t;
    
    if (p1.current) {
      p1.current.rotation.x = Math.sin(t * 0.8) * 0.12;
      p1.current.rotation.z = Math.cos(t * 0.5) * 0.08;
    }
    if (p2.current) {
      p2.current.rotation.x = Math.cos(t * 0.7) * 0.1;
      p2.current.rotation.z = Math.sin(t * 0.6) * 0.15;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* OCCUPIED SPACE: Two prisms with Matrix Rain texture */}
      <mesh ref={p1}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={p2}>
        <boxGeometry args={[1.05, 1.05, 1.05]} />
        <meshBasicMaterial color={0x0a0514} wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
