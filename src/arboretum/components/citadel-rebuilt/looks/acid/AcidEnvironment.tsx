import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';

export const ACID_HORIZON_SRGB = [0.08, 0.02, 0.18] as const;
export const ACID_FOG = { near: 42, far: 180 } as const;

/* ────────────────────  ACID KALEIDOSCOPE SKY  ──────────────────── */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  vec3 rainbow(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    // Dome projection coordinates
    vec2 p = d.xz / (abs(h) + 0.28);
    float r = length(p);
    float a = atan(p.y, p.x);

    // 8-fold kaleidoscopic symmetry
    float fold = 8.0;
    a = abs(mod(a + 3.14159 / fold, 6.28318 / fold) - 3.14159 / fold);

    // Sacred mandala rings & swirling spiral waves
    float spiral = sin(r * 4.0 - uTime * 0.8 + a * 6.0);
    float rings = sin(r * 12.0 + uTime * 0.4);
    float pattern = sin(spiral * 2.5 + rings * 1.5);

    // Chromatic rainbow waves
    vec3 c1 = rainbow(r * 0.15 - uTime * 0.08 + a * 0.4);
    vec3 c2 = rainbow(pattern * 0.3 + uTime * 0.12);
    vec3 col = mix(c1, c2, 0.5 + 0.5 * sin(pattern * 3.0));

    // Deep cosmic violet abyss near horizon
    vec3 voidHorizon = vec3(0.08, 0.02, 0.18);
    col = mix(voidHorizon, col, smoothstep(0.02, 0.38, h));

    // Pulsating sacred sun mandala
    vec3 sunDir = normalize(vec3(0.3, 0.3, -0.9));
    float sunDot = max(dot(d, sunDir), 0.0);
    float sunBurst = sin(atan(d.y - sunDir.y, d.x - sunDir.x) * 16.0 + uTime * 1.5);
    col += rainbow(uTime * 0.2) * pow(sunDot, 12.0) * (0.8 + 0.4 * sunBurst);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function AcidSkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    ref.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ acidOwn: true }}>
      <sphereGeometry args={[420, 32, 20]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ─────────────────────  ACID LIQUID GROUND  ────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vWave;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;

    // Subtle non-negative breathing ripple so troughs never dip beneath overworld asset bases
    float wave = (sin(vWorld.x * 0.12 + uTime * 1.1) * cos(vWorld.y * 0.12 + uTime * 0.9) * 0.5 + 0.5) * 0.14;
    vWave = wave;

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y += wave - sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  varying vec2 vWorld;
  varying float vWave;

  vec3 rainbow(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    // Liquid light / oil slick marbling coordinates
    vec2 p = vWorld * 0.14;
    p += vec2(sin(p.y * 3.0 + uTime * 0.6), cos(p.x * 3.0 + uTime * 0.5)) * 0.35;

    float distCenter = length(vWorld);
    float distPath = abs(vWorld.x - sin(vWorld.y * 0.09) * 3.0);

    // Moiré interference ripple
    float ripple = sin(length(p) * 14.0 - uTime * 1.2) * sin(p.x * 8.0 + p.y * 8.0);

    // Liquid tie-dye color bands
    vec3 tieDye = rainbow(ripple * 0.4 + length(p) * 0.2 + uTime * 0.1);

    // Sacred geometric plaza mandala
    float plazaRings = sin(distCenter * 3.2 - uTime * 0.8);
    float isPlaza = smoothstep(4.8, 3.8, distCenter);
    float isRoad = smoothstep(2.8, 2.0, distPath);

    vec3 roadCol = rainbow(distPath * 0.5 + uTime * 0.25) * 1.35;
    vec3 col = mix(tieDye * 0.75, roadCol, max(isPlaza * (0.6 + 0.4 * plazaRings), isRoad));

    // Distance fog blend
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));

    gl_FragColor = vec4(col, 1.0);
  }
`;

function AcidGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uFogColor: { value: new THREE.Color().setRGB(ACID_HORIZON_SRGB[0], ACID_HORIZON_SRGB[1], ACID_HORIZON_SRGB[2]) },
          uFogNear: { value: ACID_FOG.near },
          uFogFar: { value: ACID_FOG.far },
          uCam: { value: new THREE.Vector3() },
          uCenter: { value: new THREE.Vector3() },
          uCurvatureRadius: { value: getActiveCurvatureRadius() },
        },
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uCam.value.copy(camera.position);
    material.uniforms.uCenter.value.copy(livePlayerWorldPos);
    material.uniforms.uCurvatureRadius.value = getActiveCurvatureRadius();
    ref.current?.position.set(livePlayerWorldPos.x, -0.02, livePlayerWorldPos.z);
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-900}
      frustumCulled={false}
      userData={{ acidOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────  ACID MUSHROOMS & MERKABA  ─────────────────── */

function AcidMushrooms() {
  const shroomList = useMemo(
    () => [
      { pos: [-4.5, 0, 8.5] as [number, number, number], scale: 1.4, hue: 0.1 },
      { pos: [-6.8, 0, 5.2] as [number, number, number], scale: 1.9, hue: 0.4 },
      { pos: [-3.8, 0, 11.2] as [number, number, number], scale: 1.1, hue: 0.7 },
      { pos: [4.2, 0, 7.8] as [number, number, number], scale: 1.6, hue: 0.85 },
      { pos: [6.5, 0, 5.0] as [number, number, number], scale: 2.1, hue: 0.25 },
      { pos: [5.2, 0, 12.0] as [number, number, number], scale: 1.3, hue: 0.55 },
    ],
    [],
  );

  const shroomRefs = useRef<(THREE.Group | null)[]>([]);
  const merkabaRef = useRef<THREE.Group>(null);
  const sporeGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pp = livePlayerWorldPos;
    shroomList.forEach((m, idx) => {
      const grp = shroomRefs.current[idx];
      if (grp) {
        grp.position.y = -sphereDrop(m.pos[0] - pp.x, m.pos[2] - pp.z);
      }
    });
    if (merkabaRef.current) {
      const drop = sphereDrop(-3.2 - pp.x, 5.5 - pp.z);
      merkabaRef.current.position.y = 4.2 + Math.sin(t * 1.5) * 0.45 - drop;
      merkabaRef.current.rotation.x = t * 0.4;
      merkabaRef.current.rotation.y = t * 0.6;
      merkabaRef.current.rotation.z = Math.sin(t * 0.8) * 0.3;
    }
    if (sporeGroupRef.current) {
      sporeGroupRef.current.children.forEach((spore, idx) => {
        const drop = sphereDrop(spore.position.x - pp.x, spore.position.z - pp.z);
        spore.position.y = 1.0 + ((t * 0.8 + idx * 0.6) % 6.0) - drop;
        spore.position.x += Math.sin(t * 1.2 + idx) * 0.015;
      });
    }
  });

  return (
    <group userData={{ acidOwn: true }}>
      {/* Giant Psychedelic Mushrooms */}
      {shroomList.map((m, i) => (
        <group
          key={`shroom-${i}`}
          ref={(el) => {
            shroomRefs.current[i] = el;
          }}
          position={m.pos}
          scale={m.scale}
          userData={{ acidOwn: true }}
        >
          {/* Stem */}
          <mesh position={[0, 0.9, 0]} userData={{ acidOwn: true }}>
            <cylinderGeometry args={[0.16, 0.28, 1.8, 8]} />
            <meshStandardMaterial
              color="#ffebfa"
              emissive="#c44bc8"
              emissiveIntensity={0.35}
              roughness={0.4}
            />
          </mesh>
          {/* Mushroom Cap */}
          <mesh position={[0, 1.85, 0]} userData={{ acidOwn: true }}>
            <sphereGeometry args={[0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial
              color="#ff007f"
              emissive="#7928ca"
              emissiveIntensity={0.65}
              roughness={0.2}
            />
          </mesh>
          {/* Glowing Gills underside */}
          <mesh position={[0, 1.82, 0]} rotation={[Math.PI, 0, 0]} userData={{ acidOwn: true }}>
            <circleGeometry args={[0.9, 16]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
          {/* Neon Spots on Cap */}
          {[0, 1.2, 2.4, 3.6, 4.8].map((angle, spotIdx) => (
            <mesh
              key={`spot-${spotIdx}`}
              position={[Math.cos(angle) * 0.55, 2.2, Math.sin(angle) * 0.55]}
              userData={{ acidOwn: true }}
            >
              <sphereGeometry args={[0.12, 6, 6]} />
              <meshBasicMaterial color="#39ff14" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Floating Sacred Geometry Merkaba Prism */}
      <group ref={merkabaRef} position={[-3.2, 4.2, 5.5]} userData={{ acidOwn: true }}>
        <mesh userData={{ acidOwn: true }}>
          <octahedronGeometry args={[1.2, 0]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#ff00aa"
            emissiveIntensity={0.5}
            roughness={0.1}
            wireframe
          />
        </mesh>
        <mesh scale={0.7} rotation={[0, Math.PI / 4, Math.PI / 4]} userData={{ acidOwn: true }}>
          <icosahedronGeometry args={[1.0, 0]} />
          <meshStandardMaterial
            color="#ffe600"
            emissive="#39ff14"
            emissiveIntensity={0.6}
            roughness={0.1}
            wireframe
          />
        </mesh>
      </group>

      {/* Drifting Psychedelic Spore Particles */}
      <group ref={sporeGroupRef} userData={{ acidOwn: true }}>
        {Array.from({ length: 24 }).map((_, idx) => (
          <mesh
            key={`spore-${idx}`}
            position={[
              (Math.sin(idx * 4.3) - 0.5) * 22,
              Math.random() * 6,
              (Math.cos(idx * 3.7) - 0.5) * 22,
            ]}
            userData={{ acidOwn: true }}
          >
            <sphereGeometry args={[0.075, 4, 4]} />
            <meshBasicMaterial
              color={idx % 3 === 0 ? '#39ff14' : idx % 3 === 1 ? '#00f0ff' : '#ff007f'}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function AcidEnvironment() {
  return (
    <>
      <AcidSkyDome />
      <AcidGround />
      <AcidMushrooms />
    </>
  );
}
