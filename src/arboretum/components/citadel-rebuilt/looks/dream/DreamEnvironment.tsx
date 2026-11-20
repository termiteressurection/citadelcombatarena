import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';
import { DREAM_GLSL_NOISE, DREAM_HORIZON_SRGB } from './dreamGlsl';

const horizonLinear = () =>
  new THREE.Color().setRGB(
    DREAM_HORIZON_SRGB[0],
    DREAM_HORIZON_SRGB[1],
    DREAM_HORIZON_SRGB[2],
    THREE.SRGBColorSpace,
  );

/** Match the ground's rolling hill height at any world (x, z) so storybook props sit flush on the hills. */
export function sampleDreamHillY(x: number, z: number): number {
  const pathCenterX = Math.sin(z * 0.09) * 3.2 + (z < 0 ? ( -z * 0.22 ) : 0);
  const distFromPath = Math.abs(x - pathCenterX);
  const distFromAltar = Math.hypot(x, z);
  const pathFlat = THREE.MathUtils.smoothstep(distFromPath, 2.4, 7.5);
  const altarFlat = THREE.MathUtils.smoothstep(distFromAltar, 3.2, 8.5);
  const innerZone = 1.0 - THREE.MathUtils.smoothstep(distFromAltar, 20.0, 27.0);
  const mask = Math.min(pathFlat, altarFlat) * innerZone;
  const h1 = Math.sin(x * 0.075 + 0.8) * Math.cos(z * 0.065 + 0.4) * 2.2;
  const h2 = Math.sin(x * 0.16 - z * 0.12 + 1.7) * 0.85;
  return Math.max(0, (h1 + h2 + 1.1) * 0.75) * mask;
}

/* ─────────────────────────────  SKY  ───────────────────────────── */

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
  ${DREAM_GLSL_NOISE}

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    vec3 horizon = vec3(${DREAM_HORIZON_SRGB.map((n) => n.toFixed(3)).join(', ')});
    vec3 mid = vec3(0.92, 0.72, 0.86);
    vec3 top = vec3(0.62, 0.56, 0.82);

    vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.24, h));
    col = mix(col, top, smoothstep(0.18, 0.82, h));
    col = mix(col, horizon, smoothstep(0.0, -0.15, h));

    // Warm golden-rose sunlight wash
    vec3 sunDir = normalize(vec3(0.38, 0.24, -0.88));
    float sd = max(dot(d, sunDir), 0.0);
    col += vec3(1.0, 0.82, 0.62) * pow(sd, 6.0) * 0.48;
    col += vec3(1.0, 0.95, 0.86) * pow(sd, 90.0) * 0.65;

    // Painterly lavender & cream clouds (2 noise taps instead of 8 FBM octaves)
    vec2 cuv = d.xz / (abs(d.y) + 0.30) * 0.85 + vec2(uTime * 0.005, uTime * 0.002);
    float c = dNoise(cuv * 1.5);
    float c2 = dNoise(cuv * 3.4 + 7.0);
    float cloud = smoothstep(0.36, 0.72, c * 0.65 + c2 * 0.35) * smoothstep(0.01, 0.26, h);
    col = mix(col, vec3(1.0, 0.94, 0.96), cloud * 0.72);
    col = mix(col, vec3(0.84, 0.68, 0.86), cloud * (1.0 - c2) * 0.32);

    // Twinkling dream-stars in the upper haze
    vec2 sp = d.xz / (abs(d.y) + 0.55) * 38.0;
    vec2 cell = floor(sp);
    float rnd = dHash(cell);
    float tw = step(0.952, rnd) * smoothstep(0.16, 0.0, length(fract(sp) - 0.5));
    tw *= 0.55 + 0.45 * sin(uTime * 1.5 + rnd * 40.0);
    col += vec3(1.0, 0.97, 0.88) * tw * smoothstep(0.06, 0.42, h) * 0.95;

    gl_FragColor = vec4(dreamToLinear(col), 1.0);
  }
`;

function DreamSkyDome() {
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
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ dreamOwn: true }}>
      <sphereGeometry args={[420, 28, 18]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ───────────────────────────  GROUND  ──────────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vHill;
  varying float vPathDist;

  float hillAt(vec2 w) {
    float pathCenterX = sin(w.y * 0.09) * 3.2 + (w.y < 0.0 ? (-w.y * 0.22) : 0.0);
    float distFromPath = abs(w.x - pathCenterX);
    float distFromAltar = length(w);
    float pathFlat = smoothstep(2.4, 7.5, distFromPath);
    float altarFlat = smoothstep(3.2, 8.5, distFromAltar);
    float innerZone = 1.0 - smoothstep(20.0, 27.0, distFromAltar);
    float mask = min(pathFlat, altarFlat) * innerZone;
    float h1 = sin(w.x * 0.075 + 0.8) * cos(w.y * 0.065 + 0.4) * 2.2;
    float h2 = sin(w.x * 0.16 - w.y * 0.12 + 1.7) * 0.85;
    return max(0.0, (h1 + h2 + 1.1) * 0.75) * mask;
  }

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.09) * 3.2 + (vWorld.y < 0.0 ? (-vWorld.y * 0.22) : 0.0);
    vPathDist = abs(vWorld.x - pathCenterX);
    float hill = hillAt(vWorld);
    vHill = hill;

    // Match Citadel globe curvature around player position so distant objects stay anchored
    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y += hill - sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vHill;
  varying float vPathDist;
  ${DREAM_GLSL_NOISE}

  void main() {
    // 3 lightweight single-octave noise lookups instead of 13 FBM lookups
    float n1 = dNoise(vWorld * 0.08);
    float n2 = dNoise(vWorld * 0.24 + 3.7);
    float brush = dNoise(vec2(vWorld.x * 0.85 + n2 * 1.8, vWorld.y * 0.35));

    // Lush painterly meadow greens (deep olive-moss in dips, bright sunlit chartreuse on crests)
    vec3 mossDark = vec3(0.32, 0.48, 0.24);
    vec3 meadowMid = vec3(0.54, 0.76, 0.34);
    vec3 sunlitLime = vec3(0.76, 0.90, 0.42);
    vec3 lavenderShadow = vec3(0.56, 0.46, 0.64);

    vec3 grass = mix(mossDark, meadowMid, smoothstep(0.22, 0.72, n1));
    grass = mix(grass, sunlitLime, smoothstep(0.35, 1.8, vHill + n2 * 0.65));
    grass = mix(grass, lavenderShadow, smoothstep(0.62, 0.88, n2) * 0.28);
    grass *= 0.88 + 0.24 * brush;

    // Winding cream & warm sandstone flagstone pathway (inspired by Dreams screenshot)
    float wobble = (n2 - 0.5) * 0.85;
    float onPath = 1.0 - smoothstep(2.1, 3.1, vPathDist + wobble);
    float altarPlaza = 1.0 - smoothstep(3.2, 4.6, length(vWorld) + wobble * 0.6);
    float stoneMask = max(onPath, altarPlaza);

    vec3 stoneCream = vec3(0.95, 0.89, 0.82);
    vec3 stoneRose = vec3(0.86, 0.76, 0.78);
    vec3 stoneShadow = vec3(0.70, 0.58, 0.66);
    float stepLine = smoothstep(0.06, 0.0, abs(fract(vWorld.y * 0.38 + n1 * 0.25) - 0.5));
    vec3 stone = mix(stoneRose, stoneCream, smoothstep(0.28, 0.75, brush));
    stone = mix(stone, stoneShadow, stepLine * 0.35);
    // Soft mossy border transition along the stone edge
    float edgeBand = smoothstep(1.6, 2.7, vPathDist + wobble) * onPath;
    stone = mix(stone, vec3(0.64, 0.54, 0.66), edgeBand * 0.45);

    vec3 col = mix(grass, stone, stoneMask);

    // Wildflower clusters along the meadow border (red, yellow, cyan-blue, pink)
    vec2 fp = vWorld * 2.2;
    vec2 fid = floor(fp);
    float fr = dHash(fid);
    float nearBorder = smoothstep(1.8, 3.2, vPathDist) * (1.0 - smoothstep(3.2, 9.5, vPathDist));
    float fl = step(0.94 - nearBorder * 0.08, fr) * smoothstep(0.24, 0.06, length(fract(fp) - 0.5)) * (1.0 - stoneMask);
    float cPick = dHash(fid + 13.7);
    vec3 fc = cPick < 0.28
      ? vec3(0.98, 0.32, 0.36)
      : (cPick < 0.58 ? vec3(1.0, 0.86, 0.24) : (cPick < 0.82 ? vec3(0.38, 0.74, 1.0) : vec3(1.0, 0.54, 0.82)));
    col = mix(col, fc, fl);

    vec3 lin = dreamToLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

export const DREAM_FOG = { near: 42, far: 190 } as const;

function DreamGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFogColor: { value: horizonLinear() },
          uFogNear: { value: DREAM_FOG.near },
          uFogFar: { value: DREAM_FOG.far },
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
      userData={{ dreamOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────  STORYBOOK SCENERY & IMP  ─────────────────── */

function DreamStorybookScenery() {
  const impRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.Group>(null);
  const bushGroupRef = useRef<THREE.Group>(null);
  const treeGroupRef = useRef<THREE.Group>(null);
  const cottageGroupRef = useRef<THREE.Group>(null);

  // Fluffy painterly bushes along both sides of the winding stone path
  const bushClusters = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; color: string; topColor: string }[] = [
      // Left foreground & mid-ground lush border
      { pos: [-4.2, 0, 12.5], scale: [1.8, 1.15, 1.6], color: '#567d38', topColor: '#9cd654' },
      { pos: [-3.3, 0, 9.8], scale: [1.4, 0.95, 1.3], color: '#658f42', topColor: '#b0e266' },
      { pos: [-4.8, 0, 7.2], scale: [2.1, 1.35, 1.8], color: '#4d7032', topColor: '#8ec94a' },
      { pos: [-3.6, 0, 4.2], scale: [1.5, 1.0, 1.4], color: '#689444', topColor: '#ace060' },
      { pos: [-5.5, 0, 1.0], scale: [2.0, 1.25, 1.7], color: '#527836', topColor: '#98d252' },
      { pos: [-6.4, 0, -4.5], scale: [2.2, 1.4, 1.9], color: '#4c6e34', topColor: '#8cc44c' },
      // Right foreground & pathway curve toward cottage
      { pos: [2.6, 0, 12.8], scale: [1.6, 1.05, 1.5], color: '#5c853c', topColor: '#a4dc5c' },
      { pos: [1.8, 0, 10.2], scale: [1.35, 0.9, 1.25], color: '#6b9646', topColor: '#b4e66a' },
      { pos: [3.8, 0, 7.6], scale: [1.9, 1.2, 1.6], color: '#507534', topColor: '#94ce50' },
      { pos: [4.6, 0, 3.8], scale: [1.7, 1.1, 1.5], color: '#5e883e', topColor: '#a2da5a' },
      { pos: [6.2, 0, -1.5], scale: [2.1, 1.3, 1.8], color: '#4e7234', topColor: '#8ec84e' },
      { pos: [7.8, 0, -5.8], scale: [1.6, 1.05, 1.5], color: '#628c40', topColor: '#a8de60' },
    ];
    return list.map((b) => ({
      ...b,
      pos: [b.pos[0], sampleDreamHillY(b.pos[0], b.pos[2]), b.pos[2]] as [number, number, number],
    }));
  }, []);

  // Sculptural cypress/poplar trees on the hills (matching the clusters in the Dreams screenshot)
  const cypressTrees = useMemo(() => {
    const raw: { x: number; z: number; h: number; r: number; tint: string }[] = [
      // Left hill trio
      { x: -10.5, z: -4.5, h: 6.2, r: 1.55, tint: '#63566e' },
      { x: -13.2, z: -6.2, h: 7.4, r: 1.75, tint: '#586456' },
      { x: -8.4, z: -7.8, h: 5.4, r: 1.35, tint: '#6d5e78' },
      // Mid-background trio behind the path
      { x: -2.8, z: -14.5, h: 5.8, r: 1.3, tint: '#786886' },
      { x: -0.9, z: -15.8, h: 6.8, r: 1.45, tint: '#6c5e7c' },
      { x: 1.2, z: -14.8, h: 5.2, r: 1.25, tint: '#7e6e8c' },
      // Right hill trees behind cottage
      { x: 14.8, z: -12.5, h: 8.2, r: 2.1, tint: '#5a6258' },
      { x: 17.5, z: -9.2, h: 6.8, r: 1.7, tint: '#685c74' },
    ];
    return raw.map((t) => ({
      ...t,
      y: sampleDreamHillY(t.x, t.z),
    }));
  }, []);

  const cottagePos = useMemo<[number, number, number]>(() => {
    const x = 9.5;
    const z = -9.2;
    return [x, sampleDreamHillY(x, z), z];
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;
    if (bushGroupRef.current) {
      bushGroupRef.current.children.forEach((child, idx) => {
        const b = bushClusters[idx];
        if (!b) return;
        child.position.y = b.pos[1] - sphereDrop(b.pos[0] - px, b.pos[2] - pz);
      });
    }
    if (treeGroupRef.current) {
      treeGroupRef.current.children.forEach((child, idx) => {
        const tr = cypressTrees[idx];
        if (!tr) return;
        child.position.y = tr.y - sphereDrop(tr.x - px, tr.z - pz);
      });
    }
    if (cottageGroupRef.current) {
      cottageGroupRef.current.position.y = cottagePos[1] - sphereDrop(cottagePos[0] - px, cottagePos[2] - pz);
    }
    if (impRef.current) {
      const impDrop = sphereDrop(-3.2 - px, 7.2 - pz);
      impRef.current.position.y = 3.2 + Math.sin(t * 2.1) * 0.28 - impDrop;
      impRef.current.rotation.y = 0.35 + Math.sin(t * 0.9) * 0.18;
      impRef.current.rotation.z = Math.sin(t * 1.4) * 0.06;
    }
    if (smokeRef.current) {
      smokeRef.current.children.forEach((puff, i) => {
        const phase = (t * 0.45 + i * 0.33) % 1;
        puff.position.y = phase * 4.2;
        puff.position.x = Math.sin(t * 0.8 + i) * 0.35 * phase;
        const s = 0.35 + phase * 0.65;
        puff.scale.setScalar(s);
      });
    }
  });

  return (
    <group userData={{ dreamOwn: true }}>
      {/* Fluffy Dual-Tone Meadow Bushes */}
      <group ref={bushGroupRef} userData={{ dreamOwn: true }}>
      {bushClusters.map((b, i) => (
        <group key={`dream-bush-${i}`} position={b.pos} userData={{ dreamOwn: true }}>
          <mesh position={[0, 0.38 * b.scale[1], 0]} scale={b.scale} userData={{ dreamOwn: true }}>
            <icosahedronGeometry args={[0.85, 1]} />
            <meshLambertMaterial color={b.color} />
          </mesh>
          <mesh
            position={[0.12, 0.62 * b.scale[1], 0.08]}
            scale={[b.scale[0] * 0.82, b.scale[1] * 0.72, b.scale[2] * 0.82]}
            userData={{ dreamOwn: true }}
          >
            <icosahedronGeometry args={[0.8, 1]} />
            <meshLambertMaterial
              color={b.topColor}
              emissive={b.topColor}
              emissiveIntensity={0.18}
            />
          </mesh>
        </group>
      ))}
      </group>

      {/* Sculptural Painterly Cypress Trees */}
      <group ref={treeGroupRef} userData={{ dreamOwn: true }}>
      {cypressTrees.map((t, i) => (
        <group key={`dream-tree-${i}`} position={[t.x, t.y, t.z]} userData={{ dreamOwn: true }}>
          {/* Trunk */}
          <mesh position={[0, 0.7, 0]} userData={{ dreamOwn: true }}>
            <cylinderGeometry args={[0.18, 0.28, 1.6, 6]} />
            <meshLambertMaterial color="#5c4238" />
          </mesh>
          {/* Lower foliage puff */}
          <mesh position={[0, t.h * 0.48, 0]} scale={[t.r, t.h * 0.46, t.r]} userData={{ dreamOwn: true }}>
            <icosahedronGeometry args={[1, 1]} />
            <meshLambertMaterial color={t.tint} />
          </mesh>
          {/* Upper sunlit crown */}
          <mesh
            position={[0.1, t.h * 0.74, 0.08]}
            scale={[t.r * 0.76, t.h * 0.36, t.r * 0.76]}
            userData={{ dreamOwn: true }}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshLambertMaterial
              color="#8e829c"
              emissive="#f3c6d8"
              emissiveIntensity={0.12}
            />
          </mesh>
        </group>
      ))}
      </group>

      {/* Cozy Storybook Cottage (Right Hillside, as in the Dreams reference image) */}
      <group ref={cottageGroupRef} position={cottagePos} rotation={[0, -0.48, 0]} userData={{ dreamOwn: true }}>
        {/* Plaster cottage walls */}
        <mesh position={[0, 1.35, 0]} userData={{ dreamOwn: true }}>
          <boxGeometry args={[3.8, 2.7, 3.2]} />
          <meshLambertMaterial color="#f2cbb8" emissive="#e8a598" emissiveIntensity={0.1} />
        </mesh>
        {/* Warm pitched roof */}
        <mesh position={[0, 3.45, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.18, 0.85, 1.05]} userData={{ dreamOwn: true }}>
          <coneGeometry args={[3.1, 2.2, 4]} />
          <meshLambertMaterial color="#7c4d59" />
        </mesh>
        {/* Red wooden front door */}
        <mesh position={[-0.5, 0.95, 1.62]} userData={{ dreamOwn: true }}>
          <boxGeometry args={[0.78, 1.75, 0.1]} />
          <meshLambertMaterial color="#d93848" emissive="#b82535" emissiveIntensity={0.18} />
        </mesh>
        {/* Glowing cottage window */}
        <mesh position={[0.85, 1.35, 1.62]} userData={{ dreamOwn: true }}>
          <boxGeometry args={[0.72, 0.72, 0.1]} />
          <meshBasicMaterial color="#ffe89e" />
        </mesh>
        {/* Chimney + drifting pastel smoke puffs */}
        <mesh position={[1.1, 3.9, -0.5]} userData={{ dreamOwn: true }}>
          <cylinderGeometry args={[0.26, 0.32, 1.6, 6]} />
          <meshLambertMaterial color="#9e6b74" />
        </mesh>
        <group ref={smokeRef} position={[1.1, 4.8, -0.5]} userData={{ dreamOwn: true }}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} userData={{ dreamOwn: true }}>
              <dodecahedronGeometry args={[0.38, 0]} />
              <meshBasicMaterial color="#fbe4ee" transparent opacity={0.45} depthWrite={false} />
            </mesh>
          ))}
        </group>
        {/* Rustic wooden fence beside the cottage */}
        {[-3.4, -2.5, -1.6, 2.4, 3.3].map((fx, idx) => (
          <mesh key={`fence-post-${idx}`} position={[fx, 0.55, 1.9]} rotation={[0, 0, (idx % 2 - 0.5) * 0.08]} userData={{ dreamOwn: true }}>
            <boxGeometry args={[0.16, 1.1, 0.16]} />
            <meshLambertMaterial color="#593a38" />
          </mesh>
        ))}
        <mesh position={[-2.5, 0.72, 1.9]} userData={{ dreamOwn: true }}>
          <boxGeometry args={[2.1, 0.12, 0.1]} />
          <meshLambertMaterial color="#6b4642" />
        </mesh>
        <mesh position={[2.85, 0.72, 1.9]} userData={{ dreamOwn: true }}>
          <boxGeometry args={[1.2, 0.12, 0.1]} />
          <meshLambertMaterial color="#6b4642" />
        </mesh>
      </group>

      {/* Floating Green Dream Imp Companion (with halo ring & expressive eyes) */}
      <group ref={impRef} position={[-3.2, 3.2, 7.2]} userData={{ dreamOwn: true }}>
        {/* Fuzzy emerald-mint body */}
        <mesh userData={{ dreamOwn: true }}>
          <icosahedronGeometry args={[0.68, 2]} />
          <meshLambertMaterial
            color="#2ee682"
            emissive="#18b862"
            emissiveIntensity={0.35}
          />
        </mesh>
        {/* Soft outer fuzz aura */}
        <mesh scale={1.14} userData={{ dreamOwn: true }}>
          <icosahedronGeometry args={[0.68, 1]} />
          <meshBasicMaterial
            color="#7affb2"
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
        {/* Topknot stem */}
        <mesh position={[0, 0.88, 0]} userData={{ dreamOwn: true }}>
          <cylinderGeometry args={[0.04, 0.09, 0.55, 6]} />
          <meshLambertMaterial color="#2ee682" emissive="#18b862" emissiveIntensity={0.3} />
        </mesh>
        {/* Imp halo ring above antenna */}
        <mesh position={[0, 1.38, 0]} userData={{ dreamOwn: true }}>
          <torusGeometry args={[0.28, 0.025, 10, 28]} />
          <meshBasicMaterial color="#5ef2c8" />
        </mesh>
        {/* Left & Right Eyes */}
        <mesh position={[-0.22, 0.08, 0.60]} userData={{ dreamOwn: true }}>
          <sphereGeometry args={[0.095, 12, 12]} />
          <meshBasicMaterial color="#18121e" />
        </mesh>
        <mesh position={[0.22, 0.08, 0.60]} userData={{ dreamOwn: true }}>
          <sphereGeometry args={[0.095, 12, 12]} />
          <meshBasicMaterial color="#18121e" />
        </mesh>
        {/* Eye specular highlights */}
        <mesh position={[-0.19, 0.12, 0.68]} userData={{ dreamOwn: true }}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.25, 0.12, 0.68]} userData={{ dreamOwn: true }}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Little happy mouth */}
        <mesh position={[0, -0.06, 0.63]} rotation={[0.2, 0, Math.PI]} userData={{ dreamOwn: true }}>
          <torusGeometry args={[0.09, 0.024, 8, 16, Math.PI]} />
          <meshBasicMaterial color="#d9385a" />
        </mesh>
      </group>
    </group>
  );
}

/* ──────────────────────────  SPARKLES  ─────────────────────────── */

const SPARKLE_COUNT = 220;
const SPARKLE_SPAN = 80;

const SPARKLE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform vec3 uCenter;
  varying float vSeed;
  varying float vTwinkle;

  void main() {
    vec3 p = position;
    float rise = uTime * (0.25 + 0.4 * aSeed);
    p.y = mod(position.y + rise, 24.0);
    vec2 rel = mod(position.xz - uCenter.xz + ${(SPARKLE_SPAN / 2).toFixed(1)}, ${SPARKLE_SPAN.toFixed(1)}) - ${(SPARKLE_SPAN / 2).toFixed(1)};
    vec3 world = vec3(
      uCenter.x + rel.x + sin(uTime * 0.3 + aSeed * 20.0) * 0.9,
      p.y,
      uCenter.z + rel.y + cos(uTime * 0.27 + aSeed * 31.0) * 0.9
    );
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = 0.08 + aSeed * 0.14;
    gl_PointSize = size * projectionMatrix[1][1] * uScale / max(-mv.z, 0.1);
    vSeed = aSeed;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 50.0);
  }
`;

const SPARKLE_FRAG = /* glsl */ `
  varying float vSeed;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a * vTwinkle;
    vec3 warm = vec3(1.0, 0.90, 0.64);
    vec3 pink = vec3(1.0, 0.76, 0.90);
    vec3 white = vec3(1.0, 0.98, 0.95);
    vec3 col = vSeed < 0.45 ? warm : (vSeed < 0.78 ? pink : white);
    gl_FragColor = vec4(pow(col, vec3(2.2)) * a, a);
  }
`;

function DreamSparkles() {
  const gl = useThree((s) => s.gl);
  const sizeVec = useMemo(() => new THREE.Vector2(), []);
  const geometry = useMemo(() => {
    const pos = new Float32Array(SPARKLE_COUNT * 3);
    const seed = new Float32Array(SPARKLE_COUNT);
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPARKLE_SPAN * 4;
      pos[i * 3 + 1] = Math.random() * 24;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPARKLE_SPAN * 4;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 500 },
          uCenter: { value: new THREE.Vector3() },
        },
        vertexShader: SPARKLE_VERT,
        fragmentShader: SPARKLE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uCenter.value.copy(camera.position);
    gl.getDrawingBufferSize(sizeVec);
    material.uniforms.uScale.value = sizeVec.y * 0.5;
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={50}
      userData={{ dreamOwn: true }}
    />
  );
}

/** Sky, sculpted rolling meadow, storybook cottage, floating imp, and sparkle dust for the Dream look. */
export function DreamEnvironment() {
  return (
    <>
      <DreamSkyDome />
      <DreamGround />
      <DreamStorybookScenery />
      <DreamSparkles />
    </>
  );
}
