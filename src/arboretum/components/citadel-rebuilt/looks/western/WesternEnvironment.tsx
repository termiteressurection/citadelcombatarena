import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';

export const WESTERN_HORIZON_SRGB = [0.85, 0.68, 0.45] as const;
export const WESTERN_FOG = { near: 42, far: 185 } as const;

const horizonLinear = () =>
  new THREE.Color().setRGB(
    WESTERN_HORIZON_SRGB[0],
    WESTERN_HORIZON_SRGB[1],
    WESTERN_HORIZON_SRGB[2],
    THREE.SRGBColorSpace,
  );

/* ──────────────────────  WESTERN FRONTIER SKY  ────────────────────── */

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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);

    // Sun-bleached sepia prairie sky
    vec3 dustHorizon = vec3(0.88, 0.72, 0.48);
    vec3 amberMid    = vec3(0.74, 0.54, 0.34);
    vec3 umberZenith = vec3(0.38, 0.25, 0.15);

    vec3 col = mix(dustHorizon, amberMid, smoothstep(0.0, 0.28, h));
    col = mix(col, umberZenith, smoothstep(0.22, 0.85, h));

    // Blazing frontier high-noon / sunset desert sun
    vec3 sunDir = normalize(vec3(0.22, 0.20, -0.95));
    float sunDot = max(dot(d, sunDir), 0.0);
    col += vec3(1.0, 0.90, 0.68) * pow(sunDot, 10.0) * 0.55;
    col += vec3(1.0, 0.96, 0.85) * pow(sunDot, 80.0) * 0.75;

    // Distant Monument-Valley flat-topped mesa silhouettes along the horizon
    if (h >= -0.02 && h < 0.16) {
      float a = atan(d.x, d.z);
      float mesa1 = step(abs(a + 0.55), 0.18) * 0.095;
      float mesa2 = step(abs(a - 0.42), 0.22) * 0.115;
      float mesa3 = step(abs(a - 1.35), 0.14) * 0.08;
      float ridge = sin(a * 8.0) * 0.015 + 0.03;
      float silhouetteH = max(max(mesa1, mesa2), max(mesa3, ridge));
      if (h < silhouetteH) {
        col = mix(vec3(0.28, 0.18, 0.10), dustHorizon, 0.35);
      }
    }

    gl_FragColor = vec4(toLinear(col), 1.0);
  }
`;

function WesternSkyDome() {
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
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ westernOwn: true }}>
      <sphereGeometry args={[420, 24, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────────  DESERT ALKALI & BOARDWALK GROUND  ─────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vPathDist;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.07) * 2.5;
    vPathDist = abs(vWorld.x - pathCenterX);

    float dune = max(0.0, sin(vWorld.x * 0.05) * cos(vWorld.y * 0.05)) * 0.14 * smoothstep(3.0, 8.0, vPathDist);

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y += dune - sagitta;
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
    // Cracked desert alkali clay & sun-baked sandstone dust
    float sandGrain = (hash(floor(vWorld * 16.0)) - 0.5) * 0.07;
    vec2 crackCell = abs(fract(vWorld * 0.45) - 0.5);
    float crack = smoothstep(0.46, 0.5, max(crackCell.x, crackCell.y));

    vec3 desertSand = vec3(0.76, 0.58, 0.38) + sandGrain;
    desertSand = mix(desertSand, vec3(0.42, 0.28, 0.16), crack * 0.55);

    // Weathered frontier timber boardwalk planks leading to the plaza
    float plazaDist = length(vWorld);
    bool onPlaza = plazaDist < 4.5;
    bool onBoardwalk = vPathDist < 2.5;

    float plankGap = step(0.92, fract(vWorld.y * 1.6));
    float plankTone = hash(vec2(floor(vWorld.y * 1.6), 1.0)) * 0.08;
    vec3 timber = vec3(0.48, 0.32, 0.18) + plankTone;
    timber = mix(timber, vec3(0.16, 0.10, 0.05), plankGap);

    vec3 col = (onPlaza || onBoardwalk) ? timber : desertSand;

    vec3 lin = toLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

function WesternGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFogColor: { value: horizonLinear() },
          uFogNear: { value: WESTERN_FOG.near },
          uFogFar: { value: WESTERN_FOG.far },
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
      userData={{ westernOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────  SAGUARO CACTI, HITCHING POSTS & TUMBLEWEEDS  ────────────── */

function WesternScenery() {
  const tumbleRef = useRef<THREE.Group>(null);
  const cactiGroupRef = useRef<THREE.Group>(null);
  const hitchingPostRef = useRef<THREE.Group>(null);

  const cacti = useMemo(
    () => [
      { pos: [-7.2, 0, 9.5] as [number, number, number], scale: 1.25, rot: 0.3 },
      { pos: [7.6, 0, 8.2] as [number, number, number], scale: 1.1, rot: -0.5 },
      { pos: [-10.5, 0, -5.5] as [number, number, number], scale: 1.4, rot: 0.8 },
      { pos: [11.2, 0, -6.8] as [number, number, number], scale: 1.3, rot: -0.2 },
    ],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;
    if (cactiGroupRef.current) {
      cactiGroupRef.current.children.forEach((child, idx) => {
        const c = cacti[idx];
        if (!c) return;
        child.position.y = -sphereDrop(c.pos[0] - px, c.pos[2] - pz);
      });
    }
    if (hitchingPostRef.current) {
      hitchingPostRef.current.position.y = -sphereDrop(-3.8 - px, 5.2 - pz);
    }
    if (tumbleRef.current) {
      tumbleRef.current.children.forEach((weed, idx) => {
        const cycle = ((t * 2.2 + idx * 9.0) % 28) - 14;
        const wz = 6.5 + idx * 4.5;
        weed.position.x = cycle;
        weed.position.z = wz;
        weed.position.y = 0.45 + Math.abs(Math.sin(t * 4.2 + idx)) * 0.55 - sphereDrop(cycle - px, wz - pz);
        weed.rotation.z = -t * 3.5;
        weed.rotation.x = t * 1.8;
      });
    }
  });

  return (
    <group userData={{ westernOwn: true }}>
      {/* Sculpted Saguaro Cacti */}
      <group ref={cactiGroupRef} userData={{ westernOwn: true }}>
      {cacti.map((c, i) => (
        <group
          key={`cactus-${i}`}
          position={c.pos}
          scale={c.scale}
          rotation={[0, c.rot, 0]}
          userData={{ westernOwn: true }}
        >
          {/* Main trunk */}
          <mesh position={[0, 1.8, 0]} userData={{ westernOwn: true }}>
            <cylinderGeometry args={[0.26, 0.32, 3.6, 8]} />
            <meshLambertMaterial color="#5c5338" />
          </mesh>
          {/* Left arm */}
          <mesh position={[-0.45, 2.0, 0]} rotation={[0, 0, Math.PI / 2]} userData={{ westernOwn: true }}>
            <cylinderGeometry args={[0.18, 0.18, 0.7, 7]} />
            <meshLambertMaterial color="#5c5338" />
          </mesh>
          <mesh position={[-0.75, 2.55, 0]} userData={{ westernOwn: true }}>
            <cylinderGeometry args={[0.18, 0.18, 1.2, 7]} />
            <meshLambertMaterial color="#5c5338" />
          </mesh>
          {/* Right arm */}
          <mesh position={[0.45, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} userData={{ westernOwn: true }}>
            <cylinderGeometry args={[0.17, 0.17, 0.65, 7]} />
            <meshLambertMaterial color="#5c5338" />
          </mesh>
          <mesh position={[0.72, 2.0, 0]} userData={{ westernOwn: true }}>
            <cylinderGeometry args={[0.17, 0.17, 1.1, 7]} />
            <meshLambertMaterial color="#5c5338" />
          </mesh>
        </group>
      ))}
      </group>

      {/* Frontier Timber Hitching Post near the boardwalk */}
      <group ref={hitchingPostRef} position={[-3.8, 0, 5.2]} rotation={[0, 0.25, 0]} userData={{ westernOwn: true }}>
        <mesh position={[-1.1, 0.65, 0]} userData={{ westernOwn: true }}>
          <cylinderGeometry args={[0.12, 0.14, 1.3, 6]} />
          <meshLambertMaterial color="#4a301c" />
        </mesh>
        <mesh position={[1.1, 0.65, 0]} userData={{ westernOwn: true }}>
          <cylinderGeometry args={[0.12, 0.14, 1.3, 6]} />
          <meshLambertMaterial color="#4a301c" />
        </mesh>
        <mesh position={[0, 1.15, 0]} rotation={[0, 0, Math.PI / 2]} userData={{ westernOwn: true }}>
          <cylinderGeometry args={[0.08, 0.08, 2.6, 6]} />
          <meshLambertMaterial color="#5c3d24" />
        </mesh>
      </group>

      {/* Rolling Bouncing Tumbleweeds */}
      <group ref={tumbleRef} userData={{ westernOwn: true }}>
        {[0, 1].map((i) => (
          <mesh key={`tumble-${i}`} userData={{ westernOwn: true }}>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshBasicMaterial color="#6e4e2e" wireframe />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function WesternEnvironment() {
  return (
    <>
      <WesternSkyDome />
      <WesternGround />
      <WesternScenery />
    </>
  );
}
