import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';

export const INDUSTRIAL_HORIZON_SRGB = [0.09, 0.08, 0.09] as const;
export const INDUSTRIAL_FOG = { near: 36, far: 165 } as const;

const horizonLinear = () =>
  new THREE.Color().setRGB(
    INDUSTRIAL_HORIZON_SRGB[0],
    INDUSTRIAL_HORIZON_SRGB[1],
    INDUSTRIAL_HORIZON_SRGB[2],
    THREE.SRGBColorSpace,
  );

/* ──────────────────────  WAREHOUSE ROOF SKY  ────────────────────── */

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

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);

    // Smoky iron warehouse ceiling & corrugated skylight rafters
    vec3 sootDark   = vec3(0.05, 0.055, 0.065);
    vec3 rustHaze   = vec3(0.18, 0.10, 0.06);
    vec3 sodiumGlow = vec3(1.0, 0.48, 0.08);

    vec3 col = mix(rustHaze, sootDark, smoothstep(0.0, 0.45, h));

    // Overhead steel rafters & corrugated roof beams in the upper dome
    if (h > 0.12) {
      vec2 roofUv = d.xz / (h + 0.25);
      float girderX = smoothstep(0.06, 0.02, abs(fract(roofUv.x * 2.5) - 0.5));
      float girderZ = smoothstep(0.08, 0.02, abs(fract(roofUv.y * 1.2) - 0.5));
      float corrugated = sin(roofUv.x * 60.0) * 0.015;
      col += corrugated;

      // Frosted industrial skylights between steel trusses
      float skylight = step(0.35, fract(roofUv.y * 1.2)) * (1.0 - girderX);
      col = mix(col, vec3(0.28, 0.18, 0.10), skylight * 0.45);
      col = mix(col, vec3(0.02, 0.02, 0.03), max(girderX, girderZ) * 0.85);
    }

    // Distant furnace blast glow on the horizon
    vec3 furnaceDir = normalize(vec3(0.0, 0.08, -1.0));
    float furnaceDot = max(dot(d, furnaceDir), 0.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 3.2);
    col += sodiumGlow * pow(furnaceDot, 8.0) * 0.45 * pulse;

    gl_FragColor = vec4(toLinear(col), 1.0);
  }
`;

function IndustrialSkyDome() {
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
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ industrialOwn: true }}>
      <sphereGeometry args={[420, 24, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────────  CONCRETE & GRATING FLOOR  ─────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vPathDist;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.06) * 2.2;
    vPathDist = abs(vWorld.x - pathCenterX);

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y -= sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  varying vec2 vWorld;
  varying float vPathDist;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Poured brutalist concrete slabs with expansion joints
    vec2 slabUv = fract(vWorld * 0.16);
    float joint = step(slabUv.x, 0.025) + step(slabUv.y, 0.025);
    float grit = (hash(floor(vWorld * 18.0)) - 0.5) * 0.06;

    vec3 concrete = vec3(0.16, 0.17, 0.19) + grit;
    concrete = mix(concrete, vec3(0.06, 0.06, 0.07), clamp(joint, 0.0, 1.0));

    // Diamond-plate steel walkway & OSHA hazard-stripe border
    float plazaDist = length(vWorld);
    bool onPlaza = plazaDist < 4.6;
    bool onWalkway = vPathDist < 2.6;
    bool onHazardBorder =
      (!onPlaza && abs(plazaDist - 4.6) < 0.38) ||
      (!onPlaza && abs(vPathDist - 2.6) < 0.38);

    // Steel grating tread pattern
    vec2 tread = abs(fract(vWorld * 2.4) - 0.5);
    float diamond = step(0.32, tread.x + tread.y);
    vec3 steelFloor = mix(vec3(0.22, 0.24, 0.27), vec3(0.34, 0.36, 0.40), diamond * 0.5);

    vec3 col = (onPlaza || onWalkway) ? steelFloor : concrete;

    // Diagonal yellow & black industrial caution stripes
    if (onHazardBorder) {
      float stripe = step(0.5, fract((vWorld.x + vWorld.y) * 1.4));
      col = mix(vec3(0.08, 0.08, 0.09), vec3(0.95, 0.68, 0.05), stripe);
    }

    vec3 lin = toLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

function IndustrialGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFogColor: { value: horizonLinear() },
          uFogNear: { value: INDUSTRIAL_FOG.near },
          uFogFar: { value: INDUSTRIAL_FOG.far },
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

  useFrame(({ camera }) => {
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
      userData={{ industrialOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────  STEEL I-BEAM GANTRIES & FURNACE SPARKS  ────────────── */

function IndustrialScenery() {
  const sparksRef = useRef<THREE.Group>(null);
  const lampRef = useRef<THREE.Group>(null);
  const pillarGroupRef = useRef<THREE.Group>(null);

  const pillarPositions = useMemo(
    () => [
      [-9.5, 0, 10.0] as [number, number, number],
      [9.5, 0, 10.0] as [number, number, number],
      [-9.5, 0, -2.0] as [number, number, number],
      [9.5, 0, -2.0] as [number, number, number],
      [-9.5, 0, -14.0] as [number, number, number],
      [9.5, 0, -14.0] as [number, number, number],
    ],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;
    if (pillarGroupRef.current) {
      pillarGroupRef.current.children.forEach((child, idx) => {
        const pos = pillarPositions[idx];
        if (!pos) return;
        child.position.y = -sphereDrop(pos[0] - px, pos[2] - pz);
      });
    }
    if (lampRef.current) {
      lampRef.current.position.y = 9.2 - sphereDrop(0 - px, 4.5 - pz);
      lampRef.current.rotation.z = Math.sin(t * 1.3) * 0.08;
    }
    if (sparksRef.current) {
      sparksRef.current.children.forEach((spark, idx) => {
        const phase = (t * (1.4 + (idx % 3) * 0.4) + idx * 0.37) % 1;
        const sx = Math.sin(t * 2.0 + idx * 1.7) * 3.8;
        const sz = Math.cos(t * 1.6 + idx * 2.3) * 3.8;
        spark.position.x = sx;
        spark.position.z = sz;
        spark.position.y = 0.5 + phase * 6.5 - sphereDrop(sx - px, sz - pz);
      });
    }
  });

  return (
    <group userData={{ industrialOwn: true }}>
      {/* Brutalist Rusted Steel I-Beam Gantry Columns */}
      <group ref={pillarGroupRef} userData={{ industrialOwn: true }}>
      {pillarPositions.map((pos, i) => (
        <group key={`ibeam-${i}`} position={pos} userData={{ industrialOwn: true }}>
          <mesh position={[0, 5.5, 0]} userData={{ industrialOwn: true }}>
            <boxGeometry args={[0.85, 11.0, 0.85]} />
            <meshStandardMaterial color="#2a2d34" roughness={0.6} metalness={0.8} />
          </mesh>
          {/* Hazard yellow concrete base plinth */}
          <mesh position={[0, 0.6, 0]} userData={{ industrialOwn: true }}>
            <boxGeometry args={[1.35, 1.2, 1.35]} />
            <meshStandardMaterial color="#d97706" roughness={0.7} metalness={0.2} />
          </mesh>
        </group>
      ))}
      </group>

      {/* Swinging Overhead Sodium-Vapor Cage Lamp */}
      <group ref={lampRef} position={[0, 9.2, 4.5]} userData={{ industrialOwn: true }}>
        <mesh position={[0, 1.4, 0]} userData={{ industrialOwn: true }}>
          <cylinderGeometry args={[0.04, 0.04, 2.8, 6]} />
          <meshBasicMaterial color="#1f242d" />
        </mesh>
        <mesh userData={{ industrialOwn: true }}>
          <cylinderGeometry args={[0.55, 0.85, 0.5, 8]} />
          <meshStandardMaterial color="#3b2314" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.25, 0]} userData={{ industrialOwn: true }}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshBasicMaterial color="#ff8c1a" />
        </mesh>
      </group>

      {/* Rising Arc-Welder & Furnace Sparks */}
      <group ref={sparksRef} userData={{ industrialOwn: true }}>
        {Array.from({ length: 20 }).map((_, idx) => (
          <mesh key={`spark-${idx}`} userData={{ industrialOwn: true }}>
            <dodecahedronGeometry args={[0.06, 0]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#ff9e00' : '#ff4800'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function IndustrialEnvironment() {
  return (
    <>
      <IndustrialSkyDome />
      <IndustrialGround />
      <IndustrialScenery />
    </>
  );
}
