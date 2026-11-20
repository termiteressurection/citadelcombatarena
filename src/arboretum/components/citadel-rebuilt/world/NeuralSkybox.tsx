/**
 * NeuralSkybox — inverted-sphere skybox with tier-gated fragment shader.
 *
 * Kill switch: `citadel.visuals.next === '1'` AND `citadel.visuals.sky !== '0'`.
 *
 * Per-tier behavior from QualityProfile.visuals:
 *   brick  (skyMode='gradient'): per-fragment vertical gradient. ~0 GPU cost.
 *   hearth (skyMode='worley', density=0.6): 3D Worley F1, 1 octave. Target 3.5ms.
 *   forge  (skyMode='worley', density=1.0): same shader, denser cells. Target 4ms.
 *
 * The shader runs against the view direction (worldNormal), so pixels map to
 * sphere angles not world positions — giving a parallax-free "painted sky"
 * that stays stable as the player walks around.
 *
 * This is a continuous-animation material (u_time drives pulse modulation),
 * so it registers with shaderTimeRegistry. On overlay close the sky rewinds
 * by pauseDurationMs, matching the rest of the continuous scene.
 */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getQualityProfile } from '../qualityTier';
import { register, unregister } from '../shaderTimeRegistry';
import { visualFlags } from '../visualFlags';

const SKY_RADIUS = 400;

const VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    // Normalize the vertex normal in world space. For an inverted sphere the
    // normals face inward; we want the outward-pointing equivalent for the
    // fragment shader's view-direction math.
    vWorldDir = normalize(-normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_GRADIENT = /* glsl */ `
  precision mediump float;
  varying vec3 vWorldDir;
  uniform vec3 u_top;
  uniform vec3 u_horizon;
  uniform vec3 u_bottom;
  void main() {
    float t = clamp(vWorldDir.y, -1.0, 1.0);
    vec3 col = t >= 0.0
      ? mix(u_horizon, u_top, smoothstep(0.0, 1.0, t))
      : mix(u_horizon, u_bottom, smoothstep(0.0, 1.0, -t));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FRAG_WORLEY = /* glsl */ `
  precision mediump float;
  varying vec3 vWorldDir;
  uniform float u_time;
  uniform float u_density;
  uniform vec3 u_top;
  uniform vec3 u_horizon;
  uniform vec3 u_pulseA; // Neon Cyan
  uniform vec3 u_pulseB; // Pink/Magenta

  // Deterministic 2D hash for twinkling stars
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // 1. Twinkling star field
    float starRand = hash21(vWorldDir.xz * 310.0 + sign(vWorldDir.y) * 87.0);
    float starTwinkle = 0.3 + 0.7 * sin(u_time * 2.4 + starRand * 30.0);
    float starValue = smoothstep(0.993, 1.0, starRand) * starTwinkle;
    vec3 stars = vec3(starValue * 0.92);

    // 2. Base vertical sky gradient (Horizon to Zenith)
    float tSky = clamp(vWorldDir.y, 0.0, 1.0);
    vec3 baseSky = mix(u_horizon, u_top, smoothstep(0.0, 1.0, tSky));

    // 3. Cosmic nebulae / aurora breathing glow
    // Soft noise pattern driven by time and direction coordinates
    float noise1 = sin(vWorldDir.x * 2.5 + u_time * 0.3) * cos(vWorldDir.z * 2.5 + u_time * 0.25);
    float noise2 = cos(vWorldDir.y * 3.0 - u_time * 0.2) * sin(vWorldDir.x * 1.5 + u_time * 0.35);
    float nebulaStrength = smoothstep(-0.4, 1.0, noise1 * 0.5 + noise2 * 0.5);
    
    // Mix pulse colors for the nebula tint
    vec3 nebulaColor = mix(u_pulseA, u_pulseB, 0.5 + 0.5 * sin(u_time * 0.15 + vWorldDir.z * 1.5));
    // Blend nebula with the base sky, fading out near the horizon
    float horizonFade = smoothstep(0.02, 0.45, vWorldDir.y);
    vec3 skyWithNebula = baseSky + nebulaColor * (nebulaStrength * 0.22 * horizonFade);

    // Combine everything
    vec3 finalCol = skyWithNebula + stars * horizonFade;

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

export function NeuralSkybox() {
  const flags = visualFlags();
  const enabled = flags.master && flags.sky;
  const qp = getQualityProfile();
  const { skyMode, skyWorleyDensity } = qp.visuals;

  const material = useMemo(() => {
    if (!enabled) return null;
    const uniforms: Record<string, THREE.IUniform> = {
      u_top: { value: new THREE.Color('#0a0420') },
      u_horizon: { value: new THREE.Color('#1a0833') },
      u_bottom: { value: new THREE.Color('#030611') },
    };
    if (skyMode === 'worley') {
      uniforms.u_time = { value: 0 };
      uniforms.u_density = { value: skyWorleyDensity };
      uniforms.u_pulseA = { value: new THREE.Color('#22d3ee') }; // cyan
      uniforms.u_pulseB = { value: new THREE.Color('#ec4899') }; // magenta
    }
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: skyMode === 'worley' ? FRAG_WORLEY : FRAG_GRADIENT,
      side: THREE.BackSide,
      depthWrite: false,
      // Sky is meant to be atmospheric and passes through tone mapping.
      // Only the additive-wireframe altar opts out of tone mapping.
      toneMapped: true,
    });
  }, [enabled, skyMode, skyWorleyDensity]);

  useEffect(() => {
    if (!material || skyMode !== 'worley') return;
    register(material);
    return () => {
      unregister(material);
      material.dispose();
    };
  }, [material, skyMode]);

  useFrame((_, dt) => {
    if (!material) return;
    const u = (material as any).uniforms['u_time'];
    if (u) u.value += dt;
  });

  if (!material) return null;

  return (
    <mesh
      frustumCulled={false}
      matrixAutoUpdate={false}
      onUpdate={(self) => self.updateMatrix()}
    >
      <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
