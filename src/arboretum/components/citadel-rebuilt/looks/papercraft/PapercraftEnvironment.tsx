import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';

export const PAPERCRAFT_HORIZON_SRGB = [0.95, 0.89, 0.78] as const;
export const PAPERCRAFT_FOG = { near: 46, far: 195 } as const;

const horizonLinear = () =>
  new THREE.Color().setRGB(
    PAPERCRAFT_HORIZON_SRGB[0],
    PAPERCRAFT_HORIZON_SRGB[1],
    PAPERCRAFT_HORIZON_SRGB[2],
    THREE.SRGBColorSpace,
  );

/* ──────────────────────  PAPERCRAFT SKY DOME  ────────────────────── */

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

    // Layered construction paper sky bands with drop-shadow seams
    vec3 cream   = vec3(0.96, 0.91, 0.80);
    vec3 apricot = vec3(0.93, 0.65, 0.50);
    vec3 coral   = vec3(0.86, 0.44, 0.36);
    vec3 slate   = vec3(0.24, 0.27, 0.40);

    float wave1 = sin(d.x * 5.0) * 0.025;
    float wave2 = cos(d.z * 6.0) * 0.025;

    vec3 col = cream;
    float shadow = 1.0;

    float b1 = 0.08 + wave1;
    float b2 = 0.24 + wave2;
    float b3 = 0.46 + wave1 * 0.8;

    if (h > b3) {
      col = slate;
      if (h < b3 + 0.015) shadow = 0.82;
    } else if (h > b2) {
      col = coral;
      if (h < b2 + 0.015) shadow = 0.84;
    } else if (h > b1) {
      col = apricot;
      if (h < b1 + 0.015) shadow = 0.86;
    }

    col *= shadow;

    // Cut-paper sun hung on a vertical string
    vec3 sunDir = normalize(vec3(0.28, 0.26, -0.92));
    float sunDist = acos(clamp(dot(d, sunDir), -1.0, 1.0));
    if (sunDist < 0.11) {
      col = vec3(0.99, 0.88, 0.52);
      if (sunDist > 0.098) col = vec3(1.0, 0.97, 0.90); // White paper cut edge
    }

    // Subtle fibrous paper grain
    float grain = (hash(d.xz * 220.0) - 0.5) * 0.04;
    col += grain;

    gl_FragColor = vec4(toLinear(col), 1.0);
  }
`;

function PapercraftSkyDome() {
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
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ papercraftOwn: true }}>
      <sphereGeometry args={[420, 24, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────────  PAPERCRAFT GROUND  ─────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vStepH;
  varying float vPathDist;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.08) * 2.8;
    vPathDist = abs(vWorld.x - pathCenterX);

    // Stepped topographical cardboard contour terraces (kept subtle so overworld assets sit flush)
    float rawH = sin(vWorld.x * 0.065) * cos(vWorld.y * 0.065) * 1.8;
    float innerZone = 1.0 - smoothstep(18.0, 25.0, length(vWorld));
    float pathMask = smoothstep(2.6, 6.5, vPathDist) * smoothstep(3.5, 7.5, length(vWorld));
    float stepped = floor(max(0.0, rawH * pathMask) * 3.0) / 3.0;
    vStepH = stepped;

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y += stepped * innerZone * 0.25 - sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  varying vec2 vWorld;
  varying float vStepH;
  varying float vPathDist;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Layered construction paper sheets (warm sage, olive kraft, cream cardstock)
    vec3 sageCard  = vec3(0.58, 0.72, 0.56);
    vec3 oliveCard = vec3(0.46, 0.60, 0.44);
    vec3 creamCard = vec3(0.95, 0.90, 0.80);
    vec3 kraftPath = vec3(0.84, 0.68, 0.50);

    vec3 turf = mix(oliveCard, sageCard, clamp(vStepH * 0.8 + 0.2, 0.0, 1.0));

    // Topographical paper cut contour lines
    float contour = abs(fract(vStepH * 3.0) - 0.5);
    if (contour < 0.06) {
      turf = creamCard; // Exposed white core of cut matboard
    }

    // Folded origami diamond tiles along the pathway
    float plazaDist = length(vWorld);
    bool onPlaza = plazaDist < 4.5;
    bool onRoad  = vPathDist < 2.5;

    vec2 foldGrid = abs(fract(vWorld * 0.4) - 0.5);
    float crease = smoothstep(0.46, 0.5, max(foldGrid.x, foldGrid.y));
    vec3 roadCol = mix(kraftPath, creamCard, crease * 0.65);

    vec3 col = (onPlaza || onRoad) ? roadCol : turf;

    // White paper-cut border along the road edge
    if ((!onPlaza && abs(plazaDist - 4.5) < 0.16) || (!onPlaza && abs(vPathDist - 2.5) < 0.16)) {
      col = vec3(0.98, 0.95, 0.88);
    }

    // Tactile paper fiber grain
    float grain = (hash(floor(vWorld * 28.0)) - 0.5) * 0.05;
    col += grain;

    vec3 lin = toLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

function PapercraftGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFogColor: { value: horizonLinear() },
          uFogNear: { value: PAPERCRAFT_FOG.near },
          uFogFar: { value: PAPERCRAFT_FOG.far },
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
      userData={{ papercraftOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────  ORIGAMI CRANES & PAPER PINES  ────────────────── */

function PapercraftScenery() {
  const cranesRef = useRef<THREE.Group>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  const paperTrees = useMemo(
    () => [
      { pos: [-5.5, 0, 8.2] as [number, number, number], scale: 1.2, color: '#6b9080' },
      { pos: [5.8, 0, 7.6] as [number, number, number], scale: 1.1, color: '#e07a5f' },
      { pos: [-7.5, 0, -4.2] as [number, number, number], scale: 1.35, color: '#81b29a' },
      { pos: [7.8, 0, -5.0] as [number, number, number], scale: 1.25, color: '#f2cc8f' },
    ],
    [],
  );

  useFrame(({ clock }) => {
    // Charming 10-FPS stop-motion cadence for the origami cranes
    const steppedT = Math.floor(clock.elapsedTime * 10) / 10;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;
    if (treeGroupRef.current) {
      treeGroupRef.current.children.forEach((child, idx) => {
        const tr = paperTrees[idx];
        if (!tr) return;
        child.position.y = -sphereDrop(tr.pos[0] - px, tr.pos[2] - pz);
      });
    }
    if (cranesRef.current) {
      cranesRef.current.children.forEach((crane, idx) => {
        const angle = steppedT * 0.45 + idx * ((Math.PI * 2) / 5);
        const r = 6.2 + (idx % 2) * 1.8;
        const cx = Math.cos(angle) * r;
        const cz = Math.sin(angle) * r;
        crane.position.set(
          cx,
          3.8 + Math.sin(steppedT * 2.2 + idx) * 0.4 - sphereDrop(cx - px, cz - pz),
          cz,
        );
        crane.rotation.y = -angle + Math.PI / 2;
        crane.rotation.z = Math.sin(steppedT * 3.0 + idx) * 0.14;
      });
    }
  });

  return (
    <group userData={{ papercraftOwn: true }}>
      {/* Accordion-Folded Origami Pine Trees */}
      <group ref={treeGroupRef} userData={{ papercraftOwn: true }}>
      {paperTrees.map((t, i) => (
        <group key={`paper-tree-${i}`} position={t.pos} scale={t.scale} userData={{ papercraftOwn: true }}>
          {/* Rolled kraft-paper trunk */}
          <mesh position={[0, 0.9, 0]} userData={{ papercraftOwn: true }}>
            <cylinderGeometry args={[0.18, 0.26, 1.8, 5]} />
            <meshLambertMaterial color="#b08968" flatShading />
          </mesh>
          {/* Tiered 4-sided origami pyramid tiers */}
          {[0, 1, 2].map((tier) => (
            <mesh
              key={tier}
              position={[0, 1.7 + tier * 0.85, 0]}
              rotation={[0, (tier * Math.PI) / 4, 0]}
              userData={{ papercraftOwn: true }}
            >
              <coneGeometry args={[1.35 - tier * 0.28, 1.25, 4]} />
              <meshLambertMaterial color={t.color} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      </group>

      {/* Orbiting Folded Origami Cranes */}
      <group ref={cranesRef} userData={{ papercraftOwn: true }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <group key={`crane-${i}`} userData={{ papercraftOwn: true }}>
            <mesh rotation={[0, 0, Math.PI / 4]} scale={[0.6, 0.15, 0.9]} userData={{ papercraftOwn: true }}>
              <octahedronGeometry args={[0.7, 0]} />
              <meshLambertMaterial
                color={i % 2 === 0 ? '#fdf8ee' : '#e07a5f'}
                flatShading
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function PapercraftEnvironment() {
  return (
    <>
      <PapercraftSkyDome />
      <PapercraftGround />
      <PapercraftScenery />
    </>
  );
}
