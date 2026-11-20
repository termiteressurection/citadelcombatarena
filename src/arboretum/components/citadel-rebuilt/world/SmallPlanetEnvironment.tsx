/**
 * SmallPlanetEnvironment — visually-curved ground plane.
 *
 * Gated on `citadel.visuals.next === '1'` AND `citadel.visuals.sky !== '0'`;
 * when disabled, the existing RebuiltWorld ground remains primary. When
 * enabled, this plane renders ON TOP (y=+0.01) of the existing ground and
 * is opaque, so the curvature is what the player sees.
 *
 * Physical coordinates stay flat — PlayerController and world colliders are
 * unchanged. This is a vertex displacement purely for visual curvature; the
 * displacement only activates OUTSIDE the chamber radius so the play area
 * remains perceptually level.
 *
 * Curvature math:
 *
 *   excess = max(0, |xz| - CHAMBER_R)
 *   drop   = min(MAX_DROP, K * excess²)
 *
 * With CHAMBER_R = 40 (matches CHAMBER_SIZE):
 *   r = 40  (chamber edge):  drop = 0      (flat play area)
 *   r = 60  (excess = 20):   drop ≈ 4      (horizon starts curving)
 *   r = 100 (excess = 60):   drop = 36     (approaching the clamp)
 *   r = 120+:                drop = 40     (clamped; visual horizon drop)
 *
 * Note: v6 plan specified k=0.002, MAX_DROP=0.5, which assumes a unit-scale
 * play area. Our chamber is 40 units and the original constants produced a
 * dimple starting at r=16 — visible inside the chamber and player-visible.
 * These values are the corrected equivalents for a 40-unit chamber.
 */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CHAMBER_SIZE } from '../types';
import { register, unregister } from '../shaderTimeRegistry';
import { visualFlags } from '../visualFlags';

const K = 0.01;
const MAX_DROP = 40;
const CHAMBER_R = CHAMBER_SIZE;

const VERT = /* glsl */ `
  uniform float u_time;
  varying vec2 vLocalXY;
  varying float vDropFactor;

  void main() {
    vec3 pos = position;
    // position.xy are the plane's local axes (pre-rotation); after the mesh's
    // -π/2 x-rotation they map to world (x, z). length(pos.xy) is the world
    // ground-plane radial distance.
    float r = length(pos.xy);
    float excess = max(0.0, r - ${CHAMBER_R.toFixed(1)});
    float drop = min(${MAX_DROP.toFixed(1)}, ${K.toFixed(4)} * excess * excess);
    // Push local +z (= world -y after rotation) so the ground falls away.
    pos.z += drop;
    vLocalXY = pos.xy;
    vDropFactor = drop / ${MAX_DROP.toFixed(1)};
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float u_time;
  uniform vec3 u_lineColor;
  uniform vec3 u_baseColor;
  varying vec2 vLocalXY;
  varying float vDropFactor;

  // Anti-aliased grid via fwidth. Requires OES_standard_derivatives, which
  // is default in WebGL2.
  float gridLine(vec2 p, float spacing, float width) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) / fwidth(p / spacing);
    float line = min(g.x, g.y);
    return 1.0 - smoothstep(width, width + 1.0, line);
  }

  void main() {
    float grid = gridLine(vLocalXY, 2.0, 0.5);
    // Slow u_time pulse along the grid intensity; this is the continuous
    // animation that shaderTimeRegistry rewinds on overlay close.
    float pulse = 0.7 + 0.3 * sin(u_time * 0.6);
    float fade = 1.0 - vDropFactor;
    vec3 col = mix(u_baseColor, u_lineColor, grid * fade * pulse);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SmallPlanetEnvironment() {
  const flags = visualFlags();
  const enabled = flags.master && flags.sky;

  const material = useMemo(() => {
    if (!enabled) return null;
    return new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_lineColor: { value: new THREE.Color('#a855f7') },
        u_baseColor: { value: new THREE.Color('#030611') },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: false,
      depthWrite: true,
    });
  }, [enabled]);

  useEffect(() => {
    if (!material) return;
    register(material);
    return () => {
      unregister(material);
      material.dispose();
    };
  }, [material]);

  useFrame((_, dt) => {
    if (!material) return;
    (material as any).uniforms.u_time.value += dt;
  });

  if (!material) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      frustumCulled={false}
      matrixAutoUpdate={false}
      onUpdate={(self) => self.updateMatrix()}
    >
      <planeGeometry args={[512, 512, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
